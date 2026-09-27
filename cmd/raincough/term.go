package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"raincough/internal/core"
)

// 全局终端管理器(main 中初始化)。
var globalTerm *core.TermManager

// handleTermOpen POST /api/terminal/open -> {"sid": "tN"}
func (s *server) handleTermOpen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Rows int `json:"rows"`
		Cols int `json:"cols"`
	}
	_ = json.NewDecoder(r.Body).Decode(&b)
	sess, err := globalTerm.Open(b.Rows, b.Cols)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"sid": sess.ID})
}

// handleTermStream GET /api/terminal/stream?sid=.. => SSE
func (s *server) handleTermStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "GET required"})
		return
	}
	sid := r.URL.Query().Get("sid")
	sess, ok := globalTerm.Get(sid)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "会话不存在"})
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "不支持 SSE"})
		return
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	disconnect := r.Context().Done()
	// 事件驱动推送: 会话有新输出/关闭即刻唤醒(旧实现 1s 轮询 → 回显最多延迟 1 秒,
	// 表现为"输入缓慢、回显一顿一顿"); 15s 注释心跳保活, 防代理/浏览器空闲掐线。
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		chunks, _, closed := sess.DrainAll()
		for _, c := range chunks {
			fmt.Fprintf(w, "data: %s\n\n", c)
		}
		if closed {
			fmt.Fprintf(w, "event: closed\ndata: {}\n\n")
			flusher.Flush()
			return
		}
		flusher.Flush()

		select {
		case <-disconnect:
			return
		case <-sess.Notify():
			// 新输出/关闭 → 立刻进入下一轮 drain(零等待)
		case <-heartbeat.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}

// handleTermInput POST /api/terminal/input {sid, data(base64)}
func (s *server) handleTermInput(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		SID  string `json:"sid"`
		Data string `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	sess, ok := globalTerm.Get(b.SID)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "会话不存在"})
		return
	}
	raw, err := base64.StdEncoding.DecodeString(b.Data)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "data 需为 base64"})
		return
	}
	if err := sess.Write(raw); err != nil {
		writeJSON(w, http.StatusGone, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleTermResize POST /api/terminal/resize {sid, rows, cols}
func (s *server) handleTermResize(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		SID  string `json:"sid"`
		Rows int    `json:"rows"`
		Cols int    `json:"cols"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	sess, ok := globalTerm.Get(b.SID)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "会话不存在"})
		return
	}
	if err := sess.Resize(b.Rows, b.Cols); err != nil {
		writeJSON(w, http.StatusGone, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}

// handleTermClose POST /api/terminal/close {sid}
func (s *server) handleTermClose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		SID string `json:"sid"`
	}
	_ = json.NewDecoder(r.Body).Decode(&b)
	globalTerm.Close(b.SID)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true})
}
