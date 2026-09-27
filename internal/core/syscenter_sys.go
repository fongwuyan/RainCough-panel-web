package core

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---- 系统中心扩展(旧前端 sysf* 契约的数据逻辑; HTTP 装配留在 cmd) ----

// Hardware 硬件信息(/proc + /sys + DMI/hwmon)。
// 同时携带旧前端期望的结构化字段 cpu/board/memory/temps/smart(双契约兼容)。
func (sc *SysCenter) Hardware() map[string]interface{} {
	out := map[string]interface{}{}
	if b, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		out["cpuinfo"] = string(b)
		model := ""
		for _, l := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(l, "model name") {
				if i := strings.Index(l, ":"); i >= 0 {
					model = strings.TrimSpace(l[i+1:])
					break
				}
			}
		}
		out["cpu"] = map[string]interface{}{"model": model, "cores": runtime.NumCPU()}
	}
	out["cpu_count"] = runtime.NumCPU()
	mem := map[string]interface{}{}
	if b, err := os.ReadFile("/proc/meminfo"); err == nil {
		out["meminfo"] = string(b)
		for _, l := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(l, "MemTotal:") {
				if f := strings.Fields(l); len(f) >= 2 {
					if v, e := strconv.ParseInt(f[1], 10, 64); e == nil {
						mem["total"] = v * 1024 // bytes
					}
				}
			}
		}
	}
	mem["sticks"] = sc.memorySticks()
	out["memory"] = mem
	vendor, _ := os.ReadFile("/sys/class/dmi/id/sys_vendor")
	product, _ := os.ReadFile("/sys/class/dmi/id/product_name")
	out["product"] = strings.TrimSpace(string(product))
	out["board"] = map[string]interface{}{
		"vendor": strings.TrimSpace(string(vendor)),
		"model":  strings.TrimSpace(string(product)),
	}
	out["temps"] = sc.hwmonTemps()
	out["smart"] = sc.smartStatus()
	return out
}

// memorySticks 解析 dmidecode 内存条(不可用时返回空)。
func (sc *SysCenter) memorySticks() []map[string]interface{} {
	out, err := sc.Sudo("dmidecode", "-t", "memory")
	if err != nil || !strings.Contains(out, "Memory Device") {
		return []map[string]interface{}{}
	}
	sticks := []map[string]interface{}{}
	for _, part := range strings.Split(out, "Memory Device")[1:] {
		size, speed := "", ""
		for _, l := range strings.Split(part, "\n") {
			t := strings.TrimSpace(l)
			if size == "" && strings.HasPrefix(t, "Size:") {
				size = strings.TrimSpace(strings.TrimPrefix(t, "Size:"))
			}
			if speed == "" && strings.HasPrefix(t, "Speed:") {
				speed = strings.TrimSpace(strings.TrimPrefix(t, "Speed:"))
			}
		}
		if size == "" || strings.Contains(size, "No Module") || strings.Contains(size, "Unknown") || strings.Contains(size, "None") || strings.Contains(size, "Other") {
			continue
		}
		sticks = append(sticks, map[string]interface{}{"size": size, "speed": strings.TrimPrefix(speed, "-")})
	}
	return sticks
}

// hwmonTemps 读取 /sys/class/hwmon 温度传感器。
func (sc *SysCenter) hwmonTemps() []map[string]interface{} {
	temps := []map[string]interface{}{}
	chips, _ := filepath.Glob("/sys/class/hwmon/hwmon*")
	for _, c := range chips {
		nb, err := os.ReadFile(filepath.Join(c, "name"))
		if err != nil {
			continue
		}
		values := map[string]string{}
		inputs, _ := filepath.Glob(filepath.Join(c, "temp*_input"))
		for _, in := range inputs {
			b, err := os.ReadFile(in)
			if err != nil {
				continue
			}
			v, err := strconv.ParseFloat(strings.TrimSpace(string(b)), 64)
			if err != nil || v == 0 {
				continue
			}
			lblFile := strings.TrimSuffix(in, "_input") + "_label"
			lbl := filepath.Base(strings.TrimSuffix(in, "_input"))
			if lb, err := os.ReadFile(lblFile); err == nil && strings.TrimSpace(string(lb)) != "" {
				lbl = strings.TrimSpace(string(lb))
			}
			values[lbl] = fmt.Sprintf("%.0f°C", v/1000)
		}
		if len(values) > 0 {
			temps = append(temps, map[string]interface{}{"chip": strings.TrimSpace(string(nb)), "values": values})
		}
	}
	return temps
}

