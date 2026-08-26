package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"raincough/internal/core"
)

// fmOps — 文件管理异步任务(旧前端 /api/fm/ops 契约)。
// 支持 op: copy/move/delete/archive; 任务队列带进度与取消。

type fmTask struct {
	ID        string      `json:"id"`
	Op        string      `json:"op"`
	Paths     []string    `json:"paths"`
	Dest      string      `json:"dest,omitempty"`
	Status    string      `json:"status"` // running/done/error/cancelled
	Progress  int         `json:"progress"`
	Message   string      `json:"message,omitempty"`
	Created   int64       `json:"created"`
	Updated   int64       `json:"updated"`
	ResultURL string      `json:"result_url,omitempty"`
	cancel    chan struct{}
}

type fmOpsManager struct {
	mu    sync.Mutex
	tasks []*fmTask
	id    int
}

var fmOps = &fmOpsManager{}

func (m *fmOpsManager) nextID() string {
	m.id++
	return fmt.Sprintf("op%d", m.id)
}

func (m *fmOpsManager) add(t *fmTask) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t.ID = m.nextID()
	t.Created = time.Now().Unix()
	t.Updated = t.Created
	m.tasks = append([]*fmTask{t}, m.tasks...) // 最新在前
	if len(m.tasks) > 100 {
		m.tasks = m.tasks[:100]
	}
}

func (m *fmOpsManager) get(id string) *fmTask {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, t := range m.tasks {
		if t.ID == id {
			return t
		}
	}
	return nil
}

func (m *fmOpsManager) remove(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, t := range m.tasks {
		if t.ID == id {
			m.tasks = append(m.tasks[:i], m.tasks[i+1:]...)
			return
		}
	}
}

func (m *fmOpsManager) list() []*fmTask {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]*fmTask, len(m.tasks))
	copy(out, m.tasks)
	return out
}

// ---- handler: POST /api/fm/ops (启动) ----

func (s *server) handleFmOpsStart(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Op    string   `json:"op"`
		Paths []string `json:"paths"`
		Dest  string   `json:"dest"`
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
	if b.Dest != "" {
		if _, err := resolveFM(b.Dest); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": "目标目录越界"})
			return
		}
	}
	t := &fmTask{Op: b.Op, Paths: b.Paths, Dest: b.Dest, Status: "running", Progress: 0, cancel: make(chan struct{})}
	if b.Op == "archive" {
		t.Dest = b.Dest
		t.Message = "format=" + b.Format + " name=" + b.Name
	}
	fmOps.add(t)
	abs := make([]string, len(b.Paths))
	for i, p := range b.Paths {
		ab, _ := resolveFM(p)
		abs[i] = ab
	}
	go runFmTask(t, abs, b)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "queued", "id": t.ID, "task": t})
}

func runFmTask(t *fmTask, abs []string, opts struct {
	Op     string   `json:"op"`
	Paths  []string `json:"paths"`
	Dest   string   `json:"dest"`
	Format string   `json:"format"`
	Name   string   `json:"name"`
}) {
	update := func(p int, msg string, status string) {
		t.Progress = p
		t.Message = msg
		if status != "" {
			t.Status = status
		}
		t.Updated = time.Now().Unix()
	}
	cancelled := func() bool {
		select {
		case <-t.cancel:
			t.Status = "cancelled"
			t.Message = "已取消"
			t.Updated = time.Now().Unix()
			return true
		default:
			return false
		}
	}

	var destDir string
	if t.Op == "copy" || t.Op == "move" {
		destDir, _ = resolveFM(t.Dest)
		if err := os.MkdirAll(destDir, 0o755); err != nil {
			update(0, err.Error(), "error")
			return
		}
	}

	total := len(abs)
	for i, src := range abs {
		if cancelled() {
			return
		}
		name := filepath.Base(src)
		switch t.Op {
		case "copy":
			dst := filepath.Join(destDir, name)
			if err := copyPath(src, dst); err != nil {
				update(0, "复制失败 " + name + ": " + err.Error(), "error")
				return
			}
		case "move":
			dst := filepath.Join(destDir, name)
			if err := os.Rename(src, dst); err != nil {
				if err2 := copyPath(src, dst); err2 == nil {
					os.RemoveAll(src)
				} else {
					update(0, "移动失败 " + name + ": " + err.Error(), "error")
					return
				}
			}
		case "delete":
			if err := core.Delete(src); err != nil {
				update(0, "删除失败 " + name + ": " + err.Error(), "error")
				return
			}
		case "archive":
			// 在每个循环只做一次(archive 是聚合)
		}
		update((i+1)*100/total, fmt.Sprintf("%d/%d", i+1, total), "")
		if cancelled() {
			return
		}
	}

	// archive 单独处理
	if t.Op == "archive" {
		if cancelled() {
			return
		}
		outPath := filepath.Join(os.TempDir(), "rc-"+t.ID+".zip")
		os.MkdirAll(filepath.Dir(outPath), 0o755)
		if err := zipPaths(abs, outPath); err != nil {
			update(0, "打包失败: "+err.Error(), "error")
			return
		}
		t.ResultURL = "/api/fm/ops/" + t.ID + "/download"
		t.Dest = outPath
	}

	update(100, "完成", "done")
	t.Updated = time.Now().Unix()
}

