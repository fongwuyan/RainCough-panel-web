package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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
		writeJSON(w, http.StatusOK, map[string]interface{}{"updates": lines, "error": errStr(err)})
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

func (s *server) sysfCron(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		user := r.URL.Query().Get("user")
		out, _ := globalSys.CronTab(user)
		writeJSON(w, http.StatusOK, map[string]interface{}{"user": user, "content": out})
	case http.MethodPost:
		var b struct {
			User    string `json:"user"`
			Content string `json:"content"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		err := globalSys.SaveCronTab(b.User, b.Content)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "error": errStr(err)})
	}
}

func (s *server) sysfDisks(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"disks": globalSys.LsblkDisks()})
}

func (s *server) sysfSnap(w http.ResponseWriter, r *http.Request) {
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/snapshot/")
	switch sub {
	case "cap":
		caps, err := globalSys.LvsCap()
		writeJSON(w, http.StatusOK, map[string]interface{}{"volumes": caps, "error": errStr(err)})
	case "create":
		var b struct {
			Name string `json:"name"`
		}
		json.NewDecoder(r.Body).Decode(&b)
		out, err := globalSys.LvsCreateSnapshot(b.Name)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": err == nil, "output": out, "error": errStr(err)})
	case "list":
		out, err := globalSys.LvsList()
		writeJSON(w, http.StatusOK, map[string]interface{}{"output": out, "error": errStr(err)})
	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported"})
	}
}

func (s *server) sysfUsers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"users": globalSys.Users()})
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
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": globalSys.CleanScan()})
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
		writeJSON(w, http.StatusOK, map[string]interface{}{"kernels": kernels, "error": errStr(err)})
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
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": out})
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
		out, err := globalSys.LogrotateList()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"list":  []map[string]interface{}{{"name": "logrotate.conf", "content": out}},
			"error": errStr(err),
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
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rows":         globalSys.BootHistory(),
		"boot_started": time.Now().Format("2006-01-02 15:04:05"),
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
