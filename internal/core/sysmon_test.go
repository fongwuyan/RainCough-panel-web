package core

import (
	"testing"
	"time"
)

// TestCpuPercent: 模拟两次采样, 验证使用率差值计算。
func TestCpuPercent(t *testing.T) {
	// prev: total=1000, idle=800
	prev := &CpuState{User: 100, System: 100, Idle: 800, Total: 1000}
	// cur: total=1100, idle=830 -> busy=70, dTotal=100, dIdle=30 -> 70%
	cur := &CpuState{User: 140, System: 130, Idle: 830, Total: 1100}
	p := CpuPercent(prev, cur)
	if p < 69 || p > 71 {
		t.Fatalf("期望 ~70%%, 得到 %.2f%%", p)
	}

	// 无变化 -> 0%
	same := &CpuState{User: 100, System: 100, Idle: 800, Total: 1000}
	if p := CpuPercent(prev, same); p != 0 {
		t.Fatalf("无变化应返回 0, 得到 %.2f", p)
	}

	// 首次采样(prev=nil) -> 0
	if p := CpuPercent(nil, cur); p != 0 {
		t.Fatalf("首次采样应返回 0, 得到 %.2f", p)
	}
}

// TestCpuPerCorePercent: 每核使用率。
func TestCpuPerCorePercent(t *testing.T) {
	prev := &CpuState{PerCore: []PerCpuCounter{{Idle: 100, Total: 200}, {Idle: 50, Total: 100}}}
	cur := &CpuState{PerCore: []PerCpuCounter{{Idle: 110, Total: 220}, {Idle: 50, Total: 130}}}
	out := CpuPerCorePercent(prev, cur)
	if len(out) != 2 {
		t.Fatalf("应返回 2 核, 得到 %d", len(out))
	}
	// 核1: dTotal=20, dIdle=10 -> 50%
	if out[0] < 49 || out[0] > 51 {
		t.Fatalf("核1 期望 50%%, 得到 %.2f", out[0])
	}
	// 核2: dTotal=30, dIdle=0 -> 100%
	if out[1] < 99 || out[1] > 100 {
		t.Fatalf("核2 期望 100%%, 得到 %.2f", out[1])
	}
}

// TestMemPercent: 内存使用率。
func TestMemPercent(t *testing.T) {
	m := MemInfo{Total: 16000000, Avail: 4000000}
	p := MemPercent(m)
	if p < 74.9 || p > 75.1 {
		t.Fatalf("期望 75%%, 得到 %.2f", p)
	}
	if p := MemPercent(MemInfo{}); p != 0 {
		t.Fatalf("空内存应返回 0, 得到 %.2f", p)
	}
}

// TestSnapshotCache: 缓存间隔内重复快照返回同一对象。
func TestSnapshotCache(t *testing.T) {
	m := NewSystemMonitor()
	m.shadowAt = time.Now()
	s1 := m.Snapshot()
	s2 := m.Snapshot()
	if s1 != s2 {
		t.Fatal("缓存间隔内两次快照应返回同一对象")
	}
	// CPU 首次无 prev, 应为 0(不崩溃)
	if s1.CPUPercent < 0 || s1.CPUPercent > 100 {
		t.Fatalf("CPUPercent 越界: %.2f", s1.CPUPercent)
	}
}

// TestDuplicateNames: 各采集函数不 panic(Windows 环境下返回简化值)。
func TestCollectorsNoPanic(t *testing.T) {
	ReadCpuState()
	ReadMemInfo()
	ReadDisks()
	ReadNetCounters()
	ReadNetIfaces()
	CpuModel()
	LoadAvg()
	ThreadCount()
	BootTime()
}