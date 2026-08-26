package core

import (
	"sync"
	"testing"
	"time"
)

// mockNS 内存 namespace(mock SharedData)。
type mockNS struct {
	mu   sync.Mutex
	data map[string]interface{}
}

func (m *mockNS) Set(key string, value interface{}) error {
	if value == nil {
		m.mu.Lock()
		delete(m.data, key)
		m.mu.Unlock()
		return nil
	}
	m.mu.Lock()
	m.data[key] = value
	m.mu.Unlock()
	return nil
}

func (m *mockNS) Get(key string) (interface{}, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.data[key]
	return v, ok, nil
}

func (m *mockNS) List(prefix string, limit int) (map[string]interface{}, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := map[string]interface{}{}
	for k, v := range m.data {
		if len(prefix) == 0 || (len(k) >= len(prefix) && k[:len(prefix)] == prefix) {
			// 模拟真实数据层: JSON 序列化往返(对象 -> map)
			out[k] = toMap(v)
			if len(out) >= limit {
				break
			}
		}
	}
	return out, nil
}

// toMap 模拟 JSON 序列化(结构体 -> map[string]interface{})。
func toMap(v interface{}) map[string]interface{} {
	m := map[string]interface{}{}
	if t, ok := v.(*Task); ok {
		m["id"] = t.ID
		m["source"] = t.Source
		m["kind"] = t.Kind
		m["name"] = t.Name
		m["status"] = t.Status
		m["phase"] = t.Phase
		m["message"] = t.Message
		m["error"] = t.Error
		m["progress"] = float64(t.Progress)
		m["created_at"] = float64(t.CreatedAt)
		m["updated_at"] = float64(t.UpdatedAt)
		if t.Meta != nil {
			m["meta"] = t.Meta
		}
		return m
	}
	if j, ok := v.(*ScheduleJob); ok {
		m["id"] = j.ID
		m["name"] = j.Name
		m["cron"] = j.Cron
		m["action"] = j.Action
		m["enabled"] = j.Enabled
		m["last_run"] = float64(j.LastRun)
		m["last_status"] = j.LastStatus
		m["last_message"] = j.LastMessage
		m["created_at"] = float64(j.CreatedAt)
		if j.Params != nil {
			params := map[string]interface{}{}
			for k, v := range j.Params {
				params[k] = v
			}
			m["params"] = params
		}
		return m
	}
	return nil
}

func newMockNS() *mockNS { return &mockNS{data: map[string]interface{}{}} }

// ---- 任务队列测试 ----

func TestTaskStoreLifecycle(t *testing.T) {
	ts := NewTaskStore(newMockNS())
	id := ts.Begin("envpkg", "安装环境包 python-3.11", "install", nil)
	if id == "" {
		t.Fatal("Begin 未返回 ID")
	}

	ts.Update(id, "downloading", 50, "下载中...")
	ts.Finish(id, true, "安装完成", "", 100)

	task, ok := ts.Get(id)
	if !ok {
		t.Fatalf("任务不存在: %s", id)
	}
	if task.Status != "done" || task.Progress != 100 {
		t.Fatalf("状态错误: %s %d", task.Status, task.Progress)
	}
	if task.Message != "安装完成" {
		t.Fatalf("消息错误: %q", task.Message)
	}
}

func TestTaskStoreFailureAndCount(t *testing.T) {
	ts := NewTaskStore(newMockNS())
	id := ts.Begin("scheduler", "备份", "upload", nil)
	ts.Finish(id, false, "", "磁盘不足", 30)

	// Count 统计
	c := ts.Count()
	if c["failed"] != 1 {
		t.Fatalf("failed 计数错误: %v", c)
	}

	// 不包含 done 的 List
	active := ts.List(false, 0)
	if len(active) != 0 {
		t.Fatalf("failed 不应出现在 active 列表: %d", len(active))
	}
	// 包含 done
	all := ts.List(true, 0)
	if len(all) != 1 {
		t.Fatalf("全量列表应为 1: %d", len(all))
	}
}

