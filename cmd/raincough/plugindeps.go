package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type dependencyInfo struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Optional  bool   `json:"optional"`
	Installed string `json:"installed"`
	Status    string `json:"status"`
}

type pluginDepsInfo struct {
	Name         string           `json:"name"`
	Version      string           `json:"version"`
	Dependencies []dependencyInfo `json:"dependencies"`
}

func parseDep(raw interface{}) (name, version string, optional bool) {
	switch v := raw.(type) {
	case string:
		return v, "", false
	case map[string]interface{}:
		if n, ok := v["name"].(string); ok {
			name = n
		}
		if ver, ok := v["version"].(string); ok {
			version = ver
		}
		if b, ok := v["optional"].(bool); ok {
			optional = b
		}
	}
	return
}

func (s *server) handlePluginDeps(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "GET required"})
		return
	}
	installed := map[string]string{}
	ents, _ := os.ReadDir(s.cfg.PluginsDir)
	for _, e := range ents {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		installed[e.Name()] = readPluginVersion(filepath.Join(s.cfg.PluginsDir, e.Name()))
	}
	out := make([]pluginDepsInfo, 0)
	issues := 0
	for _, e := range ents {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(s.cfg.PluginsDir, e.Name(), "plugin.json"))
		if err != nil {
			continue
		}
		var m struct {
			Name         string        `json:"name"`
			Version      string        `json:"version"`
			Dependencies []interface{} `json:"dependencies"`
		}
		if json.Unmarshal(b, &m) != nil {
			continue
		}
		info := pluginDepsInfo{Name: e.Name(), Version: m.Version, Dependencies: []dependencyInfo{}}
		for _, raw := range m.Dependencies {
			n, ver, opt := parseDep(raw)
			if n == "" {
				continue
			}
			d := dependencyInfo{Name: n, Version: ver, Optional: opt, Installed: installed[n]}
			switch {
			case installed[n] == "":
				if opt {
					d.Status = "optional_missing"
				} else {
					d.Status = "missing"
					issues++
				}
			case ver != "" && installed[n] != ver:
				d.Status = "version_mismatch"
				issues++
			default:
				d.Status = "ok"
			}
			info.Dependencies = append(info.Dependencies, d)
		}
		out = append(out, info)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	writeJSON(w, http.StatusOK, map[string]interface{}{"plugins": out, "issues": issues})
}
