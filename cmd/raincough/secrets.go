package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type secretRec struct {
	ID      string `json:"id"`
	Plugin  string `json:"plugin"`
	Name    string `json:"name"`
	Value   string `json:"value"`
	Updated int64  `json:"updated"`
}

type secretView struct {
	ID      string `json:"id"`
	Plugin  string `json:"plugin"`
	Name    string `json:"name"`
	Hint    string `json:"hint"`
	Updated int64  `json:"updated"`
}

func (s *server) secretPath() string {
	return filepath.Join(s.cfg.BaseDir, "data", "secrets.json")
}

func (s *server) loadSecrets() []secretRec {
	b, err := os.ReadFile(s.secretPath())
	if err != nil {
		return nil
	}
	var rows []secretRec
	_ = json.Unmarshal(b, &rows)
	return rows
}

func (s *server) saveSecrets(rows []secretRec) error {
	if err := os.MkdirAll(filepath.Dir(s.secretPath()), 0o700); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(rows, "", "  ")
	b = append(b, '\n')
	tmp := s.secretPath() + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.secretPath())
}

func maskSecret(v string) string {
	if len(v) <= 4 {
		return "****"
	}
	return "****" + v[len(v)-4:]
}

func (s *server) handleSecrets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rows := s.loadSecrets()
		out := make([]secretView, 0, len(rows))
		for _, x := range rows {
			out = append(out, secretView{ID: x.ID, Plugin: x.Plugin, Name: x.Name, Hint: maskSecret(x.Value), Updated: x.Updated})
		}
		sort.Slice(out, func(i, j int) bool { return out[i].Updated > out[j].Updated })
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": out})
	case http.MethodPost:
		var b struct {
			ID     string `json:"id"`
			Plugin string `json:"plugin"`
			Name   string `json:"name"`
			Value  string `json:"value"`
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		b.Plugin = strings.TrimSpace(b.Plugin)
		b.Name = strings.TrimSpace(b.Name)
		if b.Plugin == "" || b.Name == "" || strings.ContainsAny(b.Plugin+b.Name, `/\`) {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "plugin/name 必填且不能包含路径分隔符"})
			return
		}
		if b.Value == "" || len(b.Value) > 16384 {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "value 为空或过长"})
			return
		}
		rows := s.loadSecrets()
		if b.ID == "" {
			b.ID = "sec_" + time.Now().Format("20060102150405")
		}
		found := false
		for i := range rows {
			if rows[i].ID == b.ID {
				rows[i].Plugin, rows[i].Name, rows[i].Value, rows[i].Updated = b.Plugin, b.Name, b.Value, time.Now().Unix()
				found = true
				break
			}
		}
		if !found {
			rows = append(rows, secretRec{ID: b.ID, Plugin: b.Plugin, Name: b.Name, Value: b.Value, Updated: time.Now().Unix()})
		}
		if err := s.saveSecrets(rows); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "id": b.ID})
	case http.MethodDelete:
		var b struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		rows := s.loadSecrets()
		out := rows[:0]
		for _, x := range rows {
			if x.ID != b.ID {
				out = append(out, x)
			}
		}
		if err := s.saveSecrets(out); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}
