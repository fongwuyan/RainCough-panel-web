package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// pluginConfigPath 只允许已安装插件根目录下的 config.json，阻止路径穿越。
func (s *server) pluginConfigPath(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, `/\`) {
		return "", fmt.Errorf("插件名非法")
	}
	dir := filepath.Join(s.cfg.PluginsDir, name)
	fi, err := os.Stat(dir)
	if err != nil || !fi.IsDir() {
		return "", fmt.Errorf("插件不存在: %s", name)
	}
	return filepath.Join(dir, "config.json"), nil
}

// handlePluginConfig GET ?plugin= / POST {plugin, config}
func (s *server) handlePluginConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		name := r.URL.Query().Get("plugin")
		p, err := s.pluginConfigPath(name)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		b, err := os.ReadFile(p)
		if os.IsNotExist(err) {
			writeJSON(w, http.StatusOK, map[string]interface{}{"plugin": name, "exists": false, "config": map[string]interface{}{}})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		var v interface{}
		if err := json.Unmarshal(b, &v); err != nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{"plugin": name, "exists": true, "invalid_json": true, "text": string(b)})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"plugin": name, "exists": true, "config": v})
	case http.MethodPost:
		var b struct {
			Plugin string          `json:"plugin"`
			Config json.RawMessage `json:"config"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
			return
		}
		p, err := s.pluginConfigPath(b.Plugin)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		if len(b.Config) == 0 || len(b.Config) > 1<<20 {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "config 为空或超过 1MB"})
			return
		}
		var obj interface{}
		if err := json.Unmarshal(b.Config, &obj); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "config 不是合法 JSON: " + err.Error()})
			return
		}
		pretty, _ := json.MarshalIndent(obj, "", "  ")
		pretty = append(pretty, '\n')
		tmp := p + ".tmp"
		if err := os.WriteFile(tmp, pretty, 0o600); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		if err := os.Rename(tmp, p); err != nil {
			_ = os.Remove(tmp)
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "plugin": b.Plugin, "path": p})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

// handlePluginConfigList GET /api/plugin-config/list — 只列有 config.json 或目录存在的插件。
func (s *server) handlePluginConfigList(w http.ResponseWriter, r *http.Request) {
	ents, _ := os.ReadDir(s.cfg.PluginsDir)
	out := make([]map[string]interface{}, 0, len(ents))
	for _, e := range ents {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		p := filepath.Join(s.cfg.PluginsDir, e.Name(), "config.json")
		_, err := os.Stat(p)
		out = append(out, map[string]interface{}{"name": e.Name(), "has_config": err == nil})
	}
	sort.Slice(out, func(i, j int) bool { return out[i]["name"].(string) < out[j]["name"].(string) })
	writeJSON(w, http.StatusOK, map[string]interface{}{"plugins": out})
}
