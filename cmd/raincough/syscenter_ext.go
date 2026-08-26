package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// 系统中心扩展端点(对应旧前端 api.js sysf* 契约, 脚本化 sudo 执行)。

func (s *server) sysfHardware(w http.ResponseWriter, r *http.Request) {
	out := map[string]interface{}{}
	if b, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		out["cpuinfo"] = string(b)
	}
	if b, err := os.ReadFile("/proc/meminfo"); err == nil {
		out["meminfo"] = string(b)
	}
	out["cpu_count"] = runtimeNumCPU()
	if sb, err := os.ReadFile("/sys/class/dmi/id/product_name"); err == nil {
		out["product"] = strings.TrimSpace(string(sb))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *server) sysfUpdates(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/updates/")
	switch r.Method {
	case http.MethodGet:
		out, err := globalSys.Sudo("apt", "list", "--upgradable", "-q")
		var lines []string
		for _, l := range strings.Split(out, "\n") {
			l = strings.TrimSpace(l)
			if l == "" || strings.HasPrefix(l, "Listing") || strings.Contains(l, "upgradable") {
				continue
			}
			lines = append(lines, l)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"updates": lines, "error": errStr(err)})
	case http.MethodPost:
		if sub == "refresh" {
			_, err := globalSys.Sudo("apt", "update", "-q")
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "message": "ok", "error": errStr(err)})
		} else if sub == "run" {
			go func() { globalSys.Sudo("apt", "upgrade", "-y") }()
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "started-in-background"})
		} else {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported"})
		}
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method"})
	}
}