// smartStatus smartctl 健康概览(未安装时返回空)。
func (sc *SysCenter) smartStatus() []map[string]interface{} {
	if _, err := exec.LookPath("smartctl"); err != nil {
		return []map[string]interface{}{}
	}
	scan, err := sc.Sudo("smartctl", "--scan")
	if err != nil {
		return []map[string]interface{}{}
	}
	res := []map[string]interface{}{}
	for _, l := range strings.Split(scan, "\n") {
		f := strings.Fields(l)
		if len(f) == 0 {
			continue
		}
		dev := f[0]
		status := "UNKNOWN"
		if out, e := sc.Sudo("smartctl", "-H", dev); e == nil {
			switch {
			case strings.Contains(out, "PASSED"), strings.Contains(out, "OK"):
				status = "PASSED"
			case strings.Contains(out, "FAILED"):
				status = "FAILED"
			}
		}
		res = append(res, map[string]interface{}{"dev": dev, "status": status})
	}
	return res
}

// AptUpgradable 可升级软件包列表(过滤 ls 头注释)。
func (sc *SysCenter) AptUpgradable() ([]string, error) {
	out, err := sc.Sudo("apt", "list", "--upgradable", "-q")
	var lines []string
	for _, l := range strings.Split(out, "\n") {
		l = strings.TrimSpace(l)
		if l == "" || strings.HasPrefix(l, "Listing") || strings.Contains(l, "upgradable") {
			continue
		}
		lines = append(lines, l)
	}
	return lines, err
}

// AptRefresh 刷新软件源索引。
func (sc *SysCenter) AptRefresh() error {
	_, err := sc.Sudo("apt", "update", "-q")
	return err
}

// AptUpgrade 全量升级(可能耗时, 调用方自行决定是否后台执行)。
func (sc *SysCenter) AptUpgrade() (string, error) {
	return sc.Sudo("apt", "upgrade", "-y")
}

// CronTab 读取 crontab(user 为空默认 root)。
func (sc *SysCenter) CronTab(user string) (string, error) {
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

// SaveCronTab 写入 crontab(user 为空默认 root)。
func (sc *SysCenter) SaveCronTab(user, content string) error {
	if user == "" {
		user = "root"
	}
	path := "/var/spool/cron/crontabs/" + user
	if err := os.MkdirAll("/var/spool/cron/crontabs", 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o600)
}

// LvsCap LVM 卷容量列表(逻辑卷名/大小/属性)。
func (sc *SysCenter) LvsCap() ([]map[string]interface{}, error) {
	out, err := sc.Sudo("lvs", "--noheadings", "-o", "lv_name,lv_size,lv_attr")
	caps := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) >= 3 {
			caps = append(caps, map[string]interface{}{"name": f[0], "size": f[1], "attr": f[2]})
		}
	}
	return caps, err
}

// LvsCreateSnapshot 创建 vg0/root 的快照(2G)。
func (sc *SysCenter) LvsCreateSnapshot(name string) (string, error) {
	return sc.Sudo("lvcreate", "-L", "2G", "-s", "-n", name, "vg0/root")
}

// LvsList 逻辑卷原始列表。
func (sc *SysCenter) LvsList() (string, error) {
	return sc.Sudo("lvs", "--noheadings", "-o", "lv_name,lv_size,lv_attr")
}

