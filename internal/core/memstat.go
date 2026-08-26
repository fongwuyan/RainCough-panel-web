package core

import (
	"bufio"
	"os"
	"runtime"
)

// MemInfo 内存信息。
type MemInfo struct {
	Total     uint64
	Avail     uint64
	SwapTotal uint64
	SwapFree  uint64
}

// ReadMemInfo 读取内存信息(linux /proc/meminfo)。
func ReadMemInfo() MemInfo {
	var m MemInfo
	if runtime.GOOS != "linux" {
		return m
	}
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return m
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		idx := stringsIndex(line, ":")
		if idx <= 0 {
			continue
		}
		name := line[:idx+1]
		fields := stringsFields(line[idx+1:])
		if len(fields) == 0 {
			continue
		}
		kb := parseUint(fields[0]) * 1024
		switch name {
		case "MemTotal:":
			m.Total = kb
		case "MemAvailable:":
			m.Avail = kb
		case "SwapTotal:":
			m.SwapTotal = kb
		case "SwapFree:":
			m.SwapFree = kb
		}
	}
	return m
}

// ---- 小工具(避免过多导入) ----

func stringsIndex(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func stringsFields(s string) []string {
	var out []string
	cur := ""
	for _, c := range s {
		if c == ' ' || c == '\t' || c == '\n' {
			if cur != "" {
				out = append(out, cur)
				cur = ""
			}
		} else {
			cur += string(c)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func parseUint(s string) uint64 {
	v := uint64(0)
	for _, c := range s {
		if c < '0' || c > '9' {
			break
		}
		v = v*10 + uint64(c-'0')
	}
	return v
}

// MemPercent 计算内存使用率(total==0 返回 0)。
func MemPercent(m MemInfo) float64 {
	if m.Total == 0 {
		return 0
	}
	used := m.Total - m.Avail
	return float64(used) / float64(m.Total) * 100
}
