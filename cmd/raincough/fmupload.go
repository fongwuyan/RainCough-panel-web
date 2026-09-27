package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// ---- 文件管理: 分块上传 ----
// 修复: 前端 api.fmUpload 唯一路径是 POST /api/fm/upload/chunk(XHR 分块+进度条),
// 后端从未实现(只有单请求 /api/fm/upload) → 实测 404, 文件管理【无法上传任何文件】。
// 契约(api.js fmUpload): form = path / filename / file_id / chunk_index /
//   total_chunks / conflict(rename|overwrite|skip) / chunk
// 响应: {ok:true, ...}(前端判 xhr.status 2xx && data.ok)

const (
	fmChunkMemLimit = 4 << 20 // 单块内存缓冲 4MB(块 8MB, 其余落盘)
	fmChunkMaxTotal = 100000  // 单文件最大块数
	fmUploadStale    = 24 * time.Hour // 未完成上传的临时目录保留时长
)

var fmUploadIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// fmUploadWorkRoot 分块临时目录根(按 file_id 隔离)。
func fmUploadWorkRoot() string { return filepath.Join(os.TempDir(), "rc-upload") }

// fmUploadCleanupStale 清理超时未完成的上传临时目录(尽力而为)。
func fmUploadCleanupStale() {
	root := fmUploadWorkRoot()
	ents, err := os.ReadDir(root)
	if err != nil {
		return
	}
	for _, e := range ents {
		p := filepath.Join(root, e.Name())
		if fi, err := e.Info(); err == nil && time.Since(fi.ModTime()) > fmUploadStale {
			_ = os.RemoveAll(p)
		}
	}
}

// fmUniquePath 同名冲突 rename 策略: 原名可用则原名; 否则 name (1).ext → name (2).ext ...
func fmUniquePath(dir, name string) string {
	full := filepath.Join(dir, name)
	if _, err := os.Lstat(full); os.IsNotExist(err) {
		return full
	}
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	for i := 1; i <= 9999; i++ {
		p := filepath.Join(dir, fmt.Sprintf("%s (%d)%s", base, i, ext))
		if _, err := os.Lstat(p); os.IsNotExist(err) {
			return p
		}
	}
	return filepath.Join(dir, fmt.Sprintf("%s-%d%s", base, time.Now().Unix(), ext))
}

// handleFmUploadChunk POST /api/fm/upload/chunk — 接收单块 / 最后一块拼装落盘。
func (s *server) handleFmUploadChunk(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(fmChunkMemLimit); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad multipart: " + err.Error()})
		return
	}
	// 目标目录在 form.path(不是 query)
	dirRel := strings.TrimSpace(r.FormValue("path"))
	if dirRel == "" {
		dirRel = "/"
	}
	dir, err := resolveFM(dirRel)
	if err != nil {
		writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
		return
	}
	// 文件名显式拒绝穿越(不静默改名, 契约清晰)
	rawName := strings.TrimSpace(r.FormValue("filename"))
	if rawName == "" || rawName == "." || rawName == ".." ||
		strings.Contains(rawName, "..") || strings.ContainsAny(rawName, `/\`) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "文件名非法"})
		return
	}
	name := filepath.Base(rawName)
	id := strings.TrimSpace(r.FormValue("file_id"))
	if !fmUploadIDRe.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "file_id 非法"})
		return
	}
	idx := fmAtoi(r.FormValue("chunk_index"))
	total := fmAtoi(r.FormValue("total_chunks"))
	if total < 1 || total > fmChunkMaxTotal || idx < 0 || idx >= total {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "分块序号非法"})
		return
	}
	conflict := r.FormValue("conflict")
	if conflict == "" {
		conflict = "rename"
	}
	if conflict != "rename" && conflict != "overwrite" && conflict != "skip" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "conflict 非法: " + conflict})
		return
	}

	part, _, err := r.FormFile("chunk")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "缺少 chunk 字段"})
		return
	}
	defer part.Close()

	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	work := filepath.Join(fmUploadWorkRoot(), id)
	if err := os.MkdirAll(work, 0o700); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	fmUploadCleanupStale()

	dst, err := os.Create(filepath.Join(work, fmt.Sprintf("%06d.part", idx)))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	_, cerr := io.Copy(dst, part)
	dst.Close()
	if cerr != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "写块失败: " + cerr.Error()})
		return
	}

	// 中间块: 直接确认
	if idx+1 < total {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ok": true, "pending": true, "received": idx + 1, "total": total,
		})
		return
	}

	// 最后一块 → 按 conflict 策略拼装
	final := filepath.Join(dir, name)
	if conflict == "skip" {
		if _, err := os.Lstat(final); err == nil {
			_ = os.RemoveAll(work)
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"ok": true, "skipped": true, "name": name, "path": final,
			})
			return
		}
	} else if conflict == "rename" {
		final = fmUniquePath(dir, name)
	}

	tmp := fmt.Sprintf("%s.uploading-%d", final, time.Now().UnixNano())
	out, err := os.Create(tmp)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	var written int64
	complete := true
	for i := 0; i < total; i++ {
		f, err := os.Open(filepath.Join(work, fmt.Sprintf("%06d.part", i)))
		if err != nil {
			complete = false
			break
		}
		n, cerr := io.Copy(out, f)
		f.Close()
		written += n
		if cerr != nil {
			complete = false
			break
		}
	}
	_ = out.Close()
	if !complete {
		_ = os.Remove(tmp)
		// 保留临时目录以便重传续用; 前端会重试该文件
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": fmt.Sprintf("分块缺失或写入中断(已收 %d/%d 块), 请重试", idx+1, total),
			"received": idx + 1, "total": total,
		})
		return
	}
	if err := os.Rename(tmp, final); err != nil {
		_ = os.Remove(tmp)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	_ = os.RemoveAll(work)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok": true, "name": filepath.Base(final), "path": final,
		"size": written, "conflict": conflict,
	})
}
