package core

import (
	"bufio"
	"net"
	"os"
	"runtime"
	"strconv"
	"strings"
)

// NetCounters 网络累计字节(整体)。
type NetCounters struct {
	Sent uint64
	Recv uint64
}

// NetIfaceState 接口累计计数器(用于速率差值)。
type NetIfaceState struct {
	Name  string
	Up    bool
	Speed int64
	Sent  uint64
	Recv  uint64
	Addr  string
}

// ReadNetCounters 读取整体网络累计字节(linux /proc/net/dev)。
func ReadNetCounters() NetCounters {
	var n NetCounters
	if runtime.GOOS != "linux" {
		return n
	}
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return n
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		iface := strings.TrimSpace(parts[0])
		if iface == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}
		n.Recv += atou(fields[0])
		n.Sent += atou(fields[8])
	}
	return n
}

// ReadNetIfaces 读取各接口实时状态(速率需外部差值计算)。
func ReadNetIfaces() []NetIfaceState {
	var out []NetIfaceState
	if runtime.GOOS != "linux" {
		return out
	}
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return out
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		name := strings.TrimSpace(parts[0])
		if name == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}
		st := NetIfaceState{
			Name:  name,
			Recv:  atou(fields[0]),
			Sent:  atou(fields[8]),
			Speed: 0,
		}
		// 探测接口是否 up + IP 地址
		if iface, err := net.InterfaceByName(name); err == nil {
			st.Up = (iface.Flags & net.FlagUp) != 0
			st.Speed = 0 // Linux 下速度需 ethtool, 简化
			if addrs, err := iface.Addrs(); err == nil {
				for _, a := range addrs {
					if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil {
						st.Addr = ipn.IP.String()
						break
					}
				}
			}
		}
		out = append(out, st)
	}
	return out
}

func atou(s string) uint64 {
	v, _ := strconv.ParseUint(s, 10, 64)
	return v
}
