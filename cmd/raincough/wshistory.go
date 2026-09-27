package main

import (
	"net/http"
	"strconv"

	"raincough/internal/core"
)

// globalWSH 工作台常驻历史(每秒采样, 不限期, 仅"存储清理"可删)。
var globalWSH *core.WSHistory

// handleWSHistory GET /api/workspace/history?points=N — 供工作台页面回填历史图表。
// 只返回尾部最多 N 点(有界响应), 文件总量以 bytes 形式返回。
func (s *server) handleWSHistory(w http.ResponseWriter, r *http.Request) {
	if globalWSH == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "历史模块未初始化"})
		return
	}
	points := 600
	if v := r.URL.Query().Get("points"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			points = n
		}
	}
	series, pts, size, since := globalWSH.Status(points)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"series": series,
		"points": pts,
		"tail":   len(pts),
		"bytes":  size,
		"since":  since,
	})
}
