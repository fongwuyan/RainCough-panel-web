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

type pluginBackupInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Time    int64  `json:"time"`
	Path    string `json:"-"`
}

func (s *server) pluginBackupDir() string { return filepath.Join(s.cfg.PluginsDir, ".backup") }

func validPluginDirName(name string) bool {
	return name != "" && name != "." && name != ".." && !strings.ContainsAny(name, `/\`)
}

func readPluginVersion(dir string) string {
	b, err := os.ReadFile(filepath.Join(dir, "plugin.json"))
	if err != nil {
		return ""
	}
	var m struct {
		Version string `json:"version"`
	}
	_ = json.Unmarshal(b, &m)
	return m.Version
}

func (s *server) listPluginBackups(name string) []pluginBackupInfo {
	root := s.pluginBackupDir()
	ents, _ := os.ReadDir(root)
	out := make([]pluginBackupInfo, 0)
	for _, e := range ents {
		if !e.IsDir() || !strings.HasPrefix(e.Name(), name+"-") {
			continue
		}
		p := filepath.Join(root, e.Name())
		fi, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, pluginBackupInfo{Name: e.Name(), Version: readPluginVersion(p), Time: fi.ModTime().Unix(), Path: p})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Time > out[j].Time })
	return out
}

func (s *server) handlePluginBackups(w http.ResponseWriter, r *http.Request, name string) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "GET required"})
		return
	}
	if !validPluginDirName(name) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "插件名非法"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"plugin": name, "items": s.listPluginBackups(name)})
}

func (s *server) handlePluginRollback(w http.ResponseWriter, r *http.Request, name string) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	if !validPluginDirName(name) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "插件名非法"})
		return
	}
	var b struct {
		Backup string `json:"backup"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	bak := filepath.Base(strings.TrimSpace(b.Backup))
	if !strings.HasPrefix(bak, name+"-") || strings.ContainsAny(bak, `/\`) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "备份名非法"})
		return
	}
	src := filepath.Join(s.pluginBackupDir(), bak)
	if fi, err := os.Stat(src); err != nil || !fi.IsDir() {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "备份不存在"})
		return
	}
	dst := filepath.Join(s.cfg.PluginsDir, name)
	if _, err := os.Stat(dst); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "当前插件目录不存在"})
		return
	}
	// 当前版本移入 .backup，再备份恢复；失败自动回滚
	rollback := filepath.Join(s.pluginBackupDir(), name+"-rollback-"+time.Now().Format("20060102150405"))
	if err := os.Rename(dst, rollback); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "移走当前版本失败: " + err.Error()})
		return
	}
	if err := os.Rename(src, dst); err != nil {
		_ = os.Rename(rollback, dst)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "恢复备份失败: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "plugin": name, "restored": bak, "restart_required": true})
}
