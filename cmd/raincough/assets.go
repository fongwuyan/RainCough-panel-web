package main

import (
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type assetInfo struct {
	Plugin string `json:"plugin"`
	Path   string `json:"path"`
	Name   string `json:"name"`
	Size   int64  `json:"size"`
	MTime  int64  `json:"mtime"`
	Kind   string `json:"kind"`
	URL    string `json:"url"`
}

func assetKind(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".avif", ".heic", ".tif", ".tiff":
		return "image"
	case ".mp4", ".webm", ".mkv", ".mov", ".avi":
		return "video"
	case ".mp3", ".wav", ".flac", ".ogg", ".m4a":
		return "audio"
	case ".zip", ".tar", ".gz", ".tgz", ".7z", ".rar":
		return "archive"
	case ".json", ".txt", ".md", ".log", ".csv", ".yaml", ".yml", ".xml":
		return "text"
	case ".pdf":
		return "pdf"
	case ".docx", ".pptx", ".xlsx":
		return "doc"
	case ".safetensors", ".ckpt", ".pt", ".bin", ".gguf":
		return "model"
	}
	return "file"
}

func (s *server) pluginAssetsHidden(name string) bool {
	b, err := os.ReadFile(filepath.Join(s.cfg.PluginsDir, name, "plugin.json"))
	if err != nil {
		return false
	}
	var m struct {
		Assets struct {
			Visible *bool `json:"visible"`
		} `json:"assets"`
	}
	if json.Unmarshal(b, &m) != nil {
		return false
	}
	return m.Assets.Visible != nil && !*m.Assets.Visible
}

func (s *server) assetPath(plugin, rel string) (string, error) {
	if !validPluginDirName(plugin) {
		return "", os.ErrInvalid
	}
	rel = filepath.ToSlash(strings.TrimSpace(rel))
	parts := strings.SplitN(rel, "/", 2)
	if len(parts) != 2 || (parts[0] != "cache" && parts[0] != "output" && parts[0] != "work") {
		return "", os.ErrInvalid
	}
	root := filepath.Join(s.cfg.PluginsDir, plugin, parts[0])
	p := filepath.Join(root, filepath.FromSlash(parts[1]))
	cleanRoot := filepath.Clean(root) + string(filepath.Separator)
	if !strings.HasPrefix(filepath.Clean(p)+string(filepath.Separator), cleanRoot) {
		return "", os.ErrInvalid
	}
	return p, nil
}

func (s *server) handleAssetDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Plugin string `json:"plugin"`
		Path   string `json:"path"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	p, err := s.assetPath(b.Plugin, b.Path)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "路径非法"})
		return
	}
	if fi, err := os.Stat(p); err != nil || !fi.Mode().IsRegular() {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "资产不存在"})
		return
	}
	if err := os.Remove(p); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

func (s *server) handleAssetRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Plugin  string `json:"plugin"`
		Path    string `json:"path"`
		NewName string `json:"new_name"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if b.NewName == "" || b.NewName == "." || b.NewName == ".." || strings.ContainsAny(b.NewName, `/\`) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "新文件名非法"})
		return
	}
	p, err := s.assetPath(b.Plugin, b.Path)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "路径非法"})
		return
	}
	if _, err := os.Stat(p); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "资产不存在"})
		return
	}
	np := filepath.Join(filepath.Dir(p), b.NewName)
	if _, err := os.Stat(np); err == nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{"error": "同名文件已存在"})
		return
	}
	if err := os.Rename(p, np); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "name": b.NewName})
}

func (s *server) handleAssets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "GET required"})
		return
	}
	q := r.URL.Query()
	plugin := q.Get("plugin")
	kind := q.Get("kind")
	qq := strings.ToLower(strings.TrimSpace(q.Get("q")))
	offset, _ := strconv.Atoi(q.Get("offset"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 || limit > 2000 {
		limit = 300
	}
	const maxScan = 5000
	if plugin != "" && !validPluginDirName(plugin) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "插件名非法"})
		return
	}
	ents, _ := os.ReadDir(s.cfg.PluginsDir)
	out := make([]assetInfo, 0)
	for _, e := range ents {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		if plugin != "" && e.Name() != plugin {
			continue
		}
		if s.pluginAssetsHidden(e.Name()) {
			continue
		}
		for _, sub := range []string{"cache", "output", "work"} {
			root := filepath.Join(s.cfg.PluginsDir, e.Name(), sub)
			if _, err := os.Stat(root); err != nil {
				continue
			}
			_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
				if err != nil || info == nil || !info.Mode().IsRegular() {
					return nil
				}
				if len(out) >= maxScan {
					return filepath.SkipAll
				}
				rel, _ := filepath.Rel(root, path)
				if strings.HasPrefix(rel, ".") {
					return nil
				}
				k := assetKind(info.Name())
				if kind != "" && k != kind {
					return nil
				}
				if qq != "" && !strings.Contains(strings.ToLower(rel), qq) {
					return nil
				}
				u := "/api/plugins/" + url.PathEscape(e.Name()) + "/"
				for i, seg := range strings.Split(filepath.ToSlash(filepath.Join(sub, rel)), "/") {
					if i > 0 {
						u += "/"
					}
					u += url.PathEscape(seg)
				}
				out = append(out, assetInfo{Plugin: e.Name(), Path: filepath.ToSlash(filepath.Join(sub, rel)), Name: info.Name(), Size: info.Size(), MTime: info.ModTime().Unix(), Kind: k, URL: u})
				return nil
			})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].MTime > out[j].MTime })
	total := len(out)
	end := offset + limit
	if end > total {
		end = total
	}
	if offset > total {
		offset = total
	}
	items := out[offset:end]
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": total, "offset": offset, "limit": limit, "has_more": end < total})
}
