package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"raincough/internal/core"
)

// 文件管理根目录: 旧的 FM_ALLOW_ROOTS 语义, env 可覆盖(默认 /)。
var fmRoots = func() []string {
	if v := os.Getenv("FM_ALLOW_ROOTS"); v != "" {
		return strings.Split(v, ",")
	}
	return []string{"/"}
}()

// resolveFM 解析请求路径到绝对路径(约束在允许根内)。
func resolveFM(rel string) (string, error) {
	if rel == "" || rel == "." {
		rel = "/"
	}
	// 解析为绝对路径(防止相对路径逃逸)
	abs := rel
	if !filepath.IsAbs(abs) {
		abs = "/" + strings.TrimLeft(rel, "/")
	}
	abs = filepath.Clean(abs)
	for _, root := range fmRoots {
		cleanRoot := filepath.Clean(root)
		if cleanRoot == "" {
			continue
		}
		// 根 / 特判: 任何绝对路径都在其下
		if cleanRoot == "/" {
			if strings.HasPrefix(abs, "/") {
				return abs, nil
			}
			continue
		}
		// 前缀匹配: 允许根本身或其下任意路径(兼容 Windows 反斜杠)
		if abs == cleanRoot || strings.HasPrefix(abs, cleanRoot+string(filepath.Separator)) {
			return abs, nil
		}
	}
	return "", fmt.Errorf("路径超出允许根目录: %s", rel)
}

