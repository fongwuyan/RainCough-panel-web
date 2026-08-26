package host

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// PluginHost 插件运行时: 扫描目录、拉起/监控/回收子进程、注册表。
type PluginHost struct {
	dir      string
	maxChild int
	dsn      string // 注入 SharedData DSN(库级账号)
	sudoPW   string

	mu       sync.Mutex
	children map[string]*Child // name -> child
	order    []string          // 稳定顺序
	lastScan time.Time
}

// New 创建 PluginHost。
func New(pluginsDir, dsn string, maxChild int) *PluginHost {
	return &PluginHost{
		dir:      pluginsDir,
		maxChild: maxChild,
		dsn:      dsn,
		children: map[string]*Child{},
	}
}

// SetSudoPW 注入 sudo 密码(透传给需要提权的插件, 兼容旧环境变量)。
func (h *PluginHost) SetSudoPW(pw string) { h.sudoPW = pw }

// Scan 扫描插件目录, 拉起新插件。返回启停摘要。
func (h *PluginHost) Scan() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lastScan = time.Now()

	var names []string
	entries, err := os.ReadDir(h.dir)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)

	var msgs []string
	for _, name := range names {
		if h.children[name] != nil {
			continue // 已拉起
		}
		dir := filepath.Join(h.dir, name)
		m, err := LoadManifest(dir)
		if err != nil {
			// 无 plugin.json 或 manifest 损坏: 记录可观测, 不静默
			if _, statErr := os.Stat(filepath.Join(dir, "plugin.json")); statErr == nil {
				msgs = append(msgs, fmt.Sprintf("[host] %s: manifest 加载失败: %v", name, err))
			}
			continue
		}
		if len(h.children) >= h.maxChild {
			msgs = append(msgs, fmt.Sprintf("[host] 达到子进程上限(%d), %s 未拉起", h.maxChild, name))
			continue
		}
		child, err := h.startChild(m, dir)
		if err != nil {
			msgs = append(msgs, fmt.Sprintf("[host] %s: %v", name, err))
			continue
		}
		h.children[name] = child
		h.order = append(h.order, name)
		msgs = append(msgs, fmt.Sprintf("[host] 已加载: %s (%s)", name, m.Label))
	}
	return msgs
}

func (h *PluginHost) startChild(m *Manifest, dir string) (*Child, error) {
	env := []string{fmt.Sprintf("RAINCOUGH_DB_DSN=%s", h.dsn)}
	if h.sudoPW != "" {
		env = append(env, fmt.Sprintf("RC_SUDO_PW=%s", h.sudoPW))
		env = append(env, fmt.Sprintf("TOUCHGAL_SUDO_PW=%s", h.sudoPW))
	}
	child := &Child{name: m.Name, dir: dir, manifest: m, env: env}
	if err := child.Start(); err != nil {
		return nil, err
	}
	return child, nil
}

// Get 按名返回子进程。
func (h *PluginHost) Get(name string) *Child {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.children[name]
}

// List 返回注册表条目(与 /api/plugins 一致)。
func (h *PluginHost) List() []map[string]interface{} {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(h.order))
	for _, name := range h.order {
		c := h.children[name]
		if c == nil {
			continue
		}
		info := c.manifest.Info()
		info["alive"] = c.Alive()
		out = append(out, info)
	}
	return out
}

// Remove 卸载插件: 终止子进程并从注册表移除。
func (h *PluginHost) Remove(name string) error {
	h.mu.Lock()
	c := h.children[name]
	if c != nil {
		delete(h.children, name)
		h.order = removeStr(h.order, name)
	}
	h.mu.Unlock()
	if c == nil {
		return fmt.Errorf("插件 %s 未加载", name)
	}
	c.Kill()
	return nil
}

// Shutdown 终止全部子进程(面板退出清场)。
func (h *PluginHost) Shutdown() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, c := range h.children {
		c.Kill()
	}
	h.children = map[string]*Child{}
	h.order = nil
}

// Watchdog 常驻监视: 崩溃自动拉起(带 2s 退避)。
func (h *PluginHost) Watchdog(stop <-chan struct{}, interval time.Duration) {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			h.mu.Lock()
			for name, c := range h.children {
				if c.Alive() {
					continue
				}
				h.mu.Unlock()
				dir := filepath.Join(h.dir, name)
				if m, err := LoadManifest(dir); err == nil {
					if nc, err := h.startChild(m, dir); err == nil {
						h.mu.Lock()
						h.children[name] = nc
						h.mu.Unlock()
					}
				}
				h.mu.Lock()
			}
			h.mu.Unlock()
		}
	}
}

func removeStr(s []string, v string) []string {
	out := s[:0]
	for _, x := range s {
		if x != v {
			out = append(out, x)
		}
	}
	return out
}
