package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type panelToken struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Scope   string `json:"scope"` // read | full
	Hash    string `json:"hash"`
	Hint    string `json:"hint"`
	Created int64  `json:"created"`
}

type tokenStore struct {
	mu   sync.Mutex
	path string
	rows []panelToken
}

var panelTokens *tokenStore

func initPanelTokens(dataDir string) {
	t := &tokenStore{path: filepath.Join(dataDir, "tokens.json")}
	if b, err := os.ReadFile(t.path); err == nil {
		_ = json.Unmarshal(b, &t.rows)
	}
	panelTokens = t
}

func (t *tokenStore) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(t.path), 0o700); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(t.rows, "", "  ")
	b = append(b, '\n')
	tmp := t.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, t.path)
}

func tokenHash(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// check 校验 Authorization: Bearer <token>。read 仅允许 GET/HEAD。
func (t *tokenStore) check(r *http.Request) bool {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return false
	}
	raw := strings.TrimSpace(auth[7:])
	if raw == "" {
		return false
	}
	h := tokenHash(raw)
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, row := range t.rows {
		if subtle.ConstantTimeCompare([]byte(h), []byte(row.Hash)) == 1 {
			if row.Scope == "read" && r.Method != http.MethodGet && r.Method != http.MethodHead {
				return false
			}
			return true
		}
	}
	return false
}

func (s *server) handleTokens(w http.ResponseWriter, r *http.Request) {
	if panelTokens == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "Token 存储未初始化"})
		return
	}
	switch r.Method {
	case http.MethodGet:
		panelTokens.mu.Lock()
		rows := make([]map[string]interface{}, 0, len(panelTokens.rows))
		for _, x := range panelTokens.rows {
			rows = append(rows, map[string]interface{}{"id": x.ID, "name": x.Name, "scope": x.Scope, "hint": x.Hint, "created": x.Created})
		}
		panelTokens.mu.Unlock()
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": rows})
	case http.MethodPost:
		var b struct {
			Name  string `json:"name"`
			Scope string `json:"scope"`
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		if b.Scope != "read" && b.Scope != "full" {
			b.Scope = "read"
		}
		b.Name = strings.TrimSpace(b.Name)
		if b.Name == "" {
			b.Name = "token"
		}
		buf := make([]byte, 24)
		if _, err := rand.Read(buf); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		raw := "rcp_" + hex.EncodeToString(buf)
		now := time.Now()
		row := panelToken{ID: "tok_" + now.Format("20060102150405"), Name: b.Name, Scope: b.Scope, Hash: tokenHash(raw), Hint: "****" + raw[len(raw)-4:], Created: now.Unix()}
		panelTokens.mu.Lock()
		panelTokens.rows = append(panelTokens.rows, row)
		err := panelTokens.saveLocked()
		panelTokens.mu.Unlock()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "id": row.ID, "token": raw, "scope": row.Scope})
	case http.MethodDelete:
		var b struct {
			ID string `json:"id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		panelTokens.mu.Lock()
		out := panelTokens.rows[:0]
		for _, x := range panelTokens.rows {
			if x.ID != b.ID {
				out = append(out, x)
			}
		}
		panelTokens.rows = out
		err := panelTokens.saveLocked()
		panelTokens.mu.Unlock()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}
