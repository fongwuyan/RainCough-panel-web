package pluginrt

// 环境准备执行器 —— 执行清单里声明的 apply[] 步骤。
//
// ★ 这是整套机制里唯一会写系统的地方, 安全边界必须钉死:
//  1. 命令只能来自清单的 apply[], **前端只传步骤 id, 绝不接受命令原文**。
//     传原文 = 任何登录用户都能在面板上执行任意 shell, 面板直接变成后门。
//  2. 清单的 level 必须是 apply 才允许执行; 默认 check = 纯只读, 一个字节都不改。
//  3. needs=root 的步骤在非 root 面板上一律拒绝 —— 不降级、不 sudo、不"试试看"。
//  4. 必须显式确认(confirm=true), 且确认页要把命令原文摊给用户看。
//  5. 步骤失败即停: 步骤之间通常有依赖(venv → pip → unit), 后面跑了也是白跑。
//
// 幂等: 步骤可用 check 字段关联一个检查项; 该检查已 ok 就跳过这一步。
//   这让"再点一次修复"是安全的, 而不是重复装一遍。

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// 步骤执行状态
const (
	StepOK      = "ok"
	StepSkipped = "skipped"
	StepFailed  = "failed"
	StepDenied  = "denied"
)

// StepResult 单步结果。
type StepResult struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	// Command 实际会执行的命令原文 —— 前端确认页展示的就是它
	Command string `json:"command,omitempty"`
	Status  string `json:"status"`
	Detail  string `json:"detail,omitempty"`
	MS      int64  `json:"ms"`
}

// ApplyResult 一批步骤的执行结果。
type ApplyResult struct {
	Plugin string       `json:"plugin"`
	OK     bool         `json:"ok"`
	Steps  []StepResult `json:"steps"`
	// Report 执行完重新检查的环境报告 —— 前端一次刷新到位, 不用再发一次请求
	Report *EnvReport `json:"report,omitempty"`
	// Denied 因权限不足被拒绝的步骤数(面板非 root)
	Denied int `json:"denied"`
}

// Apply 执行指定的 apply 步骤。
//
// steps 为空 = 执行清单里全部 apply 步骤(按声明顺序)。
// confirm 必须为 true —— 没有确认就没有执行, 这是后端硬门槛, 不靠前端自觉。
//
// 返回的 error 只表示"根本没开始执行"(参数不合法/级别不对/未确认);
// 步骤本身跑失败不算 error, 在 Steps 里逐条给状态。
func (r *EnvRunner) Apply(spec *EnvironmentSpec, steps []string, confirm bool) (*ApplyResult, error) {
	if !confirm {
		return nil, errors.New("未确认: 执行环境准备步骤前必须显式确认")
	}
	if spec == nil || len(spec.Apply) == 0 {
		return nil, errors.New("该插件未声明可执行的环境准备步骤")
	}
	level := spec.EffectiveLevel()
	if level != EnvLevelApply {
		return nil, fmt.Errorf("该插件的环境级别是 %q(只读), 不允许自动执行; 插件作者需把 environment.level 设为 %q", level, EnvLevelApply)
	}

	todo, err := selectSteps(spec, steps)
	if err != nil {
		return nil, err
	}

	// 幂等: 先查一遍, 关联的检查项已 ok 的步骤直接跳过
	pre := r.Report(spec)
	okChecks := map[string]bool{}
	for _, it := range pre.Items {
		if it.Status == StatusOK {
			okChecks[it.ID] = true
		}
	}

	res := &ApplyResult{Plugin: pre.Plugin, Steps: []StepResult{}}
	stopped := false
	for _, a := range todo {
		sr := StepResult{ID: a.ID, Label: a.LabelOrID(), Command: a.Run}
		switch {
		case stopped:
			sr.Status = StepSkipped
			sr.Detail = "前一步失败, 后续步骤未执行"
		case a.Check != "" && okChecks[a.Check]:
			sr.Status = StepSkipped
			sr.Detail = "无需执行(" + a.Check + " 检查已通过)"
		case a.Needs == "root" && !r.Root:
			sr.Status = StepDenied
			sr.Detail = "该步骤需要 root 权限, 当前面板不是 root 运行"
			res.Denied++
		default:
			started := time.Now()
			ok, detail := r.runStep(a)
			sr.MS = time.Since(started).Milliseconds()
			sr.Detail = detail
			if ok {
				sr.Status = StepOK
			} else {
				sr.Status = StepFailed
				stopped = true
			}
		}
		res.Steps = append(res.Steps, sr)
	}

	// OK 只在"所有请求的步骤都成功或已满足"时为真。
	// 被拒的步骤同样让 OK=false —— 用户点的是"全部修复", 没修完就不该报成功。
	res.OK = !stopped && res.Denied == 0

	post := r.Report(spec)
	res.Report = &post
	return res, nil
}

// selectSteps 把请求的步骤 id 映射到清单里的定义。
//
// 空列表 = 全部步骤。未知 id 直接报错: 静默忽略会让用户以为"执行了",
// 实际什么都没做 —— 这种"以为做了"比报错危险得多。
func selectSteps(spec *EnvironmentSpec, want []string) ([]ApplyDef, error) {
	if len(want) == 0 {
		out := make([]ApplyDef, len(spec.Apply))
		copy(out, spec.Apply)
		return out, nil
	}
	byID := make(map[string]ApplyDef, len(spec.Apply))
	for _, a := range spec.Apply {
		byID[a.ID] = a
	}
	out := make([]ApplyDef, 0, len(want))
	for _, id := range want {
		id = strings.TrimSpace(id)
		a, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("步骤 %q 不在该插件的清单里", id)
		}
		out = append(out, a)
	}
	return out, nil
}

// runStep 执行单条命令, 返回 (成功?, 详情)。
func (r *EnvRunner) runStep(a ApplyDef) (bool, string) {
	shell := shellPath()
	if shell == "" {
		return false, "当前环境没有 /bin/sh, 无法执行步骤"
	}

	ctx, cancel := context.WithTimeout(context.Background(),
		time.Duration(a.EffectiveTimeout())*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, shell, "-c", a.Run)
	cmd.Dir = r.Dir
	if len(r.Extra) > 0 {
		cmd.Env = append(os.Environ(), r.Extra...)
	}
	// 同 runShell: 超时后必须让 Wait 收手, 否则孙进程持有管道会拖到天荒地老。
	// 对 apt install 这类命令尤其重要 —— 超时挂死比失败更糟。
	cmd.WaitDelay = 500 * time.Millisecond

	// 合并 stdout/stderr: 装依赖时 pip/apt 的进度多在 stderr, 分开收会得到空输出
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf

	err := cmd.Run()
	out := strings.TrimSpace(buf.String())

	if ctx.Err() == context.DeadlineExceeded {
		return false, fmt.Sprintf("执行超时(%ds)%s", a.EffectiveTimeout(), suffixDetail(out))
	}
	if err != nil {
		return false, "命令失败" + suffixDetail(out)
	}
	return true, tailRunes(out, detailMaxRunes)
}
