package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
)

// ---- 面板版本与更新(手动) /api/panel ----
//
// 铁律: 版本号只读自仓库根 VERSION 文件, 代码里不做任何自动递增;
// 面板更新一律手动三步(检查 → 下载并应用 → 由用户确认是否立即重启)。

// panelVersion 本地版本(读 VERSION, 读不到回空串)。
func (s *server) panelVersion() string {
	if s.cfg == nil || s.cfg.BaseDir == "" {
		return ""
	}
	b, err := os.ReadFile(filepath.Join(s.cfg.BaseDir, "VERSION"))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// panelCommit 构建时写入的 git 版本(go build 自动嵌入)。
func panelCommit() string {
	if bi, ok := debug.ReadBuildInfo(); ok {
		for _, kv := range bi.Settings {
			if kv.Key == "vcs.revision" {
				return kv.Value
			}
		}
	}
	return ""
}

// releaseEntry releases.json 里的单条发布记录。
type releaseEntry struct {
	Version       string `json:"version"`
	Tag           string `json:"tag"`
	Asset         string `json:"asset"`
	Date          string `json:"date"`
	Md5           string `json:"md5"`
	Size          int64  `json:"size_bytes"`
	Install       string `json:"install"`
	InstallLatest string `json:"install_latest"`
}

// handlePanelVersion GET /api/panel/version
func (s *server) handlePanelVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	v := s.panelVersion()
	dir := ""
	if s.cfg != nil {
		dir = s.cfg.BaseDir
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"version": v, "commit": panelCommit(), "dir": dir,
	})
}

// handlePanelInstallCommand GET /api/panel/install-command
// 读 BaseDir/releases.json: 返回本版本的独立安装命令与最新版命令(与文档同源)。
func (s *server) handlePanelInstallCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	cur := s.panelVersion()
	out := map[string]interface{}{"version": cur, "entries": []releaseEntry{}}
	if s.cfg == nil || s.cfg.BaseDir == "" {
		writeJSON(w, http.StatusOK, out)
		return
	}
	raw, err := os.ReadFile(filepath.Join(s.cfg.BaseDir, "releases.json"))
	if err != nil {
		writeJSON(w, http.StatusOK, out)
		return
	}
	var f struct {
		Panel []releaseEntry `json:"panel"`
	}
	if err := json.Unmarshal(raw, &f); err != nil {
		writeJSON(w, http.StatusOK, out)
		return
	}
	out["entries"] = f.Panel
	for _, e := range f.Panel {
		if e.InstallLatest != "" {
			out["install_latest"] = e.InstallLatest
		}
		if cur != "" && e.Version == cur {
			out["install"] = e.Install
			out["tag"] = e.Tag
			out["md5"] = e.Md5
			out["size_bytes"] = e.Size
		}
	}
	writeJSON(w, http.StatusOK, out)
}
