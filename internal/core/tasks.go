package core

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// ---- 统一任务队列(与旧面板 tasks.py 契约兼容) ----

// Task 统一任务条目。
type Task struct {
	ID        string                 `json:"id"`
	Source    string                 `json:"source"` // 提供者: scheduler/envpkg/mcserver/aigen/...
	Kind      string                 `json:"kind"`   // install/download/upload/shell/...
	Name      string                 `json:"name"`   // 展示名
	Status    string                 `json:"status"` // queued|running|done|failed
	Phase     string                 `json:"phase,omitempty"`
	Progress  int                    `json:"progress"` // 0-100
	Message   string                 `json:"message,omitempty"`
	Error     string                 `json:"error,omitempty"`
	CreatedAt int64                  `json:"created_at"`
	UpdatedAt int64                  `json:"updated_at"`
	Meta      map[string]interface{} `json:"meta,omitempty"`
}

// TaskStore 任务存储(基于 SharedData KV)。
type TaskStore struct {
	ns Namespacelike // 数据层 namespace(core_tasks)
	mu sync.Mutex
	// 内存中的实时任务(线程安全更新 + 定期落库)
	tasks map[string]*Task
	order []string
}

// Namespacelike namespace 访问接口。
type Namespacelike interface {
	Set(key string, value interface{}) error
	Get(key string) (interface{}, bool, error)
}

// NewTaskStore 创建任务存储。
func NewTaskStore(ns Namespacelike) *TaskStore {
	return &TaskStore{ns: ns, tasks: map[string]*Task{}}
}

// newID 生成任务ID: src-prefix-时间戳-随机。
func newTaskID(prefix string) string {
	b := make([]byte, 2)
	rand.Read(b)
	return fmt.Sprintf("%s-%d-%s", prefix, time.Now().Unix(), hex.EncodeToString(b))
}

// Begin 创建任务(queued)。返回任务ID。
func (ts *TaskStore) Begin(source, name, kind string, meta map[string]interface{}) string {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	id := newTaskID(strings.ToLower(source))
	t := &Task{
		ID: id, Source: source, Kind: kind, Name: name,
		Status: "queued", Progress: 0,
		CreatedAt: time.Now().Unix(), UpdatedAt: time.Now().Unix(),
		Meta: meta,
	}
	ts.tasks[id] = t
	ts.order = append(ts.order, id)
	ts.persist(t)
	return id
}

// Update 更新任务字段。
func (ts *TaskStore) Update(id, phase string, progress int, message string) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	t, ok := ts.tasks[id]
	if !ok {
		return
	}
	if phase != "" {
		t.Phase = phase
	}
	if progress >= 0 {
		t.Progress = progress
	}
	if message != "" {
		t.Message = message
		t.Status = "running"
	}
	t.UpdatedAt = time.Now().Unix()
	ts.persist(t)
}

// Finish 完成任务。
func (ts *TaskStore) Finish(id string, ok bool, message, errMsg string, progress int) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	t, found := ts.tasks[id]
	if !found {
		return
	}
	if ok {
		t.Status = "done"
	} else {
		t.Status = "failed"
	}
	if message != "" {
		t.Message = message
	}
	if errMsg != "" {
		t.Error = errMsg
	}
	if progress >= 0 {
		t.Progress = progress
	}
	t.UpdatedAt = time.Now().Unix()
	ts.persist(t)
}

// List 列出任务(按创建时间倒序, 可过滤状态)。
func (ts *TaskStore) List(includeDone bool, limit int) []*Task {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	out := make([]*Task, 0, len(ts.tasks))
	for _, id := range ts.order {
		t := ts.tasks[id]
		if !includeDone && (t.Status == "done" || t.Status == "failed") {
			continue
		}
		out = append(out, t)
	}
	// 倒序(最新在前)
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt > out[j].CreatedAt })
	if limit > 0 && len(out) > limit {
		out = out[:limit]
	}
	return out
}

// Get 单条任务。
func (ts *TaskStore) Get(id string) (*Task, bool) {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	t, ok := ts.tasks[id]
	return t, ok
}

// Count 各状态计数(前端徽标用)。
func (ts *TaskStore) Count() map[string]int {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	c := map[string]int{"queued": 0, "running": 0, "done": 0, "failed": 0}
	for _, t := range ts.tasks {
		c[t.Status]++
	}
	return c
}

// Cleanup 清理过期任务(done/failed, 保留 N 天)。
func (ts *TaskStore) Cleanup(retainDays int) int {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	cutoff := time.Now().Add(-time.Duration(retainDays) * 24 * time.Hour).Unix()
	removed := 0
	var keep []string
	for _, id := range ts.order {
		t := ts.tasks[id]
		if (t.Status == "done" || t.Status == "failed") && t.UpdatedAt < cutoff {
			delete(ts.tasks, id)
			_ = ts.ns.Set("task:"+id, nil) // 尽力清库
			removed++
			continue
		}
		keep = append(keep, id)
	}
	ts.order = keep
	return removed
}

// persist 落库(尽力而为, 失败不影响运行态)。
func (ts *TaskStore) persist(t *Task) {
	_ = ts.ns.Set("task:"+t.ID, t)
}

// LoadPersisted 启动时从库恢复未完成任务。
func (ts *TaskStore) LoadPersisted() {
	lister, ok := ts.ns.(interface {
		List(prefix string, limit int) (map[string]interface{}, error)
	})
	if !ok {
		return
	}
	items, err := lister.List("task:", 1000)
	if err != nil {
		return
	}
	ts.mu.Lock()
	defer ts.mu.Unlock()
	for k, v := range items {
		id := strings.TrimPrefix(k, "task:")
		m, ok := v.(map[string]interface{})
		if !ok {
			continue
		}
		task := taskFromMap(id, m)
		if task.Status == "queued" || task.Status == "running" {
			task.Status = "failed" // 重启后未完成任务标记失败
			task.Error = "面板重启, 任务中断"
			task.UpdatedAt = time.Now().Unix()
		}
		ts.tasks[id] = task
		ts.order = append(ts.order, id)
	}
}

// taskFromMap 从 map 还原 Task。
func taskFromMap(id string, m map[string]interface{}) *Task {
	t := &Task{ID: id}
	str := func(k string) string {
		if v, ok := m[k].(string); ok {
			return v
		}
		return ""
	}
	t.Source = str("source")
	t.Kind = str("kind")
	t.Name = str("name")
	t.Status = str("status")
	t.Phase = str("phase")
	t.Message = str("message")
	t.Error = str("error")
	if v, ok := m["progress"].(float64); ok {
		t.Progress = int(v)
	}
	if v, ok := m["created_at"].(float64); ok {
		t.CreatedAt = int64(v)
	}
	if v, ok := m["updated_at"].(float64); ok {
		t.UpdatedAt = int64(v)
	}
	if v, ok := m["meta"].(map[string]interface{}); ok {
		t.Meta = v
	}
	return t
}
