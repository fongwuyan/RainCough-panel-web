//go:build !linux

package core

import "fmt"

// 非 Linux 平台占位实现: 面板只部署在 Linux, 这里仅为开发机编译通过。

// kernelVersion 内核版本(非 Linux 无此概念)。
func kernelVersion() string { return "" }

// Disks 块设备列表。
func Disks() []map[string]interface{} { return []map[string]interface{}{} }

// Unmount 卸载设备。
func Unmount(part string) error { return fmt.Errorf("仅支持 Linux") }

// NetStatus 网络概览。
func NetStatus() map[string]interface{} {
	return map[string]interface{}{
		"dns": "", "tcp_conns": 0,
		"rate": map[string]float64{"rx": 0, "tx": 0},
		"public_ip": "", "interfaces": []map[string]interface{}{},
	}
}

// diskIORates 磁盘 IO(非 Linux 不支持)。
func diskIORates() ([]DiskIOStat, float64, float64) { return nil, 0, 0 }
