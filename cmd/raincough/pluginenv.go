package main

// 插件环境检查与准备。
//
//   GET  /api/plugins/{name}/environment        → 只读报告(跑 check[])
//   POST /api/plugins/{name}/environment/apply   → 执行 apply[] 步骤(需显式确认)
//
// 为什么单独开接口而不是塞进 /api/plugins 列表:
//   · 检查要执行 shell 命令, 有耗时(典型 3-5 条、每条 <1s), 塞进列表会让插件页变慢
//   · 结果依赖"当前时刻", 列表接口被前端缓存后就不准了
//   · 用户可能只想看某个插件的环境, 没必要为它扫全部插件
//
// 安全: check 只跑清单里 check[] 的命令, 不执行 apply[]。这个接口可以反复调、随便调。
//
// apply 的安全边界见 internal/pluginrt/envapply.go 的注释 —— 最要紧的一条:
// **前端只传步骤 id, 绝不接受命令原文**, 否则面板就成了任意 shell 执行器。

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"raincough/internal/pluginrt"
)

// handlePluginEnvReport 返回插件的环境报告。
//
// 路径参数 name 由 handlePlugin 解析, 可能是任意大小写(jmcomic / JMComic)。
func (s *server) handlePluginEnvReport(w http.ResponseWriter, r *http.Request, name string) {
	dir := s.resolvePluginDir(name)
	if dir == "" {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "插件目录不存在: " + name,
		})
		return
	}
	rep := s.buildEnvReport(name, dir)
	writeJSON(w, http.StatusOK, rep)
}

// handlePluginEnvApply 执行清单里声明的环境准备步骤。
//
// 请求体:
//
//	{ "steps": ["deps", "unit"], "confirm": true }
//
// steps 为空 = 执行清单里全部 apply 步骤。
// confirm 必须为 true —— 后端硬门槛, 不靠前端自觉。
func (s *server) handlePluginEnvApply(w http.ResponseWriter, r *http.Request, name string) {
	dir := s.resolvePluginDir(name)
	if dir == "" {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"error": "插件目录不存在: " + name,
		})
		return
	}

	var body struct {
		Steps   []string `json:"steps"`
		Confirm bool     `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err.Error() != "EOF" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "请求体解析失败: " + err.Error(),
		})
		return
	}

	spec, specErr := pluginrt.LoadEnvSpec(dir)
	if specErr != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "environment 清单非法, 拒绝执行: " + specErr.Error(),
		})
		return
	}
	if spec == nil || len(spec.Apply) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "该插件未声明可执行的环境准备步骤",
		})
		return
	}

	runner := s.envRunner(name, dir)
	res, err := runner.Apply(spec, body.Steps, body.Confirm)
	if err != nil {
		// 参数/级别/确认这类问题 → 400, 用户改一下能重来
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":     res.OK,
		"plugin": res.Plugin,
		"steps":  res.Steps,
		"denied": res.Denied,
		"env":    res.Report,
	})
}

// buildEnvReport 生成插件的环境报告(只读)。
//
// 清单非法时不返回错误, 而是丢弃 environment 继续给基础报告,
// 因为用户此刻最需要知道的恰恰是"这台机器差什么", 而不是"清单第几行写错了"。
func (s *server) buildEnvReport(name, dir string) *pluginrt.EnvReport {
	spec, specErr := pluginrt.LoadEnvSpec(dir)
	rep := s.envRunner(name, dir).Report(spec)
	if specErr != nil {
		rep.Warn = appendWarn(rep.Warn, "environment 清单非法, 已忽略: "+specErr.Error())
	}
	return &rep
}

// envRunner 造一个带当前环境上下文的 runner。
func (s *server) envRunner(name, dir string) *pluginrt.EnvRunner {
	r := &pluginrt.EnvRunner{
		Dir:    dir,
		Python: "python3",
		Root:   pluginrt.IsRoot(),
	}
	// 本插件进程 PID: 供 owner.plugin="self" 判定"升级时自己占着端口不算冲突"。
	// supervisor 按插件目录名登记, 所以用目录名而不是 URL 里的大小写变体。
	if globalSUP != nil {
		key := filepath.Base(filepath.Clean(dir))
		if snap, err := globalSUP.View(key); err == nil {
			r.SelfPID = snap.Pid
		}
	}
	return r
}

// resolvePluginDir 由插件名定位目录。
//
// 与 pluginx 的 resolveName 不同: 那边只认已注册插件(registry/restRoutes),
// 这里直接看磁盘 —— 插件进程崩了、注册表还没重扫时也要能查环境。
func (s *server) resolvePluginDir(name string) string {
	base := strings.TrimSpace(s.cfg.PluginsDir)
	name = strings.TrimSpace(name)
	if base == "" || name == "" || name == "." || name == ".." {
		return ""
	}
	if strings.ContainsAny(name, `/\`) {
		return ""
	}
	if p := filepath.Join(base, name); hasManifest(p) {
		return p
	}
	// 大小写不敏感回退: 移动端/第三方客户端常传小写
	entries, err := os.ReadDir(base)
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		if !strings.EqualFold(e.Name(), name) {
			continue
		}
		if p := filepath.Join(base, e.Name()); hasManifest(p) {
			return p
		}
	}
	return ""
}

func hasManifest(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "plugin.json"))
	return err == nil
}

// appendWarn 合并提示, 避免后一条覆盖前一条。
func appendWarn(old, add string) string {
	switch {
	case old == "":
		return add
	case add == "":
		return old
	default:
		return old + "; " + add
	}
}
