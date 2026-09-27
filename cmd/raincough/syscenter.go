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

	// 接口监控(真实数据: apiMon 中间件在请求链路上采集)
	case sub == "api-monitor/stats" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, apiMon.stats())
	case sub == "api-monitor/calls" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"calls": apiMon.recent()})
	case sub == "api-monitor/clear" && r.Method == http.MethodPost:
		apiMon.clear()
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported: " + r.Method + " /api/sysfunc/" + sub})
	}
}
