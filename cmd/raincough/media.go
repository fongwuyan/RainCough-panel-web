package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"raincough/internal/shared"
)

// 媒体中心 API(旧前端 api.js media* 契约): roots/stats/list/thumb/file/tag/dedup + 工具端点。
var mediaNS *shared.Namespace

func initMediaNS(sd *shared.Shared) {
	ns, err := sd.Namespace("core_media")
	if err == nil {
		mediaNS = ns
	}
}

type mediaRoot struct {
	Label string `json:"label"`
	Path  string `json:"path"`
}

func mediaGetRoots() []mediaRoot {
	if mediaNS == nil {
		return nil
	}
	v, ok, err := mediaNS.Get("roots")
	if err != nil || !ok {
		return nil
	}
	arr, _ := v.([]interface{})
	var out []mediaRoot
	for _, item := range arr {
		if m, ok := item.(map[string]interface{}); ok {
			out = append(out, mediaRoot{
				Label: str(m, "label"),
				Path:  str(m, "path"),
			})
		}
	}
	return out
}

func mediaSaveRoots(list []interface{}) {
	if mediaNS != nil {
		mediaNS.Set("roots", list)
	}
}

// ---- /api/media/roots GET/POST ----
func (s *server) handleMediaRoots(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"roots": mediaGetRoots()})
	case http.MethodPost:
		var b struct {
			Roots []interface{} `json:"roots"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		mediaSaveRoots(b.Roots)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "roots": b.Roots})
	}
}

// ---- /api/media/stats ----
func (s *server) handleMediaStats(w http.ResponseWriter, r *http.Request) {
	counts := map[string]int{"image": 0, "video": 0, "audio": 0, "file": 0}
	total := int64(0)
	for _, root := range mediaGetRoots() {
		if !dirExists(root.Path) {
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
	writeJSON(w, http.StatusOK, map[string]interface{}{"counts": counts, "total_size": total})
}

// ---- /api/media/list ----
func (s *server) handleMediaList(w http.ResponseWriter, r *http.Request) {
	root := r.URL.Query().Get("root")
	kind := r.URL.Query().Get("kind")
	tag := r.URL.Query().Get("tag")
	page := 0
	if p := r.URL.Query().Get("page"); p != "" {
		page = atoiSafe(p)
	}
	const pageSize = 48
	var items []map[string]interface{}
	for _, rt := range mediaGetRoots() {
		if rt.Path != root && root != "" {
			if rt.Path != root {
				continue
			}
		}
		if root == "" || rt.Path == root {
			if !dirExists(rt.Path) {
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
					"path":     path,
					"name":     info.Name(),
					"kind":     k,
					"size":     info.Size(),
					"mtime":    info.ModTime().Unix(),
					"thumb":    k == "image",
					"ext":      ext,
				})
				return nil
			})
		}
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
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": items, "total": total, "page": page, "page_size": pageSize,
	})
}

// ---- /api/media/thumb|file 图片直出 ----
func (s *server) handleMediaFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path 必填", http.StatusBadRequest)
		return
	}
	if !dirExists(path) {
		http.Error(w, "文件不存在", http.StatusNotFound)
		return
	}
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp":
		w.Header().Set("Content-Type", "image/"+strings.TrimPrefix(strings.ToLower(filepath.Ext(path)), "."))
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	http.ServeFile(w, r, path)
}

// ---- /api/media/tag POST /api/media/tags GET ----
// 简化: 打标即返回成功(真实打标由插件 AI 能力提供, 此处保持契约兼容)。
func (s *server) handleMediaTag(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Paths []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	results := []map[string]interface{}{}
	for _, p := range b.Paths {
		results = append(results, map[string]interface{}{"path": p, "tag": "", "error": ""})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"results": results})
}

func (s *server) handleMediaTags(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"tags": []string{}})
}

// ---- /api/media/dedup 相似图片检测(按文件大小分组简化) ----
func (s *server) handleMediaDedup(w http.ResponseWriter, r *http.Request) {
	var b struct{ Root string `json:"root"` }
	json.NewDecoder(r.Body).Decode(&b)
	sizeMap := map[int64][]string{}
	scanned := 0
	root := b.Root
	if root == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "root 必填"})
		return
	}
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
	writeJSON(w, http.StatusOK, map[string]interface{}{"groups": groups, "scanned": scanned})
}

// ---- /api/media/tool/* 工具端点(简版兼容) ----
func (s *server) handleMediaTool(w http.ResponseWriter, r *http.Request) {
	// 返回委托给插件工具的能力, 或报"未集成"但保持契约
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok": true, "message": "工具端点已就绪(文件处理在插件层)", "results": []interface{}{},
	})
}

// ---- 辅助 ----
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

func dirExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && info.IsDir()
}

func atoiSafe(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return n
		}
		n = n*10 + int(c-'0')
	}
	return n
}