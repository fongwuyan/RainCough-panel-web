// Package core 主系统核心功能(系统功能, 开发者维护)。
package core

// SystemMonitor 系统监控采集(纯逻辑, 与 HTTP 层解耦)。
// 数据源: Linux /proc; 非 Linux 返回简化值。

// SystemSnapshot 与旧面板 /api/system 契约兼容的系统快照。
type SystemSnapshot struct {
	// CPU
	CPUPercent float64   `json:"cpu_percent"`
	CPUCount   int       `json:"cpu_count"`
	CPUPerCore []float64 `json:"cpu_per_core"`
	CPUModel   string    `json:"cpu_model"`
	LoadAvg    []float64 `json:"load_avg"`
	// 内存/交换
	MemoryTotal     uint64  `json:"memory_total"`
	MemoryUsed      uint64  `json:"memory_used"`
	MemoryAvailable uint64  `json:"memory_available"`
	MemoryPercent   float64 `json:"memory_percent"`
	SwapTotal       uint64  `json:"swap_total"`
	SwapUsed        uint64  `json:"swap_used"`
	SwapPercent     float64 `json:"swap_percent"`
	// 磁盘
	Disks       []DiskInfo `json:"disks"`
	DiskTotal   uint64     `json:"disk_total"`
	DiskUsed    uint64     `json:"disk_used"`
	DiskPercent float64    `json:"disk_percent"`
	// 网络(累计字节 + 本次采样速率)
	NetSent     uint64     `json:"net_sent"`
	NetRecv     uint64     `json:"net_recv"`
	NetUpRate   float64    `json:"net_up_rate"`
	NetDownRate float64    `json:"net_down_rate"`
	NetIfaces   []NetIface `json:"net_interfaces"`
	// 进程/系统
	ProcessCount int    `json:"process_count"`
	ThreadCount  int64  `json:"thread_count"`
	Hostname     string `json:"hostname"`
	Platform     string `json:"platform"`
	Arch         string `json:"arch"`
	GoVersion    string `json:"go_version"`
	BootTime     int64  `json:"boot_time"`
	Uptime       int64  `json:"uptime"`
	CurrentTime  int64  `json:"current_time"`
}

// DiskInfo 磁盘分区信息。
type DiskInfo struct {
	Mountpoint string  `json:"mountpoint"`
	Total      uint64  `json:"total"`
	Used       uint64  `json:"used"`
	Free       uint64  `json:"free"`
	Percent    float64 `json:"percent"`
	FSType     string  `json:"fstype,omitempty"`
	Device     string  `json:"device,omitempty"`
}

// NetIface 网络接口实时状态。
type NetIface struct {
	Name     string  `json:"name"`
	Up       bool    `json:"up"`
	Speed    int64   `json:"speed"`
	UpRate   float64 `json:"up_rate"`
	DownRate float64 `json:"down_rate"`
	Addr     string  `json:"addr"`
}

// CpuState 用于 CPU 差值计算的累计计数器。
type CpuState struct {
	User    uint64
	Nice    uint64
	System  uint64
	Idle    uint64
	Iowait  uint64
	Irq     uint64
	Softirq uint64
	Steal   uint64
	Total   uint64
	PerCore []PerCpuCounter // 按核累计
}

// PerCpuCounter 单核计数器。
type PerCpuCounter struct {
	Idle  uint64
	Total uint64
}
