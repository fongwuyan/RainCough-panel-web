//go:build !linux

package core

// ReadDisks 非 Linux 平台返回空列表(数据源 /proc/mounts 不存在)。
func ReadDisks() []DiskInfo {
	return nil
}