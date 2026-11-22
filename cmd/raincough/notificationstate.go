package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

func (s *server) notificationStatePath() string {
	return filepath.Join(s.cfg.DataDir, "notification-read.json")
}

func (s *server) handleNotificationState(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		keys := []string{}
		if b, err := os.ReadFile(s.notificationStatePath()); err == nil {
			_ = json.Unmarshal(b, &keys)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"keys": keys})
	case http.MethodPost:
		var b struct {
			Keys []string `json:"keys"`
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if len(b.Keys) > 5000 {
			b.Keys = b.Keys[:5000]
		}
		out, _ := json.MarshalIndent(b.Keys, "", "  ")
		out = append(out, '\n')
		if err := os.MkdirAll(filepath.Dir(s.notificationStatePath()), 0o755); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		tmp := s.notificationStatePath() + ".tmp"
		if err := os.WriteFile(tmp, out, 0o600); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		if err := os.Rename(tmp, s.notificationStatePath()); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "count": len(b.Keys)})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}
