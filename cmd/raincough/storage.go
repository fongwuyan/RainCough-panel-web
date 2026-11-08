package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"raincough/internal/core"
)

// 存储策略：主盘剩余空间低于阈值时，新数据（上传/插件数据）落到后面的盘。
//
// 只影响"新写入"，不迁移已有数据 —— 已有的 rc.db / plugins / 上传文件原地不动。
// 规则：
//   · 候选 = /api/disks 里已挂载的分区（按配置的顺序）
//   · 从前往后挑第一个「剩余空间 >= 阈值」的盘
//   · 如果都低于阈值，挑剩余空间最大的那个（总比写爆主盘好）
//   · 每块盘上用 <挂载点>/RainCoughData 作为数据根，下面分 uploads / plugins
const storageBaseName = "RainCoughData"

type storageConfig struct {
	ThresholdGB int      `json:"threshold_gb"`
	Order       []string `json:"order"`    // 挂载点，按优先顺序
	Disabled    []string `json:"disabled"` // 不参与策略的挂载点
}

type storageMount struct {
	Path    string  `json:"path"`
	Dev     string  `json:"dev"`
	FS      string  `json:"fs"`
	Label   string  `json:"label"`
	Total   float64 `json:"total"`
	Used    float64 `json:"used"`
	Free    float64 `json:"free"`
	Enabled bool    `json:"enabled"`
	Base    string  `json:"base"`
}

func (s *server) storageFile() string {
	dir := s.cfg.DataDir
	if dir == "" {
		dir = "data"
	}
	return filepath.Join(dir, "storage.json")
}

func loadStorageCfg(path string) storageConfig {
	cfg := storageConfig{ThresholdGB: 10}
	raw, err := os.ReadFile(path)
	if err != nil {
		return cfg
	}
	_ = json.Unmarshal(raw, &cfg)
	if cfg.ThresholdGB < 0 {
		cfg.ThresholdGB = 0
	}
	return cfg
}

func (s *server) saveStorageCfg(cfg storageConfig) error {
	p := s.storageFile()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	raw, _ := json.MarshalIndent(cfg, "", "  ")
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

func numOf(v interface{}) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case float32:
		return float64(x)
	case int:
		return float64(x)
	case int64:
		return float64(x)
	case uint64:
		return float64(x)
	case json.Number:
		f, _ := x.Float64()
		return f
	default:
		return 0
	}
}

