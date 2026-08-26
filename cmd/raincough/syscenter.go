package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"raincough/internal/core"
)

// 全局系统中心(main 中初始化)。
var globalSys *core.SysCenter

// handleSysCenter 系统中心路由: /api/sysfunc/<sub>
func (s *server) handleSysCenter(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/")
	switch {
	// 服务管理
	case sub == "service/list" && r.Method == http.MethodGet:
		list, err := globalSys.ServiceList()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"services": list})

	case sub == "service/action" && r.Method == http.MethodPost:
		var b struct {
			Name   string `json:"name"`
			Action string `json:"action"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		out, err := globalSys.ServiceAction(b.Name, b.Action)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error(), "output": out})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "output": out})

	// 进程
	case sub == "process/list" && r.Method == http.MethodGet:
		list, err := globalSys.ProcessList()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"processes": list})

	case sub == "process/kill" && r.Method == http.MethodPost:
		var b struct {
			PID string `json:"pid"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		out, err := globalSys.KillProcess(b.PID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error(), "output": out})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	// 日志
	case sub == "log" && r.Method == http.MethodGet:
		path := r.URL.Query().Get("path")
		lines := 200
		if l := r.URL.Query().Get("lines"); l != "" {
			var n int
			if _, err := fmtSscan(l, &n); err == nil {
				lines = n
			}
		}
		grep := r.URL.Query().Get("grep")
		logs, err := globalSys.TailLog(path, lines, grep)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"path": path, "logs": logs})

	case sub == "log/journal" && r.Method == http.MethodGet:
		unit := r.URL.Query().Get("unit")
		lines := 100
		logs, err := globalSys.JournalLog(unit, lines)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"unit": unit, "logs": logs})

	// 防火墙
	case sub == "fw/status" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, func() map[string]interface{} {
			st, err := globalSys.FirewallStatus()
			if err != nil {
				return map[string]interface{}{"error": err.Error()}
			}
			return st
		}())

	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported: " + r.Method + " /api/sysfunc/" + sub})
	}
}