// Users 可登录用户列表(/etc/passwd)。
func (sc *SysCenter) Users() []map[string]interface{} {
	out, _ := os.ReadFile("/etc/passwd")
	var users []map[string]interface{}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.Split(line, ":")
		if len(f) >= 7 && !strings.Contains(f[6], "nologin") && f[6] != "/bin/false" {
			users = append(users, map[string]interface{}{"name": f[0], "uid": f[2], "home": f[5], "shell": f[6]})
		}
	}
	return users
}

// SSHKeys 读取用户 authorized_keys。
func (sc *SysCenter) SSHKeys(user string) (string, error) {
	if user == "" {
		user = "root"
	}
	path := "/home/" + user + "/.ssh/authorized_keys"
	if user == "root" {
		path = "/root/.ssh/authorized_keys"
	}
	b, err := os.ReadFile(path)
	return string(b), err
}

// SaveSSHKeys 写入用户 authorized_keys。
func (sc *SysCenter) SaveSSHKeys(user, keys string) error {
	home := "/home/" + user
	if user == "root" {
		home = "/root"
	}
	dir := home + "/.ssh"
	os.MkdirAll(dir, 0o700)
	return os.WriteFile(dir+"/authorized_keys", []byte(keys), 0o600)
}

// CleanScan 清理候选扫描(apt 缓存 / tmp)。
// 大小优先用 sudo du(白名单已放行 /usr/bin/du, 含不可读子目录, 口径与真实一致),
// 失败再退化为本地 walk。
func (sc *SysCenter) CleanScan() []map[string]interface{} {
	return []map[string]interface{}{
		{"key": "apt", "path": "/var/cache/apt", "size": sc.DirSizeCached("/var/cache/apt"), "label": "apt-cache"},
		{"key": "tmp", "path": "/tmp", "size": sc.DirSizeCached("/tmp"), "label": "tmp-files"},
	}
}

// CleanApt 清理 apt 缓存。
func (sc *SysCenter) CleanApt() (string, error) {
	return sc.Sudo("apt", "clean")
}

// DirSizeCached 目录大小: sudo du(精确, 含 root 私有目录) → 本地 DirSize 兜底。
func (sc *SysCenter) DirSizeCached(path string) int64 {
	if out, err := sc.Sudo("/usr/bin/du", "-s", "-B1", "--", path); err == nil {
		if f := strings.Fields(strings.TrimSpace(out)); len(f) > 0 {
			if v, e := strconv.ParseInt(f[0], 10, 64); e == nil && v > 0 {
				return v
			}
		}
	}
	v, _ := DirSize(path)
	return v
}

// CleanTmp 清理 /tmp 一级内容。
// 旧实现经 sh -c 调用 → sudoers 白名单不放行 sh, 【恒失败】(reader 已记载)。
// 现改为固定参数的 find: 精确放行(见宿主 /etc/sudoers.d/91-raincough-find),
// 并【剪枝 systemd-private-* / snap-private-*】避免删掉在跑服务的私有 /tmp;
// 提权不可用时降级为当前用户可删部分(报告里注明)。
func (sc *SysCenter) CleanTmp() (string, error) {
	args := []string{"/tmp", "-mindepth", "1", "-maxdepth", "1",
		"-not", "-name", "systemd-private-*",
		"-not", "-name", "snap-private-*",
		"-exec", "rm", "-rf", "{}", "+"}
	full := append([]string{"/usr/bin/find"}, args...)
	if out, err := sc.Sudo(full...); err == nil {
		return out, nil
	} else {
		out2, err2 := sc.Run("/usr/bin/find", args...)
		if err2 != nil {
			return "", fmt.Errorf("提权清理失败: %v; 降级清理也失败: %v", err, err2)
		}
		return strings.TrimSpace(out2) + "\n(降级模式: 无提权, 仅清理当前用户可删除的条目, root 私有目录未动)", nil
	}
}

// PwrState 已排程的关机/重启状态。
func (sc *SysCenter) PwrState() string {
	b, err := os.ReadFile("/run/systemd/shutdown/scheduled")
	if err != nil {
		return "none"
	}
	return strings.TrimSpace(string(b))
}

