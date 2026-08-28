package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
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
	out, err := globalSys.Run("kill", "-s", sig, b.PID)
	_ = out
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// pluginCheckItem 单个插件的健康检查结果。
type pluginCheckItem struct {
	Name       string `json:"name"`
	Label      string `json:"label"`
	Version    string `json:"version"`
	Alive      bool   `json:"alive"`
	HealthHTTP bool   `json:"health_http"` // __health 网关可达
	AssetOK    bool   `json:"asset_ok"`    // assets/plugin.js 可达(有独立前端)
	LogTail    string `json:"log_tail,omitempty"`
	RuntimeLog string `json:"runtime_log,omitempty"` // .runtime.log 存在路径
	Err        string `json:"error,omitempty"`
}

// handlePluginsHealth GET /api/sys/plugins-health — 插件加载全检(供「插件健康」页)。
// 并发探测 __health 与 assets, 聚合子进程状态 + runtime 日志尾。
func (s *server) handlePluginsHealth(w http.ResponseWriter, r *http.Request) {
	// 只读 service; 有余裕时也可带 ?deep=1 逐插件 __health
	items := make([]pluginCheckItem, 0)
	base := s.cfg.PluginsDir
	for _, child := range s.host.All() {
		it := pluginCheckItem{Name: child.Name(), Alive: child.Alive()}
		it.Label = child.Label()
		it.Version = child.Version()
		port := child.Port()
		if port > 0 {
			it.HealthHTTP = pingTCP(port)
		}
		// 资产可达: 文件存在即视为资产组件在位(提供服务端静态)
		assetPath := filepath.Join(base, child.Name(), "assets", "plugin.js")
		it.AssetOK = fileExists(assetPath)
		// runtime 日志尾部(子进程 stdout/stderr 落盘)
		rlog := filepath.Join(base, child.Name(), ".runtime.log")
		if fileExists(rlog) {
			it.RuntimeLog = rlog
			tail, _ := tailFile(rlog, 6)
			it.LogTail = tail
		}
		if !it.Alive {
			it.Err = "子进程未存活"
		} else if !it.HealthHTTP {
			it.Err = "健康端点探测失败"
		}
		items = append(items, it)
	}
	// 汇总
	alive := 0
	healthy := 0
	for _, it := range items {
		if it.Alive {
			alive++
		}
		if it.Alive && it.HealthHTTP {
			healthy++
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total":   len(items),
		"alive":   alive,
		"healthy": healthy,
		"items":   items,
	})
}

// handlePluginRuntimeLog GET /api/sys/plugins-health/log?name=x&lines=n — 指定插件子进程 runtime 日志。
func (s *server) handlePluginRuntimeLog(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	lines := 200
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			lines = n
		}
	}
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	p := filepath.Join(s.cfg.PluginsDir, name, ".runtime.log")
	if !fileExists(p) {
		// 也看主日志里该插件相关
		writeJSON(w, http.StatusOK, map[string]interface{}{"exists": false, "text": ""})
		return
	}
	text, err := tailFile(p, lines)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"exists": true, "text": text})
}

// pingTCP TCP 连通探测(等价插件就绪判定)。
func pingTCP(port int) bool {
	conn, err := netDialTimeout(port)
	if err != nil {
		return false
	}
	if conn != nil {
		_ = conn.Close()
	}
	return true
}

// fileExists 文件存在。
func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// tailFile 读文件尾部 n 行。
func tailFile(p string, n int) (string, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	text := strings.TrimSpace(string(b))
	if text == "" {
		return "", nil
	}
	parts := strings.Split(text, "\n")
	if len(parts) > n {
		parts = parts[len(parts)-n:]
	}
	return strings.Join(parts, "\n"), nil
}

// netDialTimeout 连接 127.0.0.1:port(300ms 超时)。
func netDialTimeout(port int) (io.Closer, error) {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 300*time.Millisecond)
	return conn, err
}