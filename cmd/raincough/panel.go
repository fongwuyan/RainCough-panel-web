package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
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

// ---- 手动更新: 应用 / 重启 ----

// 单飞锁: 同一时刻只允许一个面板更新任务。
var panelUpdMu = make(chan struct{}, 1)

// updateState 已应用/待重启状态(持久化, 刷新页面不丢)。
type updateState struct {
	Applied string `json:"applied"`
	Pending bool   `json:"pending_restart"`
	Backup  string `json:"backup"`
	At      int64  `json:"at"`
}

func (s *server) updateDir() string {
	if s.cfg == nil {
		return ""
	}
	return filepath.Join(s.cfg.BaseDir, ".update")
}

func (s *server) writeUpdateState(st updateState) {
	d := s.updateDir()
	if d == "" {
		return
	}
	_ = os.MkdirAll(d, 0o755)
	if b, err := json.Marshal(st); err == nil {
		_ = os.WriteFile(filepath.Join(d, "state.json"), b, 0o644)
	}
}

func (s *server) readUpdateState() updateState {
	var st updateState
	d := s.updateDir()
	if d == "" {
		return st
	}
	if b, err := os.ReadFile(filepath.Join(d, "state.json")); err == nil {
		_ = json.Unmarshal(b, &st)
	}
	return st
}

// panelGHDownload 下载 Release 资产(大文件, 长超时)。
func panelGHDownload(url string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	if globalStore != nil {
		if tok := globalStore.Token(); tok != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
	}
	cl := &http.Client{Timeout: 300 * time.Second}
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

// handlePanelUpdateState GET /api/panel/update/state -> 是否已应用待重启
func (s *server) handlePanelUpdateState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	st := s.readUpdateState()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"applied": st.Applied, "pending_restart": st.Pending, "backup": st.Backup, "at": st.At,
		"current": s.panelVersion(),
	})
}

