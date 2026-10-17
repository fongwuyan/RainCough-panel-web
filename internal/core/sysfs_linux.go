//go:build linux

package core

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// 本文件用纯标准库读取 /proc 与 /sys, 替代 df/lsblk/ip/ss 等外部命令。

// kernelVersion 内核版本(/proc/sys/kernel/osrelease)。
func kernelVersion() string {
	b, err := os.ReadFile("/proc/sys/kernel/osrelease")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// ---- 磁盘 ----

type mountInfo struct {
	device string
	fstype string
}

// readMounts 解析 /proc/self/mounts, 返回 设备名 -> 挂载信息。
func readMounts() map[string]mountInfo {
	out := map[string]mountInfo{}
	f, err := os.Open("/proc/self/mounts")
	if err != nil {
		return out
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 3 {
			continue
		}
		dev := fields[0]
		// /dev/sda1 与 /dev/mapper/x 都按 basename 归并
		out[filepath.Base(dev)] = mountInfo{device: dev, fstype: fields[2]}
	}
	return out
}

// readLabels 读取 /dev/disk/by-label 下的符号链接, 返回 设备 basename -> 标签。
func readLabels() map[string]string {
	out := map[string]string{}
	entries, err := os.ReadDir("/dev/disk/by-label")
	if err != nil {
		return out
	}
	for _, e := range entries {
		target, err := os.Readlink(filepath.Join("/dev/disk/by-label", e.Name()))
		if err != nil {
			continue
		}
		out[filepath.Base(target)] = e.Name()
	}
	return out
}

// blockSize 读取 /sys/class/block/<name>/size (512 字节扇区数)。
func blockSize(name string) uint64 {
	b, err := os.ReadFile(filepath.Join("/sys/class/block", name, "size"))
	if err != nil {
		return 0
	}
	n, _ := strconv.ParseUint(strings.TrimSpace(string(b)), 10, 64)
	return n * 512
}

func blockAttr(name, attr string) string {
	b, err := os.ReadFile(filepath.Join("/sys/class/block", name, attr))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// diskUsage 用 Statfs 计算挂载点用量(替代 df)。
func diskUsage(mountpoint string) (used, total uint64, percent float64) {
	if mountpoint == "" {
		return 0, 0, 0
	}
	var st syscall.Statfs_t
	if err := syscall.Statfs(mountpoint, &st); err != nil {
		return 0, 0, 0
	}
	bs := uint64(st.Bsize)
	total = st.Blocks * bs
	free := st.Bavail * bs
	if total == 0 {
		return 0, 0, 0
	}
	used = total - free
	return used, total, float64(used) * 100 / float64(total)
}

func isDiskName(name string) bool {
	for _, p := range []string{"sd", "vd", "xvd", "hd"} {
		if strings.HasPrefix(name, p) {
			// 排除分区: sda1 这类带数字尾巴的
			rest := name[len(p):]
			if rest == "" {
				return false
			}
			last := rest[len(rest)-1]
			return last < '0' || last > '9'
		}
	}
	if strings.HasPrefix(name, "nvme") || strings.HasPrefix(name, "mmcblk") {
		// nvme0n1 = 盘; nvme0n1p1 = 分区; mmcblk0 = 盘; mmcblk0p1 = 分区
		return !strings.Contains(name, "p") || !hasDigitAfterP(name)
	}
	return false
}

// hasDigitAfterP 判断 "p" 后面是否紧跟数字(nvme0n1p1 / mmcblk0p1 = 分区)。
func hasDigitAfterP(name string) bool {
	i := strings.LastIndex(name, "p")
	if i < 0 || i == len(name)-1 {
		return false
	}
	c := name[i+1]
	return c >= '0' && c <= '9'
}

// Disks 块设备列表(纯 /proc/partitions + /sys/class/block + Statfs)。
func Disks() []map[string]interface{} {
	f, err := os.Open("/proc/partitions")
	if err != nil {
		return []map[string]interface{}{}
	}
	defer f.Close()

	var names []string
	sizes := map[string]uint64{}
	sc := bufio.NewScanner(f)
	first := true
	for sc.Scan() {
		if first { // 表头
			first = false
			continue
		}
		fields := strings.Fields(sc.Text())
		if len(fields) < 4 {
			continue
		}
		name := fields[3]
		if strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") ||
			strings.HasPrefix(name, "dm-") || strings.HasPrefix(name, "sr") {
			continue
		}
		sz, _ := strconv.ParseUint(fields[2], 10, 64)
		names = append(names, name)
		sizes[name] = sz * 1024
	}
	sort.Strings(names)

	mounts := readMounts()
	labels := readLabels()

	var disks []map[string]interface{}
	for _, name := range names {
		if !isDiskName(name) {
			continue
		}
		size := blockSize(name)
		if size == 0 {
			size = sizes[name]
		}
		partitions := []map[string]interface{}{}
		for _, pn := range names {
			if pn == name || !strings.HasPrefix(pn, name) {
				continue
			}
			psize := blockSize(pn)
			if psize == 0 {
				psize = sizes[pn]
			}
			mi, mounted := mounts[pn]
			used, total, pct := diskUsage("")
			if mounted {
				used, total, pct = diskUsage(mountPointOf(pn))
			}
			partitions = append(partitions, map[string]interface{}{
				"path":       "/dev/" + pn,
				"name":       pn,
				"fstype":     mi.fstype,
				"label":      labels[pn],
				"mountpoint": mountPointOf(pn),
				"size":       psize,
				"mounted":    mounted,
				"removable":  blockAttr(pn, "removable") == "1",
				"used":       used,
				"total":      total,
				"percent":    pct,
			})
		}
		disks = append(disks, map[string]interface{}{
			"name": name, "path": "/dev/" + name, "type": "disk",
			"size": size, "hotplug": blockAttr(name, "removable") == "1", "removable": false,
			"model": blockAttr(name, "device/model"), "tran": "",
			"partitions": partitions,
		})
	}
	return disks
}

// mountPointOf 从 /proc/self/mounts 里反查设备对应的挂载点。
func mountPointOf(devName string) string {
	f, err := os.Open("/proc/self/mounts")
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) >= 2 && filepath.Base(fields[0]) == devName {
			return fields[1]
		}
	}
	return ""
}