func TestTaskStorePersistRestore(t *testing.T) {
	ns := newMockNS()
	ts := NewTaskStore(ns)
	id := ts.Begin("jmcomic", "下载漫画", "download", nil)
	ts.Update(id, "fetching", 60, "下载章节中...")

	// 模拟重启: 新 store 从同一 ns 恢复
	ts2 := NewTaskStore(ns)
	ts2.LoadPersisted()
	task, ok := ts2.Get(id)
	if !ok {
		t.Fatalf("重启后任务应恢复: %s", id)
	}
	// 重启后 running -> failed
	if task.Status != "failed" {
		t.Fatalf("重启后 running 任务应标记 failed, 得到 %s", task.Status)
	}
	if !containsStr(task.Error, "重启") {
		t.Fatalf("错误信息应说明重启: %q", task.Error)
	}
}

func TestTaskCleanup(t *testing.T) {
	ts := NewTaskStore(newMockNS())
	id := ts.Begin("test", "旧任务", "shell", nil)
	ts.Finish(id, true, "", "", 100)
	// 把 UpdatedAt 改到 2 天前
	ts.mu.Lock()
	ts.tasks[id].UpdatedAt = time.Now().Add(-2 * 24 * time.Hour).Unix()
	ts.mu.Unlock()

	removed := ts.Cleanup(1)
	if removed != 1 {
		t.Fatalf("应清理 1 个旧任务, 得到 %d", removed)
	}
	if _, ok := ts.Get(id); ok {
		t.Fatal("清理后任务应不存在")
	}
}

// ---- 调度器测试 ----

func mockExec(j *ScheduleJob) (string, error) {
	return "executed:" + j.Action, nil
}

func TestSchedulerCRUD(t *testing.T) {
	s := NewScheduler(newMockNS(), mockExec)
	j, err := s.Create("每日备份", "0 3 * * *", "shell", map[string]string{"cmd": "backup"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if j.ID == "" || !j.Enabled {
		t.Fatalf("创建失败: %+v", j)
	}
	if len(s.List()) != 1 {
		t.Fatal("List 应为 1")
	}

	// 更新
	enabled := false
	if err := s.Update(j.ID, "", "0 4 * * *", "", nil, &enabled); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ := s.Get(j.ID)
	if got.Cron != "0 4 * * *" || got.Enabled {
		t.Fatalf("更新失败: %+v", got)
	}

	// 手动执行
	msg, err := s.RunNow(j.ID)
	if err != nil || msg != "executed:shell" {
		t.Fatalf("runNow: %v %q", err, msg)
	}
	got, _ = s.Get(j.ID)
	if got.LastStatus != "ok" || got.LastRun == 0 {
		t.Fatalf("runNow 未记录: %+v", got)
	}

	// 删除
	if err := s.Delete(j.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if len(s.List()) != 0 {
		t.Fatal("删除后应为 0")
	}
}

func TestCronValidation(t *testing.T) {
	valid := []string{"0 3 * * *", "*/5 * * * *", "30 2 1 * *", "0 0 * * 0"}
	invalid := []string{"", "60 * * * *", "* * * *", "* 25 * * *", "bad"}
	for _, c := range valid {
		if err := validateCron(c); err != nil {
			t.Fatalf("合法 cron 被拒: %q -> %v", c, err)
		}
	}
	for _, c := range invalid {
		if err := validateCron(c); err == nil {
			t.Fatalf("非法 cron 未被拒: %q", c)
		}
	}
}

func TestCronMatch(t *testing.T) {
	// 每分钟
	if !cronMatches("* * * * *", time.Date(2026, 8, 26, 10, 15, 0, 0, time.Local)) {
		t.Fatal("* * * * * 应总是匹配")
	}
	// 每 5 分钟
	if !cronMatches("*/5 * * * *", time.Date(2026, 8, 26, 10, 15, 0, 0, time.Local)) {
		t.Fatal("10:15 应匹配 */5")
	}
	if cronMatches("*/5 * * * *", time.Date(2026, 8, 26, 10, 17, 0, 0, time.Local)) {
		t.Fatal("10:17 不应匹配 */5")
	}
	// 整点 3 点
	if !cronMatches("0 3 * * *", time.Date(2026, 8, 26, 3, 0, 0, 0, time.Local)) {
		t.Fatal("03:00 应匹配 0 3 * * *")
	}
	if cronMatches("0 3 * * *", time.Date(2026, 8, 26, 4, 0, 0, 0, time.Local)) {
		t.Fatal("04:00 不应匹配 0 3 * * *")
	}
}

func containsStr(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
