package main

import (
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
)

// handleSysLogs GET /api/sys/logs?lines=&grep= — 系统日志(兼容旧前端 Logs.vue)
func (s *server) handleSysLogs(w http.ResponseWriter, r *http.Request) {
	lines := 200
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			lines = n
		}
	}
	grep := r.URL.Query().Get("grep")
	// 主程序日志 + 系统日志兜底
	paths := []string{"/home/f/raincough-dev/srv.log", "/var/log/syslog", "/var/log/messages"}
	var all []string
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		text := strings.TrimSpace(string(b))
		if text == "" {
			continue
		}
		parts := strings.Split(text, "\n")
		// 每文件保留目标行数, 分摊
		per := lines/len(paths) + 5
		if len(parts) > per {
			parts = parts[len(parts)-per:]
		}
		all = append([]string{"===== " + p + " ====="}, append(parts, all...)...)
	}
	if grep != "" {
		var filtered []string
		for _, l := range all {
			if strings.Contains(l, grep) {
				filtered = append(filtered, l)
			}
		}
		all = filtered
	}
	if len(all) > lines {
		all = all[len(all)-lines:]
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"text": strings.Join(all, "\n")})
}

// handleSysProcesses GET /api/sys/processes?sort= — 进程列表(兼容旧前端 Processes.vue)
func (s *server) handleSysProcesses(w http.ResponseWriter, r *http.Request) {
	sortKey := r.URL.Query().Get("sort")
	if sortKey == "" {
		sortKey = "cpu"
	}
	out, err := globalSys.Run("ps", "axo", "pid,user,pcpu,pmem,comm,args,etime")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	procs := []map[string]interface{}{}
	lines := strings.Split(out, "\n")
	for i, line := range lines {
		if i == 0 || strings.TrimSpace(line) == "" {
			continue
		}
		f := strings.Fields(line)
		if len(f) < 6 {
			continue
		}
		cpu, _ := strconv.ParseFloat(f[2], 64)
		mem, _ := strconv.ParseFloat(f[3], 64)
		// args 可能含空格, comm=f[4]
		argsIdx := 5
		cmdline := strings.Join(f[argsIdx:], " ")
		procs = append(procs, map[string]interface{}{
			"pid": f[0], "username": f[1], "cpu": cpu, "mem": mem,
			"name": f[4], "cmdline": cmdline, "create_time": 0,
		})
	}
	switch sortKey {
	case "pid":
		sort.Slice(procs, func(a, b int) bool { return procs[a]["pid"].(string) < procs[b]["pid"].(string) })
	case "mem":
		sort.Slice(procs, func(a, b int) bool { return procs[a]["mem"].(float64) > procs[b]["mem"].(float64) })
	default:
		sort.Slice(procs, func(a, b int) bool { return procs[a]["cpu"].(float64) > procs[b]["cpu"].(float64) })
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"processes": procs})
}

// handleSysKill POST /api/sys/processes/kill {pid, sig} — 结束进程
func (s *server) handleSysKill(w http.ResponseWriter, r *http.Request) {
	var b struct {
		PID string `json:"pid"`
		Sig string `json:"sig"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.PID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "pid 必填"})
		return
	}
	sig := b.Sig
	if sig == "" {
		sig = "SIGKILL"
	}
	_, err := globalSys.Run("kill", "-s", sig, b.PID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}
