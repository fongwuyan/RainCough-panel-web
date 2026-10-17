package core

import (
	"bufio"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// GPU 采集: 纯 /sys/bus/pci + /proc/driver/nvidia, 不调用 lspci/nvidia-smi。
//
// 能力边界(零依赖的代价): 型号/厂商/驱动/PCI 地址可得;
// 利用率、温度、显存占用需要 NVML, 无 CGO 时拿不到 → usage=-1 / temp=0, 前端显示 "—"。

type gpuInfo struct {
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	Vendor    string `json:"vendor"`
	Driver    string `json:"driver"`
	PCI       string `json:"pci"`
	VRAMTotal uint64 `json:"vram_total"`
	Temp      int    `json:"temp"`
	Usage     int    `json:"usage"` // -1 = 不可得
}

var (
	gpuMu    sync.Mutex
	gpuCache []gpuInfo
	gpuStamp time.Time
)

// GPUs 返回全部显示设备(3s 缓存, 避免高频轮询扫 sysfs)。
func GPUs() []map[string]interface{} {
	gpuMu.Lock()
	if time.Since(gpuStamp) < 3*time.Second && gpuCache != nil {
		cached := gpuCache
		gpuMu.Unlock()
		return toGPUList(cached)
	}
	gpuMu.Unlock()

	list := collectGPUs()
	gpuMu.Lock()
	gpuCache = list
	gpuStamp = time.Now()
	gpuMu.Unlock()
	return toGPUList(list)
}

func toGPUList(list []gpuInfo) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(list))
	for _, g := range list {
		out = append(out, map[string]interface{}{
			"name": g.Name, "kind": g.Kind, "vendor": g.Vendor, "driver": g.Driver,
			"pci": g.PCI, "vram_total": g.VRAMTotal, "temp": g.Temp, "usage": g.Usage,
		})
	}
	return out
}

func collectGPUs() []gpuInfo {
	entries, err := os.ReadDir("/sys/bus/pci/devices")
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	var out []gpuInfo
	for _, pci := range names {
		base := filepath.Join("/sys/bus/pci/devices", pci)
		class := strings.TrimSpace(readStr(filepath.Join(base, "class")))
		// 0x030000 VGA / 0x030200 3D / 0x038000 other display
		if !strings.HasPrefix(class, "0x0300") && !strings.HasPrefix(class, "0x0302") && !strings.HasPrefix(class, "0x0380") {
			continue
		}
		vendorID := strings.TrimPrefix(strings.TrimSpace(readStr(filepath.Join(base, "vendor"))), "0x")
		deviceID := strings.TrimPrefix(strings.TrimSpace(readStr(filepath.Join(base, "device"))), "0x")

		g := gpuInfo{PCI: pci, Usage: -1}
		g.Vendor, g.Kind = vendorName(vendorID)
		g.Name = g.Vendor + " " + deviceID
		g.Driver = driverOf(base)
		g.VRAMTotal = amdgpuVRAM(base)

		// NVIDIA: /proc/driver/nvidia/gpus/<pci>/information 里有真实型号
		if vendorID == "10de" {
			if model := nvidiaModel(pci); model != "" {
				g.Name = model
			}
		}
		out = append(out, g)
	}
	return out
}

func readStr(p string) string {
	b, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	return string(b)
}

func driverOf(base string) string {
	target, err := os.Readlink(filepath.Join(base, "driver"))
	if err != nil {
		return ""
	}
	return filepath.Base(target)
}

// vendorName 厂商 ID → (展示名, kind)。
func vendorName(id string) (string, string) {
	switch id {
	case "10de":
		return "NVIDIA", "nvidia"
	case "8086":
		return "Intel", "intel"
	case "1002", "1022":
		return "AMD", "amd"
	case "1af4", "1234":
		return "虚拟显卡", "virt"
	case "1a03":
		return "ASPEED", "server"
	default:
		return "PCI " + id, "other"
	}
}

// nvidiaModel 从 /proc/driver/nvidia/gpus/<pci>/information 取型号。
func nvidiaModel(pci string) string {
	f, err := os.Open(filepath.Join("/proc/driver/nvidia/gpus", pci, "information"))
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if i := strings.Index(line, "Model:"); i >= 0 {
			return strings.TrimSpace(line[i+len("Model:"):])
		}
	}
	return ""
}

// amdgpuVRAM 读 AMD 显卡显存总量(单位字节); 其他厂商返回 0。
func amdgpuVRAM(base string) uint64 {
	b, err := os.ReadFile(filepath.Join(base, "mem_info_vram_total"))
	if err != nil {
		return 0
	}
	return parseUint(strings.TrimSpace(string(b)))
}

