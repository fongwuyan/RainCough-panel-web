package main

import (
	"bufio"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// ---- 系统监控辅助(不依赖外部库) ----

var bootTime = time.Now()

// uptimeSeconds 返回系统启动时长(进程角度近似; 完整实现读 /proc/uptime)。
func uptimeSeconds() int64 {
	if runtime.GOOS == "linux" {
		if b, err := os.ReadFile("/proc/uptime"); err == nil {
			fields := strings.Fields(string(b))
			if len(fields) > 0 {
				if secs, err := strconv.ParseFloat(fields[0], 64); err == nil {
					return int64(secs)
				}
			}
		}
	}
	return int64(time.Since(bootTime).Seconds())
}

// processCount 进程数(linux 读 /proc; 其他平台返回 0)。
func processCount() int {
	if runtime.GOOS != "linux" {
		return 0
	}
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return 0
	}
	n := 0
	for _, e := range entries {
		if e.IsDir() {
			if _, err := strconv.Atoi(e.Name()); err == nil {
				n++
			}
		}
	}
	return n
}

// fillMem 填充内存快照(linux 读 /proc/meminfo; 其他平台用运行时估算)。
func fillMem(s *sysSnapshot) {
	memTotal, memAvail, swapTotal, swapFree := uint64(0), uint64(0), uint64(0), uint64(0)

	if runtime.GOOS == "linux" {
		f, err := os.Open("/proc/meminfo")
		if err == nil {
			defer f.Close()
			sc := bufio.NewScanner(f)
			for sc.Scan() {
				line := sc.Text()
				var v uint64
				var name string
				if n, _ := fmtSscanf(line, &name, &v); n == 2 {
					kb := v * 1024
					switch name {
					case "MemTotal:":
						memTotal = kb
					case "MemAvailable:":
						memAvail = kb
					case "SwapTotal:":
						swapTotal = kb
					case "SwapFree:":
						swapFree = kb
					}
				}
			}
		}
	}

	if memTotal == 0 {
		// 非 Linux 或无 /proc: 运行时粗略估算(开发环境可接受)
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		memTotal = 16 << 30
		memAvail = memTotal - m.Alloc
	}

	s.MemoryTotal = memTotal
	s.MemoryUsed = memTotal - memAvail
	if memTotal > 0 {
		s.MemoryPercent = float64(s.MemoryUsed) / float64(memTotal) * 100
	}
	s.SwapTotal = swapTotal
	s.SwapUsed = swapTotal - swapFree
	if swapTotal > 0 {
		s.SwapPercent = float64(s.SwapUsed) / float64(swapTotal) * 100
	}
}

// fmtSscanf 轻量解析 "Name: 12345 kB" 形式行。
func fmtSscanf(line string, name *string, v *uint64) (int, error) {
	idx := strings.Index(line, ":")
	if idx <= 0 {
		return 0, strconv.ErrSyntax
	}
	*name = line[:idx+1] // 含 ':'
	rest := strings.TrimSpace(line[idx+1:])
	// 取首个数字
	fields := strings.Fields(rest)
	if len(fields) == 0 {
		return 0, strconv.ErrSyntax
	}
	n, err := strconv.ParseUint(fields[0], 10, 64)
	if err != nil {
		return 0, err
	}
	*v = n
	return 2, nil
}
