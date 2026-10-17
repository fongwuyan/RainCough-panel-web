package main

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"raincough/internal/core"
)

// 旧前端 api.js 依赖的兼容端点。磁盘与网络已全部改为读 /proc /sys, 不再调用 lsblk/df/ip。

// 磁盘列表缓存(1s 节拍下避免每请求都扫 /proc/partitions + Statfs)。
var disksCache struct {
	mu    sync.Mutex
	data  []map[string]interface{}
	stamp time.Time
}

// handleDisks GET /api/disks
func (s *server) handleDisks(w http.ResponseWriter, r *http.Request) {
	disksCache.mu.Lock()
	if time.Since(disksCache.stamp) < time.Second && disksCache.data != nil {
		data := disksCache.data
		disksCache.mu.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"disks": data})
		return
	}
	disksCache.mu.Unlock()

	disks := core.Disks()
	disksCache.mu.Lock()
	disksCache.data = disks
	disksCache.stamp = time.Now()
	disksCache.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]interface{}{"disks": disks})
}

// handleDiskUnmount POST /api/disks/unmount {part|device}
func (s *server) handleDiskUnmount(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Part   string `json:"part"`
		Device string `json:"device"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if b.Part == "" {
		b.Part = b.Device
	}
	if err := core.Unmount(b.Part); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	disksCache.mu.Lock()
	disksCache.stamp = time.Time{} // 失效缓存
	disksCache.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleNetStatus GET /api/net/status
func (s *server) handleNetStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
		return
	}
	writeJSON(w, http.StatusOK, core.NetStatus())
}

// handleWsToken GET /api/terminal/ws_token
// websocket-terminal 服务早已移除, 终端走 SSE(/api/terminal/stream)。
// 端点保留仅为兼容旧客户端, 显式返回 deprecated 并指明新传输方式。
func (s *server) handleWsToken(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":      "",
		"port":       0,
		"host":       r.Host,
		"deprecated": true,
		"transport":  "sse",
		"stream":     "/api/terminal/stream",
		"note":       "websocket-terminal 已移除, 请使用 SSE 流",
	})
}

// handleTasksPurge POST /api/tasks/purge
// 只接受 POST: 清理是破坏性操作, 不能让 GET(链接/图片/预取)误触发。
func (s *server) handleTasksPurge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	n := globalTasks.Cleanup(0)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "removed": n})
}
