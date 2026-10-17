package supervisor

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"raincough/internal/pluginrt"
	"raincough/internal/pluginx"
	"raincough/internal/shared"
)

// Options 启动参数。
type Options struct {
	PluginsDir  string        // 插件根目录
	LogDir      string        // 日志目录(默认 <DataDir>/log)
	RestartMax  int           // 单插件连续崩溃上限(超过则 Crashed)
	BackoffBase time.Duration // 初次 backoff(下个 backoff = min(base*2^idx, max))
	BackoffMax  time.Duration // backoff 上限
	StartGrace  time.Duration // 启动到判崩的宽限秒数(期间不算 crash)
	UDSDir      string        // 透传给 RC_REG_TOKEN 之外的 env(通常 pluginx 已自管)
}

// Supervisor 进程级 supervisor。
// 责任: 扫描插件目录, 让 autostart=true 的常驻; 提供 start/stop/restart;
// 子进程崩了按 backoff 重启(计数到 RestartMax 暂停)。
type Supervisor struct {
	opts Options
	sd   *shared.Shared // 可为 nil: 内存模式, autostart 配置不持久化

	mu            sync.Mutex
	procs         map[string]*Proc // 按 name 索引
	autostartBoot map[string]bool  // loadAutostart 阶段填入, scanAll upsert 读取
	// depsChecked Python 依赖自检已跑过的插件(每个进程生命周期只查一次)
	depsChecked map[string]bool
}

// checkPythonDepsOnce 启动前查一次 Python 依赖(缺包时打可操作日志)。
func (s *Supervisor) checkPythonDepsOnce(p *Proc, pythonBin string) {
	s.mu.Lock()
	if s.depsChecked == nil {
		s.depsChecked = map[string]bool{}
	}
	if s.depsChecked[p.Name] {
		s.mu.Unlock()
		return
	}
	s.depsChecked[p.Name] = true
	s.mu.Unlock()

	// 读 plugin.json 的 requirements
	raw, err := os.ReadFile(filepath.Join(p.Dir, "plugin.json"))
	if err != nil {
		return
	}
	var mf struct {
		Requirements []string `json:"requirements"`
	}
	if json.Unmarshal(raw, &mf) != nil || len(mf.Requirements) == 0 {
		return
	}
	miss, err := pluginrt.CheckPythonModules(pythonBin, mf.Requirements)
	if err != nil {
		log.Printf("[supervisor] %s 依赖检查跳过: %v", p.Name, err)
		return
	}
	if len(miss) == 0 {
		return
	}
	log.Printf("[supervisor] %s 缺少 Python 依赖: %s —— 插件可能启动即崩, 请执行: %s -m pip install %s",
		p.Name, strings.Join(miss, ", "), pythonBin, strings.Join(miss, " "))
}

// New 创建 supervisor。sd=nil 时 autostart 仅内存缓存(重启失效)。
func New(opts Options, sd *shared.Shared) *Supervisor {
	if opts.LogDir == "" {
		opts.LogDir = filepath.Join(opts.PluginsDir, "..", "logs")
	}
	if opts.RestartMax <= 0 {
		opts.RestartMax = 5
	}
	if opts.BackoffBase <= 0 {
		opts.BackoffBase = time.Second
	}
	if opts.BackoffMax <= 0 {
		opts.BackoffMax = 30 * time.Second
	}
	if opts.StartGrace <= 0 {
		opts.StartGrace = 5 * time.Second
	}
	return &Supervisor{
		opts:          opts,
		sd:            sd,
		procs:         map[string]*Proc{},
		autostartBoot: map[string]bool{},
	}
}

// Start 扫描目录 + 拉起 autostart 插件(不等待握手)。幂等: 二次调用 noop。
func (s *Supervisor) Start() error {
	if err := os.MkdirAll(s.opts.LogDir, 0o755); err != nil {
		return fmt.Errorf("日志目录失败: %w", err)
	}
	s.loadAutostart()
	s.scanAll()

	// 配置里写明 autostart=true 的, 启动后立刻拉起
	toSpawn := []*Proc{}
	s.mu.Lock()
	for _, p := range s.procs {
		if p.Autostart {
			toSpawn = append(toSpawn, p)
		}
	}
	s.mu.Unlock()
	for _, p := range toSpawn {
		_ = s.spawn(p, "autostart")
	}
	return nil
}

