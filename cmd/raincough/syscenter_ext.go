package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"raincough/internal/core"
)

// 系统中心扩展端点(对应旧前端 api.js sysf* 契约)。
// 数据逻辑(硬件/更新/cron/LVM/用户/密钥/清理/电源/内核/时间/健康/事件/日志轮转/启动历史/网络)
// 已下沉 internal/core.SysCenter 与 SystemMonitor; 本文件仅做 HTTP 装配。

// 性能采样器(main 中初始化)。
var perf *core.PerfTracker

func (s *server) sysfHardware(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, globalSys.Hardware())
}

func (s *server) sysfUpdates(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/updates/")
	switch r.Method {
	case http.MethodGet:
		lines, err := globalSys.AptUpgradable()
		// 旧前端契约: count / security / packages[{pkg,new,arch}](保留原始 updates 行)
		pkgs := []map[string]interface{}{}
		security := 0
		for _, l := range lines {
			f := strings.Fields(l)
			if len(f) < 2 {
				continue
			}
			name := f[0]
			if i := strings.Index(name, "/"); i > 0 {
				name = name[:i]
			}
			arch := ""
			if len(f) >= 3 {
				arch = strings.Trim(f[2], "[]")
			}
			if strings.Contains(f[0], "-security") || strings.Contains(l, "[security]") {
				security++
			}
			pkgs = append(pkgs, map[string]interface{}{"pkg": name, "new": f[1], "arch": arch})
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"updates": lines, "error": errStr(err),
			"count": len(pkgs), "security": security, "packages": pkgs,
		})
	case http.MethodPost:
		if sub == "refresh" {
			err := globalSys.AptRefresh()
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "message": "ok", "error": errStr(err)})
		} else if sub == "run" {
			go func() { globalSys.AptUpgrade() }()
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "message": "started-in-background"})
		} else {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported"})
		}
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method"})
	}
}

func (s *server) sysfDisks(w http.ResponseWriter, r *http.Request) {
	// 旧前端契约: df[{fs,type,size,used,avail,use,mount}] 人类可读 + lsblk JSON 原样
	df := []map[string]interface{}{}
	if out, err := globalSys.Run("df", "-h", "-x", "tmpfs", "-x", "devtmpfs", "-x", "squashfs",
		"-x", "efivarfs", "--output=source,fstype,size,used,avail,pcent,target"); err == nil {
		for i, l := range strings.Split(strings.TrimSpace(out), "\n") {
			if i == 0 || strings.TrimSpace(l) == "" {
				continue
			}
			f := strings.Fields(l)
			if len(f) < 7 {
				continue
			}
			df = append(df, map[string]interface{}{
				"fs": f[0], "type": f[1], "size": f[2], "used": f[3],
				"avail": f[4], "use": f[5], "mount": strings.Join(f[6:], " "),
			})
		}
	}
	var lsblk interface{}
	if out, err := globalSys.Run("lsblk", "-J", "-b", "-o", "NAME,PATH,TYPE,SIZE,FSTYPE,LABEL,MOUNTPOINT"); err == nil {
		_ = json.Unmarshal([]byte(out), &lsblk)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"disks": globalSys.LsblkDisks(), "df": df, "lsblk": lsblk,
	})
}

