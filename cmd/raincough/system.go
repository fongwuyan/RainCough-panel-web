package main

import (
	"net/http"
	"time"

	"raincough/internal/core"
)

// 全局系统监控器(带 1.5s 缓存, 高频轮询降载)。
var sysMon = core.NewSystemMonitor()

// handleSystem 系统概览(与旧版 /api/system 契约全量兼容)。
func (s *server) handleSystem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
		return
	}
	writeJSON(w, http.StatusOK, sysMon.Snapshot())
}

// handleSystemSub 细分端点。
func (s *server) handleSystemSub(w http.ResponseWriter, r *http.Request) {
	// 预留: /api/system/processes /api/system/net 等(M4 展开)
	writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "not implemented"})
}

var _ = time.Now // 保留 time 依赖位(未来扩展)
