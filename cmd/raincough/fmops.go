package main

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"raincough/internal/core"
)

// fmOps — 文件管理异步任务 HTTP 装配(旧前端 /api/fm/ops 契约)。
// 业务逻辑(任务队列/复制/移动/打包/解压)在 internal/core。

var fmOps = core.NewFmOpsManager()

// handleFmOpsStart POST /api/fm/ops — 启动新任务。
func (s *server) handleFmOpsStart(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Op     string   `json:"op"`
		Paths  []string `json:"paths"`
		Dest   string   `json:"dest"`
		Format string   `json:"format"`
		Name   string   `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if b.Op == "" || len(b.Paths) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "op 与 paths 必填"})
		return
	}
	switch b.Op {
	case "copy", "move", "delete", "archive":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "op 非法: " + b.Op})
		return
	}
	// 路径校验(全部在允许根内)
	for _, p := range b.Paths {
		if _, err := resolveFM(p); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
			return
		}
	}
	var destAbs string
	if b.Dest != "" {
		da, err := resolveFM(b.Dest)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": "目标目录越界"})
			return
		}
		destAbs = da
	}
	t := core.NewFmTask(b.Op, b.Paths, b.Dest)
	if b.Op == "archive" {
		t.Message = "format=" + b.Format + " name=" + b.Name
	}
	fmOps.Add(t)
	abs := make([]string, len(b.Paths))
	for i, p := range b.Paths {
		ab, _ := resolveFM(p)
		abs[i] = ab
	}
	go core.RunFmTask(t, abs, destAbs)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "queued", "id": t.ID, "task": t})
}

// handleFmOps GET /api/fm/ops(列表) / GET|POST /api/fm/ops/{id}(详情/取消/下载/删除)。
func (s *server) handleFmOps(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/fm/ops")
	rest = strings.TrimPrefix(rest, "/")
	parts := []string{}
	if rest != "" {
		parts = strings.Split(rest, "/")
	}
	// POST /api/fm/ops = 启动新任务
	if r.Method == http.MethodPost && (len(parts) == 0 || (len(parts) == 1 && parts[0] == "")) {
		s.handleFmOpsStart(w, r)
		return
	}
	// 列表
	if len(parts) == 0 || (len(parts) == 1 && parts[0] == "") {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "GET required"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"tasks": fmOps.List()})
		return
	}
	id := parts[0]
	sub := ""
	if len(parts) > 1 {
		sub = parts[1]
	}
	t := fmOps.Get(id)
	switch {
	case t == nil:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "任务不存在"})
	case sub == "" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"task": t})
	case sub == "cancel" && r.Method == http.MethodPost:
		t.Cancel()
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "task": t})
	case sub == "download" && r.Method == http.MethodGet:
		if t.Dest == "" || !isFile(t.Dest) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "产物不存在"})
			return
		}
		w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(t.Dest))
		http.ServeFile(w, r, t.Dest)
	case r.Method == http.MethodDelete && sub == "":
		fmOps.Remove(id)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "unsupported"})
	}
}

// handleFmUnzip POST /api/fm/unzip {path, dest?, password?}。
func (s *server) handleFmUnzip(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Path     string `json:"path"`
		Archive  string `json:"archive"`
		Dest     string `json:"dest"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	// 兼容前端契约 {archive, dest, password} 与旧 {path, dest}
	if b.Path == "" && b.Archive != "" {
		b.Path = b.Archive
	}
	if b.Path == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "path 必填"})
		return
	}
	src, err := resolveFM(b.Path)
	if err != nil {
		writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
		return
	}
	if !strings.HasSuffix(strings.ToLower(src), ".zip") {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "仅支持 zip(tar 解压请用系统工具)"})
		return
	}
	dest := filepath.Dir(src)
	if b.Dest != "" {
		if d, err := resolveFM(b.Dest); err == nil {
			dest = d
		}
	}
	if err := core.UnzipTo(src, dest); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "dest": dest})
}
