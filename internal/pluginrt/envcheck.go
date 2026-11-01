package pluginrt

// 环境检查引擎 —— 只读。
//
// ★ 本文件里出现的所有命令都必须是无副作用的探测(服务状态、端口、能否 import、文件存在)。
//   永远不要在这里"顺手装一下": Preflight 会被前端反复调用、也会在安装中止前调用,
//   任何写操作都会变成用户没同意过的改动。

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// CheckItem 一条检查结果。
type CheckItem struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Kind     string `json:"kind"` // shell|port|requirements
	Status   string `json:"status"`
	Detail   string `json:"detail,omitempty"`
	Hint     string `json:"hint,omitempty"`
	Guide    string `json:"guide,omitempty"`
	Fix      string `json:"fix"`
	Required bool   `json:"required"`
	// ApplySteps 能修这一项的 apply 步骤 id。
	// 前端点"一键修复"时把它原样回传给后端 —— 后端只认 id, 不认命令原文。
	ApplySteps []string `json:"apply_steps,omitempty"`
}

// ApplyInfo 清单里声明的一条可执行步骤。
type ApplyInfo struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Needs string `json:"needs"`
	// Check 关联的检查项 id(已通过则该步骤跳过)
	Check string `json:"check,omitempty"`
	// Command 命令原文 —— 确认页要把它完整摊给用户看, 不折叠不省略
	Command string `json:"command"`
}

// EnvReport 一个插件的环境报告。
type EnvReport struct {
	Plugin  string `json:"plugin"`
	Version string `json:"version,omitempty"`
	Level   string `json:"level"`
	Ready   bool   `json:"ready"`
	// Pending 必需项里尚未就绪的数量 —— 前端唯一的 gate 依据
	Pending int         `json:"pending"`
	Items   []CheckItem `json:"items"`
	// Root 面板进程是否 root, 决定 fix=root 的项能否点
	Root bool   `json:"root"`
	OS   string `json:"os"`
	Arch string `json:"arch"`
	// Apply 清单里声明的可执行步骤(level=apply 时才有内容)。
	// 前端用它渲染"一键修复"和命令确认页 —— 命令原文由后端给出,
	// 前端不需要、也不允许自己拼命令。
	Apply []ApplyInfo `json:"apply,omitempty"`
	// Warn 清单问题等非致命提示
	Warn      string `json:"warn,omitempty"`
	CheckedAt int64  `json:"checked_at"`
	MS        int64  `json:"ms"`
}

// EnvRunner 执行环境检查。
type EnvRunner struct {
	// Dir 插件目录: 既是 shell 的工作目录, 也是读 plugin.json 的位置
	Dir string
	// Python 面板侧解释器, 用于旧式 requirements 的 import 探测
	Python string
	// SelfPID 本插件进程 PID, 供 owner.plugin="self" 比对; 0 表示未运行
	SelfPID int
	// Root 面板进程是否 root
	Root bool
	// Extra 追加到子进程的环境变量
	Extra []string
	// MaxTotal 整体预算, 超时后剩余项记 unknown; 0 用默认 120s
	MaxTotal time.Duration
}

const (
	detailMaxRunes  = 500
	envReportBudget = 120 * time.Second
)

// Report 跑一遍全部检查。无 environment 且无 requirements 时返回 Ready=true 空报告。
func (r *EnvRunner) Report(spec *EnvironmentSpec) EnvReport {
	started := time.Now()
	budget := r.MaxTotal
	if budget <= 0 {
		budget = envReportBudget
	}

	rep := EnvReport{
		Plugin: filepath.Base(filepath.Clean(r.Dir)),
		Level:  spec.EffectiveLevel(),
		Root:   r.Root,
		OS:     runtime.GOOS,
		Arch:   runtime.GOARCH,
		Items:  []CheckItem{},
	}
	if name, ver, reqs, err := peekBasics(r.Dir); err == nil {
		if name != "" {
			rep.Plugin = name
		}
		rep.Version = ver
		if spec == nil && len(reqs) > 0 {
			// 老式声明: 只检查不安装, 与面板此前的行为保持一致,
			// 避免升级后突然开始给人装包。
			rep.Warn = "该插件用旧式 requirements 声明依赖(未声明 environment), 面板只能检查、不能自动修复"
			rep.Items = append(rep.Items, r.legacyRequirementItems(reqs)...)
		}
	}

	if spec != nil {
		// 可执行步骤清单: 只在 level=apply 时给(level=check 的插件根本没打算让人执行)
		if spec.EffectiveLevel() == EnvLevelApply {
			for _, a := range spec.Apply {
				rep.Apply = append(rep.Apply, ApplyInfo{
					ID:      a.ID,
					Label:   a.LabelOrID(),
					Needs:   a.Needs,
					Check:   a.Check,
					Command: a.Run,
				})
			}
		}
		deadline := started.Add(budget)
		for _, c := range spec.Check {
			if time.Now().After(deadline) {
				rep.Items = append(rep.Items, CheckItem{
					ID: c.ID, Label: c.LabelOrID(), Kind: "skipped",
					Status: StatusUnknown, Fix: spec.fixFor(c), Required: c.IsRequired(),
					Detail: "整体检查超时, 该项未执行",
				})
				continue
			}
			rep.Items = append(rep.Items, r.checkOne(spec, c))
		}
	}

	for _, it := range rep.Items {
		// 只有"确定缺"才算没就绪。
		// degraded(端被占但查不出是谁, 常见于面板非 root)与 unknown(探测超时)
		// 都是"没法判断", 不是"坏了" —— 把它们算成未就绪会让非 root 部署
		// 永远显示"环境未就绪", 反而掩盖真正的问题。
		if it.Required && it.Status == StatusMissing {
			rep.Pending++
		}
	}
	rep.Ready = rep.Pending == 0
	rep.CheckedAt = time.Now().Unix()
	rep.MS = time.Since(started).Milliseconds()
	return rep
}

