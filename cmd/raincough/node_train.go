package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

func (s *server) handleNodeTrainState(w http.ResponseWriter, r *http.Request) {
	nid := strings.TrimSpace(r.URL.Query().Get("node_id"))
	n, ok := s.nodeByID(nid)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	resp, err := s.nodeGetRaw(n, "/node/v1/train", 30*time.Second)
	if err != nil {
		writeJSON(w, 502, map[string]interface{}{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(out)
}

func (s *server) nodePostJSON(n Node, path string, body interface{}, timeout time.Duration) (int, []byte, error) {
	b, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", nodeURL(n, path), bytes.NewReader(b))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if n.Token != "" {
		req.Header.Set("Authorization", "Bearer "+n.Token)
	}
	cl := &http.Client{Timeout: timeout}
	resp, err := cl.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, out, nil
}

func (s *server) handleNodeTrainStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		NodeID string                 `json:"node_id"`
		Req    map[string]interface{} `json:"req"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.NodeID == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id required"})
		return
	}
	n, ok := s.nodeByID(b.NodeID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	code, out, err := s.nodePostJSON(n, "/node/v1/train", b.Req, 30*time.Second)
	if err != nil {
		writeJSON(w, 502, map[string]interface{}{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(out)
}

func (s *server) handleNodeTrainStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		NodeID string `json:"node_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.NodeID == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id required"})
		return
	}
	n, ok := s.nodeByID(b.NodeID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	code, out, err := s.nodePostJSON(n, "/node/v1/train/stop", map[string]interface{}{}, 30*time.Second)
	if err != nil {
		writeJSON(w, 502, map[string]interface{}{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(out)
}
