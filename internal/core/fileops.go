package core

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ---- 文件管理异步任务(旧前端 /api/fm/ops 契约) ----

// FmTask 单个文件操作任务: copy/move/delete/archive。
type FmTask struct {
	ID        string   `json:"id"`
	Op        string   `json:"op"`
	Paths     []string `json:"paths"`
	Dest      string   `json:"dest,omitempty"`
	Status    string   `json:"status"` // running/done/error/cancelled
	Progress  int      `json:"progress"`
	Message   string   `json:"message,omitempty"`
	Created   int64    `json:"created"`
	Updated   int64    `json:"updated"`
	ResultURL string   `json:"result_url,omitempty"`
	cancel    chan struct{}
}

// NewFmTask 创建任务(注入取消通道)。
func NewFmTask(op string, paths []string, dest string) *FmTask {
	return &FmTask{Op: op, Paths: paths, Dest: dest, Status: "running", cancel: make(chan struct{})}
}

// Cancel 请求取消任务(幂等, 非阻塞)。
func (t *FmTask) Cancel() {
	select {
	case t.cancel <- struct{}{}:
	default:
	}
}

// FmOpsManager 任务队列(最新在前, 保留上限 100)。
type FmOpsManager struct {
	mu    sync.Mutex
	tasks []*FmTask
	id    int
}

// NewFmOpsManager 创建任务管理器。
func NewFmOpsManager() *FmOpsManager { return &FmOpsManager{} }

func (m *FmOpsManager) nextID() string {
	m.id++
	return fmt.Sprintf("op%d", m.id)
}

// Add 入队并分配 ID。
func (m *FmOpsManager) Add(t *FmTask) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t.ID = m.nextID()
	t.Created = time.Now().Unix()
	t.Updated = t.Created
	m.tasks = append([]*FmTask{t}, m.tasks...) // 最新在前
	if len(m.tasks) > 100 {
		m.tasks = m.tasks[:100]
	}
}

// Get 按 ID 取任务。
func (m *FmOpsManager) Get(id string) *FmTask {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, t := range m.tasks {
		if t.ID == id {
			return t
		}
	}
	return nil
}

// Remove 按 ID 移除任务。
func (m *FmOpsManager) Remove(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, t := range m.tasks {
		if t.ID == id {
			m.tasks = append(m.tasks[:i], m.tasks[i+1:]...)
			return
		}
	}
}

// List 返回全部任务(副本)。
func (m *FmOpsManager) List() []*FmTask {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]*FmTask, len(m.tasks))
	copy(out, m.tasks)
	return out
}

// RunFmTask 异步执行任务: 复制/移动/删除/打包, 带进度与取消。
// abs 为已解析(通过允许根校验)的源路径; destAbs 为已解析的目标目录(copy/move 用)。
func RunFmTask(t *FmTask, abs []string, destAbs string) {
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
		destDir = destAbs
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
			if err := Copy(src, dst); err != nil {
				update(0, "复制失败 "+name+": "+err.Error(), "error")
				return
			}
		case "move":
			dst := filepath.Join(destDir, name)
			if err := os.Rename(src, dst); err != nil {
				if err2 := Copy(src, dst); err2 == nil {
					Delete(src)
				} else {
					update(0, "移动失败 "+name+": "+err.Error(), "error")
					return
				}
			}
		case "delete":
			if err := Delete(src); err != nil {
				update(0, "删除失败 "+name+": "+err.Error(), "error")
				return
			}
		case "archive":
			// 聚合操作, 循环内只计数
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