// Shutdown 对所有运行中插件发 SIGTERM, 5 秒宽限后 SIGKILL。
func (s *Supervisor) Shutdown() {
	s.mu.Lock()
	procs := make([]*Proc, 0, len(s.procs))
	for _, p := range s.procs {
		procs = append(procs, p)
	}
	s.mu.Unlock()
	for _, p := range procs {
		s.stopLocked(p, "shutdown")
	}
	deadline := time.Now().Add(7 * time.Second)
	for time.Now().Before(deadline) {
		all := true
		s.mu.Lock()
		for _, p := range s.procs {
			p.mu.Lock()
			if p.cmd != nil || p.state == StateBackoff || p.state == StateStarting {
				all = false
			}
			p.mu.Unlock()
			if !all {
				break
			}
		}
		s.mu.Unlock()
		if all {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
}

// ---- 公共接口 ----

// StartPlugin 启动插件(若已 running 则 noop 返 ok)。综合锁: 先看 st, 再决策。
func (s *Supervisor) StartPlugin(name string) error {
	s.mu.Lock()
	p, ok := s.procs[name]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("插件目录未注册: %s", name)
	}
	p.mu.Lock()
	if p.cmd != nil && p.cmd.Process != nil {
		st := p.state
		p.mu.Unlock()
		if st == StateRunning || st == StateStarting {
			return nil
		}
	}
	// 清掉之前的 stopCh(若已 close 则新建一个)
	p.mu.Unlock()
	p.stopOnce = sync.Once{}
	p.mu.Lock()
	p.stopCh = make(chan struct{})
	p.crashCount = 0
	p.backoffIdx = 0
	p.state = StateStopped
	p.pid = 0
	p.stopReason = ""
	p.mu.Unlock()
	return s.spawn(p, "manual")
}

// RemovePlugin 卸载插件: 先停进程, 再从 supervisor 记录里删掉。
//
// 为什么必须显式删记录: 卸掉目录后若只 Rescan(), procs 表里的旧条目会一直留着,
// 服务列表里那个插件永远显示 "running/stopped", 用户以为卸载失败
// (2026-10-17 实测: echopi 目录已删, /api/services/list 仍报 state=running)。
//
// 进程未启动时也安全(直接删记录)。返回 nil 表示记录原本就不存在(不视为错误)。
func (s *Supervisor) RemovePlugin(name string) error {
	s.mu.Lock()
	p, ok := s.procs[name]
	s.mu.Unlock()
	if !ok {
		return nil
	}
	// 先停: 目录马上要被删, 不能让进程还在跑(否则会有孤儿进程持有已删文件)
	s.stopLocked(p, "removed")
	// 等它退干净(最多 6s), 避免紧接着的 spawn/rename 撞上
	deadline := time.Now().Add(6 * time.Second)
	for time.Now().Before(deadline) {
		p.mu.Lock()
		st, hasCmd := p.state, p.cmd != nil
		p.mu.Unlock()
		if st == StateStopped && !hasCmd {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	s.mu.Lock()
	delete(s.procs, name)
	s.mu.Unlock()
	// 清掉 autostart / 运行态持久化, 否则重启后面板上还会冒出来
	s.clearPersisted(name)
	return nil
}

// clearPersisted 把该插件从持久化的 autostart 表里抹掉并立刻落盘。
//
// 注意: autostart 是**整张 map** 存在一个键里(autoKey), 不是按插件分键,
// 所以不能简单 Delete("autostart:"+name) —— 必须重写整张表, 否则下一轮
// persistAutostart 又会按内存重建, 插件删了却还在表里。
func (s *Supervisor) clearPersisted(name string) {
	_ = name
	if err := s.persistAutostart(); err != nil {
		log.Printf("[supervisor] 清理 autostart 记录失败: %v", err)
	}
}

// StopPlugin 发 SIGTERM, 5s 后 SIGKILL。stopReason 写 "user"。
func (s *Supervisor) StopPlugin(name string) error {
	s.mu.Lock()
	p, ok := s.procs[name]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("插件未注册: %s", name)
	}
	s.stopLocked(p, "user")
	return nil
}

// RestartPlugin 等价 stop + 重新拉(清理崩溃计数)。
func (s *Supervisor) RestartPlugin(name string) error {
	if err := s.StopPlugin(name); err != nil {
		return err
	}
	// 等待退到 stopped, 最多 6s
	deadline := time.Now().Add(6 * time.Second)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		p := s.procs[name]
		s.mu.Unlock()
		if p == nil {
			return fmt.Errorf("插件未注册: %s", name)
		}
		p.mu.Lock()
		st := p.state
		hasCmd := p.cmd != nil
		p.mu.Unlock()
		if st == StateStopped && !hasCmd {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	s.mu.Lock()
	p := s.procs[name]
	s.mu.Unlock()
	if p == nil {
		return fmt.Errorf("插件未注册: %s", name)
	}
	return s.StartPlugin(name)
}

// SetAutostart 切换 autostart 标志并写盘(内存模式仅改标志)。
func (s *Supervisor) SetAutostart(name string, on bool) error {
	s.mu.Lock()
	p, ok := s.procs[name]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("插件未注册: %s", name)
	}
	p.Autostart = on
	s.mu.Unlock()
	return s.persistAutostart()
}

// List 返回所有已注册进程视图(顺序: 按名字)。
func (s *Supervisor) List() []Snapshot {
	s.mu.Lock()
	out := make([]Snapshot, 0, len(s.procs))
	for _, p := range s.procs {
		out = append(out, p.snapshot())
	}
	s.mu.Unlock()
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// View 返回单插件视图。
func (s *Supervisor) View(name string) (Snapshot, error) {
	s.mu.Lock()
	p, ok := s.procs[name]
	s.mu.Unlock()
	if !ok {
		return Snapshot{}, fmt.Errorf("插件未注册: %s", name)
	}
	return p.snapshot(), nil
}

// Tail 返回日志后 N 行, 支持 grep。
func (s *Supervisor) Tail(name string, lines int, grep string) (string, error) {
	s.mu.Lock()
	p, ok := s.procs[name]
	s.mu.Unlock()
	if !ok {
		return "", fmt.Errorf("插件未注册: %s", name)
	}
	if lines <= 0 {
		lines = 200
	}
	f, err := os.Open(p.LogPath)
	if err != nil {
		return "", nil
	}
	defer f.Close()
	// 行式 + 翻转
	type L struct {
		s string
	}
	all := make([]L, 0, lines*2)
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for sc.Scan() {
		all = append(all, L{sc.Text()})
	}
	start := 0
	if len(all) > lines {
		start = len(all) - lines
	}
	picked := all[start:]
	out := make([]string, 0, len(picked))
	for _, l := range picked {
		if grep != "" && !strings.Contains(l.s, grep) {
			continue
		}
		out = append(out, l.s)
	}
	return strings.Join(out, "\n"), nil
}

// ConnSeen 供 PluginX 调用(插件握手成功后置位)。这样 supervisor 视图能显示「已握手」。
func (s *Supervisor) ConnSeen(name string) {
	s.mu.Lock()
	p, ok := s.procs[name]
	s.mu.Unlock()
	if !ok {
		return
	}
	p.mu.Lock()
	p.connSeen = true
	p.connSeenAt = time.Now()
	if p.state == StateStarting {
		p.state = StateRunning
	}
	p.mu.Unlock()
}

// ConnLost 插件连接断开时调用; 不影响 Running 标志(因为进程可能还在)。
// 真正崩了由 cmd.Wait 协程检测 exit code。
func (s *Supervisor) ConnLost(name string) {
	s.mu.Lock()
	p, ok := s.procs[name]
	s.mu.Unlock()
	if !ok {
		return
	}
	p.mu.Lock()
	p.connSeen = false
	p.mu.Unlock()
}

// ---- 内部 ----

// scanAll 扫描插件目录, 解析 manifest.backend.exec, 注入或不注入 proc。
// 已经在 procs 表里的不重建; cmd 状态保留(支持运行期 install/uninstall)。
func (s *Supervisor) scanAll() {
	if s.opts.PluginsDir == "" {
		return
	}
	entries, err := os.ReadDir(s.opts.PluginsDir)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("[supervisor] scanAll 读目录失败 %s: %v", s.opts.PluginsDir, err)
		}
		return
	}
	seen := map[string]bool{}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		seen[e.Name()] = true
		m, err := pluginx.LoadManifestV4(filepath.Join(s.opts.PluginsDir, e.Name()))
		if err != nil || m == nil || len(m.Backend.Exec) == 0 {
			continue
		}
		s.upsertFromManifest(e.Name(), m)
	}
	// 移除已不存在的: stopReason 标记 + 交给 waitAndReact 收尾
	s.mu.Lock()
	defer s.mu.Unlock()
	for n, p := range s.procs {
		if !seen[n] {
			log.Printf("[supervisor] 插件目录消失, 仅标记: %s", n)
			p.mu.Lock()
			if p.stopReason == "" {
				p.stopReason = "目录被卸载"
			}
			p.mu.Unlock()
		}
	}
}

