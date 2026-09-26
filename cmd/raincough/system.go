package main

import (
	"net/http"
	"strings"

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
	sub := strings.TrimPrefix(r.URL.Path, "/api/system/")
	switch sub {
	case "gpus":
		// 工作台 GPU 卡: 全部核显/独显(lspci + nvidia-smi + sysfs, 3s 缓存)
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"gpus": core.GPUs()})
	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "not implemented"})
	}
}
