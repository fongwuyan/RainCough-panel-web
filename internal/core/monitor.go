package core

import (
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// SystemMonitor 系统监控器: 聚合采集 + 差值计算 + 缓存。
type SystemMonitor struct {
	mu sync.Mutex

	// CPU 差值
	prevCpu *CpuState
	// 网络差值
	prevNet    *NetCounters
	prevIfaces map[string]*NetIfaceState
	// 缓存
	cached   *SystemSnapshot
	cachedAt time.Time
	shadowAt time.Time // 影子时钟(便于测试)

	// 配置
	cacheInterval time.Duration
}

// NewSystemMonitor 创建监控器。
func NewSystemMonitor() *SystemMonitor {
	return &SystemMonitor{
		prevIfaces:    map[string]*NetIfaceState{},
		cacheInterval: 1500 * time.Millisecond,
	}
}

// Snapshot 获取系统快照(带缓存)。
func (m *SystemMonitor) Snapshot() *SystemSnapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	if m.cached != nil && now.Sub(m.cachedAt) < m.cacheInterval {
		return m.cached
	}

	cur := ReadCpuState()
	curNet := ReadNetCounters()
	curIfaces := ReadNetIfaces()
	mem := ReadMemInfo()
	disks := ReadDisks()
	hostname, _ := os.Hostname()

	snap := &SystemSnapshot{
		CPUCount: runtime.NumCPU(),
		CPUModel: CpuModel(),
		LoadAvg:  LoadAvg(),
		// 内存
		MemoryTotal:     mem.Total,
		MemoryUsed:      mem.Total - mem.Avail,
		MemoryAvailable: mem.Avail,
		MemoryPercent:   MemPercent(mem),
		SwapTotal:       mem.SwapTotal,
		SwapUsed:        mem.SwapTotal - mem.SwapFree,
		// 磁盘
		Disks: disks,
		// 网络(累计)
		NetSent: curNet.Sent,
		NetRecv: curNet.Recv,
		// 系统
		ProcessCount:  processCountLinux(),
		ThreadCount:   ThreadCount(),
		Hostname:      hostname,
		Platform:      runtime.GOOS,
		Arch:          runtime.GOARCH,
		GoVersion:     runtime.Version(),
		PythonVersion: runtime.Version(),
		BootTime:      BootTime(),
		Uptime:        uptimeSec(),
		CurrentTime:   time.Now().Unix(),
	}
	if mem.Total > 0 {
		snap.SwapPercent = float64(snap.SwapUsed) / float64(mem.SwapTotal) * 100
	}
	// 磁盘总量汇总(取第一个真实盘, 与旧版一致)
	if len(disks) > 0 {
		for _, d := range disks {
			if d.Mountpoint == "/" {
				snap.DiskTotal = d.Total
				snap.DiskUsed = d.Used
				snap.DiskPercent = d.Percent
				break
			}
		}
		if snap.DiskTotal == 0 {
			snap.DiskTotal = disks[0].Total
			snap.DiskUsed = disks[0].Used
			snap.DiskPercent = disks[0].Percent
		}
	}

	// CPU 使用率(需两次采样)
	snap.CPUPercent = CpuPercent(m.prevCpu, &cur)
	snap.CPUPerCore = CpuPerCorePercent(m.prevCpu, &cur)
	m.prevCpu = &cur

	// 网络速率(需两次采样)
	dt := m.netDelta()
	if dt > 0 {
		snap.NetUpRate = float64(curNet.Sent-m.prevNet.Sent) / dt
		snap.NetDownRate = float64(curNet.Recv-m.prevNet.Recv) / dt
	}
	m.prevNet = &curNet

	// 接口速率
	ifaces := make([]NetIface, 0, len(curIfaces))
	for i := range curIfaces {
		ci := &curIfaces[i]
		out := NetIface{Name: ci.Name, Up: ci.Up, Speed: ci.Speed, Addr: ci.Addr}
		if p, ok := m.prevIfaces[ci.Name]; ok && dt > 0 {
			out.UpRate = float64(ci.Sent-p.Sent) / dt
			out.DownRate = float64(ci.Recv-p.Recv) / dt
		}
		ifaces = append(ifaces, out)
		cp := *ci
		m.prevIfaces[ci.Name] = &cp
	}
	snap.NetIfaces = ifaces

	m.cached = snap
	m.cachedAt = now
	return snap
}

// netDelta 返回距上次采样的秒数(用于速率计算)。
func (m *SystemMonitor) netDelta() float64 {
	// 首次采样时 prevNet 为 nil, 无法算速率
	if m.prevNet == nil {
		return 0
	}
	// 用缓存时间差近似采样间隔
	interval := time.Since(m.cachedAt).Seconds()
	if interval <= 0 {
		interval = 1.5 // 默认近似
	}
	return interval
}

func (m *SystemMonitor) now() time.Time {
	if m.shadowAt.IsZero() {
		return time.Now()
	}
	return m.shadowAt
}

// ---- 内部小函数 ----

func processCountLinux() int {
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

func uptimeSec() int64 {
	if runtime.GOOS == "linux" {
		b, err := os.ReadFile("/proc/uptime")
		if err == nil {
			fields := strings.Fields(string(b))
			if len(fields) > 0 {
				v, err := strconv.ParseFloat(fields[0], 64)
				if err == nil && v > 0 {
					return int64(v)
				}
			}
		}
	}
	return int64(time.Since(startTime).Seconds())
}
