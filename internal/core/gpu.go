package core

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// GPU 显示适配器(核显/独显)信息 — 工作台 GPU 卡数据源。
type GPU struct {
	Index    int     `json:"index"`
	Name     string  `json:"name"`
	Vendor   string  `json:"vendor"`
	Kind     string  `json:"kind"` // 独显 / 核显 / 虚拟 / 未知
	PCI      string  `json:"pci"`
	Driver   string  `json:"driver"`
	VRAM     int64   `json:"vram"`      // MiB; 0 = 未知/共享
	VRAMUsed int64   `json:"vram_used"` // MiB
	Usage    float64 `json:"usage"`     // % ; -1 = 未知
	Temp     int     `json:"temp"`      // °C; 0 = 未知
}

var (
	gpuMu    sync.Mutex
	gpuCache []GPU
	gpuAt    time.Time
)

// GPUs 检测全部核显/显卡(3 秒缓存, 避免高频轮询重复执行 lspci/nvidia-smi)。
func GPUs() []GPU {
	gpuMu.Lock()
	if gpuCache != nil && time.Since(gpuAt) < 3*time.Second {
		defer gpuMu.Unlock()
		return gpuCache
	}
	gpuMu.Unlock()

	out := detectGPUs()

	gpuMu.Lock()
	gpuCache, gpuAt = out, time.Now()
	gpuMu.Unlock()
	return out
}

var quotedRe = regexp.MustCompile(`"([^"]*)"`)
var amdAPURe = regexp.MustCompile(`\b\d{3,4}[dm]\b`)

func detectGPUs() []GPU {
	list := lspciGPUs()
	mergeNvidia(&list)
	for i := range list {
		enrichSysfs(&list[i])
	}
	// 独显在前, 同类按 PCI 排序
	for i := range list {
		list[i].Index = i
	}
	return list
}

// lspciGPUs 解析 lspci -D -mm 的显示类设备(VGA/3D/Display)。
// 行示例: 0000:00:02.0 "VGA compatible controller" "Intel Corporation" "Iris Graphics 6100" -r09 ...
func lspciGPUs() []GPU {
	out, err := exec.Command("lspci", "-D", "-mm").CombinedOutput()
	if err != nil && len(out) == 0 {
		return nil
	}
	var list []GPU
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		q := quotedRe.FindAllStringSubmatch(line, -1)
		if len(q) < 3 {
			continue
		}
		class := stripPCIIds(q[0][1])
		if !isDisplayClass(q[0][1]) {
			continue
		}
		slot := strings.TrimSpace(strings.SplitN(line, `"`, 2)[0])
		g := GPU{
			PCI:    slot,
			Name:   stripPCIIds(q[2][1]),
			Vendor: stripPCIIds(q[1][1]),
			Usage:  -1,
		}
		if g.Name == "" {
			g.Name = class
		}
		g.Kind = gpuKind(g.Vendor, g.Name)
		list = append(list, g)
	}
	return list
}

func isDisplayClass(c string) bool {
	l := strings.ToLower(c)
	return strings.Contains(l, "vga") ||
		strings.Contains(l, "3d controller") ||
		strings.Contains(l, "display controller") ||
		strings.Contains(c, "0300") ||
		strings.Contains(c, "0302") ||
		strings.Contains(c, "0380")
}

// stripPCIIds 去掉 " [8086:162b]" / " [0300]" 形式的 ID 后缀。
var idSuffixRe = regexp.MustCompile(`\s*\[[0-9a-fA-F]{4}:[0-9a-fA-F]{4}\]$|\s*\[[0-9a-fA-F]{4}\]$`)

func stripPCIIds(s string) string {
	return strings.TrimSpace(idSuffixRe.ReplaceAllString(s, ""))
}

// gpuKind 判定 独显/核显/虚拟。
func gpuKind(vendor, name string) string {
	v := strings.ToLower(vendor)
	n := strings.ToLower(name)
	switch {
	case strings.Contains(v, "nvidia"):
		return "独显"
	case strings.Contains(v, "intel"):
		if strings.Contains(n, "arc") {
			return "独显" // Intel Arc 独立显卡
		}
		return "核显"
	case strings.Contains(v, "amd"), strings.Contains(v, "ati"):
		if strings.Contains(n, "rx ") || strings.Contains(n, "radeon pro") ||
			strings.Contains(n, "firepro") || strings.Contains(n, "firegl") {
			return "独显"
		}
		// APU: "Radeon Graphics" / "Radeon 780M" 等
		if strings.Contains(n, "graphics") || amdAPURe.MatchString(n) {
			return "核显"
		}
		return "独显"
	case strings.Contains(v, "vmware"), strings.Contains(v, "innotek"),
		strings.Contains(v, "virtualbox"), strings.Contains(v, "qemu"),
		strings.Contains(v, "cirrus"), strings.Contains(v, "bochs"),
		strings.Contains(v, "virtio"), strings.Contains(v, "red hat"),
		strings.Contains(n, "virtio"), strings.Contains(n, "bochs"),
		strings.Contains(n, "qxl"), strings.Contains(n, "cirrus"),
		strings.Contains(n, "vbox"), strings.Contains(n, "vmware"):
		return "虚拟"
	}
	return "未知"
}

