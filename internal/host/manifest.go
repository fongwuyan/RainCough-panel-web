// Package host 插件运行时: plugin.json 规范、子进程管理、HTTP 网关代理。
package host

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

// PluginNameRE 插件名白名单(兼容 JMComic 这类既有大写名称 与 uptime-cpp 连字符)。
var PluginNameRE = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,32}$`)

// Manifest plugin.json v3 规范。
// 插件 = 独立包: manifest + C++/任意语言后端 + 自带 Vue3 前端产物(可选)。
type Manifest struct {
	Name        string   `json:"name"`
	Label       string   `json:"label"`
	Version     string   `json:"version"`
	Description string   `json:"description,omitempty"`
	Author      string   `json:"author,omitempty"`
	Icon        string   `json:"icon,omitempty"`
	Lang        string   `json:"lang,omitempty"`    // cpp|python|node|go|rust|php|...
	Entry       []string `json:"entry"`             // 启动命令(相对插件目录)
	Env         string   `json:"env,omitempty"`     // 环境包名(envpkg), 注入 PATH
	Health      string   `json:"health,omitempty"`  // 就绪探针路径, 默认 /__health
	Timeout     int      `json:"timeout,omitempty"` // 就绪等待秒, 默认 30
	DB          bool     `json:"db,omitempty"`      // 是否需要共用数据层(默认 false)
	Assets      *Assets  `json:"assets,omitempty"`  // 前端构建产物(Vue3)
	Routes      []string `json:"routes,omitempty"`  // 元信息: 插件 API 路由
}

// Assets 插件前端构建产物(远程组件挂载)。
type Assets struct {
	Entry string `json:"entry"` // 如 /assets/plugin.js
	CSS   string `json:"css,omitempty"`
}

// LoadManifest 读取并校验插件目录下的 plugin.json。
func LoadManifest(dir string) (*Manifest, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "plugin.json"))
	if err != nil {
		return nil, err
	}
	// 剥离 UTF-8 BOM(Windows 编辑器/PowerShell 常见), json.Unmarshal 不识别
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("plugin.json 解析失败: %w", err)
	}
	if err := m.Validate(); err != nil {
		return nil, err
	}
	return &m, nil
}

// Validate 校验 manifest 必填项。
func (m *Manifest) Validate() error {
	if !PluginNameRE.MatchString(m.Name) {
		return fmt.Errorf("插件名称非法: %q (仅 a-z0-9_ 1-32 字符)", m.Name)
	}
	if m.Label == "" {
		m.Label = m.Name
	}
	if len(m.Entry) == 0 {
		return fmt.Errorf("plugin.json 缺少 entry(启动命令)")
	}
	if m.Health == "" {
		m.Health = "/__health"
	}
	if m.Timeout <= 0 {
		m.Timeout = 30
	}
	if m.Version == "" {
		m.Version = "0.0.0"
	}
	return nil
}

// Info 输出插件注册表条目(供 /api/plugins 列表)。
func (m *Manifest) Info() map[string]interface{} {
	info := map[string]interface{}{
		"name":        m.Name,
		"label":       m.Label,
		"version":     m.Version,
		"description": m.Description,
		"author":      m.Author,
		"icon":        m.Icon,
		"lang":        m.Lang,
		"routes":      m.Routes,
	}
	if m.Assets != nil {
		info["assets"] = m.Assets
	}
	return info
}
