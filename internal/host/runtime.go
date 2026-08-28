package host

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// PluginHost 插件运行时: 扫描目录、拉起/监控/回收子进程、注册表。
type PluginHost struct {
	dir      string
	maxChild int
	dsn      string // 注入 SharedData DSN(库级账号)
	sudoPW   string

	proxyTimeout time.Duration // 网关代理到子进程超时(0=15s)
	restartMax   int           // 单插件连续崩溃最大重启次数(0=5)

	mu       sync.Mutex
	children map[string]*Child  // name -> child
	order    []string           // 稳定顺序
	dead     map[string]Restart // 已死插件的退避状态
	lastScan time.Time
}

// Restart 记录单插件的崩溃重启状态(指数退避)。
type Restart struct {
	Count    int       // 连续崩溃次数
	Backoff  time.Time // 退避截止时间(此时间前不重启)
	LastDied time.Time
}

// Options PluginHost 可选项。
type Options struct {
	MaxChildren  int
	ProxyTimeout time.Duration
	RestartMax   int
}

// New 创建 PluginHost。
func New(pluginsDir, dsn string, maxChild int) *PluginHost {
	return NewWithOptions(pluginsDir, dsn, Options{MaxChildren: maxChild})
}

// NewWithOptions 创建 PluginHost(可配置代理超时与重启上限)。
func NewWithOptions(pluginsDir, dsn string, opts Options) *PluginHost {
	proxyTimeout := opts.ProxyTimeout
	if proxyTimeout <= 0 {
		proxyTimeout = 15 * time.Second
	}
	restartMax := opts.RestartMax
	if restartMax <= 0 {
		restartMax = 5
	}
	if opts.MaxChildren <= 0 {
		opts.MaxChildren = 8
	}
	return &PluginHost{
		dir:          pluginsDir,
		maxChild:     opts.MaxChildren,
		dsn:          dsn,
		proxyTimeout: proxyTimeout,
		restartMax:   restartMax,
		children:     map[string]*Child{},
		dead:         map[string]Restart{},
	}
}

// SetSudoPW 注入 sudo 密码(透传给需要提权的插件, 兼容旧环境变量)。
func (h *PluginHost) SetSudoPW(pw string) { h.sudoPW = pw }

// Scan 扫描插件目录, 拉起新插件。返回启停摘要。
func (h *PluginHost) Scan() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lastScan = time.Now()

	var names []string
	entries, err := os.ReadDir(h.dir)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)

	var msgs []string
	for _, name := range names {
		if h.children[name] != nil {
			continue // 已拉起
		}
		// 处于退避期的不尝试
		if r, ok := h.dead[name]; ok && time.Now().Before(r.Backoff) {
			continue
		}
		dir := filepath.Join(h.dir, name)
		m, err := LoadManifest(dir)
		if err != nil {
			// 无 plugin.json 或 manifest 损坏: 记录可观测, 不静默
			if _, statErr := os.Stat(filepath.Join(dir, "plugin.json")); statErr == nil {
				msgs = append(msgs, fmt.Sprintf("[host] %s: manifest 加载失败: %v", name, err))
			}
			continue
		}
		if len(h.children) >= h.maxChild {
			msgs = append(msgs, fmt.Sprintf("[host] 达到子进程上限(%d), %s 未拉起", h.maxChild, name))
			continue
		}
		child, err := h.startChild(m, dir)
		if err != nil {
			h.noteDeath(name) // 启动失败也计入退避, 防止启动即崩的插件反复拉起
			msgs = append(msgs, fmt.Sprintf("[host] %s: %v", name, err))
			continue
		}
		h.children[name] = child
		h.order = append(h.order, name)
		delete(h.dead, name) // 成功拉起, 清除退避状态
		msgs = append(msgs, fmt.Sprintf("[host] 已加载: %s (%s)", name, m.Label))
	}
	return msgs
}

func (h *PluginHost) startChild(m *Manifest, dir string) (*Child, error) {
	env := []string{fmt.Sprintf("RAINCOUGH_DB_DSN=%s", h.dsn)}
	if h.sudoPW != "" {
		env = append(env, fmt.Sprintf("RC_SUDO_PW=%s", h.sudoPW))
		env = append(env, fmt.Sprintf("TOUCHGAL_SUDO_PW=%s", h.sudoPW))
	}
	child := &Child{name: m.Name, dir: dir, manifest: m,
		env: env, proxyTimeout: h.proxyTimeout}
	if err := child.Start(); err != nil {
		return nil, err
	}
	return child, nil
}