// mergeNvidia 用 nvidia-smi 合并 NVIDIA 卡(显存/利用率/温度), 并兜底 lspci 缺失场景。
func mergeNvidia(list *[]GPU) {
	out, err := exec.Command("nvidia-smi",
		"--query-gpu=index,name,pci.bus_id,memory.total,memory.used,utilization.gpu,temperature.gpu,driver_version",
		"--format=csv,noheader,nounits").CombinedOutput()
	if err != nil && len(out) == 0 {
		return
	}
	byPCI := map[string]int{}
	for i, g := range *list {
		byPCI[normPCI(g.PCI)] = i
	}
	for _, row := range strings.Split(string(out), "\n") {
		row = strings.TrimSpace(row)
		if row == "" {
			continue
		}
		f := splitCSV(row)
		if len(f) < 7 {
			continue
		}
		pci := normPCI(strings.TrimSpace(f[2]))
		idx := -1
		if i, ok := byPCI[pci]; ok {
			idx = i
		} else {
			*list = append(*list, GPU{
				Name:   strings.TrimSpace(f[1]),
				Vendor: "NVIDIA Corporation",
				Kind:   "独显",
				PCI:    pci,
				Usage:  -1,
			})
			idx = len(*list) - 1
			byPCI[pci] = idx
		}
		g := &(*list)[idx]
		if g.Name == "" {
			g.Name = strings.TrimSpace(f[1])
		}
		if g.Vendor == "" {
			g.Vendor = "NVIDIA Corporation"
		}
		if g.Kind == "" || g.Kind == "未知" {
			g.Kind = "独显"
		}
		g.PCI = pci
		g.VRAM = parseInt64(f[3])
		g.VRAMUsed = parseInt64(f[4])
		if v := parseFloat(f[5]); v >= 0 {
			g.Usage = v
		}
		g.Temp = int(parseInt64(f[6]))
		if len(f) >= 8 && g.Driver == "" {
			g.Driver = strings.TrimSpace(f[7])
		}
	}
}

// enrichSysfs 从 sysfs 补驱动/AMD 显存/利用率/温度。
func enrichSysfs(g *GPU) {
	if g.PCI == "" {
		return
	}
	base := filepath.Join("/sys/bus/pci/devices", g.PCI)
	if g.Driver == "" {
		if tgt, err := os.Readlink(filepath.Join(base, "driver")); err == nil {
			g.Driver = filepath.Base(tgt)
		}
	}
	// amdgpu: 显存总量(字节) / 核心占用 / 温度
	if g.VRAM == 0 {
		if b, err := os.ReadFile(filepath.Join(base, "mem_info_vram_total")); err == nil {
			if v, e := strconv.ParseInt(strings.TrimSpace(string(b)), 10, 64); e == nil && v > 0 {
				g.VRAM = v / (1024 * 1024)
			}
		}
	}
	if g.Usage < 0 {
		if b, err := os.ReadFile(filepath.Join(base, "gpu_busy_percent")); err == nil {
			if v, e := strconv.ParseFloat(strings.TrimSpace(string(b)), 64); e == nil {
				g.Usage = v
			}
		}
	}
	if g.Temp == 0 {
		if matches, _ := filepath.Glob(filepath.Join(base, "hwmon", "hwmon*", "temp1_input")); len(matches) > 0 {
			if b, err := os.ReadFile(matches[0]); err == nil {
				if v, e := strconv.ParseInt(strings.TrimSpace(string(b)), 10, 64); e == nil && v > 0 {
					g.Temp = int(v / 1000)
				}
			}
		}
	}
}

// normPCI 统一 PCI 地址格式: nvidia-smi 的 8 位域 "00000000:01:00.0" -> "0000:01:00.0"。
func normPCI(s string) string {
	parts := strings.Split(s, ":")
	if len(parts) == 3 && len(parts[0]) > 4 {
		parts[0] = parts[0][len(parts[0])-4:]
		return strings.Join(parts, ":")
	}
	return s
}

// splitCSV 简单 CSV 切分(兼容 "N/A" 与含逗号的名称)。
func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		out = append(out, strings.TrimSpace(p))
	}
	return out
}

func parseInt64(s string) int64 {
	s = strings.TrimSpace(s)
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func parseFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" || strings.EqualFold(s, "n/a") {
		return -1
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return -1
	}
	return v
}