func strOf(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// usableMount 过滤掉系统/伪文件系统，避免把 ESP、/boot、/run 当存储盘。
func usableMount(mp string) bool {
	if mp == "" || mp == "/boot" || strings.HasPrefix(mp, "/boot/") {
		return false
	}
	for _, bad := range []string{"/proc", "/sys", "/dev", "/run", "/snap", "/var/lib/docker", "/var/lib/containers"} {
		if mp == bad || strings.HasPrefix(mp, bad+"/") {
			return false
		}
	}
	return true
}

// storageMounts 从 core.Disks() 摊平成"可写的挂载点"列表。
func storageMounts() []storageMount {
	out := []storageMount{}
	seen := map[string]bool{}
	for _, d := range core.Disks() {
		parts, _ := d["partitions"].([]map[string]interface{})
		for _, p := range parts {
			if m, _ := p["mounted"].(bool); !m {
				continue
			}
			mp := strOf(p["mountpoint"])
			if !usableMount(mp) || seen[mp] {
				continue
			}
			seen[mp] = true
			total := numOf(p["total"])
			used := numOf(p["used"])
			if total <= 0 {
				continue
			}
			free := total - used
			if free < 0 {
				free = 0
			}
			out = append(out, storageMount{
				Path: mp, Dev: strOf(p["path"]), FS: strOf(p["fstype"]),
				Label: strOf(p["label"]), Total: total, Used: used, Free: free,
				Base: filepath.Join(mp, storageBaseName),
			})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	return out
}

func orderedMounts(all []storageMount, cfg storageConfig) []storageMount {
	disabled := map[string]bool{}
	for _, d := range cfg.Disabled {
		disabled[d] = true
	}
	byPath := map[string]storageMount{}
	for _, m := range all {
		byPath[m.Path] = m
	}
	var out []storageMount
	for _, p := range cfg.Order {
		if m, ok := byPath[p]; ok && !disabled[p] {
			m.Enabled = true
			out = append(out, m)
			delete(byPath, p)
		}
	}
	var rest []storageMount
	for p, m := range byPath {
		if disabled[p] {
			continue
		}
		m.Enabled = true
		rest = append(rest, m)
	}
	sort.Slice(rest, func(i, j int) bool { return rest[i].Path < rest[j].Path })
	return append(out, rest...)
}

func pickStorage(cfg storageConfig, all []storageMount) (storageMount, bool) {
	cands := orderedMounts(all, cfg)
	if len(cands) == 0 {
		return storageMount{}, false
	}
	need := float64(cfg.ThresholdGB) * 1024 * 1024 * 1024
	for _, m := range cands {
		if cfg.ThresholdGB <= 0 || m.Free >= need {
			return m, true
		}
	}
	best := cands[0]
	for _, m := range cands[1:] {
		if m.Free > best.Free {
			best = m
		}
	}
	return best, true
}

// writeStorageTargets 把"当前策略解析出的写入目录"落成一个小 JSON，
// 给插件后端读取：插件不用拿面板密码，也能知道新数据该写哪块盘。
// 路径固定为 <DataDir>/storage-targets.json，插件端按约定找它。
func writeStorageTargets(dataDir string) {
	if dataDir == "" {
		return
	}
	cfg := loadStorageCfg(filepath.Join(dataDir, "storage.json"))
	m, ok := pickStorage(cfg, storageMounts())
	if !ok {
		return
	}
	plugins := filepath.Join(m.Base, "plugins")
	uploads := filepath.Join(m.Base, "uploads")
	_ = os.MkdirAll(plugins, 0o755)
	_ = os.MkdirAll(uploads, 0o755)
	out := map[string]interface{}{
		"threshold_gb": cfg.ThresholdGB,
		"mount":        m.Path,
		"plugins":      plugins,
		"uploads":      uploads,
		"updated_at":   time.Now().Unix(),
	}
	raw, _ := json.MarshalIndent(out, "", "  ")
	p := filepath.Join(dataDir, "storage-targets.json")
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err == nil {
		_ = os.Rename(tmp, p)
	}
}

// handleStorage GET/POST /api/storage
func (s *server) handleStorage(w http.ResponseWriter, r *http.Request) {
	cfg := loadStorageCfg(s.storageFile())
	all := storageMounts()
	// 每次读取都刷新策略落盘文件：磁盘剩余变化后，插件读到的也是最新选盘结果
	writeStorageTargets(s.cfg.DataDir)

	switch r.Method {
	case http.MethodGet:
		active, ok := pickStorage(cfg, all)
		// 启用中的按顺序排前面，禁用的垫后，前端一张表就能勾选/排序
		disabled := map[string]bool{}
		for _, d := range cfg.Disabled {
			disabled[d] = true
		}
		ordered := orderedMounts(all, cfg)
		var disabledMounts []storageMount
		for _, m := range all {
			if disabled[m.Path] {
				m.Enabled = false
				disabledMounts = append(disabledMounts, m)
			}
		}
		mounts := append(ordered, disabledMounts...)
		resp := map[string]interface{}{
			"mounts":       mounts,
			"threshold_gb": cfg.ThresholdGB,
			"order":        cfg.Order,
			"disabled":     cfg.Disabled,
		}
		if ok {
			resp["active"] = active
			resp["active_path"] = filepath.Join(active.Base, "uploads")
			resp["active_plugins"] = filepath.Join(active.Base, "plugins")
		}
		writeJSON(w, http.StatusOK, resp)
	case http.MethodPost:
		var b struct {
			ThresholdGB *int      `json:"threshold_gb"`
			Order       *[]string `json:"order"`
			Disabled    *[]string `json:"disabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if b.ThresholdGB != nil {
			if *b.ThresholdGB < 0 {
				*b.ThresholdGB = 0
			}
			cfg.ThresholdGB = *b.ThresholdGB
		}
		if b.Order != nil {
			cfg.Order = *b.Order
		}
		if b.Disabled != nil {
			cfg.Disabled = *b.Disabled
		}
		if err := s.saveStorageCfg(cfg); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeStorageTargets(s.cfg.DataDir)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "threshold_gb": cfg.ThresholdGB})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

// handleStorageTarget GET /api/storage/target?kind=uploads|plugins&ensure=1
//
// 给「新数据写到哪」用：按策略选盘 → 建 <挂载点>/RainCoughData/<kind> → 返回绝对路径。
func (s *server) handleStorageTarget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	kind := strings.TrimSpace(r.URL.Query().Get("kind"))
	if kind == "" {
		kind = "uploads"
	}
	if kind != "uploads" && kind != "plugins" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "kind 只支持 uploads / plugins"})
		return
	}
	cfg := loadStorageCfg(s.storageFile())
	all := storageMounts()
	m, ok := pickStorage(cfg, all)
	if !ok {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "没有可用的已挂载磁盘"})
		return
	}
	dir := filepath.Join(m.Base, kind)
	if r.URL.Query().Get("ensure") != "0" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "创建目录失败: " + err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"path": dir, "mount": m.Path, "free": m.Free, "total": m.Total,
		"threshold_gb": cfg.ThresholdGB,
	})
}

// storageSummary 给别处（如安装器）用的简短描述。
func (s *server) storageSummary() string {
	cfg := loadStorageCfg(s.storageFile())
	m, ok := pickStorage(cfg, storageMounts())
	if !ok {
		return "无可用磁盘"
	}
	return fmt.Sprintf("%s（剩余 %.1f GB，阈值 %d GB）", m.Path, m.Free/1073741824, cfg.ThresholdGB)
}
