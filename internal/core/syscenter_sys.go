package core

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---- 系统中心扩展(旧前端 sysf* 契约的数据逻辑; HTTP 装配留在 cmd) ----

// Hardware 硬件/内核信息(/proc + /sys)。
func (sc *SysCenter) Hardware() map[string]interface{} {
	out := map[string]interface{}{}
	if b, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		out["cpuinfo"] = string(b)
	}
	if b, err := os.ReadFile("/proc/meminfo"); err == nil {
		out["meminfo"] = string(b)
	}
	out["cpu_count"] = runtime.NumCPU()
	if sb, err := os.ReadFile("/sys/class/dmi/id/product_name"); err == nil {
		out["product"] = strings.TrimSpace(string(sb))
	}
	return out
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
func (sc *SysCenter) CleanScan() []map[string]interface{} {
	aptSize, _ := DirSize("/var/cache/apt")
	tmpSize, _ := DirSize("/tmp")
	return []map[string]interface{}{
		{"key": "apt", "path": "/var/cache/apt", "size": aptSize, "label": "apt-cache"},
		{"key": "tmp", "path": "/tmp", "size": tmpSize, "label": "tmp-files"},
	}
}

// CleanApt 清理 apt 缓存。
func (sc *SysCenter) CleanApt() (string, error) {
	return sc.Sudo("apt", "clean")
}

// CleanTmp 清理 /tmp 一级内容。
func (sc *SysCenter) CleanTmp() (string, error) {
	return sc.Sudo("sh", "-c", "find /tmp -mindepth 1 -maxdepth 1 -exec rm -rf {} +")
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

// KernelList 已安装内核包列表。
func (sc *SysCenter) KernelList() ([]string, error) {
	out, err := sc.Sudo("dpkg", "--list", "linux-image-*")
	var kernels []string
	for _, l := range strings.Split(out, "\n") {
		if strings.Contains(l, "linux-image") {
			f := strings.Fields(l)
			if len(f) > 0 {
				kernels = append(kernels, f[0])
			}
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

// Events journal 最近事件时间线。
func (sc *SysCenter) Events(limit int) ([]map[string]interface{}, error) {
	out, err := sc.Run("journalctl", "--no-pager", "-n", fmt.Sprint(limit), "--output=short-iso")
	events := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			events = append(events, map[string]interface{}{"line": line})
		}
	}
	return events, err
}

// LogrotateList 读取 logrotate 主配置。
func (sc *SysCenter) LogrotateList() (string, error) {
	b, err := os.ReadFile("/etc/logrotate.conf")
	return string(b), err
}

// LogrotateSave 保存单条 logrotate 配置。
func (sc *SysCenter) LogrotateSave(name, content string) error {
	return os.WriteFile("/etc/logrotate.d/"+name, []byte(content), 0o644)
}

// BootHistory 启动历史(journalctl --list-boots)。
func (sc *SysCenter) BootHistory() []map[string]interface{} {
	out, _ := sc.Run("journalctl", "--list-boots", "--no-pager")
	rows := []map[string]interface{}{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) >= 3 {
			rows = append(rows, map[string]interface{}{"action": "boot", "when": f[1] + " " + f[2]})
		}
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
