package main

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"raincough/internal/core"
)

// 系统扩展仓储(在 main 中初始化)。
var globalExt *core.ExtStore

// ---- 系统扩展 /api/ext ----
//
// 内置功能(工作台/文件管理/终端/系统扩展/插件/设置/开发文档)随面板主体安装;
// 其余功能以扩展包形式存放于主面板库 extensions/, 由本组接口按需安装。

// handleExtList GET /api/ext -> 已装扩展 + 内置功能清单
func (s *server) handleExtList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalExt == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "扩展仓储未初始化"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"extensions": globalExt.Installed(),
		"builtin":    globalExt.Builtins(),
		"dir":        globalExt.Dir(),
	})
}

// handleExtRegistry GET /api/ext/registry -> 主面板库可用扩展
func (s *server) handleExtRegistry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalExt == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "扩展仓储未初始化"})
		return
	}
	list, source, err := globalExt.Registry()
	hasToken := false
	if globalStore != nil {
		hasToken = globalStore.Token() != ""
	}
	if err != nil {
		// 仓库不可用: 前端只提示一句, 这里仍回 200 + 空清单, 避免整页报错
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"extensions": list, "source": "", "error": err.Error(), "has_token": hasToken,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"extensions": list, "source": source, "has_token": hasToken,
	})
}

// extActionBody 安装/卸载/更新共用请求体。
type extActionBody struct {
	Name string `json:"name"`
}

// handleExtInstall POST /api/ext/install
func (s *server) handleExtInstall(w http.ResponseWriter, r *http.Request) {
	s.extTaskAction(w, r, false)
}

// handleExtUpdate POST /api/ext/update (覆盖安装, 与安装同路径)
func (s *server) handleExtUpdate(w http.ResponseWriter, r *http.Request) {
	s.extTaskAction(w, r, false)
}

// extTaskAction 安装/更新: 起异步任务并占用任务队列(source=ext)。
func (s *server) extTaskAction(w http.ResponseWriter, r *http.Request, _ bool) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalExt == nil || globalTasks == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "扩展仓储未初始化"})
		return
	}
	var b extActionBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || strings.TrimSpace(b.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	status, err := globalExt.Install(b.Name, globalTasks)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": status, "name": b.Name})
}

// handleExtRemove POST /api/ext/remove
func (s *server) handleExtRemove(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalExt == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "扩展仓储未初始化"})
		return
	}
	var b extActionBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || strings.TrimSpace(b.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 必填"})
		return
	}
	if err := globalExt.Remove(b.Name); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "name": b.Name})
}

// handleExtAsset GET /api/ext/<name>            -> 扩展清单(JSON)
//
//	GET /api/ext/<name>/assets/<file> -> 扩展前端产物
func (s *server) handleExtAsset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalExt == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "扩展仓储未初始化"})
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, "/api/ext/")
	name := rest
	sub := ""
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		name = rest[:i]
		sub = rest[i+1:]
	}
	ext, ok := globalExt.InstalledByName(name)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "扩展未安装"})
		return
	}
	if sub == "" {
		writeJSON(w, http.StatusOK, ext)
		return
	}
	full, ok := globalExt.AssetPath(ext.Name, sub)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "产物不存在"})
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", extContentType(full))
	http.ServeFile(w, r, full)
}

// extContentType 产物类型(仅前端资源, 少而稳定)。
func extContentType(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".js", ".mjs":
		return "application/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".html":
		return "text/html; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".woff2":
		return "font/woff2"
	}
	return "application/octet-stream"
}
