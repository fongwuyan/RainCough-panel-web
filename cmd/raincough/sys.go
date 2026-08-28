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

	"raincough/internal/host"
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

// pluginCheckItem 单个插件的健康检查结果(信息丰富版)。
type pluginCheckItem struct {
	Name       string `json:"name"`
	Label      string `json:"label"`
	Version    string `json:"version"`
	Lang       string `json:"lang,omitempty"`
	Author     string `json:"author,omitempty"`
	Description string `json:"description,omitempty"`
	Routes     int    `json:"routes,omitempty"`
	Alive      bool   `json:"alive"`
	HealthHTTP bool   `json:"health_http"` // __health 网关可达
	AssetOK    bool   `json:"asset_ok"`    // assets/plugin.js 可达(有独立前端)
	PID        int    `json:"pid,omitempty"`
	Port       int    `json:"port,omitempty"`
	StartedAt  int64  `json:"started_at,omitempty"` // unix
	UptimeSec  int64  `json:"uptime_sec,omitempty"`
	DeadCount  int    `json:"dead_count,omitempty"`
	LogTail    string `json:"log_tail,omitempty"`
	RuntimeLog string `json:"runtime_log,omitempty"` // .runtime.log 存在路径
	Err        string `json:"error,omitempty"`
}

// handlePluginsHealth GET /api/sys/plugins-health — 插件加载全检(供「插件健康」页)。
// 遍历插件目录(含未加载), 聚合子进程状态/元数据/runtime 日志。
func (s *server) handlePluginsHealth(w http.ResponseWriter, r *http.Request) {
	items := make([]pluginCheckItem, 0)
	base := s.cfg.PluginsDir
	dead := s.host.DeadCounts()
	seen := map[string]bool{}
	for _, child := range s.host.All() {
		n := child.Name()
		seen[n] = true
		it := pluginCheckItem{Name: n, Label: child.Label(), Version: child.Version()}
		info := child.ManifestInfo()
		if v, ok := info["lang"].(string); ok { it.Lang = v }
		if v, ok := info["author"].(string); ok { it.Author = v }
		if v, ok := info["description"].(string); ok { it.Description = v }
		if v, ok := info["routes"].([]string); ok { it.Routes = len(v) }
		it.Alive = child.Alive()
		it.Port = child.Port()
		it.PID = child.PID()
		st := child.StartedAt()
		if !st.IsZero() {
			it.StartedAt = st.Unix()
			it.UptimeSec = int64(time.Since(st).Seconds())
		}
		if it.Port > 0 {
			it.HealthHTTP = pingTCP(it.Port)
		}
		assetPath := filepath.Join(base, n, "assets", "plugin.js")
		it.AssetOK = fileExists(assetPath)
		rlog := filepath.Join(base, n, ".runtime.log")
		if fileExists(rlog) {
			it.RuntimeLog = rlog
			tail, _ := tailFile(rlog, 8)
			it.LogTail = tail
		}
		it.DeadCount = dead[n]
		switch {
		case !it.Alive:
			it.Err = "子进程未存活" + errSuffix(child.StartErr())
		case !it.HealthHTTP:
			it.Err = "健康端点探测失败"
		}
		items = append(items, it)
	}
	// 目录中存在但未加载的插件(manifest 失败/退避中/资源型)
	entries, err := os.ReadDir(base)
	if err == nil {
		for _, e := range entries {
			if !e.IsDir() || strings.HasPrefix(e.Name(), ".") || seen[e.Name()] ||
				e.Name() == "demo" {
				continue
			}
			it := pluginCheckItem{Name: e.Name(), Label: e.Name()}
			full := filepath.Join(base, e.Name())
			m, merr := host.LoadManifest(full)
			if merr != nil {
				it.Err = "manifest 加载失败: " + merr.Error()
			} else {
				it.Label = m.Label; it.Version = m.Version
				it.Lang = m.Lang; it.Author = m.Author
				it.Description = m.Description
				it.Routes = len(m.Routes)
				if dc := dead[e.Name()]; dc > 0 {
					it.DeadCount = dc
					it.Err = "启动失败退避中(第 " + strconv.Itoa(dc) + " 次)"
				} else {
					it.Err = "未加载"
				}
			}
			rlog := filepath.Join(full, ".runtime.log")
			if fileExists(rlog) {
				it.RuntimeLog = rlog
				tail, _ := tailFile(rlog, 8)
				it.LogTail = tail
			}
			items = append(items, it)
		}
	}

// pingTCP TCP 连通探测(等价插件就绪判定)。

	// 总汇
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
		"total": len(items),
		"alive": alive,
		"healthy": healthy,
		"items": items,
		"checked_at": time.Now().Unix(),
	})
}