// Rescan 运行期新增/重装后调用。新插件按 autostart=true 自动起。
func (s *Supervisor) Rescan() {
	before := map[string]bool{}
	s.mu.Lock()
	for n := range s.procs {
		before[n] = true
	}
	s.mu.Unlock()
	s.scanAll()

	// ★ 自愈: 清掉"目录已不存在"的残留记录。
	// 场景: 用户通过文件管理器手动删了插件目录, 或卸载过程中途失败。
	// 旧实现只增不删 → 服务列表里永远挂着一个再也起不来的幽灵插件
	// (2026-10-17 实测: echopi 目录已删, 列表仍报 state=running)。
	for name := range before {
		if s.pluginDirGone(name) {
			log.Printf("[supervisor] %s 插件目录已不存在, 清理进程记录", name)
			if err := s.RemovePlugin(name); err != nil {
				log.Printf("[supervisor] 清理 %s 失败: %v", name, err)
			}
		}
	}

	s.mu.Lock()
	toSpawn := []*Proc{}
	for n, p := range s.procs {
		if !before[n] && p.Autostart {
			toSpawn = append(toSpawn, p)
		}
	}
	s.mu.Unlock()
	for _, p := range toSpawn {
		_ = s.spawn(p, "autostart")
	}
}

// pluginDirGone 插件目录是否已不存在(或已无有效 v4 清单)。
func (s *Supervisor) pluginDirGone(name string) bool {
	if s.opts.PluginsDir == "" {
		return false
	}
	dir := filepath.Join(s.opts.PluginsDir, name)
	if _, err := os.Stat(dir); err != nil {
		return true
	}
	_, err := pluginx.LoadManifestV4(dir)
	return err != nil
}