// PwrPlan 排程关机/重启(分钟数由调用方校验)。
func (sc *SysCenter) PwrPlan(action string, minutes int) (string, error) {
	when := "+" + fmt.Sprint(minutes)
	if action == "reboot" {
		return sc.Sudo("shutdown", "-r", when)
	}
	return sc.Sudo("shutdown", "-P", when)
}

// PwrCancel 取消排程。
func (sc *SysCenter) PwrCancel() (string, error) {
	return sc.Sudo("shutdown", "-c")
}

// KernelList 已安装内核包列表(修正: dpkg --list 首列为状态码, 包名在第 2 列)。
func (sc *SysCenter) KernelList() ([]map[string]interface{}, error) {
	out, err := sc.Sudo("dpkg", "--list", "linux-image-*")
	var kernels []map[string]interface{}
	for _, l := range strings.Split(out, "\n") {
		if !strings.Contains(l, "linux-image") {
			continue
		}
		f := strings.Fields(l)
		if len(f) >= 3 && (f[0] == "ii" || f[0] == "rc" || f[0] == "un" || f[0] == "iU") {
			kernels = append(kernels, map[string]interface{}{"status": f[0], "pkg": f[1], "ver": f[2]})
		}
	}
	return kernels, err
}

// KernelRemove 卸载内核包。
func (sc *SysCenter) KernelRemove(pkg string) (string, error) {
	return sc.Sudo("apt", "remove", "-y", pkg)
}

// TimeStatus 系统时间状态。
func (sc *SysCenter) TimeStatus() (string, error) {
	return sc.Run("timedatectl", "status")
}

// TimeSync 启用 NTP 同步。
func (sc *SysCenter) TimeSync() (string, error) {
	return sc.Sudo("timedatectl", "set-ntp", "true")
}

// HealthChecks 基础健康检查(磁盘/内存/面板服务)。
func (sc *SysCenter) HealthChecks(service string) []map[string]interface{} {
	checks := []map[string]interface{}{}
	df, _ := sc.Run("df", "-h", "/")
	checks = append(checks, map[string]interface{}{"name": "disk-root", "ok": !strings.Contains(df, "100%")})
	_, memErr := os.ReadFile("/proc/meminfo")
	checks = append(checks, map[string]interface{}{"name": "mem-readable", "ok": memErr == nil})
	_, srvErr := sc.Sudo("systemctl", "is-active", service)
	checks = append(checks, map[string]interface{}{"name": "panel-service", "ok": srvErr == nil})
	return checks
}

// Events 面板/系统事件时间线(journalctl JSON; 过滤噪声单元, 结构化为旧前端契约)。
func (sc *SysCenter) Events(limit int) ([]map[string]interface{}, error) {
	n := limit * 3
	if n < 60 {
		n = 60
	}
	out, err := sc.Run("journalctl", "--no-pager", "-o", "json", "-n", strconv.Itoa(n))
	events := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var e map[string]interface{}
		if json.Unmarshal([]byte(line), &e) != nil {
			continue
		}
		unit, _ := e["_SYSTEMD_UNIT"].(string)
		msg, _ := e["MESSAGE"].(string)
		if msg == "" {
			continue
		}
		keep := unit == "systemd.service" || unit == "systemd-logind.service" ||
			unit == "raincough.service" || strings.HasPrefix(unit, "plugin-")
		if !keep {
			continue
		}
		var t int64
		if v, ok := e["__REALTIME_TIMESTAMP"].(string); ok {
			// journal 的时间戳是微秒
			if us, e2 := strconv.ParseInt(v, 10, 64); e2 == nil {
				t = us / 1000000
			}
		}
		scope := strings.TrimSuffix(unit, ".service")
		m := strings.ToLower(msg)
		action := "log"
		switch {
		case strings.Contains(m, "fail"):
			action = "fail"
		case strings.Contains(m, "stopp"), strings.Contains(m, "deactivat"):
			action = "stop"
		case strings.Contains(m, "start"), strings.Contains(m, "activat"):
			action = "start"
		case strings.Contains(m, "shut"), strings.Contains(m, "power"):
			action = "shutdown"
		case strings.Contains(m, "reboot"):
			action = "reboot"
		}
		if unit == "systemd.service" {
			// "Started XXX Service." → scope 提取被操作对象
			for _, p := range []string{"started ", "stopped ", "failed to start ", "deactivated ", "scheduled reboot"} {
				if i := strings.Index(m, p); i >= 0 && i < len(msg)-len(p) {
					desc := strings.Trim(strings.TrimSuffix(msg[i+len(p):], "."), `"'`)
					if desc != "" && len(desc) <= 48 {
						scope = desc
					}
					break
				}
			}
		}
		events = append(events, map[string]interface{}{
			"t": t, "scope": scope, "action": action, "msg": msg,
		})
		if len(events) >= limit {
			break
		}
	}
	return events, err
}

