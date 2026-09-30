package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"raincough/internal/core"
	"raincough/internal/shared"
)

// ---- 任务队列: 方法守卫(purge/detail) + GET 列表契约 ----

// tasksTestStore 建临时 sqlite 并把 globalTasks 指向它(测试后还原)。
func tasksTestStore(t *testing.T) {
	t.Helper()
	dsn := "sqlite:///" + filepath.ToSlash(filepath.Join(t.TempDir(), "t.db"))
	sd, err := shared.OpenWithTimeout(dsn, 5*time.Second)
	if err != nil {
		t.Fatalf("open shared: %v", err)
	}
	t.Cleanup(func() { sd.Close() })
	ns, err := sd.Namespace("core_tasks")
	if err != nil {
		t.Fatalf("namespace: %v", err)
	}
	old := globalTasks
	globalTasks = core.NewTaskStore(ns)
	t.Cleanup(func() { globalTasks = old })
}

// tasksDo 以指定方法调用处理器(无请求体)。
func tasksDo(fn func(http.ResponseWriter, *http.Request), method, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	fn(rec, httptest.NewRequest(method, target, nil))
	return rec
}

// TestTaskPurgeMethodGuard 清理只能 POST: GET 不得删除任何任务。
func TestTaskPurgeMethodGuard(t *testing.T) {
	tasksTestStore(t)
	s := &server{}
	id := globalTasks.Begin("probe", "任务A", "backup", nil)
	globalTasks.Finish(id, true, "完成", "", 100)

	rec := tasksDo(s.handleTasksPurge, "GET", "/api/tasks/purge")
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET purge code=%d want 405 body=%s", rec.Code, rec.Body.String())
	}
	if _, ok := globalTasks.Get(id); !ok {
		t.Fatal("GET purge 竟然删掉了任务")
	}

	rec = tasksDo(s.handleTasksPurge, "POST", "/api/tasks/purge")
	if rec.Code != http.StatusOK {
		t.Fatalf("POST purge code=%d body=%s", rec.Code, rec.Body.String())
	}
	if _, ok := globalTasks.Get(id); ok {
		t.Fatal("POST purge 未清理任务")
	}
}

// TestTaskDetailMethodGuard 详情只读: 写方法一律 405, GET 存在 200 / 不存在 404。
func TestTaskDetailMethodGuard(t *testing.T) {
	tasksTestStore(t)
	s := &server{}
	id := globalTasks.Begin("probe", "任务B", "backup", nil)
	globalTasks.Finish(id, true, "完成", "", 100)

	for _, m := range []string{"PUT", "DELETE", "POST"} {
		rec := tasksDo(s.handleTaskDetail, m, "/api/tasks/"+id)
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s detail code=%d want 405 body=%s", m, rec.Code, rec.Body.String())
		}
	}

	rec := tasksDo(s.handleTaskDetail, "GET", "/api/tasks/"+id)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET detail code=%d body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got["name"] != "任务B" {
		t.Fatalf("GET detail 内容不对: %s", rec.Body.String())
	}

	rec = tasksDo(s.handleTaskDetail, "GET", "/api/tasks/no-such-id")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("GET 缺失 id code=%d", rec.Code)
	}
	// 方法守卫先于 id 查询: 写方法对不存在 id 也应 405
	rec = tasksDo(s.handleTaskDetail, "DELETE", "/api/tasks/no-such-id")
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("DELETE 缺失 id code=%d want 405", rec.Code)
	}
}

// TestTasksListContract GET 列表: created 键、limit 解析、默认隐藏已完成。
func TestTasksListContract(t *testing.T) {
	tasksTestStore(t)
	s := &server{}
	id := globalTasks.Begin("store", "安装插件 probe", "install", nil)
	globalTasks.Finish(id, false, "", "安装失败", 0)

	call := func(target string) map[string]interface{} {
		rec := tasksDo(func(w http.ResponseWriter, r *http.Request) { s.handleTasks(w, r) }, "GET", target)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s code=%d body=%s", target, rec.Code, rec.Body.String())
		}
		var d map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &d); err != nil {
			t.Fatalf("GET %s 非 JSON: %s", target, rec.Body.String())
		}
		return d
	}

	d := call("/api/tasks?done=1&limit=1")
	list, _ := d["tasks"].([]interface{})
	if len(list) != 1 {
		t.Fatalf("done=1&limit=1 得到 %d 条", len(list))
	}
	item := list[0].(map[string]interface{})
	for _, k := range []string{"id", "source", "kind", "name", "status", "progress", "message", "error", "created"} {
		if _, ok := item[k]; !ok {
			t.Fatalf("任务缺 %s 键: %v", k, item)
		}
	}
	if item["status"] != "failed" || item["error"] != "安装失败" {
		t.Fatalf("失败任务字段不对: %v", item)
	}
	if d["failed"] != float64(1) || d["total"] != float64(1) {
		t.Fatalf("计数不对: failed=%v total=%v", d["failed"], d["total"])
	}

	// limit 非法: 忽略解析错误, 返回全部(而不是 0 条)
	d = call("/api/tasks?done=1&limit=abc")
	if list, _ = d["tasks"].([]interface{}); len(list) != 1 {
		t.Fatalf("limit=abc 得到 %d 条", len(list))
	}

	// 无参数: 默认隐藏已完成/失败 -> 列表 0 条, 但计数仍在
	d = call("/api/tasks")
	if list, _ = d["tasks"].([]interface{}); len(list) != 0 {
		t.Fatalf("无参默认应不含已完成, 实得 %d 条", len(list))
	}
	if d["failed"] != float64(1) {
		t.Fatalf("无参时计数应仍含 failed=1, 实得 %v", d["failed"])
	}
}