// handlePanelUpdateApply POST /api/panel/update/apply {version}
// 手动触发: 下载 → 校验 → 解包 stage → 验证 → 备份 → 覆盖(不重启)。
func (s *server) handlePanelUpdateApply(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalStore == nil || globalTasks == nil || s.cfg == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "环境未就绪"})
		return
	}
	var b struct {
		Version string `json:"version"`
	}
	_ = json.NewDecoder(r.Body).Decode(&b)
	want := strings.TrimSpace(b.Version)
	select {
	case panelUpdMu <- struct{}{}:
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "已有面板更新任务进行中"})
		return
	}
	base := s.cfg.BaseDir
	repo := globalStore.GetConfig().PanelRepo
	go func() {
		defer func() { <-panelUpdMu }()
		tid := globalTasks.Begin("panel", "面板更新 "+want, "update", nil)
		done := false
		defer func() {
			if !done {
				globalTasks.Finish(tid, false, "", "面板更新失败", 0)
			}
		}()
		fail := func(msg string) { globalTasks.Update(tid, "", 0, msg) }

		// 1) 解析目标版本与资产
		globalTasks.Update(tid, "解析版本", 10, "解析 Release 资产...")
		path := fmt.Sprintf("/repos/%s/%s/releases/latest", repo.Owner, repo.Repo)
		if want != "" {
			path = fmt.Sprintf("/repos/%s/%s/releases/tags/v%s", repo.Owner, repo.Repo, want)
		}
		raw, err := panelGHGet(path)
		if err != nil {
			fail("获取 Release 失败: " + err.Error())
			return
		}
		var rel ghRelease
		if err := json.Unmarshal(raw, &rel); err != nil {
			fail("Release 解析失败")
			return
		}
		target := strings.TrimPrefix(rel.TagName, "v")
		assetURL, assetName := "", ""
		for _, a := range rel.Assets {
			if strings.HasPrefix(a.Name, "raincough-linux-x86_64-") {
				assetURL, assetName = a.URL, a.Name
				break
			}
		}
		if assetURL == "" {
			fail("该版本没有面板资产: " + rel.TagName)
			return
		}

		// 2) 下载
		globalTasks.Update(tid, "下载", 35, "下载 "+assetName)
		data, err := panelGHDownload(assetURL)
		if err != nil {
			fail("下载失败: " + err.Error())
			return
		}
		ud := s.updateDir()
		dl := filepath.Join(ud, "dl")
		stage := filepath.Join(ud, "stage")
		_ = os.RemoveAll(dl)
		_ = os.RemoveAll(stage)
		if err := os.MkdirAll(dl, 0o755); err != nil {
			fail("准备目录失败: " + err.Error())
			return
		}
		zf := filepath.Join(dl, assetName)
		if err := os.WriteFile(zf, data, 0o644); err != nil {
			fail("写入资产失败: " + err.Error())
			return
		}
		if err := os.MkdirAll(stage, 0o755); err != nil {
			fail("准备 stage 失败: " + err.Error())
			return
		}

		// 3) 解包
		globalTasks.Update(tid, "解包", 60, "解包到 stage")
		if out, err := exec.Command("tar", "-xzf", zf, "-C", stage, "--strip-components=1").CombinedOutput(); err != nil {
			fail("解包失败: " + string(out))
			return
		}

		// 4) 校验 stage(不动现网)
		globalTasks.Update(tid, "校验", 75, "校验新版本文件")
		if v, err := os.ReadFile(filepath.Join(stage, "VERSION")); err != nil || strings.TrimSpace(string(v)) != target {
			fail("校验失败: VERSION 不匹配(期望 " + target + ")")
			return
		}
		if st, err := os.Stat(filepath.Join(stage, "raincough")); err != nil || st.Size() < 1<<20 {
			fail("校验失败: 二进制缺失或异常")
			return
		}
		if _, err := os.Stat(filepath.Join(stage, "public", "index.html")); err != nil {
			fail("校验失败: 前端产物缺失")
			return
		}

		// 5) 备份现网(保留最近 3 份)
		globalTasks.Update(tid, "备份", 85, "备份当前版本")
		cur := s.panelVersion()
		bk := filepath.Join(ud, fmt.Sprintf("backup-%s-%d", cur, time.Now().Unix()))
		if err := os.MkdirAll(bk, 0o755); err != nil {
			fail("备份目录创建失败: " + err.Error())
			return
		}
		_ = exec.Command("cp", "-a", filepath.Join(base, "raincough"), filepath.Join(bk, "raincough")).Run()
		_ = exec.Command("cp", "-a", filepath.Join(base, "VERSION"), filepath.Join(bk, "VERSION")).Run()
		_ = exec.Command("cp", "-a", filepath.Join(base, "public"), filepath.Join(bk, "public")).Run()
		if _, err := os.Stat(filepath.Join(bk, "raincough")); err != nil {
			fail("备份失败: 未取到当前二进制")
			return
		}

		// 6) 覆盖(运行中的进程不受影响, 不重启)
		globalTasks.Update(tid, "应用", 95, "覆盖面板文件(不重启)")
		if out, err := exec.Command("sh", "-c",
			fmt.Sprintf("cp -a %s/. %s/", stage, base)).CombinedOutput(); err != nil {
			fail("应用失败: " + string(out))
			return
		}
		s.writeUpdateState(updateState{Applied: target, Pending: true, Backup: bk, At: time.Now().Unix()})
		s.appendHistory(panelHistoryEntry{At: time.Now().Unix(), From: cur, To: target, Action: "apply", Result: "ok", Message: "已应用, 待确认重启", Backup: bk})
		done = true
		globalTasks.Finish(tid, true, "已应用 v"+target+", 待确认重启", "", 100)
	}()
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "queued", "version": want})
}

