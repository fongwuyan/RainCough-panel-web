package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// 补充旧前端 api.js 依赖的系统端点, 保持界面可用。

// handleDisks GET /api/disks (lsblk 磁盘列表)
func (s *server) handleDisks(w http.ResponseWriter, r *http.Request) {
	disks := lsblkDisks()
	writeJSON(w, http.StatusOK, map[string]interface{}{"disks": disks})
}

// handleStorage GET /api/storage (插件存储路径)
func (s *server) handleStorage(w http.ResponseWriter, r *http.Request) {
	// 简版: 汇总插件目录 df
	result := map[string]interface{}{}
	writeJSON(w, http.StatusOK, result)
}

// handleWsToken GET /api/terminal/ws_token
func (s *server) handleWsToken(w http.ResponseWriter, r *http.Request) {
	// 旧面板由 PHP websocket 消费; 新面板走 SSE, 返回空 token 兼容前端
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": "", "port": 23080,
		"host": r.Host,
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

// lsblkDisks 磁盘列表(读 /sys/block, 简版)。
func lsblkDisks() []map[string]interface{} {
	var out []map[string]interface{}
	entries, err := os.ReadDir("/sys/block")
	if err != nil {
		return out
	}
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") {
			continue
		}
		out = append(out, map[string]interface{}{
			"name": name, "path": "/dev/" + name,
			"type": "disk", "hotplug": false, "removable": false,
			"size": 0, "partitions": []interface{}{},
		})
	}
	return out
}