// copyPath 复制文件或目录。
func copyPath(src, dst string) error {
	st, err := os.Stat(src)
	if err != nil {
		return err
	}
	if st.IsDir() {
		return filepath.Walk(src, func(p string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(src, p)
			target := filepath.Join(dst, rel)
			if info.IsDir() {
				return os.MkdirAll(target, 0o755)
			}
			return copyFile(p, target)
		})
	}
	return copyFile(src, dst)
}

func copyFile(src, dst string) error {
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
	_, err = io.Copy(out, in)
	return err
}

// zipPaths 打包多个路径为 zip。
func zipPaths(paths []string, outPath string) error {
	out, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer out.Close()
	zw := zip.NewWriter(out)
	defer zw.Close()
	for _, root := range paths {
		st, err := os.Stat(root)
		if err != nil {
			return err
		}
		if st.IsDir() {
			err = filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
				if err != nil || info.IsDir() {
					return err
				}
				rel, _ := filepath.Rel(filepath.Dir(root), p)
				return zipAddFile(zw, p, rel)
			})
		} else {
			if err := zipAddFile(zw, root, filepath.Base(root)); err != nil {
				return err
			}
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func zipAddFile(zw *zip.Writer, src, name string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, f)
	return err
}

// ---- handler: GET /api/fm/ops(列表) / GET|POST /api/fm/ops/{id} ----

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
		writeJSON(w, http.StatusOK, map[string]interface{}{"tasks": fmOps.list()})
		return
	}
	id := parts[0]
	sub := ""
	if len(parts) > 1 {
		sub = parts[1]
	}
	t := fmOps.get(id)
	switch {
	case t == nil:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "任务不存在"})
	case sub == "" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"task": t})
	case sub == "cancel" && r.Method == http.MethodPost:
		select {
		case t.cancel <- struct{}{}:
		default:
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "task": t})
	case sub == "download" && r.Method == http.MethodGet:
		if t.Dest == "" || !isFile(t.Dest) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "产物不存在"})
			return
		}
		w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(t.Dest))
		http.ServeFile(w, r, t.Dest)
	case r.Method == http.MethodDelete && sub == "":
		fmOps.remove(id)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "unsupported"})
	}
}

// ---- handler: POST /api/fm/unzip {path, dest?, password?} ----

func (s *server) handleFmUnzip(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Path     string `json:"path"`
		Dest     string `json:"dest"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Path == "" {
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
	if err := unzipTo(src, dest); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "dest": dest})
}

// unzipTo 解压 zip 到目录(zip-slip 防护)。
func unzipTo(src, destDir string) error {
	zr, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer zr.Close()
	for _, f := range zr.File {
		target := filepath.Join(destDir, f.Name)
		if !strings.HasPrefix(target, filepath.Clean(destDir)+string(filepath.Separator)) {
			return fmt.Errorf("非法压缩条目: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			os.MkdirAll(target, 0o755)
			continue
		}
		os.MkdirAll(filepath.Dir(target), 0o755)
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(target)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}