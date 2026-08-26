package core

import (
	"bufio"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// -------- CPU 采集 --------

// ReadCpuState 读取 /proc/stat 的 CPU 累计计数器(整体 + 每核)。
func ReadCpuState() CpuState {
	var s CpuState
	if runtime.GOOS != "linux" {
		return s
	}
	f, err := os.Open("/proc/stat")
	if err != nil {
		return s
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)
			if len(fields) >= 8 {
				for i := 1; i < 8; i++ {
					s.Total += atou64(fields[i])
				}
				s.User = atou64(fields[1])
				s.Nice = atou64(fields[2])
				s.System = atou64(fields[3])
				s.Idle = atou64(fields[4])
				s.Iowait = atou64(fields[5])
				s.Irq = atou64(fields[6])
				s.Softirq = atou64(fields[7])
				if len(fields) > 8 {
					s.Steal = atou64(fields[8])
				}
			}
		} else if strings.HasPrefix(line, "cpu") {
			fields := strings.Fields(line)
			if len(fields) >= 5 {
				var idle, total uint64
				for i := 1; i < len(fields); i++ {
					total += atou64(fields[i])
				}
				idle = atou64(fields[4]) // idle
				s.PerCore = append(s.PerCore, PerCpuCounter{Idle: idle, Total: total})
			}
		}
	}
	return s
}

// CpuPercent 计算两次采样间的 CPU 使用率(prev 为 nil 时返回 0, 首次采样无法算差值)。
func CpuPercent(prev, cur *CpuState) float64 {
	if prev == nil || cur == nil || prev.Total == 0 {
		return 0
	}
	dTotal := cur.Total - prev.Total
	if dTotal == 0 {
		return 0
	}
	// idle = idle + iowait(IO 等待也算空闲)
	dIdle := (cur.Idle + cur.Iowait) - (prev.Idle + prev.Iowait)
	busy := float64(dTotal-dIdle) / float64(dTotal) * 100
	if busy < 0 {
		busy = 0
	}
	if busy > 100 {
		busy = 100
	}
	return busy
}

// CpuPerCorePercent 计算每核使用率。
func CpuPerCorePercent(prev, cur *CpuState) []float64 {
	if prev == nil || cur == nil {
		return nil
	}
	n := len(cur.PerCore)
	if n == 0 || len(prev.PerCore) != n {
		return nil
	}
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		dTotal := cur.PerCore[i].Total - prev.PerCore[i].Total
		if dTotal > 0 {
			dIdle := cur.PerCore[i].Idle - prev.PerCore[i].Idle
			v := float64(dTotal-dIdle) / float64(dTotal) * 100
			if v < 0 {
				v = 0
			}
			if v > 100 {
				v = 100
			}
			out[i] = v
		}
	}
	return out
}

// LoadAvg 读取 /proc/loadavg (1/5/15 分钟)。
func LoadAvg() []float64 {
	out := []float64{0, 0, 0}
	if runtime.GOOS != "linux" {
		return out
	}
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return out
	}
	fields := strings.Fields(string(b))
	for i := 0; i < 3 && i < len(fields); i++ {
		if v, err := strconv.ParseFloat(fields[i], 64); err == nil {
			out[i] = v
		}
	}
	return out
}

// CpuModel 读取首个 CPU 型号描述。
func CpuModel() string {
	if runtime.GOOS != "linux" {
		return runtime.GOARCH
	}
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "model name") {
			if i := strings.Index(line, ":"); i >= 0 {
				return strings.TrimSpace(line[i+1:])
			}
		}
	}
	return ""
}

func atou64(s string) uint64 {
	v, _ := strconv.ParseUint(s, 10, 64)
	return v
}

// -------- 进程/线程 --------

// ThreadCount 汇总全部进程线程数。
func ThreadCount() int64 {
	if runtime.GOOS != "linux" {
		return 0
	}
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return 0
	}
	var total int64
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		pid := e.Name()
		if _, err := strconv.Atoi(pid); err != nil {
			continue
		}
		st, err := os.Stat("/proc/" + pid + "/stat")
		if err != nil {
			continue
		}
		_ = st
		// 简化: 读任务目录数量更准, 但开销大; 用 stat 文件存在计为 1 线程
		total++
	}
	return total
}

// BootTime 系统启动时间戳。
func BootTime() int64 {
	if runtime.GOOS != "linux" {
		return time.Now().Unix() - int64(uptimeFallback())
	}
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return time.Now().Unix() - int64(uptimeFallback())
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return time.Now().Unix() - int64(uptimeFallback())
	}
	secs, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return time.Now().Unix() - int64(uptimeFallback())
	}
	return time.Now().Unix() - int64(secs)
}

var startTime = time.Now()

func uptimeFallback() float64 { return time.Since(startTime).Seconds() }