// LogrotateFiles 主配置 + /etc/logrotate.d 下全部配置(旧前端 files[] 契约)。
func (sc *SysCenter) LogrotateFiles() ([]map[string]interface{}, error) {
	files := []map[string]interface{}{}
	main, err := os.ReadFile("/etc/logrotate.conf")
	if err == nil {
		files = append(files, map[string]interface{}{
			"name": "logrotate.conf", "path": "/etc/logrotate.conf", "content": string(main),
		})
	}
	entries, _ := os.ReadDir("/etc/logrotate.d")
	for _, e := range entries {
		if e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		b, e2 := os.ReadFile(filepath.Join("/etc/logrotate.d", e.Name()))
		if e2 != nil {
			continue
		}
		files = append(files, map[string]interface{}{
			"name": e.Name(), "path": "/etc/logrotate.d/" + e.Name(), "content": string(b),
		})
	}
	return files, err
}

// LogrotateSave 保存配置: logrotate.conf 写主配置, 其余写 /etc/logrotate.d/。
func (sc *SysCenter) LogrotateSave(name, content string) error {
	if name == "" {
		return fmt.Errorf("配置名为空")
	}
	if name == "logrotate.conf" || name == "logrotate" {
		return os.WriteFile("/etc/logrotate.conf", []byte(content), 0o644)
	}
	if strings.ContainsAny(name, "/\\") || strings.Contains(name, "..") {
		return fmt.Errorf("非法配置名: %s", name)
	}
	return os.WriteFile(filepath.Join("/etc/logrotate.d", name), []byte(content), 0o644)
}

// BootHistory 启动历史(journalctl --list-boots; 修正表头/字段解析, 当前启动排最前)。
func (sc *SysCenter) BootHistory() []map[string]interface{} {
	out, _ := sc.Run("journalctl", "--list-boots", "--no-pager")
	rows := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) < 3 || strings.EqualFold(f[0], "IDX") || strings.EqualFold(f[1], "BOOT_ID") {
			continue
		}
		rows = append(rows, map[string]interface{}{
			"idx":    f[0],
			"action": map[bool]string{true: "current", false: "previous"}[strings.TrimLeft(f[0], "-+") == "0"],
			"when":   strings.Join(f[2:], " "),
		})
	}
	// journalctl 按时间正序, 反转为当前启动在前
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows
}

// ---- 磁盘列表(旧前端 /api/disks) ----

// LsblkDisks 磁盘列表(真实 lsblk -J -b 输出, 带分区/挂载/使用率)。
func (sc *SysCenter) LsblkDisks() []map[string]interface{} {
	out, err := sc.Run("lsblk", "-J", "-b", "-o", "NAME,PATH,TYPE,SIZE,FSTYPE,LABEL,MOUNTPOINT,ROTA,HOTPLUG")
	if err != nil {
		log.Printf("[disks] lsblk 失败: %v (out=%q)", err, out)
		return []map[string]interface{}{}
	}
	var parsed struct {
		Blockdevices []struct {
			Name     string      `json:"name"`
			Path     string      `json:"path"`
			Type     string      `json:"type"`
			Size     json.Number `json:"size"`
			Rot      bool        `json:"rota"`
			Hotplug  bool        `json:"hotplug"`
			FSType   string      `json:"fstype"`
			Label    string      `json:"label"`
			Mount    string      `json:"mountpoint"`
			Children []struct {
				Name   string      `json:"name"`
				Path   string      `json:"path"`
				Type   string      `json:"type"`
				Size   json.Number `json:"size"`
				FSType string      `json:"fstype"`
				Label  string      `json:"label"`
				Mount  string      `json:"mountpoint"`
			} `json:"children"`
		} `json:"blockdevices"`
	}
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		log.Printf("[disks] json 解析失败: %v (out len=%d, head=%q)", err, len(out), truncateStr(out, 120))
		return []map[string]interface{}{}
	}
	log.Printf("[disks] lsblk 解析: 块设备 %d 个", len(parsed.Blockdevices))
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
			sc.addPartUsage(part, c.Mount)
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

