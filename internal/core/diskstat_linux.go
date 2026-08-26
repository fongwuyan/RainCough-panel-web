//go:build linux

package core

import (
	"bufio"
	"os"
	"strings"
	"syscall"
)

// skipFSTypes 过滤伪文件系统。
var skipFSTypes = map[string]bool{
	"proc": true, "sysfs": true, "devpts": true, "tmpfs": true,
	"devtmpfs": true, "cgroup": true, "cgroup2": true, "overlay": true,
	"shm": true, "mqueue": true, "securityfs": true, "debugfs": true,
	"tracefs": true, "pstore": true, "autofs": true, "binfmt_misc": true,
	"rpc_pipefs": true, "configfs": true, "fusectl": true, "hugetlbfs": true,
	"efivarfs": true, "bpf": true, "nsfs": true, "squashfs": true,
	"iso9660": true, "fuse.gvfsd-fuse": true, "fuse": true,
}

// ReadDisks 返回磁盘分区列表(带用量)。
func ReadDisks() []DiskInfo {
	var out []DiskInfo
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return out
	}
	defer f.Close()

	seen := map[string]bool{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 3 {
			continue
		}
		dev, mount, fstype := fields[0], fields[1], fields[2]
		if skipFSTypes[fstype] {
			continue
		}
		if seen[mount] {
			continue
		}
		seen[mount] = true
		var st syscall.Statfs_t
		if err := syscall.Statfs(mount, &st); err != nil {
			continue
		}
		total := st.Blocks * uint64(st.Bsize)
		free := st.Bfree * uint64(st.Bsize)
		used := total - free
		percent := 0.0
		if total > 0 {
			percent = float64(used) / float64(total) * 100
		}
		out = append(out, DiskInfo{
			Mountpoint: mount, Total: total, Used: used, Free: free,
			Percent: percent, FSType: fstype, Device: dev,
		})
	}
	return out
}