package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

type scheduledJob struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Action      string `json:"action"`
	IntervalSec int64  `json:"interval_sec"`
	KeepDays    int    `json:"keep_days,omitempty"`
	Enabled     bool   `json:"enabled"`
	LastRun     int64  `json:"last_run"`
	NextRun     int64  `json:"next_run"`
	LastError   string `json:"last_error"`
}

var scheduleMu sync.Mutex

func (s *server) schedulePath() string { return filepath.Join(s.cfg.DataDir, "schedules.json") }

func (s *server) loadSchedules() []scheduledJob {
	b, err := os.ReadFile(s.schedulePath())
	if err != nil {
		return nil
	}
	var rows []scheduledJob
	_ = json.Unmarshal(b, &rows)
	return rows
}

func (s *server) saveSchedules(rows []scheduledJob) error {
	if err := os.MkdirAll(s.cfg.DataDir, 0o755); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(rows, "", "  ")
	b = append(b, '\n')
	tmp := s.schedulePath() + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.schedulePath())
}

func (s *server) startScheduler() {
	if s == nil || s.cfg == nil {
		return
	}
	go func() {
		t := time.NewTicker(30 * time.Second)
		defer t.Stop()
		for range t.C {
			s.runDueSchedules()
		}
	}()
}

func (s *server) runDueSchedules() {
	scheduleMu.Lock()
	rows := s.loadSchedules()
	changed := false
	now := time.Now().Unix()
	for i := range rows {
		j := &rows[i]
		if !j.Enabled || j.IntervalSec < 30 || j.NextRun > now {
			continue
		}
		// 先推进下次时间，避免执行失败导致每 30 秒重试风暴
		j.NextRun = now + j.IntervalSec
		j.LastRun = now
		j.LastError = ""
		changed = true
		go s.runScheduleJob(j.ID)
	}
	if changed {
		_ = s.saveSchedules(rows)
	}
	scheduleMu.Unlock()
}

func (s *server) runScheduleJob(id string) {
	scheduleMu.Lock()
	rows := s.loadSchedules()
	var job *scheduledJob
	for i := range rows {
		if rows[i].ID == id {
			job = &rows[i]
			break
		}
	}
	scheduleMu.Unlock()
	if job == nil {
		return
	}
	var err error
	switch job.Action {
	case "backup":
		_, err = s.createBackup()
	case "trash_cleanup":
		err = s.cleanupTrash(job.KeepDays)
	default:
		err = nil
	}
	scheduleMu.Lock()
	rows = s.loadSchedules()
	for i := range rows {
		if rows[i].ID == id {
			if err != nil {
				rows[i].LastError = err.Error()
			} else {
				rows[i].LastError = ""
			}
			break
		}
	}
	_ = s.saveSchedules(rows)
	scheduleMu.Unlock()
}

func (s *server) cleanupTrash(keepDays int) error {
	if keepDays <= 0 {
		keepDays = 30
	}
	cutoff := time.Now().Add(-time.Duration(keepDays) * 24 * time.Hour).Unix()
	ents, err := os.ReadDir(s.fmTrashRoot())
	if err != nil {
		return nil
	}
	for _, e := range ents {
		if !e.IsDir() {
			continue
		}
		p := filepath.Join(s.fmTrashRoot(), e.Name())
		mp := filepath.Join(p, "meta.json")
		b, err := os.ReadFile(mp)
		if err != nil {
			continue
		}
		var m struct {
			DeletedAt int64 `json:"deleted_at"`
		}
		if json.Unmarshal(b, &m) == nil && m.DeletedAt < cutoff {
			_ = os.RemoveAll(p)
		}
	}
	return nil
}

func (s *server) handleSchedules(w http.ResponseWriter, r *http.Request) {
	scheduleMu.Lock()
	defer scheduleMu.Unlock()
	rows := s.loadSchedules()
	switch r.Method {
	case http.MethodGet:
		sort.Slice(rows, func(i, j int) bool { return rows[i].Name < rows[j].Name })
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": rows})
	case http.MethodPost:
		var b struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Action      string `json:"action"`
			IntervalSec int64  `json:"interval_sec"`
			KeepDays    int    `json:"keep_days"`
			Enabled     *bool  `json:"enabled"`
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if b.Action != "backup" && b.Action != "trash_cleanup" {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "action 仅支持 backup / trash_cleanup"})
			return
		}
		if b.IntervalSec < 30 {
			b.IntervalSec = 3600
		}
		enabled := true
		if b.Enabled != nil {
			enabled = *b.Enabled
		}
		if b.ID == "" {
			b.ID = "job_" + time.Now().Format("20060102150405")
		}
		found := false
		for i := range rows {
			if rows[i].ID == b.ID {
				rows[i].Name, rows[i].Action, rows[i].IntervalSec, rows[i].KeepDays, rows[i].Enabled = b.Name, b.Action, b.IntervalSec, b.KeepDays, enabled
				rows[i].NextRun = time.Now().Unix() + b.IntervalSec
				found = true
				break
			}
		}
		if !found {
			rows = append(rows, scheduledJob{ID: b.ID, Name: b.Name, Action: b.Action, IntervalSec: b.IntervalSec, KeepDays: b.KeepDays, Enabled: enabled, NextRun: time.Now().Unix() + b.IntervalSec})
		}
		if err := s.saveSchedules(rows); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "id": b.ID})
	case http.MethodDelete:
		var b struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		out := rows[:0]
		for _, x := range rows {
			if x.ID != b.ID {
				out = append(out, x)
			}
		}
		_ = s.saveSchedules(out)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

func (s *server) handleScheduleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(r.Body).Decode(&b)
	if b.ID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "缺少 id"})
		return
	}
	go s.runScheduleJob(b.ID)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}
