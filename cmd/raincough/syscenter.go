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
		// 兼容两种契约: {services:[{name...}]}(简化) 与 {units:[{unit...}]}(旧前端)
		services := list
		units := []map[string]interface{}{}
		for _, s := range list {
			units = append(units, map[string]interface{}{
				"unit": s["name"], "name": s["name"],
				"active": s["active"], "load": s["load"], "sub": s["sub"], "desc": s["desc"],
			})
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"services": services, "units": units})

	case sub == "service/action" && r.Method == http.MethodPost:
		var b struct {
			Name   string `json:"name"`
			Unit   string `json:"unit"`
			Action string `json:"action"`
			Act    string `json:"act"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if b.Unit != "" {
			b.Name = b.Unit
		}
		if b.Act != "" {
			b.Action = b.Act
		}
		if b.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "unit 必填"})
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
	case (sub == "fw/status" || sub == "fw/all") && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, func() map[string]interface{} {
			st, err := globalSys.FirewallStatus()
			if err != nil {
				return map[string]interface{}{"error": err.Error()}
			}
			// 前端 fw/all 期望完整规则列表
			st["all"] = st["rules"]
			return st
		}())

	// 接口监控(简单计数: 返回空统计, 保持契约)
	case strings.HasPrefix(sub, "api-monitor/stats") && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"total": 0, "by_status": map[string]int{}, "by_path": map[string]int{},
		})
	case strings.HasPrefix(sub, "api-monitor/calls") && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"calls": []interface{}{}})
	case sub == "api-monitor/clear" && r.Method == http.MethodPost:
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported: " + r.Method + " /api/sysfunc/" + sub})
	}
}