// upsertFromManifest 解析 manifest, 创建/更新 Proc。持 s.mu 进。
func (s *Supervisor) upsertFromManifest(name string, m *pluginx.ManifestV4) {
	dir := filepath.Join(s.opts.PluginsDir, name)
	endpointPath := filepath.Join(dir, ".rc.endpoint")
	var ep string
	if b, err := os.ReadFile(endpointPath); err == nil {
		ep = strings.TrimSpace(string(b))
	} else if !os.IsNotExist(err) {
		log.Printf("[supervisor] %s endpoint 文件读异常: %v", name, err)
	}
	logPath := filepath.Join(s.opts.LogDir, name+".runtime.log")

	s.mu.Lock()
	defer s.mu.Unlock()
	if cur, ok := s.procs[name]; ok {
		// 已存在: 同步 args/exec; 不打断进程
		cur.mu.Lock()
		cur.Args = append([]string{}, m.Backend.Exec...)
		cur.Lang = m.Backend.Lang
		if cur.Dir == "" {
			cur.Dir = dir
		}
		if cur.Endpoint == "" && ep != "" {
			cur.Endpoint = ep
		}
		cur.mu.Unlock()
		return
	}
	auto := s.loadedAutostartFor(name) // 空 => false, 由用户在运行时切
	p := &Proc{
		Name:       name,
		Dir:        dir,
		Args:       append([]string{}, m.Backend.Exec...),
		Lang:       m.Backend.Lang,
		Endpoint:   ep,
		LogPath:    logPath,
		Autostart:  auto,
		state:      StateStopped,
		startedAt:  time.Time{},
		connSeenAt: time.Time{},
		stopCh:     make(chan struct{}),
	}
	s.procs[name] = p
}

