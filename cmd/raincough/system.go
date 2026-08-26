package main

import (
	"net/http"
	"os"
	"runtime"
	"time"
)

// handleSystem 系统概览(与旧版 /api/system 契约兼容的核心字段)。
type sysSnapshot struct {
	CPUPercent    float64 `json:"cpu_percent"`
	CPUCount      int     `json:"cpu_count"`
	MemoryTotal   uint64  `json:"memory_total"`
	MemoryUsed    uint64  `json:"memory_used"`
	MemoryPercent float64 `json:"memory_percent"`
	SwapTotal     uint64  `json:"swap_total"`
	SwapUsed      uint64  `json:"swap_used"`
	SwapPercent   float64 `json:"swap_percent"`
	Uptime        int64   `json:"uptime"`
	Platform      string  `json:"platform"`
	Arch          string  `json:"arch"`
	GoVersion     string  `json:"go_version"`
	CurrentTime   int64   `json:"current_time"`
	Hostname      string  `json:"hostname"`
	ProcessCount  int     `json:"process_count"`
}

func (s *server) handleSystem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
		return
	}
	hostname, _ := os.Hostname()
	snap := sysSnapshot{
		CPUCount:     runtime.NumCPU(),
		Platform:     runtime.GOOS,
		Arch:         runtime.GOARCH,
		GoVersion:    runtime.Version(),
		Uptime:       uptimeSeconds(),
		CurrentTime:  time.Now().Unix(),
		Hostname:     hostname,
		ProcessCount: processCount(),
	}
	// 内存/CPU 采集 (Linux /proc, Windows 简化)
	fillMem(&snap)
	writeJSON(w, http.StatusOK, snap)
}

func (s *server) handleSystemSub(w http.ResponseWriter, r *http.Request) {
	// 预留: /api/system/<sub> 细分端点(M4 展开)
	writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "not implemented"})
}