// checkOne 执行单条检查并补齐元信息。
func (r *EnvRunner) checkOne(spec *EnvironmentSpec, c CheckDef) CheckItem {
	var it CheckItem
	if c.Type == CheckTypePort {
		it = r.checkPort(c)
	} else {
		it = r.runShell(c)
	}
	it.ID = c.ID
	it.Label = c.LabelOrID()
	it.Required = c.IsRequired()
	if it.Guide == "" {
		it.Guide = c.Guide
	}
	if it.Hint == "" {
		it.Hint = c.Hint
	}
	if it.Status == StatusOK {
		it.Fix = FixNone
	} else {
		it.Fix = spec.fixFor(c)
		// 能修这一项的步骤 id 一并给出: 前端点"一键修复"时原样回传,
		// 后端只认 id —— 命令原文永远来自清单, 前端碰不到。
		it.ApplySteps = spec.applyStepsFor(c)
	}
	return it
}

// runShell 跑一条 shell 检查命令。
func (r *EnvRunner) runShell(c CheckDef) CheckItem {
	it := CheckItem{Kind: "shell"}

	shell := shellPath()
	if shell == "" {
		it.Status = StatusUnknown
		it.Detail = "当前环境没有 /bin/sh, 无法执行检查命令"
		return it
	}

	ctx, cancel := context.WithTimeout(context.Background(),
		time.Duration(c.EffectiveTimeout())*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, shell, "-c", c.Run)
	cmd.Dir = r.Dir
	if len(r.Extra) > 0 {
		cmd.Env = append(os.Environ(), r.Extra...)
	}
	// ★ 超时后 Wait 会卡住: CommandContext 只 kill sh 本身, 它派生的子进程
	//   (sleep/xvfb-run 之类)还活着并持有 stdout 管道, Wait 要等 IO 收尾,
	//   结果超时形同虚设(实测 sleep 5 + timeout 1 会跑满 5 秒)。
	//   WaitDelay 让 Wait 在 ctx 结束后最多再等这么久就强行关闭管道返回。
	cmd.WaitDelay = 500 * time.Millisecond
	// 合并 stdout/stderr: 作者常把诊断打到 stderr, 分开收会得到空 detail
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf

	err := cmd.Run()
	out := strings.TrimSpace(buf.String())
	it.Detail = tailRunes(out, detailMaxRunes)

	if ctx.Err() == context.DeadlineExceeded {
		// 超时不能判成"缺失": 可能只是机器慢, 说成缺失会误导用户去装东西
		it.Status = StatusUnknown
		it.Detail = fmt.Sprintf("检查超时(%ds)%s", c.EffectiveTimeout(), suffixDetail(out))
		return it
	}

	if err != nil {
		// ★ 退出码约定(作者可用):
		//   1 = 确定缺失(默认)
		//   2 = 无法确定 —— 读不到 / 权限不足 / 环境不具备, 不能断言"坏了"
		//   3 = 已就绪但状态可疑(端口被占但查不出是谁这类)
		// 2 和 3 的意义: 别让"面板没权限看"变成"环境未就绪", 否则非 root 部署
		// 会永远显示缺东西, 反而掩盖真正缺的那一项。
		if code, ok := exitCodeOf(err); ok {
			switch code {
			case 2:
				it.Status = StatusUnknown
				it.Detail = "无法确定" + suffixDetail(out)
				return it
			case 3:
				it.Status = StatusDegraded
				it.Detail = "状态可疑" + suffixDetail(out)
				return it
			}
		}
		it.Status = StatusMissing
		return it
	}

	if c.Expect != "" {
		re, cerr := regexp.Compile(c.Expect)
		if cerr != nil {
			// 作者正则写错: 报 unknown 而不是 missing, 否则用户会去修一个不存在的问题
			it.Status = StatusUnknown
			it.Detail = "检查项的 expect 正则非法: " + cerr.Error()
			return it
		}
		if !re.MatchString(out) {
			it.Status = StatusMissing
			if it.Detail == "" {
				it.Detail = "输出不匹配 " + c.Expect
			}
			return it
		}
	}

	it.Status = StatusOK
	return it
}

