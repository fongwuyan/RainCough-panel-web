package main

import (
	"encoding/json"
	"net/http"

	"raincough/internal/core"
)

// 全局任务存储(在 main 中初始化)。插件安装、文件批量操作共用。
var globalTasks *core.TaskStore

// ---- 任务队列 /api/tasks ----

func (s *server) handleTasks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		includeDone := r.URL.Query().Get("include_done") == "1"
		if r.URL.Query().Get("done") == "0" {
			includeDone = false
		} else if r.URL.Query().Get("done") == "1" {
			includeDone = true
		}
		limit := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			var n int
			if _, err := fmtSscan(v, &n); err == nil {
				limit = n
			}
		}
		// 兼容前端 t.created 键: 序列化为 created 副本
		tasks := globalTasks.List(includeDone, limit)
		outTasks := make([]map[string]interface{}, 0, len(tasks))
		for _, t := range tasks {
			m := map[string]interface{}{
				"id": t.ID, "source": t.Source, "kind": t.Kind, "name": t.Name,
				"status": t.Status, "phase": t.Phase, "progress": t.Progress,
				"message": t.Message, "error": t.Error,
				"created": t.CreatedAt, "created_at": t.CreatedAt, "updated_at": t.UpdatedAt,
				"meta": t.Meta,
			}
			outTasks = append(outTasks, m)
		}
		cnt := globalTasks.Count()
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"tasks":   outTasks,
			"count":   cnt,
			"total":   cnt["done"] + cnt["failed"] + cnt["queued"] + cnt["running"],
			"running": cnt["running"], "queued": cnt["queued"],
			"failed": cnt["failed"], "done": cnt["done"],
		})
	case http.MethodPost:
		var b struct {
			Action string                 `json:"action"`
			Source string                 `json:"source"`
			Name   string                 `json:"name"`
			Kind   string                 `json:"kind"`
			Meta   map[string]interface{} `json:"meta"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if b.Action == "clear_done" {
			n := globalTasks.Cleanup(0)
			writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "removed": n})
			return
		}
		// 其他 action 暂不支持
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "unsupported action"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

func (s *server) handleTaskDetail(w http.ResponseWriter, r *http.Request) {
	// 只读详情: 显式拒绝写方法(原先 PUT/DELETE 也会 200 返回任务体)。
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	id := r.URL.Path[len("/api/tasks/"):]
	t, ok := globalTasks.Get(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "任务不存在"})
		return
	}
	writeJSON(w, http.StatusOK, t)
}

// fmtSscan 单参数整数解析(替代 fmt.Sscanf 多返回值麻烦)。
func fmtSscan(s string, n *int) (int, error) {
	v := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, errNotInt
		}
		v = v*10 + int(c-'0')
	}
	*n = v
	return 1, nil
}

var errNotInt = &numErr{}

type numErr struct{}

func (e *numErr) Error() string { return "not an integer" }
