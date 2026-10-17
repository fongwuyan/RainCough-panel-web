package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

// 插件服务视图(替代原系统中心的 /api/sysfunc/service/*)。
// v6 起插件进程由 Go 自管, 这里只暴露注册表状态; 启停动作留给运行时 supervisor。

// handleServicesList GET /api/services/list
func (s *server) handleServicesList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
		return
	}
	plugins := globalPX.ListPlugins()
	out := make([]map[string]interface{}, 0, len(plugins))
	for _, p := range plugins {
		name, _ := p["name"].(string)
		unit := "plugin-" + name + ".service"
		state := "未启动"
		if alive, _ := p["alive"].(bool); alive {
			state = "运行中"
		}
		out = append(out, map[string]interface{}{
			"unit":    unit,
			"name":    name,
			"label":   p["label"],
			"version": p["version"],
			"state":   state,
			"alive":   p["alive"],
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"services": out})
}

// handleServicesAction POST /api/services/action {unit, action}
func (s *server) handleServicesAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 POST"})
		return
	}
	var b struct {
		Unit   string `json:"unit"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	b.Unit = strings.TrimSpace(b.Unit)
	if b.Unit == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "unit 必填"})
		return
	}
	// 进程自管(supervisor)在插件运行时重建后接管; 当前没有可启停的插件进程。
	writeJSON(w, http.StatusNotImplemented, map[string]interface{}{
		"error": "插件运行时尚未重建, 服务启停暂不可用",
		"unit":  b.Unit,
	})
}
