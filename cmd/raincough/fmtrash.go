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

// fm trash：面板级回收站。删除先进入 <BaseDir>/data/trash/<id>，可恢复或永久清理。
type fmTrashMeta struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Original  string `json:"original"`
	IsDir     bool   `json:"is_dir"`
	Size      int64  `json:"size"`
	DeletedAt int64  `json:"deleted_at"`
	DataPath  string `json:"-"`
	MetaPath  string `json:"-"`
}

func (s *server) fmTrashRoot() string {
	return filepath.Join(s.cfg.BaseDir, "data", "trash")
}

func (s *server) fmTrashList() []fmTrashMeta {
	root := s.fmTrashRoot()
	ents, _ := os.ReadDir(root)
	out := make([]fmTrashMeta, 0, len(ents))
	for _, e := range ents {
		if !e.IsDir() {
			continue
		}
		dir := filepath.Join(root, e.Name())
		mp := filepath.Join(dir, "meta.json")
		b, err := os.ReadFile(mp)
		if err != nil {
			continue
		}
		var m fmTrashMeta
		if json.Unmarshal(b, &m) != nil || m.ID == "" {
			continue
		}
		m.DataPath = filepath.Join(dir, "data")
		m.MetaPath = mp
		if _, err := os.Stat(m.DataPath); err != nil {
			continue
		}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DeletedAt > out[j].DeletedAt })
	return out
}

func (s *server) fmTrashAdd(srcs []string) ([]fmTrashMeta, error) {
	root := s.fmTrashRoot()
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	out := make([]fmTrashMeta, 0, len(srcs))
	for _, src := range srcs {
		fi, err := os.Lstat(src)
		if err != nil {
			return out, fmt.Errorf("不存在: %s", src)
		}
		id := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(src))
		dir := filepath.Join(root, id)
		data := filepath.Join(dir, "data")
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return out, err
		}
		if err := core.Copy(src, data); err != nil {
			_ = os.RemoveAll(dir)
			return out, fmt.Errorf("移入回收站失败 %s: %w", filepath.Base(src), err)
		}
		if err := core.Delete(src); err != nil {
			_ = os.RemoveAll(dir)
			return out, fmt.Errorf("移入回收站后删除原文件失败 %s: %w", filepath.Base(src), err)
		}
		m := fmTrashMeta{ID: id, Name: filepath.Base(src), Original: src, IsDir: fi.IsDir(), Size: 0, DeletedAt: time.Now().Unix()}
		if fi.IsDir() {
			if n, err := core.DirSize(data); err == nil {
				m.Size = n
			}
		} else {
			m.Size = fi.Size()
		}
		b, _ := json.MarshalIndent(m, "", "  ")
		_ = os.WriteFile(filepath.Join(dir, "meta.json"), b, 0o600)
		out = append(out, m)
	}
	return out, nil
}

func (s *server) handleFmTrash(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": s.fmTrashList()})
		return
	case http.MethodPost:
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		Paths []string `json:"paths"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil || len(b.Paths) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "paths 必填"})
		return
	}
	paths := make([]string, 0, len(b.Paths))
	for _, p := range b.Paths {
		abs, err := resolveFM(p)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
			return
		}
		paths = append(paths, abs)
	}
	items, err := s.fmTrashAdd(paths)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error(), "items": items})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "count": len(items), "items": items})
}

func (s *server) handleFmTrashAction(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/fm/trash/")
	rest = strings.Trim(rest, "/")
	parts := strings.Split(rest, "/")
	action := parts[0]
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	if action == "purge" && (len(parts) == 1 || parts[1] == "all") {
		var b struct {
			All bool `json:"all"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		if b.All {
			ents, _ := os.ReadDir(s.fmTrashRoot())
			n := 0
			for _, e := range ents {
				if e.IsDir() {
					if os.RemoveAll(filepath.Join(s.fmTrashRoot(), e.Name())) == nil {
						n++
					}
				}
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "removed": n})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "需要 all=true"})
		return
	}
	id := ""
	if action == "restore" || action == "purge" {
		if len(parts) > 1 {
			id = parts[1]
		}
	} else {
		id = action
		action = "restore"
	}
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "缺少回收站 id"})
		return
	}
	var target *fmTrashMeta
	for _, m := range s.fmTrashList() {
		if m.ID == id {
			mm := m
			target = &mm
			break
		}
	}
	if target == nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "回收站项目不存在"})
		return
	}
	if action == "purge" {
		_ = os.RemoveAll(filepath.Dir(target.MetaPath))
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "id": id})
		return
	}
	dest := target.Original
	if _, err := os.Lstat(dest); err == nil {
		ext := filepath.Ext(dest)
		base := strings.TrimSuffix(dest, ext)
		for i := 1; i < 10000; i++ {
			dest = fmt.Sprintf("%s (restored %d)%s", base, i, ext)
			if _, err := os.Lstat(dest); err != nil {
				break
			}
		}
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	if err := core.Copy(target.DataPath, dest); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	_ = os.RemoveAll(filepath.Dir(target.MetaPath))
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "id": id, "path": dest})
}

// 避免 unused strconv 在后续扩展中报错；当前保留给分页/大小格式化。