// startLocked 已废弃: 见 StartPlugin 直接走 spawn()。
// 保留此占位避免外部 API 误删。
func (s *Supervisor) startLocked(p *Proc) error { return s.spawn(p, "manual") }

// spawn 真正启动 cmd 的入口。
func (s *Supervisor) spawn(p *Proc, reason string) error {
	if len(p.Args) == 0 {
		return fmt.Errorf("插件 %s 无 backend.exec", p.Name)
	}
	// 懒加载: 若启动时 .rc.endpoint 还没写好(或者没装), 这里再次重读一次。
	p.mu.Lock()
	if p.Endpoint == "" {
		if b, err := os.ReadFile(filepath.Join(p.Dir, ".rc.endpoint")); err == nil {
			p.Endpoint = strings.TrimSpace(string(b))
		} else {
			log.Printf("[supervisor] %s .rc.endpoint 不可读: %v (子进程将拿不到 RC_ENDPOINT)", p.Name, err)
		}
	}
	endpoint := p.Endpoint
	args := append([]string{}, p.Args...)
	lang := p.Lang
	p.mu.Unlock()

	// ★ 多语言适配: 把 backend{lang,exec} 解析成真正可执行的 argv。
	// 这一步解决的是"解释器名字因发行版而异"的问题(如 Debian 12 只有 python3 没有 python,
	// 旧 JMComic 的 exec 写的是 python, 于是必然 fork 失败)。解析失败时给出可读原因,
	// 而不是留一个 exit=-1 的黑盒崩溃。
	spec, err := pluginrt.Resolve(lang, args, p.Dir)
	if err != nil {
		return fmt.Errorf("插件 %s 运行环境不可用: %w", p.Name, err)
	}
	for _, n := range spec.Notes {
		log.Printf("[supervisor] %s 运行时: %s", p.Name, n)
	}
	// Python 插件: 启动前查一次依赖是否可导入。
	// 缺包时插件会立刻 ImportError 退出, 日志里往往只有一行 traceback 甚至空白
	// (取决于缓冲), 表现为"插件莫名其妙一直崩"。这里直接把缺什么、怎么装打出来。
	// 每个插件每次进程生命周期只查一次(见 depsChecked), 避免拖慢重启。
	if spec.Lang == pluginrt.LangPython {
		s.checkPythonDepsOnce(p, spec.Interpreter)
	}

	cmd := exec.Command(spec.Argv[0], spec.Argv[1:]...)
	cmd.Dir = p.Dir
	setupSysProcAttr(cmd)
	env := append(os.Environ(),
		"RC_ENDPOINT="+endpoint,
		"RC_PLUGIN_NAME="+p.Name,
		"RC_PLUGIN_DIR="+p.Dir,
	)
	cmd.Env = append(env, spec.Env...)
	if endpoint == "" {
		log.Printf("[supervisor] 警告: %s endpoint 为空, 子进程拿不到 RC_ENDPOINT", p.Name)
	}
	if err := s.rotateLog(p); err != nil {
		log.Printf("[supervisor] %s 日志轮转失败: %v", p.Name, err)
	}
	lf, err := os.OpenFile(p.LogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return fmt.Errorf("打开日志失败: %w", err)
	}
	cmd.Stdout = lf
	cmd.Stderr = lf
	if err := cmd.Start(); err != nil {
		lf.Close()
		return fmt.Errorf("exec 失败: %w", err)
	}

	p.mu.Lock()
	p.cmd = cmd
	p.pid = cmd.Process.Pid
	p.startedAt = time.Now()
	p.state = StateStarting
	p.lastExit = 0
	p.bootRunning = true
	if reason != "" {
		p.stopReason = ""
	}
	p.mu.Unlock()
	go s.waitAndReact(p, lf)
	log.Printf("[supervisor] start %s pid=%d reason=%s", p.Name, cmd.Process.Pid, reason)
	return nil
}

