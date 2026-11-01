package pluginrt

// 插件环境声明 —— plugin.json 的 environment 块。
//
// 为什么独立于 pluginx.ManifestV4 解析:
//   环境检查恰恰要在"清单其他字段有瑕疵"时还能用 —— 插件装上但起不来,
//   正是最需要看环境报告的时刻。所以这里只认 environment 一个键, 其余一概不看,
//   也不会因为 backend.exec 写错就整份报告拿不到。
//
// 设计取舍(详见 docs/插件环境依赖与安装编排-设计方案.md):
//   · 检查项只有两种形态: shell(run) 与 port。其余一律写成 shell 命令 ——
//     每加一个 type(http/file/...)就是在重造 shell, 而且作者学不完。
//   · 端口必须结构化, 因为要处理 ss 输出解析、root 才能看到别人 PID、
//     以及"是不是自己占的"(升级场景不能误报冲突) —— 每个作者抄一遍必错。
//   · 清单非法不影响插件安装: 调用方拿到 error 后丢弃 environment 即可,
//     环境是增强, 不该把本来能用的插件卡死。

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// 环境级别
const (
	// EnvLevelCheck 只跑 check[], 一个字节都不改(默认)
	EnvLevelCheck = "check"
	// EnvLevelApply 允许执行 apply[], 但仍需调用方确认
	EnvLevelApply = "apply"
)

// 检查项形态
const (
	CheckTypeShell = ""     // 默认: /bin/sh -c run
	CheckTypePort  = "port" // 结构化端口检查
)

// 检查状态
const (
	StatusOK       = "ok"
	StatusMissing  = "missing"
	StatusDegraded = "degraded" // 非必需项缺失, 或环境能力不足(如缺 ss)
	StatusUnknown  = "unknown"  // 超时 / 探测失败, 不能断定缺失
)

// 修复方式
const (
	FixAuto   = "auto"   // 有匹配的 apply 步骤且不需要 root
	FixRoot   = "root"   // 有匹配的 apply 步骤但需要 root
	FixManual = "manual" // 有引导链接, 只能人工
	FixNone   = "none"   // 已就绪, 或无从下手
)

const (
	defaultCheckTimeout = 30  // 秒
	defaultApplyTimeout = 120 // 秒
	minPort             = 1024
	maxPort             = 65535
)

var envIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]*$`)

// EnvironmentSpec 环境声明。
type EnvironmentSpec struct {
	Level string     `json:"level,omitempty"`
	Check []CheckDef `json:"check,omitempty"`
	Apply []ApplyDef `json:"apply,omitempty"`
}

// CheckDef 一条检查项。
type CheckDef struct {
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
	// Type 空 = shell; "port" = 结构化端口检查
	Type string `json:"type,omitempty"`
	// Run shell 命令, cwd = 插件目录
	Run string `json:"run,omitempty"`
	// Expect 对 stdout 的正则; 空则只看退出码
	Expect string `json:"expect,omitempty"`
	// Type=port 时使用
	Port  int    `json:"port,omitempty"`
	Bind  string `json:"bind,omitempty"`
	Owner *Owner `json:"owner,omitempty"`
	// Required 默认 true; 显式 false 时缺失只降级不阻断
	Required *bool  `json:"required,omitempty"`
	Hint     string `json:"hint,omitempty"`
	Guide    string `json:"guide,omitempty"`
	Timeout  int    `json:"timeout,omitempty"`
}

// Owner 端口占用者归属判定, 用于区分"自己占的"和"别人占的"。
type Owner struct {
	// Unit systemd 单元名, 比对其 MainPID
	Unit string `json:"unit,omitempty"`
	// Plugin "self" 表示本插件进程
	Plugin string `json:"plugin,omitempty"`
}

// ApplyDef 一条可执行步骤。
type ApplyDef struct {
	ID      string `json:"id"`
	Label   string `json:"label,omitempty"`
	Run     string `json:"run"`
	Needs   string `json:"needs,omitempty"` // auto|root
	Timeout int    `json:"timeout,omitempty"`
	// Check 关联的检查项 id; 该检查已 ok 则跳过本步(幂等)
	Check string `json:"check,omitempty"`
}

// IsRequired 未显式声明时默认必需。
func (c CheckDef) IsRequired() bool {
	return c.Required == nil || *c.Required
}

// EffectiveTimeout 检查项超时(秒)。
func (c CheckDef) EffectiveTimeout() int {
	if c.Timeout > 0 {
		return c.Timeout
	}
	return defaultCheckTimeout
}

// EffectiveTimeout 步骤超时(秒)。
func (a ApplyDef) EffectiveTimeout() int {
	if a.Timeout > 0 {
		return a.Timeout
	}
	return defaultApplyTimeout
}

// LabelOrID 展示名, 缺省用 id。
func (c CheckDef) LabelOrID() string {
	if strings.TrimSpace(c.Label) != "" {
		return c.Label
	}
	return c.ID
}

// LabelOrID 展示名, 缺省用 id。
func (a ApplyDef) LabelOrID() string {
	if strings.TrimSpace(a.Label) != "" {
		return a.Label
	}
	return a.ID
}

// LoadEnvSpec 读取插件目录下 plugin.json 的 environment 块。
//
// 返回值:
//   - (nil, nil)  没有 environment 块 —— 不是错误, 绝大多数插件都是这样
//   - (nil, err)  有 environment 块但内容非法 —— 调用方应丢弃环境并如实告知
//   - (spec, nil) 合法, 已完成默认值归一化
func LoadEnvSpec(dir string) (*EnvironmentSpec, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "plugin.json"))
	if err != nil {
		return nil, err
	}
	// 去 BOM: Windows 侧编辑器容易加, 直接 Unmarshal 会报 "invalid character 'ï'"
	raw = []byte(strings.TrimPrefix(string(raw), "\xef\xbb\xbf"))

	var wrap struct {
		Environment *EnvironmentSpec `json:"environment"`
	}
	if err := json.Unmarshal(raw, &wrap); err != nil {
		return nil, fmt.Errorf("plugin.json 解析失败: %w", err)
	}
	if wrap.Environment == nil {
		return nil, nil
	}
	spec := wrap.Environment
	if err := spec.normalize(); err != nil {
		return nil, err
	}
	return spec, nil
}

// EffectiveLevel 归一化后的级别。null 安全: spec 为 nil 时按 check 处理。
func (s *EnvironmentSpec) EffectiveLevel() string {
	if s == nil {
		return EnvLevelCheck
	}
	if s.Level == EnvLevelApply && len(s.Apply) > 0 {
		return EnvLevelApply
	}
	return EnvLevelCheck
}

// normalize 校验 + 补默认值。
func (s *EnvironmentSpec) normalize() error {
	s.Level = strings.TrimSpace(strings.ToLower(s.Level))
	switch s.Level {
	case "":
		s.Level = EnvLevelCheck
	case EnvLevelCheck, EnvLevelApply:
	default:
		return fmt.Errorf("environment.level 非法: %q(仅支持 check/apply)", s.Level)
	}

	seen := map[string]bool{}
	for i := range s.Check {
		c := &s.Check[i]
		c.ID = strings.TrimSpace(c.ID)
		if c.ID == "" {
			return fmt.Errorf("environment.check[%d] 缺少 id", i)
		}
		if !envIDPattern.MatchString(c.ID) {
			return fmt.Errorf("environment.check[%d].id 非法: %q", i, c.ID)
		}
		if seen[c.ID] {
			return fmt.Errorf("environment.check 中 id 重复: %s", c.ID)
		}
		seen[c.ID] = true

		c.Type = strings.TrimSpace(strings.ToLower(c.Type))
		switch c.Type {
		case CheckTypeShell:
			if strings.TrimSpace(c.Run) == "" {
				return fmt.Errorf("检查项 %s 缺少 run(type 为空即 shell 命令)", c.ID)
			}
			if c.Port != 0 {
				return fmt.Errorf("检查项 %s 声明了 port 但 type 不是 port", c.ID)
			}
		case CheckTypePort:
			if c.Port < minPort || c.Port > maxPort {
				return fmt.Errorf("检查项 %s 端口非法: %d(需在 %d-%d)", c.ID, c.Port, minPort, maxPort)
			}
			if strings.TrimSpace(c.Run) != "" {
				return fmt.Errorf("检查项 %s 是 port 类型, 不应同时写 run", c.ID)
			}
			if c.Bind == "" {
				c.Bind = "127.0.0.1"
			}
			if c.Owner != nil && c.Owner.Plugin != "" && c.Owner.Plugin != "self" {
				return fmt.Errorf("检查项 %s 的 owner.plugin 只支持 \"self\"", c.ID)
			}
		default:
			return fmt.Errorf("检查项 %s 的 type 不支持: %q(仅支持空或 port)", c.ID, c.Type)
		}

		if c.Timeout < 0 {
			return fmt.Errorf("检查项 %s 的 timeout 不能为负", c.ID)
		}
	}

	// apply 的 id 允许与 check 不同(可以用 check 字段关联), 但内部不能自己撞
	seenApply := map[string]bool{}
	for i := range s.Apply {
		a := &s.Apply[i]
		a.ID = strings.TrimSpace(a.ID)
		if a.ID == "" {
			return fmt.Errorf("environment.apply[%d] 缺少 id", i)
		}
		if !envIDPattern.MatchString(a.ID) {
			return fmt.Errorf("environment.apply[%d].id 非法: %q", i, a.ID)
		}
		if seenApply[a.ID] {
			return fmt.Errorf("environment.apply 中 id 重复: %s", a.ID)
		}
		seenApply[a.ID] = true
		if strings.TrimSpace(a.Run) == "" {
			return fmt.Errorf("步骤 %s 缺少 run", a.ID)
		}
		a.Needs = strings.TrimSpace(strings.ToLower(a.Needs))
		switch a.Needs {
		case "":
			a.Needs = "auto"
		case "auto", "root":
		default:
			return fmt.Errorf("步骤 %s 的 needs 非法: %q(仅支持 auto/root)", a.ID, a.Needs)
		}
		if a.Timeout < 0 {
			return fmt.Errorf("步骤 %s 的 timeout 不能为负", a.ID)
		}
	}
	return nil
}

// fixFor 推导某个缺失项的修复方式。
//
// 规则: 有匹配的 apply 步骤才算能自动 —— 没有步骤就只能是"给命令/给链接",
// 绝不能凭 check 的形态猜(以前版本按 kind 猜 auto, 结果点了按钮什么也没发生)。
func (s *EnvironmentSpec) fixFor(c CheckDef) string {
	if s != nil {
		for _, a := range s.Apply {
			if a.ID == c.ID || (a.Check != "" && a.Check == c.ID) {
				if a.Needs == "root" {
					return FixRoot
				}
				return FixAuto
			}
		}
	}
	if strings.TrimSpace(c.Guide) != "" {
		return FixManual
	}
	return FixNone
}

// applyStepsFor 找出能修复某个检查项的步骤 id。
//
// 前端不能自己猜"哪个步骤修哪一项" —— 它看不见清单里的 apply 块,
// 猜错的后果是点了"一键修复"却什么都没发生(或者跑了不相干的命令)。
// 所以由后端把映射关系算好一起给出去。
func (s *EnvironmentSpec) applyStepsFor(c CheckDef) []string {
	if s == nil {
		return nil
	}
	var out []string
	for _, a := range s.Apply {
		if a.ID == c.ID || (a.Check != "" && a.Check == c.ID) {
			out = append(out, a.ID)
		}
	}
	return out
}