// Unmount 卸载设备(纯 syscall, 不再 sudo umount)。
func Unmount(part string) error {
	if part == "" {
		return fmt.Errorf("part 必填")
	}
	if part == "/" {
		return fmt.Errorf("禁止卸载根分区")
	}
	return syscall.Unmount(part, 0)
}

// ---- 网络 ----

var (
	netMu   sync.Mutex
	netLast struct {
		stamp time.Time
		rx    uint64
		tx    uint64
		rate  [2]float64 // rx, tx bytes/s
	}
)

// NetStatus 网络概览: DNS / TCP 连接数 / 实时速率(替代 ip、ss、resolvectl)。
func NetStatus() map[string]interface{} {
	out := map[string]interface{}{
		"dns":        readDNS(),
		"tcp_conns":  countTCP(),
		"rate":       map[string]float64{"rx": 0, "tx": 0},
		"public_ip":  "",
		"interfaces": netIfaces(),
	}
	rx, tx := netTotal()
	netMu.Lock()
	now := time.Now()
	if !netLast.stamp.IsZero() {
		dt := now.Sub(netLast.stamp).Seconds()
		if dt > 0.2 {
			netLast.rate[0] = float64(rx-netLast.rx) / dt
			netLast.rate[1] = float64(tx-netLast.tx) / dt
			netLast.stamp = now
			netLast.rx, netLast.tx = rx, tx
		}
	} else {
		netLast.stamp = now
		netLast.rx, netLast.tx = rx, tx
	}
	out["rate"] = map[string]float64{"rx": netLast.rate[0], "tx": netLast.rate[1]}
	netMu.Unlock()
	return out
}

func readDNS() string {
	b, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return ""
	}
	var out []string
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "nameserver") {
			f := strings.Fields(line)
			if len(f) >= 2 {
				out = append(out, f[1])
			}
		}
	}
	return strings.Join(out, ", ")
}

// countTCP 统计 ESTABLISHED 连接数(/proc/net/tcp{,6} 第 4 列为状态, 01=ESTABLISHED)。
func countTCP() int {
	n := 0
	for _, p := range []string{"/proc/net/tcp", "/proc/net/tcp6"} {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		first := true
		for sc.Scan() {
			if first {
				first = false
				continue
			}
			fields := strings.Fields(sc.Text())
			if len(fields) > 3 && fields[3] == "01" {
				n++
			}
		}
		f.Close()
	}
	return n
}

