package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"
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

// ---- 更新检查(只读: 不下载、不改文件、不重启) ----

type ghAsset struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	URL  string `json:"browser_download_url"`
}

type ghRelease struct {
	TagName   string    `json:"tag_name"`
	Name      string    `json:"name"`
	Body      string    `json:"body"`
	Draft     bool      `json:"draft"`
	Published string    `json:"published_at"`
	Assets    []ghAsset `json:"assets"`
}

// panelGHGet 以面板配置的 token 访问 GitHub API(与插件市场同一套凭据)。
func panelGHGet(path string) ([]byte, error) {
	req, err := http.NewRequest("GET", "https://api.github.com"+path, nil)
	if err != nil {
		return nil, err
	}
	if globalStore != nil {
		if tok := globalStore.Token(); tok != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	cl := &http.Client{Timeout: 20 * time.Second}
	resp, err := cl.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// handlePanelUpdateCheck GET /api/panel/update/check
// 查主面板库 Release 列表与本机 VERSION 比对, 返回每个版本的 tag/更新日志/资产;
// 只读接口 —— 下载与应用是另外的手动接口。
func (s *server) handlePanelUpdateCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	cur := s.panelVersion()
	out := map[string]interface{}{"current": cur, "source": "github", "versions": []map[string]interface{}{}}
	if globalStore == nil {
		writeJSON(w, http.StatusOK, out)
		return
	}
	repo := globalStore.GetConfig().PanelRepo
	if repo.Owner == "" || repo.Repo == "" {
		out["error"] = "未配置面板仓库"
		writeJSON(w, http.StatusOK, out)
		return
	}
	raw, err := panelGHGet(fmt.Sprintf("/repos/%s/%s/releases?per_page=30", repo.Owner, repo.Repo))
	if err != nil {
		out["error"] = err.Error()
		writeJSON(w, http.StatusOK, out)
		return
	}
	var rels []ghRelease
	if err := json.Unmarshal(raw, &rels); err != nil {
		out["error"] = "Release 列表解析失败"
		writeJSON(w, http.StatusOK, out)
		return
	}
	list := []map[string]interface{}{}
	latest := ""
	for _, rel := range rels {
		if rel.Draft {
			continue
		}
		ver := strings.TrimPrefix(rel.TagName, "v")
		if latest == "" {
			latest = ver
		}
		assetName, assetURL := "", ""
		var assetSize int64
		for _, a := range rel.Assets {
			if strings.HasPrefix(a.Name, "raincough-linux-x86_64-") {
				assetName, assetSize, assetURL = a.Name, a.Size, a.URL
				break
			}
		}
		list = append(list, map[string]interface{}{
			"version": ver, "tag": rel.TagName, "notes": rel.Body, "date": rel.Published,
			"asset": assetName, "size_bytes": assetSize, "url": assetURL,
			"installed": ver == cur,
		})
	}
	out["versions"] = list
	out["latest"] = latest
	out["has_update"] = latest != "" && cur != "" && latest != cur
	writeJSON(w, http.StatusOK, out)
}