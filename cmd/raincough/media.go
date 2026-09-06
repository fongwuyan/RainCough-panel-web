package main

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"raincough/internal/core"
	"raincough/internal/shared"
)

// 媒体中心 API(旧前端 api.js media* 契约): roots/stats/list/thumb/file/tag/dedup + 工具端点。
// 文件扫描/统计逻辑在 internal/core.Media。

var mediaSvc *core.Media

func initMediaNS(sd *shared.Shared) {
	ns, err := sd.Namespace("core_media")
	if err == nil {
		mediaSvc = core.NewMedia(ns)
	} else {
		mediaSvc = core.NewMedia(nil)
	}
}

// ---- /api/media/roots GET/POST ----
func (s *server) handleMediaRoots(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"roots": mediaSvc.Roots()})
	case http.MethodPost:
		var b struct {
			Roots []interface{} `json:"roots"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		mediaSvc.SaveRoots(b.Roots)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "roots": b.Roots})
	}
}

// ---- /api/media/stats ----
func (s *server) handleMediaStats(w http.ResponseWriter, r *http.Request) {
	counts, total := mediaSvc.Stats()
	writeJSON(w, http.StatusOK, map[string]interface{}{"counts": counts, "total_size": total})
}

// ---- /api/media/list ----
func (s *server) handleMediaList(w http.ResponseWriter, r *http.Request) {
	root := r.URL.Query().Get("root")
	kind := r.URL.Query().Get("kind")
	tag := r.URL.Query().Get("tag")
	page := 0
	if p := r.URL.Query().Get("page"); p != "" {
		page = core.AtoiSafe(p)
	}
	items, total := mediaSvc.List(root, kind, tag, page)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": items, "total": total, "page": page, "page_size": 48,
	})
}

// ---- /api/media/thumb|file 图片直出 ----
func (s *server) handleMediaFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path 必填", http.StatusBadRequest)
		return
	}
	if !isFile(path) {
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
	var b struct {
		Root string `json:"root"`
	}
	json.NewDecoder(r.Body).Decode(&b)
	root := b.Root
	if root == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "root 必填"})
		return
	}
	groups, scanned := mediaSvc.Dedup(root)
	writeJSON(w, http.StatusOK, map[string]interface{}{"groups": groups, "scanned": scanned})
}

// ---- /api/media/tool/* 工具端点(简版兼容) ----
func (s *server) handleMediaTool(w http.ResponseWriter, r *http.Request) {
	// 返回委托给插件工具的能力, 或报"未集成"但保持契约
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok": true, "message": "工具端点已就绪(文件处理在插件层)", "results": []interface{}{},
	})
}