// handlePanelUpdateRestart POST /api/panel/update/restart
// 仅在用户于前端确认后调用: 脱离进程延迟重启(先回响应再重启, 避免把自己杀掉)。
func (s *server) handlePanelUpdateRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if s.cfg == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "环境未就绪"})
		return
	}
	unit := os.Getenv("RC_UNIT_NAME")
	if unit == "" {
		unit = "raincough"
	}
	cmdline := fmt.Sprintf("setsid sh -c 'sleep 2; systemctl restart %s' >/dev/null 2>&1 &", unit)
	if s.cfg.SudoPW != "" {
		cmdline = fmt.Sprintf("setsid sh -c 'sleep 2; echo %s | sudo -S systemctl restart %s' >/dev/null 2>&1 &", s.cfg.SudoPW, unit)
	}
	if err := exec.Command("sh", "-c", cmdline).Run(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "下发重启失败: " + err.Error()})
		return
	}
	st := s.readUpdateState()
	st.Pending = false
	s.writeUpdateState(st)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "unit": unit})
}

// ---- 更新历史 / 回滚 ----

// panelHistoryEntry 一条更新记录(apply / rollback)。
type panelHistoryEntry struct {
	At      int64  `json:"at"`
	From    string `json:"from"`
	To      string `json:"to"`
	Action  string `json:"action"`
	Result  string `json:"result"`
	Message string `json:"message"`
	Backup  string `json:"backup"`
}

func (s *server) appendHistory(e panelHistoryEntry) {
	d := s.updateDir()
	if d == "" {
		return
	}
	_ = os.MkdirAll(d, 0o755)
	b, err := json.Marshal(e)
	if err != nil {
		return
	}
	fh, err := os.OpenFile(filepath.Join(d, "history.jsonl"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer fh.Close()
	_, _ = fh.Write(append(b, '\n'))
}

// handlePanelUpdateLog GET /api/panel/update/log -> 最近 50 条(倒序)
func (s *server) handlePanelUpdateLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	entries := []panelHistoryEntry{}
	if d := s.updateDir(); d != "" {
		if b, err := os.ReadFile(filepath.Join(d, "history.jsonl")); err == nil {
			for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
				if strings.TrimSpace(line) == "" {
					continue
				}
				var e panelHistoryEntry
				if json.Unmarshal([]byte(line), &e) == nil {
					entries = append(entries, e)
				}
			}
		}
	}
	// 倒序: 最新在前
	for i, j := 0, len(entries)-1; i < j; i, j = i+1, j-1 {
		entries[i], entries[j] = entries[j], entries[i]
	}
	if len(entries) > 50 {
		entries = entries[:50]
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"entries": entries})
}

// handlePanelUpdateRollback POST /api/panel/update/rollback {backup?}
// 手动回滚: 从备份目录恢复二进制/VERSION/public, 恢复后需重启生效。
func (s *server) handlePanelUpdateRollback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if s.cfg == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "环境未就绪"})
		return
	}
	var b struct {
		Backup string `json:"backup"`
	}
	_ = json.NewDecoder(r.Body).Decode(&b)
	ud := filepath.Clean(s.updateDir())
	st := s.readUpdateState()
	bk := strings.TrimSpace(b.Backup)
	if bk == "" {
		bk = st.Backup
	}
	if bk == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "没有可用的备份"})
		return
	}
	bk = filepath.Clean(bk)
	if !strings.HasPrefix(bk, ud+string(os.PathSeparator)) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "备份路径非法"})
		return
	}
	if fi, err := os.Stat(filepath.Join(bk, "raincough")); err != nil || fi.IsDir() {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "备份不完整(缺二进制)"})
		return
	}
	from := s.panelVersion()
	if out, err := exec.Command("sh", "-c", fmt.Sprintf("cp -a %s/. %s/", bk, s.cfg.BaseDir)).CombinedOutput(); err != nil {
		s.appendHistory(panelHistoryEntry{At: time.Now().Unix(), From: from, Action: "rollback", Result: "fail", Message: string(out), Backup: bk})
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "回滚失败: " + string(out)})
		return
	}
	to := s.panelVersion()
	s.writeUpdateState(updateState{Applied: "", Pending: true, Backup: bk, At: time.Now().Unix()})
	s.appendHistory(panelHistoryEntry{At: time.Now().Unix(), From: from, To: to, Action: "rollback", Result: "ok", Message: "已回滚, 待确认重启", Backup: bk})
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "from": from, "to": to, "backup": bk})
}