func (s *server) sysfCron(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		user := r.URL.Query().Get("user")
		out, _ := cronTabFor(user)
		writeJSON(w, http.StatusOK, map[string]interface{}{"user": user, "content": out})
	case http.MethodPost:
		var b struct {
			User    string `json:"user"`
			Content string `json:"content"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		err := saveCronTab(b.User, b.Content)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "error": errStr(err)})
	}
}

func cronTabFor(user string) (string, error) {
	if user == "" {
		user = "root"
	}
	path := "/var/spool/cron/crontabs/" + user
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func saveCronTab(user, content string) error {
	if user == "" {
		user = "root"
	}
	path := "/var/spool/cron/crontabs/" + user
	if err := os.MkdirAll("/var/spool/cron/crontabs", 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o600)
}

func (s *server) sysfDisks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"disks": lsblkDisks()})
}

func (s *server) sysfSnap(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/snapshot/")
	switch sub {
	case "cap":
		out, err := globalSys.Sudo("lvs", "--noheadings", "-o", "lv_name,lv_size,lv_attr")
		caps := []map[string]interface{}{}
		for _, line := range strings.Split(out, "\n") {
			f := strings.Fields(line)
			if len(f) >= 3 {
				caps = append(caps, map[string]interface{}{"name": f[0], "size": f[1], "attr": f[2]})
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"volumes": caps, "error": errStr(err)})
	case "create":
		var b struct{ Name string `json:"name"` }
		json.NewDecoder(r.Body).Decode(&b)
		out, err := globalSys.Sudo("lvcreate", "-L", "2G", "-s", "-n", b.Name, "vg0/root")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	case "list":
		out, err := globalSys.Sudo("lvs", "--noheadings", "-o", "lv_name,lv_size,lv_attr")
		writeJSON(w, http.StatusOK, map[string]interface{}{"output": out, "error": errStr(err)})
	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported"})
	}
}

func (s *server) sysfUsers(w http.ResponseWriter, r *http.Request) {
	out, _ := os.ReadFile("/etc/passwd")
	var users []map[string]interface{}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.Split(line, ":")
		if len(f) >= 7 && !strings.Contains(f[6], "nologin") && f[6] != "/bin/false" {
			users = append(users, map[string]interface{}{"name": f[0], "uid": f[2], "home": f[5], "shell": f[6]})
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"users": users})
}

func (s *server) sysfSshKeys(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("user")
	if user == "" {
		user = "root"
	}
	path := "/home/" + user + "/.ssh/authorized_keys"
	if user == "root" {
		path = "/root/.ssh/authorized_keys"
	}
	b, err := os.ReadFile(path)
	writeJSON(w, http.StatusOK, map[string]interface{}{"user": user, "keys": string(b), "error": errStr(err)})
}

func (s *server) sysfSshKeysSave(w http.ResponseWriter, r *http.Request) {
	var b struct {
		User string `json:"user"`
		Keys string `json:"keys"`
	}
	json.NewDecoder(r.Body).Decode(&b)
	home := "/home/" + b.User
	if b.User == "root" {
		home = "/root"
	}
	dir := home + "/.ssh"
	os.MkdirAll(dir, 0o700)
	err := os.WriteFile(dir+"/authorized_keys", []byte(b.Keys), 0o600)
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "error": errStr(err)})
}

func (s *server) sysfClean(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/clean/")
	if sub == "scan" {
		items := []map[string]interface{}{
			{"key": "apt", "path": "/var/cache/apt", "size": dirSize("/var/cache/apt"), "label": "apt-cache"},
			{"key": "tmp", "path": "/tmp", "size": dirSize("/tmp"), "label": "tmp-files"},
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
	} else if sub == "do" {
		var b struct{ Item string `json:"item"` }
		json.NewDecoder(r.Body).Decode(&b)
		var out string
		var err error
		switch b.Item {
		case "apt":
			out, err = globalSys.Sudo("apt", "clean")
		case "tmp":
			out, err = globalSys.Sudo("sh", "-c", "find /tmp -mindepth 1 -maxdepth 1 -exec rm -rf {} +")
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

func (s *server) sysfPwr(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/pwr/")
	switch sub {
	case "state":
		b, err := os.ReadFile("/run/systemd/shutdown/scheduled")
		state := "none"
		if err == nil {
			state = strings.TrimSpace(string(b))
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"state": state})
	case "plan":
		var b struct {
			Action  string `json:"action"`
			Minutes int    `json:"minutes"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		if b.Minutes <= 0 {
			b.Minutes = 1
		}
		when := "+" + fmt.Sprint(b.Minutes)
		var out string
		var err error
		if b.Action == "reboot" {
			out, err = globalSys.Sudo("shutdown", "-r", when)
		} else {
			out, err = globalSys.Sudo("shutdown", "-P", when)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	case "cancel":
		out, err := globalSys.Sudo("shutdown", "-c")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

func (s *server) sysfKernels(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		out, err := globalSys.Sudo("dpkg", "--list", "linux-image-*")
		var kernels []string
		for _, l := range strings.Split(out, "\n") {
			if strings.Contains(l, "linux-image") {
				f := strings.Fields(l)
				if len(f) > 0 {
					kernels = append(kernels, f[0])
				}
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"kernels": kernels, "error": errStr(err)})
	} else {
		var b struct{ Pkg string `json:"pkg"` }
		json.NewDecoder(r.Body).Decode(&b)
		out, err := globalSys.Sudo("apt", "remove", "-y", b.Pkg)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

func (s *server) sysfTime(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/time/")
	if sub == "sync" {
		out, err := globalSys.Sudo("timedatectl", "set-ntp", "true")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	} else {
		out, _ := globalSys.Run("timedatectl", "status")
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": out})
	}
}

func (s *server) sysfHealth(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/health/")
	if sub == "restart" {
		out, err := globalSys.Sudo("systemctl", "restart", "raincough")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	} else {
		checks := []map[string]interface{}{}
		df, _ := globalSys.Run("df", "-h", "/")
		checks = append(checks, map[string]interface{}{"name": "disk-root", "ok": !strings.Contains(df, "100%")})
		_, memErr := os.ReadFile("/proc/meminfo")
		checks = append(checks, map[string]interface{}{"name": "mem-readable", "ok": memErr == nil})
		_, srvErr := globalSys.Sudo("systemctl", "is-active", "raincough")
		checks = append(checks, map[string]interface{}{"name": "panel-service", "ok": srvErr == nil})
		writeJSON(w, http.StatusOK, map[string]interface{}{"checks": checks})
	}
}

func (s *server) sysfEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	out, err := globalSys.Run("journalctl", "--no-pager", "-n", fmt.Sprint(limit), "--output=short-iso")
	events := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			events = append(events, map[string]interface{}{"line": line})
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"events": events, "error": errStr(err)})
}

func (s *server) sysfLogrotate(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/logrotate/")
	if sub == "list" {
		out, err := os.ReadFile("/etc/logrotate.conf")
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"list":  []map[string]interface{}{{"name": "logrotate.conf", "content": string(out)}},
			"error": errStr(err),
		})
	} else if sub == "save" {
		var b struct {
			Name    string `json:"name"`
			Content string `json:"content"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		err := os.WriteFile("/etc/logrotate.d/"+b.Name, []byte(b.Content), 0o644)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "error": errStr(err)})
	}
}

func (s *server) sysfBootHistory(w http.ResponseWriter, r *http.Request) {
	out, _ := globalSys.Run("journalctl", "--list-boots", "--no-pager")
	rows := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) >= 3 {
			rows = append(rows, map[string]interface{}{"action": "boot", "when": f[1] + " " + f[2]})
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rows": rows, "boot_started": time.Now().Format("2006-01-02 15:04:05"),
	})
}

// ---- 性能趋势/网络状态(工作台 SysPerf/SysNet) ----

// perfHist 环形采样历史(每 1s 一点, 保留最近 60 点 = 60s 滚动窗口)。
var perfHist = struct {
	mu     sync.Mutex
	points []map[string]float64 // {cpu, mem, disk}
	netRx  uint64
	netTx  uint64
}{}

const perfMaxPoints = 60

func perfSampler() {
	prev := sysMon.Snapshot()
	prevSeen := time.Now()
	for {
		time.Sleep(time.Second)
		cur := sysMon.Snapshot()
		netDur := time.Since(prevSeen).Seconds()
		if netDur <= 0 {
			netDur = 1
		}
		perfHist.mu.Lock()
		perfHist.points = append(perfHist.points, map[string]float64{
			"cpu":  cur.CPUPercent,
			"mem":  cur.MemoryPercent,
			"disk": cur.DiskPercent,
		})
		if len(perfHist.points) > perfMaxPoints {
			perfHist.points = perfHist.points[len(perfHist.points)-perfMaxPoints:]
		}
		perfHist.netRx = uint64(float64(cur.NetRecv-prev.NetRecv) / netDur)
		perfHist.netTx = uint64(float64(cur.NetSent-prev.NetSent) / netDur)
		perfHist.mu.Unlock()
		prev = cur
		prevSeen = time.Now()
	}
}

func (s *server) sysfPerfNet(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/")
	if strings.HasPrefix(sub, "perf") {
		perfHist.mu.Lock()
		pts := make([]map[string]float64, len(perfHist.points))
		copy(pts, perfHist.points)
		rx, tx := perfHist.netRx, perfHist.netTx
		perfHist.mu.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"points": pts, "net": map[string]uint64{"rx": rx, "tx": tx}, "hours": 24,
		})
	} else if strings.HasPrefix(sub, "net") {
		writeJSON(w, http.StatusOK, netStatus())
	} else {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unknown"})
	}
}

// netStatus 网络状态: 接口/连接数/IP/DNS/公网IP/速率(对应旧前端 SysNet)。
func netStatus() map[string]interface{} {
	snap := sysMon.Snapshot()
	nics := []map[string]interface{}{}
	for _, ni := range snap.NetIfaces {
		nics = append(nics, map[string]interface{}{
			"name": ni.Name, "up": ni.Up, "ip": firstNonEmpty(ni.Addr, "-"),
			"mtu": 1500, "rate": map[string]float64{"rx": ni.DownRate, "tx": ni.UpRate},
		})
	}
	tcp := 0
	if b, err := os.ReadFile("/proc/net/tcp"); err == nil {
		tcp = strings.Count(string(b), "\n") - 1
	}
	dns := ""
	if b, err := os.ReadFile("/etc/resolv.conf"); err == nil {
		for _, l := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(l, "nameserver") {
				dns = strings.TrimSpace(strings.TrimPrefix(l, "nameserver"))
				break
			}
		}
	}
	return map[string]interface{}{
		"nics": nics, "tcp_conns": tcp, "dns": dns,
		"public_ip": "-",
		"rate":      map[string]float64{"rx": snap.NetDownRate, "tx": snap.NetUpRate},
	}
}

func firstNonEmpty(v, def string) string {
	if v != "" {
		return v
	}
	return def
}

func runtimeNumCPU() int { return sysMon.Snapshot().CPUCount }

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func dirSize(path string) int64 {
	var total int64
	filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total
}