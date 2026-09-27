package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

// 补充旧前端 api.js 依赖的系统端点, 保持界面可用。

// 磁盘列表缓存(1s 节拍下避免每请求都 exec lsblk+df)。
var disksCache struct {
	mu    sync.Mutex
	data  []map[string]interface{}
	stamp time.Time
}

// handleDisks GET /api/disks (lsblk 磁盘列表, 1s 节拍缓存)
func (s *server) handleDisks(w http.ResponseWriter, r *http.Request) {
	disksCache.mu.Lock()
	if time.Since(disksCache.stamp) < time.Second && disksCache.data != nil {
		data := disksCache.data
		disksCache.mu.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"disks": data})
		return
	}
	disksCache.mu.Unlock()
	disks := globalSys.LsblkDisks()
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
	if b.Part == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "part 必填"})
		return
	}
	if b.Part == "/" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "禁止卸载根分区"})
		return
	}
	out, err := globalSys.Sudo("umount", b.Part)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error(), "output": out})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleEnvStartStop POST /api/envpkg/start|stop {name}
func (s *server) handleEnvStartStop(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	action := "start"
	if strings.HasSuffix(r.URL.Path, "/stop") {
		action = "stop"
	}
	// 环境包启停由 EnvManager 处理; 此处返回兼容响应
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "name": b.Name, "action": action, "message": "ok"})
}

// handleWsToken GET /api/terminal/ws_token
// [F6 死端点处置] websocket-terminal(23080) 服务已于 2026-09-26 随旧面板删除,
// 终端已改走 SSE(/api/terminal/stream)。端点保留仅为兼容旧客户端,
// 但【不再返回指向不存在服务的 port】, 改为显式 deprecated + 指明新传输方式。
func (s *server) handleWsToken(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":      "",
		"port":       0,
		"host":       r.Host,
		"deprecated": true,
		"transport":  "sse",
		"stream":     "/api/terminal/stream",
		"note":       "websocket-terminal(23080) 已移除, 请使用 SSE 流",
	})
}

// handleSysProcessesKill POST /api/sys/processes/kill
func (s *server) handleSysProcessesKill(w http.ResponseWriter, r *http.Request) {
	var b struct {
		PID string `json:"pid"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.PID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "pid 必填"})
		return
	}
	out, err := globalSys.KillProcess(b.PID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error(), "output": out})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleTasksPurge POST /api/tasks/purge
func (s *server) handleTasksPurge(w http.ResponseWriter, r *http.Request) {
	n := globalTasks.Cleanup(0)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "removed": n})
}

// handleSchedulerActions GET /api/scheduler/actions
func (s *server) handleSchedulerActions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"actions": []map[string]interface{}{
			{"key": "shell", "label": "Shell 命令"},
			{"key": "gen_img", "label": "AI 生图"},
			{"key": "grab_setu", "label": "抓取涩图"},
			{"key": "clean_tmp", "label": "清理临时目录"},
		},
	})
}

// handleTerminalHosts /api/terminal/hosts 与 commands 的 CRUD(SSE 终端用)
// 旧面板存 data/terminal_hosts.json; 新面板用 SharedData 简版内存实现。