// parseSizeStr 把 lsblk 大小(json.Number/字符串)解析为 uint64。
func parseSizeStr(s json.Number) uint64 {
	if s == "" {
		return 0
	}
	if v, err := strconv.ParseUint(string(s), 10, 64); err == nil {
		return v
	}
	// 人类可读格式兜底: 如 "119.2G"
	var num float64
	var unit string
	fmt.Sscanf(string(s), "%f%s", &num, &unit)
	mult := map[string]float64{"B": 1, "K": 1 << 10, "M": 1 << 20, "G": 1 << 30, "T": 1 << 40}[unit]
	if mult == 0 && unit != "" {
		mult = 1
	}
	return uint64(num * mult)
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// addPartUsage 为挂载分区补充 used/total/percent(读 /proc/mounts + statfs 简化为 df)。
func (sc *SysCenter) addPartUsage(part map[string]interface{}, mount string) {
	if mount == "" {
		return
	}
	out, err := sc.Run("df", "-P", "-k", mount)
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

// ---- 网络状态(工作台 SysNet) ----

// NetStatus 网络状态: 接口/连接数/IP/DNS/速率。
func (m *SystemMonitor) NetStatus() map[string]interface{} {
	snap := m.Snapshot()
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

// ---- 性能趋势采样(工作台 SysPerf) ----

// PerfMaxPoints 滚动窗口点数(60s)。
const PerfMaxPoints = 60

// PerfTracker 环形采样历史(每 1s 一点, 保留最近 60 点)。
type PerfTracker struct {
	mu     sync.Mutex
	m      *SystemMonitor
	points []map[string]float64 // {cpu, mem, disk}
	netRx  uint64
	netTx  uint64
}

// NewPerfTracker 创建性能采样器。
func NewPerfTracker(m *SystemMonitor) *PerfTracker { return &PerfTracker{m: m} }

// Run 阻塞采样循环(通常以 goroutine 方式启动)。
func (p *PerfTracker) Run() {
	prev := p.m.Snapshot()
	prevSeen := time.Now()
	for {
		time.Sleep(time.Second)
		cur := p.m.Snapshot()
		netDur := time.Since(prevSeen).Seconds()
		if netDur <= 0 {
			netDur = 1
		}
		p.mu.Lock()
		p.points = append(p.points, map[string]float64{
			"cpu":  cur.CPUPercent,
			"mem":  cur.MemoryPercent,
			"disk": cur.DiskPercent,
		})
		if len(p.points) > PerfMaxPoints {
			p.points = p.points[len(p.points)-PerfMaxPoints:]
		}
		p.netRx = uint64(float64(cur.NetRecv-prev.NetRecv) / netDur)
		p.netTx = uint64(float64(cur.NetSent-prev.NetSent) / netDur)
		p.mu.Unlock()
		prev = cur
		prevSeen = time.Now()
	}
}

// Snapshot 返回采样点副本与当前网络速率。
func (p *PerfTracker) Snapshot() ([]map[string]float64, uint64, uint64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	pts := make([]map[string]float64, len(p.points))
	copy(pts, p.points)
	return pts, p.netRx, p.netTx
}

func firstNonEmpty(v, def string) string {
	if v != "" {
		return v
	}
	return def
}
