package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"raincough/internal/core"
)

// globalBkp 系统备份管理器(core_backup namespace + 任务队列进度)。
var globalBkp *core.BackupManager

// handleBackup 系统备份路由分发 /api/sysfunc/backup/*。
func (s *server) handleBackup(w http.ResponseWriter, r *http.Request) {
	if globalBkp == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "备份模块未初始化"})
		return
	}
	sub := strings.TrimPrefix(r.URL.Path, "/api/sysfunc/backup/")

	switch {
	// 任务列表 / 新建
	case sub == "jobs" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"jobs": globalBkp.ListJobs()})
	case sub == "jobs" && r.Method == http.MethodPost:
		var job core.BackupJob
		if err := json.NewDecoder(r.Body).Decode(&job); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if err := globalBkp.CreateJob(job); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	// 更新(部分字段合并, body 含 name)
	case sub == "jobs/update" && r.Method == http.MethodPost:
		var patch map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		name, _ := patch["name"].(string)
		if err := globalBkp.UpdateJob(name, patch); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	// 删除任务
	case sub == "jobs/delete" && r.Method == http.MethodPost:
		var b struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if err := globalBkp.DeleteJob(b.Name); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	// 立即执行
	case sub == "jobs/run" && r.Method == http.MethodPost:
		var b struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if err := globalBkp.RunNow(b.Name); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	// 运行历史
	case sub == "runs" && r.Method == http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"runs": globalBkp.Runs()})

	// 删除归档
	case sub == "runs/delete" && r.Method == http.MethodPost:
		var b struct {
			File string `json:"file"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if err := globalBkp.DeleteRun(b.File); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})

	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "unsupported: " + r.Method + " /api/sysfunc/backup/" + sub})
	}
}
