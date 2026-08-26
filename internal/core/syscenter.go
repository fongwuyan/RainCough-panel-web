package core

import (
	"fmt"
	"os/exec"
	"strings"
)

// ---- 系统中心(与旧面板 sysfunc.py 契约兼容; 服务/进程/日志等) ----

// SysCenter 系统操作: 服务管理/进程/日志(走 systemctl + sudo)。
type SysCenter struct {
	SudoPW string // 提权密码(空=免密 -n)
}

// NewSysCenter 创建系统中心。
func NewSysCenter(sudoPW string) *SysCenter {
	return &SysCenter{SudoPW: sudoPW}
}

func (sc *SysCenter) sudo(args ...string) (string, error) {
	cmd := []string{}
	if sc.SudoPW != "" {
		cmd = append(cmd, "sudo", "-S")
	} else {
		cmd = append(cmd, "sudo", "-n")
	}
	cmd = append(cmd, args...)
	c := exec.Command(cmd[0], cmd[1:]...)
	var out strings.Builder
	c.Stdout = &out
	c.Stderr = &out
	if sc.SudoPW != "" {
		c.Stdin = strings.NewReader(sc.SudoPW + "\n")
	}
	if err := c.Run(); err != nil {
		return out.String(), err
	}
	return out.String(), nil
}

func (sc *SysCenter) run(name string, args ...string) (string, error) {
	out, err := exec.Command(name, args...).Output()
	return string(out), err
}

// ---- 服务管理 ----

// ServiceList systemd 服务列表(含状态)。
func (sc *SysCenter) ServiceList() ([]map[string]interface{}, error) {
	out, err := sc.run("systemctl", "list-units", "--type=service", "--all", "--no-pager", "--no-legend")
	if err != nil {
		// 无 systemd(容器/极简环境)降级
		return nil, err
	}
	var services []map[string]interface{}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 4 || !strings.HasSuffix(fields[0], ".service") {
			continue
		}
		services = append(services, map[string]interface{}{
			"name": strings.TrimSuffix(fields[0], ".service"),
			"load": fields[1], "active": fields[2], "sub": fields[3], "desc": strings.Join(fields[4:], " "),
		})
	}
	return services, nil
}

// ServiceAction 服务启停(start/stop/restart/reload/enable/disable)。
func (sc *SysCenter) ServiceAction(name, action string) (string, error) {
	return sc.sudo("systemctl", action, name+".service")
}

// ---- 进程 ----

// ProcessList 进程列表。
func (sc *SysCenter) ProcessList() ([]map[string]interface{}, error) {
	out, err := sc.run("ps", "-eo", "pid,ppid,user,%cpu,%mem,stat,etime,args", "--no-headers")
	if err != nil {
		return nil, err
	}
	var procs []map[string]interface{}
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 7 {
			continue
		}
		procs = append(procs, map[string]interface{}{
			"pid": fields[0], "ppid": fields[1], "user": fields[2],
			"cpu": fields[3], "mem": fields[4], "stat": fields[5], "etime": fields[6],
			"cmd": strings.Join(fields[7:], " "),
		})
	}
	return procs, nil
}

// KillProcess 结束进程。
func (sc *SysCenter) KillProcess(pid string) (string, error) {
	return sc.sudo("kill", pid)
}

// ---- 日志 ----

// TailLog 读取日志尾部(通用 tail -n)。
func (sc *SysCenter) TailLog(path string, lines int, grep string) ([]string, error) {
	if lines <= 0 {
		lines = 200
	}
	args := []string{"-n", fmt.Sprint(lines)}
	if grep != "" {
		args = append(args, "-F", grep)
	}
	args = append(args, path)
	out, err := sc.sudo(append([]string{"tail"}, args...)...)
	if err != nil {
		return nil, err
	}
	var ls []string
	for _, l := range strings.Split(out, "\n") {
		if l != "" {
			ls = append(ls, l)
		}
	}
	return ls, nil
}

// JournalLog systemd journal 日志。
func (sc *SysCenter) JournalLog(unit string, lines int) ([]string, error) {
	if lines <= 0 {
		lines = 100
	}
	out, err := sc.run("journalctl", "-u", unit, "-n", fmt.Sprint(lines), "--no-pager")
	if err != nil {
		return nil, err
	}
	var ls []string
	for _, l := range strings.Split(out, "\n") {
		if l != "" {
			ls = append(ls, l)
		}
	}
	return ls, nil
}

// ---- 防火墙(ufw) ----

// FirewallStatus ufw 状态与规则。
func (sc *SysCenter) FirewallStatus() (map[string]interface{}, error) {
	status, err := sc.sudo("ufw", "status")
	if err != nil {
		return map[string]interface{}{"enabled": false, "error": err.Error()}, nil
	}
	enabled := strings.Contains(status, "Status: active")
	var rules []string
	for _, l := range strings.Split(status, "\n") {
		if strings.Contains(l, "ALLOW") || strings.Contains(l, "DENY") {
			rules = append(rules, strings.TrimSpace(l))
		}
	}
	return map[string]interface{}{"enabled": enabled, "rules": rules, "raw": status}, nil
}