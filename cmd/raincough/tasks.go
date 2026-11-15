package main

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

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

		tasks := globalTasks.List(includeDone, 0)
		outTasks := make([]map[string]interface{}, 0, len(tasks)+32)
		for _, t := range tasks {
			outTasks = append(outTasks, map[string]interface{}{
				"id": t.ID, "source": t.Source, "kind": t.Kind, "name": t.Name,
				"status": t.Status, "phase": t.Phase, "progress": t.Progress,
				"message": t.Message, "error": t.Error,
				"created": t.CreatedAt, "created_at": t.CreatedAt, "updated_at": t.UpdatedAt,
				"meta": t.Meta,
			})
		}

		// 插件提供的任务（JMComic 下载等）。插件离线时不影响核心任务。
		for _, m := range s.externalTasks() {
			status, _ := m["status"].(string)
			if !includeDone && (status == "done" || status == "failed") {
				continue
			}
			outTasks = append(outTasks, m)
		}

		// 统一按创建时间倒序；外部任务 ID 与核心 ID 不会冲突。
		sort.SliceStable(outTasks, func(i, j int) bool {
			return asInt64(outTasks[i]["created_at"]) > asInt64(outTasks[j]["created_at"])
		})
		if limit > 0 && len(outTasks) > limit {
			outTasks = outTasks[:limit]
		}

		cnt := map[string]int{"queued": 0, "running": 0, "done": 0, "failed": 0}
		for _, m := range outTasks {
			if st, ok := m["status"].(string); ok {
				if _, exists := cnt[st]; exists {
					cnt[st]++
				}
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"tasks":   outTasks,
			"count":   cnt,
			"total":   len(outTasks),
			"running": cnt["running"], "queued": cnt["queued"],
			"failed": cnt["failed"], "done": cnt["done"],
		})
	case http.MethodPost:
		var b struct {
			Action string                 `json:"action"`
			ID     string                 `json:"id"`
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
			n := s.clearExternalTasks(globalTasks.Cleanup(0))
			writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "removed": n})
			return
		}
		if b.Action == "retry" || b.Action == "resume" {
			if !strings.HasPrefix(b.ID, "jmcomic-dl-") || globalPX == nil {
				writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "不支持的任务"})
				return
			}
			raw, err := globalPX.InvokeAsUI("jmcomic.tasks.retry",
				map[string]interface{}{"id": b.ID}, 5000*time.Millisecond)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "result": raw})
			return
		}
		// 其他 action 暂不支持
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "unsupported action"})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

// clearExternalTasks 清理插件侧已完成/失败任务记录，返回额外清理数量。
func (s *server) clearExternalTasks(n int) int {
	if globalPX == nil {
		return n
	}
	ext, err := globalPX.InvokeAsUI("jmcomic.tasks.clear", map[string]interface{}{}, 3000*time.Millisecond)
	if err != nil {
		return n
	}
	if m, ok := ext.(map[string]interface{}); ok {
		if v, ok := m["removed"].(float64); ok {
			n += int(v)
		}
	}
	return n
}

// externalTasks 拉取插件提供的任务（目前只有 JMComic 下载器）。
// 插件离线、接口未注册或超时都会静默忽略，不影响核心任务列表。
func (s *server) externalTasks() []map[string]interface{} {
	if globalPX == nil || !globalPX.HasPlugin("JMComic") {
		return nil
	}
	raw, err := globalPX.InvokeAsUI("jmcomic.tasks.list", map[string]interface{}{}, 2500*time.Millisecond)
	if err != nil {
		return nil
	}
	m, ok := raw.(map[string]interface{})
	if !ok {
		return nil
	}
	list, _ := m["tasks"].([]interface{})
	out := make([]map[string]interface{}, 0, len(list))
	for _, item := range list {
		if t, ok := item.(map[string]interface{}); ok {
			out = append(out, t)
		}
	}
	return out
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

// asInt64 兼容核心任务的 int64 与插件 JSON 解出的 float64。
func asInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case int:
		return int64(n)
	case float64:
		return int64(n)
	default:
		return 0
	}
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