// netTotal 汇总 /proc/net/dev 的收发字节(跳过 lo)。
func netTotal() (rx, tx uint64) {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		i := strings.Index(line, ":")
		if i < 0 {
			continue
		}
		name := strings.TrimSpace(line[:i])
		if name == "lo" || name == "" {
			continue
		}
		fields := strings.Fields(line[i+1:])
		if len(fields) < 9 {
			continue
		}
		r, _ := strconv.ParseUint(fields[0], 10, 64)
		t, _ := strconv.ParseUint(fields[8], 10, 64)
		rx += r
		tx += t
	}
	return rx, tx
}

// netIfaces 网卡列表与状态(/sys/class/net)。
func netIfaces() []map[string]interface{} {
	entries, err := os.ReadDir("/sys/class/net")
	if err != nil {
		return nil
	}
	out := make([]map[string]interface{}, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if name == "lo" {
			continue
		}
		state := strings.TrimSpace(readFileStr(filepath.Join("/sys/class/net", name, "operstate")))
		mac := strings.TrimSpace(readFileStr(filepath.Join("/sys/class/net", name, "address")))
		out = append(out, map[string]interface{}{"name": name, "state": state, "mac": mac})
	}
	return out
}

func readFileStr(p string) string {
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	return string(b)
}

// ---- 磁盘 IO ----

type diskIOSample struct {
	read  uint64 // 字节
	write uint64
	ioMS  uint64 // 设备忙毫秒
}

var (
	diskIOMu     sync.Mutex
	diskIOPrev   map[string]diskIOSample
	diskIOPrevAt time.Time
	diskIOCache  []DiskIOStat
	diskIOTot    [2]float64
)

// diskIORates 读 /proc/diskstats 并与上次采样做差, 得到每盘读写速率与忙碌度。
// 返回 (每盘明细, 总读速率, 总写速率)。
func diskIORates() ([]DiskIOStat, float64, float64) {
	cur, err := readDiskstats()
	if err != nil {
		return diskIOCache, diskIOTot[0], diskIOTot[1]
	}
	now := time.Now()

	diskIOMu.Lock()
	defer diskIOMu.Unlock()

	if diskIOPrev == nil {
		diskIOPrev, diskIOPrevAt = cur, now
		return diskIOCache, diskIOTot[0], diskIOTot[1]
	}
	dt := now.Sub(diskIOPrevAt).Seconds()
	if dt < 0.2 { // 采样太密, 差值噪声大, 沿用上次结果
		return diskIOCache, diskIOTot[0], diskIOTot[1]
	}

	out := make([]DiskIOStat, 0, len(cur))
	var tr, tw float64
	for name, c := range cur {
		p, ok := diskIOPrev[name]
		if !ok {
			continue // 新插的盘, 下一轮再算
		}
		r := float64(c.read-p.read) / dt
		w := float64(c.write-p.write) / dt
		util := float64(c.ioMS-p.ioMS) / (dt * 1000) * 100
		if util < 0 {
			util = 0
		}
		if util > 100 {
			util = 100
		}
		out = append(out, DiskIOStat{Name: name, ReadRate: r, WriteRate: w, Util: util})
		tr += r
		tw += w
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].ReadRate+out[i].WriteRate > out[j].ReadRate+out[j].WriteRate
	})

	diskIOPrev, diskIOPrevAt = cur, now
	diskIOCache = out
	diskIOTot = [2]float64{tr, tw}
	return out, tr, tw
}

// readDiskstats 解析 /proc/diskstats, 只保留整盘(跳过分区与 loop/ram)。
func readDiskstats() (map[string]diskIOSample, error) {
	f, err := os.Open("/proc/diskstats")
	if err != nil {
		return nil, err
	}
	defer f.Close()

	out := map[string]diskIOSample{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 14 {
			continue
		}
		name := fields[2]
		if !isDiskName(name) {
			continue
		}
		readSec, _ := strconv.ParseUint(fields[5], 10, 64)  // sectors read
		writeSec, _ := strconv.ParseUint(fields[9], 10, 64) // sectors written
		ioMS, _ := strconv.ParseUint(fields[12], 10, 64)    // time doing I/O
		out[name] = diskIOSample{read: readSec * 512, write: writeSec * 512, ioMS: ioMS}
	}
	return out, sc.Err()
}