func (s *server) sysfSnap(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/snapshot/")
	switch sub {
	case "cap":
		caps, err := globalSys.LvsCap()
		// 旧前端契约: fstype / supported / hint(保留 volumes/error)
		fstype := ""
		if out, e := globalSys.Run("stat", "-f", "-c", "%T", "/"); e == nil {
			fstype = strings.TrimSpace(out)
		}
		supported := len(caps) > 0
		hint := "根文件系统不在 LVM 逻辑卷上, 无法创建在线快照"
		if supported {
			hint = "基于 LVM 逻辑卷在线快照(硬链接不占双倍空间)"
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"volumes": caps, "error": errStr(err),
			"fstype": fstype, "supported": supported, "hint": hint,
		})
	case "create":
		var b struct {
			Name string `json:"name"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		out, err := globalSys.LvsCreateSnapshot(b.Name)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	case "list":
		out, err := globalSys.LvsList()
		// 旧前端契约: snapshots[](lv_attr 首字符 s = 快照卷)
		snaps := []string{}
		for _, l := range strings.Split(out, "\n") {
			f := strings.Fields(l)
			if len(f) >= 3 && strings.HasPrefix(f[2], "s") {
				snaps = append(snaps, f[0])
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"output": out, "error": errStr(err), "snapshots": snaps,
		})
	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported"})
	}
}

func (s *server) sysfUsers(w http.ResponseWriter, r *http.Request) {
	users := globalSys.Users()
	// 旧前端契约: 顶层数组 + sudo 标记(/etc/group 的 sudo/admin/wheel + root)
	sudoers := map[string]bool{"root": true}
	if b, err := os.ReadFile("/etc/group"); err == nil {
		for _, l := range strings.Split(string(b), "\n") {
			f := strings.Split(l, ":")
			if len(f) >= 4 && (f[0] == "sudo" || f[0] == "admin" || f[0] == "wheel") {
				for _, u := range strings.Split(f[3], ",") {
					if u != "" {
						sudoers[u] = true
					}
				}
			}
		}
	}
	for _, u := range users {
		name, _ := u["name"].(string)
		u["sudo"] = sudoers[name]
	}
	writeJSON(w, http.StatusOK, users)
}

func (s *server) sysfSshKeys(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("user")
	keys, err := globalSys.SSHKeys(user)
	writeJSON(w, http.StatusOK, map[string]interface{}{"user": user, "keys": keys, "error": errStr(err)})
}

func (s *server) sysfSshKeysSave(w http.ResponseWriter, r *http.Request) {
	var b struct {
		User string `json:"user"`
		Keys string `json:"keys"`
	}
	json.NewDecoder(r.Body).Decode(&b)
	err := globalSys.SaveSSHKeys(b.User, b.Keys)
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "error": errStr(err)})
}

func (s *server) sysfClean(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/clean/")
	if sub == "scan" {
		items := globalSys.CleanScan()
		// 旧前端契约: size 人类可读 + dirs Top15(du -d1, 90s 缓存)
		out := []map[string]interface{}{}
		for _, it := range items {
			m := map[string]interface{}{}
			for k, v := range it {
				m[k] = v
			}
			switch v := it["size"].(type) {
			case int64:
				m["size"] = humanBytes(uint64(v))
			case uint64:
				m["size"] = humanBytes(v)
			case int:
				m["size"] = humanBytes(uint64(v))
			case float64:
				m["size"] = humanBytes(uint64(v))
			}
			out = append(out, m)
		}
		// 工作台常驻历史(不限期, 唯一清理入口在此页)
		if globalWSH != nil {
			out = append(out, map[string]interface{}{
				"key":   "workspace",
				"path":  globalWSH.Path(),
				"size":  humanBytes(uint64(globalWSH.Size())), // 与其余项同口径(人类可读)
				"label": "workspace-history · 工作台常驻历史",
			})
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": out, "dirs": cleanTopDirs()})
	} else if sub == "do" {
		var b struct {
			Item string `json:"item"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		var out string
		var err error
		switch b.Item {
		case "apt":
			out, err = globalSys.CleanApt()
		case "tmp":
			out, err = globalSys.CleanTmp()
		case "workspace":
			if globalWSH == nil {
				err = fmt.Errorf("历史模块未初始化")
			} else {
				out, err = globalWSH.Clear()
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

func (s *server) sysfPwr(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/pwr/")
	switch sub {
	case "state":
		writeJSON(w, http.StatusOK, map[string]interface{}{"state": globalSys.PwrState()})
	case "plan":
		var b struct {
			Action  string `json:"action"`
			Minutes int    `json:"minutes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		// 安全: 不提供明确 action/minutes 绝不下发关机指令
		if b.Action != "reboot" && b.Action != "shutdown" && b.Action != "poweroff" {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "action 必填(reboot/shutdown)"})
			return
		}
		if b.Minutes <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "minutes 必填(>0)"})
			return
		}
		out, err := globalSys.PwrPlan(b.Action, b.Minutes)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	case "cancel":
		out, err := globalSys.PwrCancel()
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

func (s *server) sysfKernels(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		kernels, err := globalSys.KernelList()
		// 旧前端契约: installed[{pkg,ver,status}] + current(内核版本)
		current, _ := globalSys.Run("uname", "-r")
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"kernels": kernels, "installed": kernels, "error": errStr(err),
			"current": strings.TrimSpace(current),
		})
	} else {
		var b struct {
			Pkg string `json:"pkg"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		out, err := globalSys.KernelRemove(b.Pkg)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	}
}

func (s *server) sysfTime(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/time/")
	if sub == "sync" {
		out, err := globalSys.TimeSync()
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	} else {
		out, _ := globalSys.TimeStatus()
		// 旧前端契约: fields{}(timedatectl 键值) + sync(on/off)
		fields := map[string]string{}
		for _, l := range strings.Split(out, "\n") {
			i := strings.Index(l, ":")
			if i <= 0 {
				continue
			}
			k := strings.TrimSpace(l[:i])
			v := strings.TrimSpace(l[i+1:])
			if k == "" || v == "" || len(k) > 40 || strings.HasPrefix(k, "-") {
				continue
			}
			fields[k] = v
		}
		sync := "off"
		if strings.Contains(out, "NTP service: active") || strings.Contains(out, "System clock synchronized: yes") {
			sync = "on"
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": out, "fields": fields, "sync": sync})
	}
}

func (s *server) sysfHealth(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/health/")
	if sub == "restart" {
		out, err := globalSys.ServiceAction("raincough", "restart")
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	} else {
		writeJSON(w, http.StatusOK, map[string]interface{}{"checks": globalSys.HealthChecks("raincough")})
	}
}

func (s *server) sysfEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	events, err := globalSys.Events(limit)
	writeJSON(w, http.StatusOK, map[string]interface{}{"events": events, "error": errStr(err)})
}

func (s *server) sysfLogrotate(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/logrotate/")
	if sub == "list" {
		// 旧前端契约: files[{name,path,content}] + ok
		files, err := globalSys.LogrotateFiles()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"files": files, "ok": err == nil, "error": errStr(err),
		})
	} else if sub == "save" {
		var b struct {
			Name    string `json:"name"`
			Content string `json:"content"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		err := globalSys.LogrotateSave(b.Name, b.Content)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "error": errStr(err)})
	}
}

func (s *server) sysfBootHistory(w http.ResponseWriter, r *http.Request) {
	// 本次启动 = 系统监控器真实开机时间(而非请求时刻)
	bt := sysMon.Snapshot().BootTime
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rows":         globalSys.BootHistory(),
		"boot_started": time.Unix(bt, 0).Format("2006-01-02 15:04:05"),
	})
}

// sysfPerfNet GET /api/sysfunc/perf/ 与 /api/sysfunc/net/status。
func (s *server) sysfPerfNet(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/")
	if strings.HasPrefix(sub, "perf") {
		pts, rx, tx := perf.Snapshot()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"points": pts, "net": map[string]uint64{"rx": rx, "tx": tx}, "hours": 24,
		})
	} else if strings.HasPrefix(sub, "net") {
		writeJSON(w, http.StatusOK, sysMon.NetStatus())
	} else {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unknown"})
	}
}

func errStr(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// humanBytes 字节数人类可读化。
func humanBytes(b uint64) string {
	switch {
	case b >= 1<<40:
		return fmt.Sprintf("%.1fT", float64(b)/float64(1<<40))
	case b >= 1<<30:
		return fmt.Sprintf("%.1fG", float64(b)/float64(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.1fM", float64(b)/float64(1<<20))
	case b >= 1<<10:
		return fmt.Sprintf("%.1fK", float64(b)/float64(1<<10))
	}
	return fmt.Sprintf("%dB", b)
}

var (
	cleanDirsMu    sync.Mutex
	cleanDirsCache []map[string]interface{}
	cleanDirsAt    time.Time
)

// cleanTopDirs 磁盘占用 Top15(du -d1 扫描, 90s 缓存, 对应前端提示"缓存90s")。
// 直接 sudo du(宿主 sudoers 白名单放行 /usr/bin/du 但不放行 sh -c), 排序在进程内完成。
func cleanTopDirs() []map[string]interface{} {
	cleanDirsMu.Lock()
	defer cleanDirsMu.Unlock()
	if cleanDirsCache != nil && time.Since(cleanDirsAt) < 90*time.Second {
		return cleanDirsCache
	}
	out, err := globalSys.Sudo("du", "-x", "-B1", "-d", "1",
		"/home", "/opt", "/var", "/usr", "/root", "/srv", "/tmp")
	type duRow struct {
		size uint64
		path string
	}
	rows := []duRow{}
	if err == nil {
		for _, l := range strings.Split(out, "\n") {
			f := strings.Fields(l)
			if len(f) >= 2 {
				if v, e := strconv.ParseUint(f[0], 10, 64); e == nil && v > 0 {
					rows = append(rows, duRow{size: v, path: f[1]})
				}
			}
		}
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].size > rows[j].size })
	dirs := []map[string]interface{}{}
	for i, r := range rows {
		if i >= 15 {
			break
		}
		dirs = append(dirs, map[string]interface{}{"size": humanBytes(r.size), "path": r.path})
	}
	cleanDirsCache, cleanDirsAt = dirs, time.Now()
	return dirs
}
