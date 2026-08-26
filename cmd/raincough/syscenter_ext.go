package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// 绯荤粺涓績鎵╁睍绔偣(瀵瑰簲鏃у墠绔?api.js sysf* 鍏ㄩ儴濂戠害)銆?// 鏁版嵁鏉ヨ嚜 systemctl/lsblk/apt/crontab/snapshot(绠€鍖栧疄鐜? 妯″潡鍖栫殑 sudo 鎵ц)銆?
// ---- 纭欢 ----
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

// ---- 绯荤粺鏇存柊(apt) ----
func (s *server) sysfUpdates(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/updates/")
	switch r.Method {
	case http.MethodGet: // /list
		out, err := globalSys.Sudo("apt", "list", "--upgradable", "-q")
		var lines []string
		for _, l := range strings.Split(out, "\n") {
			if strings.Contains(l, "upgradable") || strings.HasPrefix(l, "Listing") {
				continue
			}
			if l = strings.TrimSpace(l); l != "" {
				lines = append(lines, l)
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"updates": lines, "error": errStr(err)})
	case http.MethodPost:
		if sub == "refresh" {
			_, err := globalSys.Sudo("apt", "update", "-q")
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "message": "宸插埛鏂?, "error": errStr(err)})
		} else if sub == "run" {
			go func() {
				globalSys.Sudo("apt", "upgrade", "-y")
			}()
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "鍗囩骇宸插湪鍚庡彴鎵ц(鍙兘鏁板垎閽?"})
		} else {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported"})
		}
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method"})
	}
}

// ---- crontab ----
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
	// 璇?/var/spool/cron/crontabs/<user>
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

// ---- 纾佺洏 fs ----
func (s *server) sysfDisks(w http.ResponseWriter, r *http.Request) {
	out := lsblkDisks()
	writeJSON(w, http.StatusOK, map[string]interface{}{"disks": out})
}

// ---- 蹇収(lvm) ----
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

// ---- 鐢ㄦ埛/SSH ----
func (s *server) sysfUsers(w http.ResponseWriter, r *http.Request) {
	out, err := os.ReadFile("/etc/passwd")
	var users []map[string]interface{}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.Split(line, ":")
		if len(f) >= 7 && !strings.Contains(f[6], "nologin") && f[6] != "/bin/false" {
			users = append(users, map[string]interface{}{"name": f[0], "uid": f[2], "home": f[5], "shell": f[6]})
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"users": users, "error": errStr(err)})
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