// rotateLog 旧的 .runtime.log → .1; 限制保留 1 代(简单够用)。
func (s *Supervisor) rotateLog(p *Proc) error {
	if _, err := os.Stat(p.LogPath); err != nil {
		return nil // 不存在, 不必 rotate
	}
	rot := p.LogPath + ".1"
	_ = os.Remove(rot)
	if err := os.Rename(p.LogPath, rot); err != nil {
		return err
	}
	return nil
}

// waitAndReact 一个 cmd 一个协程, 等结束; 决定是否 backoff 拉起。
func (s *Supervisor) waitAndReact(p *Proc, lf io.Closer) {
	defer lf.Close()
	state := p.cmd.Wait()
	exitCode := -1
	signalName := ""
	if state != nil {
		if ee, ok := state.(*exec.ExitError); ok {
			if ws, ok := ee.ProcessState.Sys().(syscall.WaitStatus); ok {
				exitCode = ws.ExitStatus()
				if ws.Signaled() {
					signalName = ws.Signal().String()
					exitCode = 128 + int(ws.Signal())
				}
			} else {
				log.Printf("[supervisor] %s ProcessState.Sys 类型异常: %T", p.Name, ee.ProcessState.Sys())
			}
		} else {
			log.Printf("[supervisor] %s Wait 返非 ExitError: err=%q", p.Name, state.Error())
		}
	}

	reason := ""
	p.mu.Lock()
	reason = p.stopReason
	p.cmd = nil
	p.pid = 0
	graceOk := !p.startedAt.IsZero() && time.Since(p.startedAt) >= s.opts.StartGrace
	p.mu.Unlock()

	// 主动 stop / 重新拉起 → 不算 crash, 不重启
	if reason != "" {
		p.mu.Lock()
		p.lastExit = exitCode
		p.state = StateStopped
		p.bootRunning = false
		// 显式停止: 复位计数, 下次 start 从干净状态起步
		p.crashCount = 0
		p.backoffIdx = 0
		p.mu.Unlock()
		log.Printf("[supervisor] %s 退出, exit=%d, reason=%s (主动停)", p.Name, exitCode, reason)
		return
	}

	// 自杀: 进程自己退出且 exit 0 + 跑过宽限 → 视作「干净退出」
	// 不是 crash, 也不重启 (autostart=true 由下次 boot 拉起)
	if exitCode == 0 && graceOk {
		p.mu.Lock()
		p.lastExit = exitCode
		p.state = StateStopped
		p.bootRunning = false
		p.crashCount = 0
		p.backoffIdx = 0
		p.mu.Unlock()
		log.Printf("[supervisor] %s 自退出 exit=0 (干净退出, 不重启)", p.Name)
		return
	}

	// 自杀: 计算 backoff
	p.mu.Lock()
	p.lastExit = exitCode
	if !graceOk {
		// 启动宽限期内崩了: 立即进 backoff, 计数加一
		p.crashCount++
	} else {
		// 运行很久后崩: 重置 backoff(不是连崩)
		p.backoffIdx = 0
		p.crashCount++
	}
	over := p.crashCount > s.opts.RestartMax
	if over {
		p.state = StateCrashed
		p.bootRunning = false
		p.mu.Unlock()
		log.Printf("[supervisor] %s 崩溃次数 %d > %d 进入 Crashed", p.Name, p.crashCount, s.opts.RestartMax)
		return
	}
	p.state = StateBackoff
	p.bootRunning = false
	idx := p.backoffIdx
	p.backoffIdx++
	delay := s.backoffDelay(idx)
	stopCh := p.stopCh
	p.mu.Unlock()

	log.Printf("[supervisor] %s 崩溃 exit=%d sig=%s reason=%s, %v 后第 %d 次重试", p.Name, exitCode, signalName, reason, delay, idx+1)
	select {
	case <-stopCh:
		p.mu.Lock()
		p.state = StateStopped
		p.mu.Unlock()
		return
	case <-time.After(delay):
	}
	_ = s.spawn(p, "backoff")
}