// checkPort 端口检查(结构化)。
func (r *EnvRunner) checkPort(c CheckDef) CheckItem {
	it := CheckItem{Kind: "port"}
	p := probePort(c.Bind, c.Port)

	if p.Free {
		it.Status = StatusOK
		it.Detail = fmt.Sprintf("%s:%d 空闲", c.Bind, c.Port)
		return it
	}

	if p.HolderPID == 0 {
		// 端口确实被占, 但查不出是谁 —— 非 root 或没装 ss 的常见情况。
		// 判 degraded 而不是 missing: 有可能是自己, 不能断言"坏了"。
		it.Status = StatusDegraded
		if !p.Queryable {
			it.Detail = fmt.Sprintf("%s:%d 已被占用, 当前环境无法查看占用进程", c.Bind, c.Port)
		} else {
			it.Detail = fmt.Sprintf("%s:%d 已被占用, 无法确定占用进程", c.Bind, c.Port)
		}
		return it
	}

	if ownerMatches(c.Owner, p.HolderPID, unitMainPID, r.SelfPID) {
		it.Status = StatusOK
		it.Detail = "由预期进程占用: " + describeHolder(p)
		return it
	}

	it.Status = StatusMissing
	it.Detail = fmt.Sprintf("%s:%d 被 %s 占用", c.Bind, c.Port, describeHolder(p))
	return it
}

// legacyRequirementItems 把旧式 requirements 翻译成检查项。
//
// Fix 标 manual 而不是 auto: 没有对应的 apply 步骤, 面板点不动。
// 让 fix=auto 却没有可执行步骤会打破"fix=auto ⟺ 有 apply"这个不变量,
// 前端就会渲染出一个点了没反应的按钮。
func (r *EnvRunner) legacyRequirementItems(reqs []string) []CheckItem {
	py := r.Python
	if strings.TrimSpace(py) == "" {
		py = "python3"
	}
	miss, err := CheckPythonModules(py, reqs)
	if err != nil {
		return []CheckItem{{
			ID: "requirements", Label: "Python 依赖", Kind: "requirements",
			Status: StatusUnknown, Fix: FixNone, Required: true,
			Detail: "无法检查: " + err.Error(),
		}}
	}
	if len(miss) == 0 {
		return []CheckItem{{
			ID: "requirements", Label: "Python 依赖", Kind: "requirements",
			Status: StatusOK, Fix: FixNone, Required: true,
			Detail: fmt.Sprintf("%d 个依赖均可导入", len(reqs)),
		}}
	}
	out := make([]CheckItem, 0, len(miss))
	for _, m := range miss {
		out = append(out, CheckItem{
			ID: "requirements." + m, Label: "Python 依赖 " + m, Kind: "requirements",
			Status: StatusMissing, Fix: FixManual, Required: true,
			Detail: "无法 import " + m,
			Hint:   fmt.Sprintf("%s -m pip install %s", py, m),
		})
	}
	return out
}

// ---- 小工具 ----

// exitCodeOf 取子进程退出码。拿不到(被信号杀死等)时返回 ok=false。
func exitCodeOf(err error) (int, bool) {
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		return ee.ExitCode(), true
	}
	return 0, false
}

// shellPath 找 POSIX sh。面板跑在 Linux, 这里主要照顾测试机(Windows 上的 Git sh)。
func shellPath() string {
	if _, err := os.Stat("/bin/sh"); err == nil {
		return "/bin/sh"
	}
	if p, err := exec.LookPath("sh"); err == nil {
		return p
	}
	return ""
}

func describeHolder(p PortProbe) string {
	if p.HolderName != "" {
		return fmt.Sprintf("%s(pid %d)", p.HolderName, p.HolderPID)
	}
	return fmt.Sprintf("pid %d", p.HolderPID)
}

func suffixDetail(out string) string {
	out = strings.TrimSpace(out)
	if out == "" {
		return ""
	}
	return ": " + tailRunes(out, 120)
}

// tailRunes 保留末尾 n 个字符(诊断信息通常在尾部)。
func tailRunes(s string, n int) string {
	if n <= 0 {
		return ""
	}
	rs := []rune(s)
	if len(rs) <= n {
		return s
	}
	return "…" + string(rs[len(rs)-n:])
}

// peekBasics 只读插件清单里检查用得上的几个字段。
// 不复用 pluginx.LoadManifestV4: 那边要求 name/frontend.entry/backend.exec 齐全,
// 而环境检查必须能在清单有瑕疵时照样跑。
func peekBasics(dir string) (name, version string, requirements []string, err error) {
	raw, err := os.ReadFile(filepath.Join(dir, "plugin.json"))
	if err != nil {
		return "", "", nil, err
	}
	raw = []byte(strings.TrimPrefix(string(raw), "\xef\xbb\xbf"))
	var m struct {
		Name         string   `json:"name"`
		Version      string   `json:"version"`
		Requirements []string `json:"requirements"`
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", "", nil, err
	}
	return m.Name, m.Version, m.Requirements, nil
}
