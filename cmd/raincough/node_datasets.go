package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

func (s *server) handleNodeDatasets(w http.ResponseWriter, r *http.Request) {
	nid := strings.TrimSpace(r.URL.Query().Get("node_id"))
	n, ok := s.nodeByID(nid)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	resp, err := s.nodeGetRaw(n, "/node/v1/datasets", 30*time.Second)
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

func (s *server) handleNodeDatasetCreate(w http.ResponseWriter, r *http.Request) {
	var b struct {
		NodeID string `json:"node_id"`
		Name   string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.NodeID == "" || b.Name == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id/name required"})
		return
	}
	n, ok := s.nodeByID(b.NodeID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	code, out, err := s.nodePostJSON(n, "/node/v1/datasets", map[string]interface{}{"name": b.Name}, 30*time.Second)
	if err != nil {
		writeJSON(w, 502, map[string]interface{}{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(out)
}

func (s *server) handleNodeDatasetUpload(w http.ResponseWriter, r *http.Request) {
	var b struct {
		NodeID   string `json:"node_id"`
		Name     string `json:"name"`
		Filename string `json:"filename"`
		ImageB64 string `json:"image_b64"`
		Caption  string `json:"caption"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.NodeID == "" || b.Name == "" || b.ImageB64 == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id/name/image_b64 required"})
		return
	}
	n, ok := s.nodeByID(b.NodeID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	body := map[string]interface{}{"filename": b.Filename, "image_b64": b.ImageB64, "caption": b.Caption}
	code, out, err := s.nodePostJSON(n, "/node/v1/datasets/"+b.Name+"/upload", body, 60*time.Second)
	if err != nil {
		writeJSON(w, 502, map[string]interface{}{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(out)
}

func (s *server) handleNodeDatasetCaption(w http.ResponseWriter, r *http.Request) {
	var b struct {
		NodeID  string `json:"node_id"`
		Name    string `json:"name"`
		File    string `json:"file"`
		Caption string `json:"caption"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.NodeID == "" || b.Name == "" || b.File == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id/name/file required"})
		return
	}
	n, ok := s.nodeByID(b.NodeID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	code, out, err := s.nodePostJSON(n, "/node/v1/datasets/"+b.Name+"/caption",
		map[string]interface{}{"file": b.File, "caption": b.Caption}, 30*time.Second)
	if err != nil {
		writeJSON(w, 502, map[string]interface{}{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(out)
}

func (s *server) handleNodeDatasetDelete(w http.ResponseWriter, r *http.Request) {
	var b struct {
		NodeID string `json:"node_id"`
		Name   string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.NodeID == "" || b.Name == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "node_id/name required"})
		return
	}
	n, ok := s.nodeByID(b.NodeID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	code, out, err := s.nodePostJSON(n, "/node/v1/datasets/"+b.Name+"/delete", map[string]interface{}{}, 30*time.Second)
	if err != nil {
		writeJSON(w, 502, map[string]interface{}{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(out)
}
