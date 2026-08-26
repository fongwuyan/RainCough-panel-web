package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
)

// 补充旧前端 api.js 依赖的系统端点, 保持界面可用。

// handleDisks GET /api/disks (lsblk 磁盘列表)
func (s *server) handleDisks(w http.ResponseWriter, r *http.Request) {
	disks := lsblkDisks()
	writeJSON(w, http.StatusOK, map[string]interface{}{"disks": disks})
}

// handleDiskUnmount POST /api/disks/unmount {part}
func (s *server) handleDiskUnmount(w http.ResponseWriter, r *http.Request) {
	var b struct{ Part string `json:"part"` }
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Part == "" {
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
	var b struct{ Name string `json:"name"` }
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

// lsblkDisks 磁盘列表(真实 lsblk -J -b 输出, 带分区/挂载/使用率)。
func lsblkDisks() []map[string]interface{} {
	out, err := globalSys.Run("lsblk", "-J", "-b", "-o", "NAME,PATH,TYPE,SIZE,FSTYPE,LABEL,MOUNTPOINT,ROTA,HOTPLUG")
	if err != nil {
		log.Printf("[disks] lsblk 失败: %v (out=%q)", err, out)
		return []map[string]interface{}{}
	}
	var parsed struct {
		Blockdevices []struct {
			Name      string `json:"name"`
			Path      string `json:"path"`
			Type      string `json:"type"`
			Size      string `json:"size"`
			Rot       bool   `json:"rota"`
			Hotplug   bool   `json:"hotplug"`
			FSType    string `json:"fstype"`
			Label     string `json:"label"`
			Mount     string `json:"mountpoint"`
			Children  []struct {
				Name      string `json:"name"`
				Path      string `json:"path"`
				Type      string `json:"type"`
				Size      string `json:"size"`
				FSType    string `json:"fstype"`
				Label     string `json:"label"`
				Mount     string `json:"mountpoint"`
			} `json:"children"`
		} `json:"blockdevices"`
	}
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		return []map[string]interface{}{}
	}
	var disks []map[string]interface{}
	for _, b := range parsed.Blockdevices {
		if b.Type != "disk" || strings.HasPrefix(b.Name, "loop") || strings.HasPrefix(b.Name, "ram") {
			continue
		}
		partitions := []map[string]interface{}{}
		for _, c := range b.Children {
			part := map[string]interface{}{
				"path": c.Path, "name": c.Name, "fstype": c.FSType,
				"label": c.Label, "mountpoint": c.Mount, "size": parseSizeStr(c.Size),
				"mounted": c.Mount != "", "removable": false,
			}
			// 使用率: 挂载点 + 真实用量(从 df)
			addPartUsage(part, c.Mount)
			partitions = append(partitions, part)
		}
		disks = append(disks, map[string]interface{}{
			"name": b.Name, "path": b.Path, "type": b.Type,
			"size": parseSizeStr(b.Size), "hotplug": b.Hotplug, "removable": false,
			"model": "", "tran": "",
			"partitions": partitions,
		})
	}
	return disks
}

// parseSizeStr 把 lsblk 大小字符串("119.2G"/字节数字)解析为 uint64。
func parseSizeStr(s string) uint64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	// 已是纯数字(lsblk -b 输出)
	if v, err := strconv.ParseUint(s, 10, 64); err == nil {
		return v
	}
	// 人类可读格式兜底: 如 "119.2G"
	var num float64
	var unit string
	fmt.Sscanf(s, "%f%s", &num, &unit)
	mult := map[string]float64{"B": 1, "K": 1 << 10, "M": 1 << 20, "G": 1 << 30, "T": 1 << 40}[unit]
	if mult == 0 && unit != "" {
		mult = 1
	}
	return uint64(num * mult)
}

// addPartUsage 为挂载分区补充 used/total/percent(读 /proc/mounts + statfs 简化为 df)。
func addPartUsage(part map[string]interface{}, mount string) {
	if mount == "" {
		return
	}
	out, err := globalSys.Run("df", "-P", "-k", mount)
	if err != nil {
		return
	}
	lines := strings.Split(out, "\n")
	if len(lines) < 2 {
		return
	}
	f := strings.Fields(lines[1])
	if len(f) >= 5 {
		total, _ := strconv.ParseFloat(f[1], 64)
		used, _ := strconv.ParseFloat(f[2], 64)
		pct, _ := strconv.ParseFloat(strings.TrimSuffix(f[4], "%"), 64)
		if total > 0 {
			part["total"] = total * 1024
			part["used"] = used * 1024
			part["percent"] = pct
		}
	}
}