// noteDeath 记录一次崩溃, 计算指数退避。
func (h *PluginHost) noteDeath(name string) {
	r := h.dead[name]
	r.Count++
	// 退避序列: 2,4,8,16,32,60(封顶) 秒
	backoff := time.Duration(1<<min(r.Count, 5)) * time.Second
	if backoff > 60*time.Second {
		backoff = 60 * time.Second
	}
	r.Backoff = time.Now().Add(backoff)
	r.LastDied = time.Now()
	h.dead[name] = r
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Get 按名返回子进程。
func (h *PluginHost) Get(name string) *Child {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.children[name]
}

// All 返回全部已加载子进程(供健康检查等只读遍历)。
func (h *PluginHost) All() []*Child {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]*Child, 0, len(h.children))
	for _, c := range h.children {
		if c != nil {
			out = append(out, c)
		}
	}
	return out
}

// Find 按名返回子进程(大小写不敏感, 兼容小写路径访问大写插件如 JMComic)。
func (h *PluginHost) Find(name string) *Child {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c := h.children[name]; c != nil {
		return c
	}
	for n, c := range h.children {
		if strings.EqualFold(n, name) {
			return c
		}
	}
	return nil
}

// List 返回注册表条目(与 /api/plugins 一致)。
func (h *PluginHost) List() []map[string]interface{} {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(h.order))
	for _, name := range h.order {
		c := h.children[name]
		if c == nil {
			continue
		}
		info := c.manifest.Info()
		info["alive"] = c.Alive()
		out = append(out, info)
	}
	return out
}

// Remove 卸载插件: 终止子进程并从注册表移除。
func (h *PluginHost) Remove(name string) error {
	h.mu.Lock()
	c := h.children[name]
	if c != nil {
		delete(h.children, name)
		h.order = removeStr(h.order, name)
	}
	delete(h.dead, name) // 用户主动卸载, 清退避状态
	h.mu.Unlock()
	if c == nil {
		return fmt.Errorf("插件 %s 未加载", name)
	}
	c.Kill()
	return nil
}

// Shutdown 终止全部子进程(面板退出清场)。
func (h *PluginHost) Shutdown() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, c := range h.children {
		c.Kill()
	}
	h.children = map[string]*Child{}
	h.order = nil
	h.dead = map[string]Restart{}
}

// Watchdog 常驻监视: 崩溃自动拉起, 带指数退避与重启上限。
// restartMax 达到后不再自动拉起(联系人工/面板操作)。
func (h *PluginHost) Watchdog(stop <-chan struct{}, interval time.Duration) {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			h.mu.Lock()
			// 1) 检测已挂子进程
			for name, c := range h.children {
				if c.Alive() {
					continue
				}
				delete(h.children, name)
				h.order = removeStr(h.order, name)
				h.noteDeath(name)
				if h.dead[name].Count > h.restartMax {
					fmt.Printf("[host] %s 连续崩溃 %d 次, 停止自动拉起\n", name, h.dead[name].Count)
				}
			}
			// 2) 尝试重启(受退避约束)
			var restart []string
			for name, r := range h.dead {
				if r.Count <= h.restartMax && time.Now().After(r.Backoff) {
					restart = append(restart, name)
				}
			}
			h.mu.Unlock()

			for _, name := range restart {
				if len(h.children) >= h.maxChild {
					break
				}
				dir := filepath.Join(h.dir, name)
				if m, err := LoadManifest(dir); err == nil {
					if nc, err := h.startChild(m, dir); err == nil {
						h.mu.Lock()
						h.children[name] = nc
						h.order = append(h.order, name)
						delete(h.dead, name)
						h.mu.Unlock()
						fmt.Printf("[host] 已重启: %s\n", name)
					} else {
						h.mu.Lock()
						h.noteDeath(name)
						h.mu.Unlock()
					}
				}
			}
		}
	}
}

func removeStr(s []string, v string) []string {
	out := s[:0]
	for _, x := range s {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}