// handleFm 文件管理路由分发。
func (s *server) handleFm(w http.ResponseWriter, r *http.Request) {
	// query path 仅 GET 型端点使用; POST 型(save/mkdir 等)路径在 body 内
	rel := r.URL.Query().Get("path")
	abs := "/"
	if rel != "" {
		var err error
		abs, err = resolveFM(rel)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
			return
		}
	}

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/api/fm/list":
		entries, err := core.ListDir(abs)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"path": abs, "items": entries, "count": len(entries),
		})

	case r.Method == http.MethodGet && r.URL.Path == "/api/fm/read":
		content, tooBig, err := core.ReadFileText(abs, core.ReadLimitMax)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"path": abs, "content": content, "too_big": tooBig,
			"encoding": "utf-8",
		})

	case r.Method == http.MethodPost && r.URL.Path == "/api/fm/save":
		var b struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		target, err := resolveFM(b.Path)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
			return
		}
		if err := core.SaveFileText(target, []byte(b.Content), core.SaveLimitMax); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "path": target})

	case r.Method == http.MethodPost && r.URL.Path == "/api/fm/mkdir":
		if err := core.Mkdir(abs); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	case r.Method == http.MethodPost && r.URL.Path == "/api/fm/rename":
		var b struct {
			Old     string `json:"old"`
			New     string `json:"new"`
			Path    string `json:"path"`
			NewName string `json:"new_name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		// 兼容前端契约 {path, new_name} 与旧契约 {old, new}
		if b.Path != "" && b.NewName != "" {
			b.Old, b.New = b.Path, b.NewName
		}
		if b.Old == "" || b.New == "" {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "path/old 与 new_name/new 必填"})
			return
		}
		oldAbs, err := resolveFM(b.Old)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
			return
		}
		// 新路径可以是相对(同目录)或绝对
		newAbs := b.New
		if !filepath.IsAbs(newAbs) {
			newAbs = filepath.Join(filepath.Dir(oldAbs), filepath.Base(b.New))
		}
		if err := core.Rename(oldAbs, newAbs); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	case r.Method == http.MethodPost && r.URL.Path == "/api/fm/delete":
		var b struct {
			Path  string   `json:"path"`
			Paths []string `json:"paths"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		targets := []string{}
		if len(b.Paths) > 0 {
			targets = b.Paths
		} else if b.Path != "" {
			targets = []string{b.Path}
		}
		if len(targets) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "path 必填"})
			return
		}
		for _, p := range targets {
			target, err := resolveFM(p)
			if err != nil {
				writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
				return
			}
			if err := core.Delete(target); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	case r.Method == http.MethodPost && r.URL.Path == "/api/fm/upload":
		// 单请求上传(旧版另有 /upload/chunk 分块, 单请求先支持小文件)
		file, header, err := r.FormFile("file")
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "缺少 file 字段"})
			return
		}
		defer file.Close()
		target, err := core.SafeJoin(abs, header.Filename)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		if err := os.MkdirAll(abs, 0o755); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		out, err := os.Create(target)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		defer out.Close()
		if _, err := copyStream(out, file); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status": true, "name": header.Filename, "path": target,
		})

	case r.Method == http.MethodGet && r.URL.Path == "/api/fm/download":
		if !isFile(abs) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "文件不存在"})
			return
		}
		w.Header().Set("Content-Disposition",
			"attachment; filename="+filepath.Base(abs))
		http.ServeFile(w, r, abs)

	case r.Method == http.MethodGet && r.URL.Path == "/api/fm/preview":
		if !isFile(abs) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "文件不存在"})
			return
		}
		ctype := core.PreviewType(abs)
		if ctype == "text" {
			content, tooBig, err := core.ReadFileText(abs, core.PreviewLimit)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"type": "text", "content": content, "too_big": tooBig,
			})
			return
		}
		// 媒体类型直接流式返回
		w.Header().Set("Content-Type", mimeFor(ctype))
		http.ServeFile(w, r, abs)

	case r.Method == http.MethodGet && r.URL.Path == "/api/fm/hash":
		if !isFile(abs) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "文件不存在"})
			return
		}
		h, err := core.FileHash(abs)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"path": abs, "md5": h})

	case r.Method == http.MethodPost && (r.URL.Path == "/api/fm/move" || r.URL.Path == "/api/fm/copy"):
		var b struct {
			Paths []string `json:"paths"`
			Dest  string   `json:"dest"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if len(b.Paths) == 0 || b.Dest == "" {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "paths 与 dest 必填"})
			return
		}
		destAbs, err := resolveFM(b.Dest)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
			return
		}
		if err := os.MkdirAll(destAbs, 0o755); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		isCopy := r.URL.Path == "/api/fm/copy"
		for _, p := range b.Paths {
			srcAbs, err := resolveFM(p)
			if err != nil {
				writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
				return
			}
			dst := filepath.Join(destAbs, filepath.Base(srcAbs))
			if isCopy {
				if err := copyPathFM(srcAbs, dst); err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
					return
				}
			} else {
				if err := os.Rename(srcAbs, dst); err != nil {
					if err2 := copyPathFM(srcAbs, dst); err2 == nil {
						os.RemoveAll(srcAbs)
					} else {
						writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
						return
					}
				}
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	case r.Method == http.MethodPost && r.URL.Path == "/api/fm/size":
		var b struct {
			Paths []string `json:"paths"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		sizes := map[string]int64{}
		for _, p := range b.Paths {
			abs, err := resolveFM(p)
			if err != nil {
				continue
			}
			sz, _ := core.DirSize(abs)
			sizes[p] = sz
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"sizes": sizes})

	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported: " + r.Method + " " + r.URL.Path})
	}
}

func isFile(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// copyPathFM 复制文件或目录(给 fm move/copy 同步端点用)。
func copyPathFM(src, dst string) error {
	st, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !st.IsDir() {
		return copyFileFM(src, dst)
	}
	return filepath.Walk(src, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyFileFM(p, target)
	})
}

func copyFileFM(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	os.MkdirAll(filepath.Dir(dst), 0o755)
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = copyStream(out, in)
	return err
}

func copyStream(dst io.Writer, src io.Reader) (int64, error) {
	return io.Copy(dst, src)
}

func mimeFor(ctype string) string {
	switch ctype {
	case "image":
		return "image/jpeg"
	case "video":
		return "video/mp4"
	case "audio":
		return "audio/mpeg"
	case "pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}
