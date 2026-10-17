package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// handleServicesList GET /api/services/list
// 数据源: supervisor.List() (进程级) + 插件 registry (alive 状态)。
func (s *server) handleServicesList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
		return
	}
	supSnap := map[string]map[string]interface{}{}
	if globalSUP != nil {
		for _, snap := range globalSUP.List() {
			supSnap[snap.Name] = map[string]interface{}{
				"state":        snap.State,
				"pid":          snap.Pid,
				"crash_count":  snap.CrashCount,
				"last_exit":    snap.LastExit,
				"started_at":   snap.StartedAt,
				"up_sec":       snap.UpSec,
				"conn_seen":    snap.ConnSeen,
				"conn_seen_at": snap.ConnSeenAt,
				"autostart":    snap.Autostart,
				"stop_reason":  snap.StopReason,
			}
		}
	}
	plugins := globalPX.ListPlugins()
	out := make([]map[string]interface{}, 0, len(plugins))
	for _, p := range plugins {
		name, _ := p["name"].(string)
		unit := "plugin-" + name + ".service"
		sup, hasSup := supSnap[name]
		state := "未启动"
		if hasSup {
			state, _ = sup["state"].(string)
		}
		alive, _ := p["alive"].(bool)
		if alive && state == "" {
			state = "运行中"
		}
		row := map[string]interface{}{
			"unit":    unit,
			"name":    name,
			"label":   p["label"],
			"version": p["version"],
			"alive":   alive,
		}
		if installed, ok := p["installed"]; ok {
			row["installed"] = installed
		}
		if hasSup {
			row["state"] = state
			row["supervisor"] = sup
		} else {
			row["state"] = "unmanaged"
		}
		out = append(out, row)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"services": out})
}

// handleServicesAction POST /api/services/action {unit|name, action}
// action: start | stop | restart。
func (s *server) handleServicesAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 POST"})
		return
	}
	if globalSUP == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "supervisor 不可用"})
		return
	}
	var b struct {
		Unit   string `json:"unit"`
		Name   string `json:"name"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	name := strings.TrimSpace(b.Name)
	if name == "" {
		// 兼容: 从 unit=plugin-XXX.service 解析
		name = strings.TrimSuffix(strings.TrimPrefix(b.Unit, "plugin-"), ".service")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	var err error
	switch strings.ToLower(strings.TrimSpace(b.Action)) {
	case "start":
		err = globalSUP.StartPlugin(name)
	case "stop":
		err = globalSUP.StopPlugin(name)
	case "restart":
		err = globalSUP.RestartPlugin(name)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "action 支持: start/stop/restart"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	snap, _ := globalSUP.View(name)
	writeJSON(w, http.StatusOK, map[string]interface{}{"name": name, "action": b.Action, "state": snap.State})
}

// handleServicesLog GET /api/services/log?name=&lines=&grep=
// 读 supervisor 维护的 .runtime.log, 不再走 pluginx 的 conn.request (避免进程死了拉不到)。
func (s *server) handleServicesLog(w http.ResponseWriter, r *http.Request) {
	if globalSUP == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "supervisor 不可用"})
		return
	}
	q := r.URL.Query()
	name := strings.TrimSpace(q.Get("name"))
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	lines := 200
	if v := q.Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			lines = n
		}
	}
	grep := q.Get("grep")
	text, err := globalSUP.Tail(name, lines, grep)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"exists": true, "text": text, "total_lines": len(text),
		"size": len(text), "file": name + ".runtime.log",
	})
}

// handleServicesAutostart POST /api/services/autostart {name, on}
func (s *server) handleServicesAutostart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 POST"})
		return
	}
	if globalSUP == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "supervisor 不可用"})
		return
	}
	var b struct {
		Name string `json:"name"`
		On   *bool  `json:"on"`
		// Autostart 兼容写法: 早期前端/脚本可能用这个键。
		// ★ 用指针接收: 缺字段时是 nil, 能明确拒绝, 而不是静默当成 false
		//   (曾踩过: 传 {"autostart":true} 被忽略, 返回 autostart:false 却不报错)
		Autostart *bool `json:"autostart"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if b.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	on := b.On
	if on == nil {
		on = b.Autostart
	}
	if on == nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "缺少 on 字段(布尔值, 表示是否开机自启)",
		})
		return
	}
	if err := globalSUP.SetAutostart(b.Name, *on); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"name": b.Name, "autostart": *on})
}