func errSuffix(s string) string {
	if s == "" {
		return ""
	}
	return ":「" + s + "」"
}

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

// handlePluginRuntimeLog GET /api/sys/plugins-health/log?name=x&lines=n&offset=m&grep=k&source=system|runtime
// source=runtime(默认): 插件子进程完整控制台日志(.runtime.log 从启动追加)。
// source=system: 主系统日志(srv.log + syslog)中该插件的加载/错误/运行痕迹(含前后文)。
func (s *server) handlePluginRuntimeLog(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	source := r.URL.Query().Get("source")
	if source == "" {
		source = "runtime"
	}
	lines := 200
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			lines = n
		}
	}
	grep := r.URL.Query().Get("grep")

	// ---- 系统日志模式: 主进程日志中的插件痕迹 ----
	if source == "system" {
		text, total, size := collectPluginSystemLog(name, grep)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"exists": true, "text": text, "total_lines": total,
			"size": size, "file": "system",
		})
		return
	}

	// ---- runtime 模式 ----
	p := filepath.Join(s.cfg.PluginsDir, name, ".runtime.log")
	if !fileExists(p) {
		writeJSON(w, http.StatusOK, map[string]interface{}{"exists": false, "text": "", "total_lines": 0, "size": 0})
		return
	}
	st, _ := os.Stat(p)
	size := st.Size()
	text, err := readLogRange(p, 0, lines)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	total := 0
	if strings.TrimSpace(text) == "" {
		total = 0
	} else {
		total = strings.Count(text, "\n") + 1
	}
	if grep != "" {
		var keep []string
		for _, l := range strings.Split(text, "\n") {
			if strings.Contains(l, grep) {
				keep = append(keep, l)
			}
		}
		text = strings.Join(keep, "\n")
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"exists": true, "text": text, "total_lines": total,
		"size": size, "file": p,
	})
}

// collectPluginSystemLog 从主系统日志(srv.log + syslog + messages)提取某插件的痕迹:
// 匹配插件名([host] 已加载:/启动失败/错误/单独出现), 支持 grep 二级过滤, 返回去重拼接文本。
func collectPluginSystemLog(name, grep string) (text string, total int, size int64) {
	paths := []string{"/home/f/raincough-dev/srv.log", "/var/log/syslog", "/var/log/messages"}
	var out []string
	var sz int64
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		sz += int64(len(b))
		lines := strings.Split(string(b), "\n")
		for _, l := range lines {
			if l == "" {
				continue
			}
			// 匹配: 插件名作为独立词(兼容大小写)
			hit := strings.Contains(l, name) ||
				strings.Contains(l, strings.ToLower(name)) ||
				strings.Contains(l, strings.ToUpper(name)) ||
				strings.Contains(l, "[host]") && (strings.Contains(l, "已加载: "+name) || strings.Contains(l, "启动失败"+"["+name+"]"))
			if !hit {
				continue
			}
			// 移除与主日志重复(同文件多次读到的行去重保序)
			dup := false
			for _, ex := range out {
				if ex == l {
					dup = true
					break
				}
			}
			if dup {
				continue
			}
			if grep != "" && !strings.Contains(l, grep) {
				continue
			}
			out = append(out, l)
		}
	}
	// 限制尾部(取最后 2000 行防过大)
	keep := len(out)
	if keep > 2000 {
		out = out[keep-2000:]
		keep = 2000
	}
	return strings.Join(out, "\n"), keep, sz
}

// readLogRange 读取日志行区间: offset=0 且 lines=0 返回全部;
// offset>0 时按行窗口(lines 行)返回; 否则返回尾部 lines 行。
func readLogRange(p string, offset, lines int) (string, error) {
	b, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	text := strings.TrimRight(string(b), "\n")
	if text == "" {
		return "", nil
	}
	parts := strings.Split(text, "\n")
	// grep 之外: 全量
	if offset == 0 && lines == 0 {
		return strings.Join(parts, "\n"), nil
	}
	if offset > 0 {
		// 从 offset 起 lines 行(offset 是行偏移)
		end := offset + lines
		if end > len(parts) {
			end = len(parts)
		}
		if offset > len(parts) {
			offset = len(parts)
		}
		return strings.Join(parts[offset:end], "\n"), nil
	}
	// 尾部 lines 行
	if len(parts) > lines {
		parts = parts[len(parts)-lines:]
	}
	return strings.Join(parts, "\n"), nil
}