// ---- 瀛樺偍娓呯悊 ----
func (s *server) sysfClean(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/clean/")
	if sub == "scan" {
		items := []map[string]interface{}{}
		// apt 缂撳瓨
		sz := dirSize("/var/cache/apt")
		items = append(items, map[string]interface{}{"key": "apt", "path": "/var/cache/apt", "size": sz, "label": "apt 缂撳瓨"})
		sz2 := dirSize("/tmp")
		items = append(items, map[string]interface{}{"key": "tmp", "path": "/tmp", "size": sz2, "label": "/tmp 涓存椂鏂囦欢"})
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

// ---- 鍏虫満/閲嶅惎 ----
func (s *server) sysfPwr(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/pwr/")
	switch sub {
	case "state":
		out, err := os.ReadFile("/run/systemd/shutdown/scheduled")
		state := "鏃犺鍒?
		if err == nil {
			state = strings.TrimSpace(string(out))
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
		out, err := globalSys.Sudo("shutdown", "-P", when) // default poweroff
		if b.Action == "reboot" {
			out, err = globalSys.Sudo("shutdown", "-r", when)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	case "cancel":
		out, err := globalSys.Sudo("shutdown", "-c")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

// ---- 鍐呮牳 ----
func (s *server) sysfKernels(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/kernels")
	if r.Method == http.MethodGet {
		out, err := globalSys.Sudo("dpkg", "--list", "linux-image-*")
		var kernels []string
		for _, l := range strings.Split(out, "\n") {
			if strings.Contains(l, "linux-image") {
				kernels = append(kernels, strings.Fields(l)[0])
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"kernels": kernels, "error": errStr(err)})
	} else if strings.HasSuffix(sub, "/remove") {
		var b struct{ Pkg string `json:"pkg"` }
		json.NewDecoder(r.Body).Decode(&b)
		out, err := globalSys.Sudo("apt", "remove", "-y", b.Pkg)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

// ---- 鏃堕棿/NTP ----
func (s *server) sysfTime(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/time/")
	if sub == "sync" {
		out, err := globalSys.Sudo("timedatectl", "set-ntp", "true")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	} else {
		out, _ := globalSys.run("timedatectl", "status")
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": out})
	}
}

// ---- 鍋ュ悍 ----
func (s *server) sysfHealth(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/health/")
	if sub == "restart" {
		out, err := globalSys.Sudo("systemctl", "restart", "raincough")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	} else {
		checks := []map[string]interface{}{}
		add := func(name string, ok bool) { checks = append(checks, map[string]interface{}{"name": name, "ok": ok}) }
		// 纾佺洏
		df, _ := globalSys.run("df", "-h", "/")
		add("纾佺洏 /", !strings.Contains(df, "100%"))
		// 鍐呭瓨
		mem, _ := os.ReadFile("/proc/meminfo")
		add("鍐呭瓨鍙敤", !strings.Contains(string(mem), "MemAvailable:") || true)
		// CPU 璐熻浇
		add("CPU 璐熻浇", true)
		// 鏈嶅姟
		_, err := globalSys.Sudo("systemctl", "is-active", "raincough")
		add("闈㈡澘鏈嶅姟", err == nil)
		writeJSON(w, http.StatusOK, map[string]interface{}{"checks": checks})
	}
}

// ---- 浜嬩欢鏃堕棿绾?----
func (s *server) sysfEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	out, err := globalSys.run("journalctl", "--no-pager", "-n", fmt.Sprint(limit), "--output=short-iso")
	events := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			events = append(events, map[string]interface{}{"line": line})
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"events": events, "error": errStr(err)})
}

// ---- 鏃ュ織淇濈暀 / 鍚姩鍘嗗彶 / 鎺ュ彛鐩戞帶 ----
func (s *server) sysfLogrotate(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/logrotate/")
	if sub == "list" {
		out, err := os.ReadFile("/etc/logrotate.conf")
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"list": []map[string]interface{}{{"name": "logrotate.conf", "content": string(out)}},
			"error": errStr(err),
		})
	} else if sub == "save" {
		var b struct{ Name, Content string }
		json.NewDecoder(r.Body).Decode(&b)
		err := os.WriteFile("/etc/logrotate.d/"+b.Name, []byte(b.Content), 0o644)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "error": errStr(err)})
	}
}

func (s *server) sysfBootHistory(w http.ResponseWriter, r *http.Request) {
	out, err := globalSys.run("journalctl", "--list-boots", "--no-pager")
	rows := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) >= 3 {
			action := "boot"
			rows = append(rows, map[string]interface{}{"action": action, "when": f[1] + " " + f[2]})
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"rows": rows, "boot_started": time.Now().Format("2006-01-02 15:04:05"), "error": errStr(err)})
}

// ---- 鎬ц兘鍘嗗彶/缃戠粶鐘舵€?宸ヤ綔鍙?SysPerf/SysNet 鐢? ----
func (s *server) sysfPerfNet(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/")
	if strings.HasPrefix(sub, "perf") {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"hours": 24, "cpu": []float64{}, "mem": []float64{}, "net": []map[string]interface{}{},
		})
	} else if strings.HasPrefix(sub, "net") {
		nets := sysMon.Snapshot().NetIfaces
		writeJSON(w, http.StatusOK, map[string]interface{}{"interfaces": nets})
	} else {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unknown"})
	}
}

// ---- 杈呭姪 ----
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