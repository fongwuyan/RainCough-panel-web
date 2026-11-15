package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

func (s *server) nodeByID(id string) (Node, bool) {
	nodes, err := s.loadNodes()
	if err != nil {
		return Node{}, false
	}
	for _, n := range nodes {
		if n.ID == id {
			return n, true
		}
	}
	return Node{}, false
}

// handleNodeJobs POST /api/node-jobs  {node_id, kind, payload}
func (s *server) handleNodeJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		NodeID  string                 `json:"node_id"`
		Kind    string                 `json:"kind"`
		Payload map[string]interface{} `json:"payload"`
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
	if b.Kind == "" {
		b.Kind = "image"
	}
	body, _ := json.Marshal(map[string]interface{}{"kind": b.Kind, "payload": b.Payload})
	req, err := http.NewRequest("POST", nodeURL(n, "/node/v1/jobs"), bytes.NewReader(body))
	if err != nil {
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if n.Token != "" {
		req.Header.Set("Authorization", "Bearer "+n.Token)
	}
	cl := &http.Client{Timeout: 30 * time.Second}
	resp, err := cl.Do(req)
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

func (s *server) nodeGetRaw(n Node, path string, timeout time.Duration) (*http.Response, error) {
	req, err := http.NewRequest("GET", nodeURL(n, path), nil)
	if err != nil {
		return nil, err
	}
	if n.Token != "" {
		req.Header.Set("Authorization", "Bearer "+n.Token)
	}
	cl := &http.Client{Timeout: timeout}
	return cl.Do(req)
}

// handleNodeJobStatus GET /api/node-jobs/status?node_id=&job_id=
func (s *server) handleNodeJobStatus(w http.ResponseWriter, r *http.Request) {
	nid := strings.TrimSpace(r.URL.Query().Get("node_id"))
	jid := strings.TrimSpace(r.URL.Query().Get("job_id"))
	if nid == "" || jid == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id/job_id required"})
		return
	}
	n, ok := s.nodeByID(nid)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	resp, err := s.nodeGetRaw(n, "/node/v1/jobs/"+jid, 20*time.Second)
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

// handleNodeJobCancel POST /api/node-jobs/cancel?node_id=&job_id=
func (s *server) handleNodeJobCancel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	q := r.URL.Query()
	nid, jid := q.Get("node_id"), q.Get("job_id")
	if nid == "" || jid == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id/job_id required"})
		return
	}
	n, ok := s.nodeByID(nid)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	req, err := http.NewRequest("POST", nodeURL(n, "/node/v1/jobs/"+jid+"/cancel"), nil)
	if err != nil {
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	if n.Token != "" {
		req.Header.Set("Authorization", "Bearer "+n.Token)
	}
	cl := &http.Client{Timeout: 30 * time.Second}
	resp, err := cl.Do(req)
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

// handleNodeModels GET /api/node-jobs/models?node_id=
func (s *server) handleNodeModels(w http.ResponseWriter, r *http.Request) {
	nid := strings.TrimSpace(r.URL.Query().Get("node_id"))
	n, ok := s.nodeByID(nid)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	resp, err := s.nodeGetRaw(n, "/node/v1/models", 30*time.Second)
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

// handleNodeJobImage GET /api/node-jobs/image?node_id=&job_id=&idx=
func (s *server) handleNodeJobImage(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	nid, jid := q.Get("node_id"), q.Get("job_id")
	idx := q.Get("idx")
	if idx == "" {
		idx = "0"
	}
	n, ok := s.nodeByID(nid)
	if !ok {
		http.NotFound(w, r)
		return
	}
	resp, err := s.nodeGetRaw(n, "/node/v1/jobs/"+jid+"/images/"+idx, 30*time.Second)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		http.Error(w, "node image error", resp.StatusCode)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "private, max-age=600")
	_, _ = io.Copy(w, resp.Body)
}
