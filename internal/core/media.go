package core

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ---- 媒体中心(旧前端 api.js media* 契约): roots/stats/list/dedup ----

// MediaRoot 媒体根目录配置。
type MediaRoot struct {
	Name  string `json:"name"`
	Label string `json:"label"`
	Path  string `json:"path"`
}

// Media 媒体中心服务: 根目录配置(KV) + 文件扫描统计。
type Media struct {
	ns Namespacelike
}

// NewMedia 创建媒体服务(namespace 可能为 nil, 此时只读操作返回空)。
func NewMedia(ns Namespacelike) *Media { return &Media{ns: ns} }

// Roots 返回已配置的媒体根目录。
func (m *Media) Roots() []MediaRoot {
	if m.ns == nil {
		return nil
	}
	v, ok, err := m.ns.Get("roots")
	if err != nil || !ok {
		return nil
	}
	arr, _ := v.([]interface{})
	var out []MediaRoot
	for _, item := range arr {
		if mm, ok := item.(map[string]interface{}); ok {
			name := mediaStr(mm, "name")
			label := mediaStr(mm, "label")
			path := mediaStr(mm, "path")
			if name == "" {
				name = label
			}
			if name == "" {
				name = path
			}
			out = append(out, MediaRoot{Name: name, Label: label, Path: path})
		}
	}
	return out
}

// SaveRoots 保存媒体根目录配置。
func (m *Media) SaveRoots(list []interface{}) {
	if m.ns != nil {
		m.ns.Set("roots", list)
	}
}

// Stats 统计各类型文件数与总大小(遍历全部根目录)。
func (m *Media) Stats() (map[string]int, int64) {
	counts := map[string]int{"image": 0, "video": 0, "audio": 0, "file": 0}
	total := int64(0)
	for _, root := range m.Roots() {
		if !mediaDirExists(root.Path) {
			continue
		}
		filepath.Walk(root.Path, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			total += info.Size()
			switch kindOfFile(path) {
			case "image":
				counts["image"]++
			case "video":
				counts["video"]++
			case "audio":
				counts["audio"]++
			default:
				counts["file"]++
			}
			return nil
		})
	}
	return counts, total
}

// List 分页列出媒体文件(按 mtime 倒序, 每页 48)。
func (m *Media) List(root, kind, tag string, page int) ([]map[string]interface{}, int) {
	const pageSize = 48
	var items []map[string]interface{}
	for _, rt := range m.Roots() {
		// 前端传 name 或 path, 都匹配
		if root != "" && rt.Name != root && rt.Path != root && rt.Label != root {
			continue
		}
		if !mediaDirExists(rt.Path) {
			continue
		}
		filepath.Walk(rt.Path, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			k := kindOfFile(path)
			if kind != "" && k != kind {
				return nil
			}
			ext := strings.ToLower(filepath.Ext(path))
			if tag != "" && len(tag) > 1 && !strings.Contains(path, tag) {
				// 简化: tag 匹配文件所在目录名
				dir := filepath.Base(filepath.Dir(path))
				if !strings.Contains(dir, tag) {
					return nil
				}
			}
			items = append(items, map[string]interface{}{
				"path":  path,
				"name":  info.Name(),
				"kind":  k,
				"size":  info.Size(),
				"mtime": info.ModTime().Unix(),
				"thumb": k == "image",
				"ext":   ext,
			})
			return nil
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i]["mtime"].(int64) > items[j]["mtime"].(int64)
	})
	total := len(items)
	start := page * pageSize
	end := start + pageSize
	if start >= total {
		items = nil
	} else if end > total {
		items = items[start:]
	} else {
		items = items[start:end]
	}
	return items, total
}

// Dedup 相似图片检测(按文件大小分组简化)。
func (m *Media) Dedup(root string) ([][]string, int) {
	sizeMap := map[int64][]string{}
	scanned := 0
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if kindOfFile(path) != "image" {
			return nil
		}
		scanned++
		sizeMap[info.Size()] = append(sizeMap[info.Size()], path)
		return nil
	})
	var groups [][]string
	for _, paths := range sizeMap {
		if len(paths) > 1 {
			groups = append(groups, paths)
		}
	}
	return groups, scanned
}

// KindOfFile 按扩展名归类文件类型。
func KindOfFile(path string) string { return kindOfFile(path) }

func kindOfFile(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return "image"
	case ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv":
		return "video"
	case ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a":
		return "audio"
	case ".zip", ".tar", ".gz", ".xz", ".7z", ".rar":
		return "archive"
	case ".txt", ".md", ".json", ".yml", ".yaml", ".toml", ".log", ".sh", ".py", ".js", ".html", ".css", ".go":
		return "text"
	default:
		return "file"
	}
}

func mediaStr(m map[string]interface{}, k string) string {
	if v, ok := m[k].(string); ok {
		return v
	}
	return ""
}

func mediaDirExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && info.IsDir()
}

// AtoiSafe 解析非负整数, 非法输入返回 0。
func AtoiSafe(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return n
		}
		n = n*10 + int(c-'0')
	}
	return n
}
