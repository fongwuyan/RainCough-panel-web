package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"raincough/internal/shared"
)

// 终端主机/常用命令 CRUD(旧前端 api.js 契约), 存 SharedData core_terminal namespace。
var termNS *shared.Namespace

func initTermNS(sd *shared.Shared) {
	ns, err := sd.Namespace("core_terminal")
	if err == nil {
		termNS = ns
	}
}

func termGet(key string, def []map[string]interface{}) []map[string]interface{} {
	if termNS == nil {
		return def
	}
	v, ok, err := termNS.Get(key)
	if err != nil || !ok {
		return def
	}
	if arr, ok := v.([]interface{}); ok {
		out := make([]map[string]interface{}, 0, len(arr))
		for _, item := range arr {
			if m, ok := item.(map[string]interface{}); ok {
				out = append(out, m)
			}
		}
		return out
	}
	return def
}

func termSave(key string, list []map[string]interface{}) {
	if termNS != nil {
		termNS.Set(key, list)
	}
}

// ---- /api/terminal/hosts CRUD ----

func (s *server) handleTermHosts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, termGet("hosts", nil))
	case http.MethodPost:
		var h map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&h); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		list := termGet("hosts", nil)
		host := str(h, "host")
		if host == "" {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "host 必填"})
			return
		}
		for _, item := range list {
			if str(item, "host") == host {
				writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "主机已存在"})
				return
			}
		}
		list = append(list, h)
		termSave("hosts", list)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "hosts": list})
	case http.MethodPut:
		var h map[string]interface{}
		json.NewDecoder(r.Body).Decode(&h)
		old := str(h, "old_host")
		list := termGet("hosts", nil)
		for i, item := range list {
			if str(item, "host") == old {
				h["old_host"] = old
				list[i] = h
			}
		}
		termSave("hosts", list)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "hosts": list})
	case http.MethodDelete:
		host := r.URL.Query().Get("host")
		list := termGet("hosts", nil)
		out := list[:0]
		for _, item := range list {
			if str(item, "host") != host {
				out = append(out, item)
			}
		}
		termSave("hosts", out)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "hosts": out})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

// ---- /api/terminal/commands CRUD ----

func (s *server) handleTermCommands(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, termGet("commands", nil))
	case http.MethodPost:
		var c map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		title := str(c, "title")
		if title == "" || str(c, "shell") == "" {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "title 与 shell 必填"})
			return
		}
		list := termGet("commands", nil)
		for _, item := range list {
			if str(item, "title") == title {
				writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "命令已存在"})
				return
			}
		}
		list = append(list, c)
		termSave("commands", list)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "commands": list})
	case http.MethodPut:
		var c map[string]interface{}
		json.NewDecoder(r.Body).Decode(&c)
		old := str(c, "old_title")
		list := termGet("commands", nil)
		for i, item := range list {
			if str(item, "title") == old {
				list[i] = c
			}
		}
		termSave("commands", list)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "commands": list})
	case http.MethodDelete:
		title := r.URL.Query().Get("title")
		list := termGet("commands", nil)
		out := list[:0]
		for _, item := range list {
			if str(item, "title") != title {
				out = append(out, item)
			}
		}
		termSave("commands", out)
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "commands": out})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

// handleTermHostsSetSort POST /api/terminal/hosts/set_sort {hosts:[...]} 保存主机排序
func (s *server) handleTermHostsSetSort(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Hosts []map[string]interface{} `json:"hosts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if b.Hosts == nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "hosts 必填"})
		return
	}
	termSave("hosts", b.Hosts)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "hosts": b.Hosts})
}

func str(m map[string]interface{}, k string) string {
	if v, ok := m[k].(string); ok {
		return strings.TrimSpace(v)
	}
	return ""
}