func (s *Supervisor) backoffDelay(idx int) time.Duration {
	d := s.opts.BackoffBase
	for i := 0; i < idx && d < s.opts.BackoffMax; i++ {
		d *= 2
	}
	if d > s.opts.BackoffMax {
		d = s.opts.BackoffMax
	}
	return d
}

// stopLocked 调用方不必持 s.mu; 发 SIGTERM 到进程组, 5s 后若还在就 SIGKILL。
// stopReason 一旦置, waitAndReact 见到就会进 stopped 而非计入 crash。
func (s *Supervisor) stopLocked(p *Proc, reason string) {
	p.mu.Lock()
	p.stopReason = reason
	pid := p.pid
	ch := p.stopCh
	p.mu.Unlock()
	if ch != nil {
		p.stopOnce.Do(func() { close(ch) })
	}
	if pid > 0 {
		_ = killProcess(pid, syscall.SIGTERM)
		go func(targetP *Proc, targetPid int) {
			time.Sleep(5 * time.Second)
			targetP.mu.Lock()
			still := targetP.pid == targetPid
			targetP.mu.Unlock()
			if still {
				_ = killProcess(targetPid, syscall.SIGKILL)
			}
		}(p, pid)
	}
}

// ---- autostart 持久化 ----

type autoPersist struct {
	Autostart map[string]bool `json:"autostart"`
}

const autoKey = "supervisor_autostart"

func (s *Supervisor) loadAutostart() {
	if s.sd == nil {
		return
	}
	ns, err := s.sd.Namespace("core_supervisor")
	if err != nil {
		return
	}
	raw, ok, _ := ns.Get(autoKey)
	if !ok || raw == nil {
		return
	}
	// 反序列化(对象:{"autostart":{"name":true,...}})
	var p autoPersist
	var bs []byte
	switch v := raw.(type) {
	case string:
		bs = []byte(v)
	case map[string]interface{}:
		b, _ := json.Marshal(v)
		bs = b
	default:
		return
	}
	if err := json.Unmarshal(bs, &p); err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for name, on := range p.Autostart {
		s.autostartBoot[name] = on
		// 还没 upsert 的, 创建占位 proc, 后续 scan 会被填实
		if _, ok := s.procs[name]; !ok {
			s.procs[name] = &Proc{
				Name: name, Autostart: on, state: StateStopped,
				LogPath: filepath.Join(s.opts.LogDir, name+".runtime.log"),
				stopCh:  make(chan struct{}),
			}
		}
	}
}

// loadedAutostartFor 调用方须持 s.mu; 从启动期填充的 map 里查 autostart。
// upsertFromManifest 内部确保 fallback=false。
func (s *Supervisor) loadedAutostartFor(name string) bool {
	if s.autostartBoot == nil {
		return false
	}
	return s.autostartBoot[name]
}

func (s *Supervisor) persistAutostart() error {
	if s.sd == nil {
		return nil
	}
	ns, err := s.sd.Namespace("core_supervisor")
	if err != nil {
		return err
	}
	s.mu.Lock()
	pm := autoPersist{Autostart: map[string]bool{}}
	for n, p := range s.procs {
		pm.Autostart[n] = p.Autostart
	}
	s.mu.Unlock()
	raw, _ := json.Marshal(pm)
	return ns.Set(autoKey, string(raw))
}
