package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"runtime/debug"
	"sort"
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

// 版本号与 tag 形状: v<数字>.<数字>.<数字>[-预发布](大小写不敏感的前缀 v 可省),
// 用于挡住 Release 列表里的非面板资产(如 env-offline-0.1.0)与非法请求参数。
//
// ★ 必须接受预发布后缀: 面板从 1.0.0-beta 起进入 beta 阶段, 若这里只认 x.y.z,
// 带 -beta 的 Release(含本机当前版本)会被整体过滤掉 ——
// 表现是"更新检查里永远看不到自己这一版", 且当前版本条目消失, 很难排查。
// 允许前导零(如 01.0.0), 与 install.sh 的版本正则保持一致。
var (
	panelVerRe = regexp.MustCompile(`^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$`)
	panelTagRe = regexp.MustCompile(`^[vV]?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$`)
	assetRefRe = regexp.MustCompile(`index-[A-Za-z0-9_-]+\.(?:js|css)`)
)

// pruneStaleAssets 删掉 public/assets 下不再被 index.html 引用的旧构建产物。
// cp 是合并语义, 不清会把上一版的 index-*.js/css 留在磁盘上, 排查时容易看错版本。
func pruneStaleAssets(pub string) {
	b, err := os.ReadFile(filepath.Join(pub, "index.html"))
	if err != nil {
		return
	}
	keep := map[string]bool{}
	for _, m := range assetRefRe.FindAllString(string(b), -1) {
		keep[m] = true
	}
	ents, err := os.ReadDir(filepath.Join(pub, "assets"))
	if err != nil {
		return
	}
	for _, e := range ents {
		n := e.Name()
		if e.IsDir() || keep[n] || !strings.HasPrefix(n, "index-") {
			continue
		}
		if !strings.HasSuffix(n, ".js") && !strings.HasSuffix(n, ".css") {
			continue
		}
		_ = os.Remove(filepath.Join(pub, "assets", n))
	}
}

// pruneBackups 只保留最近 keep 份备份目录(backup-*), 其余删掉。
func pruneBackups(dir string, keep int) {
	ents, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	type bkEnt struct {
		name string
		mod  time.Time
	}
	list := []bkEnt{}
	for _, e := range ents {
		if !e.IsDir() || !strings.HasPrefix(e.Name(), "backup-") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, bkEnt{e.Name(), info.ModTime()})
	}
	if len(list) <= keep {
		return
	}
	sort.Slice(list, func(i, j int) bool { return list[i].mod.Before(list[j].mod) })
	for _, e := range list[:len(list)-keep] {
		_ = os.RemoveAll(filepath.Join(dir, e.name))
	}
}

// panelGHGet 以面板配置的 token 访问 GitHub API(与插件市场同一套凭据);
// 直连失败自动回退只读镜像(国内主机直连 github.com 常不通)。
func panelGHGet(path string) ([]byte, error) {
	b, _, err := ghFetchBytes("https://api.github.com"+path, true, 20*time.Second)
	return b, err
}

// ghMirror 只读镜像前缀; RC_GH_MIRROR 可覆盖, 设为 off/none/- 关闭回退。
func ghMirror() string {
	m := strings.TrimSpace(os.Getenv("RC_GH_MIRROR"))
	if m == "" {
		m = "https://gh-proxy.com/"
	}
	switch m {
	case "off", "none", "-":
		return ""
	}
	if !strings.HasSuffix(m, "/") {
		m += "/"
	}
	return m
}

// ghFetchBytes 先直连, 传输层失败或 5xx 时回退镜像; 返回数据与来源(直连/镜像)。
// 带 token 的请求只发给 github.com 本身, 不发给镜像。
func ghFetchBytes(raw string, withToken bool, timeout time.Duration) ([]byte, string, error) {
	atts := []ghAttempt{{url: raw, label: "直连", timeout: timeout, token: withToken}}
	if m := ghMirror(); m != "" {
		atts = append(atts, ghAttempt{url: m + raw, label: "镜像", timeout: timeout})
	}
	return ghTry(atts)
}

// ghAttempt 一次抓取尝试。
type ghAttempt struct {
	url     string
	label   string
	timeout time.Duration
	token   bool
}

// ghTry 按顺序尝试各来源。
//
// 错误分三类处理:
//   - 传输层错误 / 5xx → 换下一个源(可能只是这个源不稳定)
//   - ★ 401 / 非限流的 403 → 该源的 token 不被接受。先**就地匿名重试同一个 URL**
//     (公开仓库匿名即可), 匿名仍不行才继续下一个源。
//     不能像以前那样"4xx 一律立即返回": 仓库从私有转公开后, 面板里常留着已失效的
//     旧 token, 401 直接中断会让更新检查报 HTTP 401 —— 而匿名访问其实完全正常。
//     (2026-10-18 实测: 面板更新检查 latest=None, error=HTTP 401)
//   - 其他 4xx(404 等) → 确定答案, 立即返回
func ghTry(atts []ghAttempt) ([]byte, string, error) {
	var lastErr error
	cl := &http.Client{}
	for _, a := range atts {
		tok := ""
		if a.token && globalStore != nil {
			tok = globalStore.Token()
		}

		// do 发一次请求; 返回 body / HTTP 状态码 / 剩余配额 / 错误
		do := func(withTok string) ([]byte, int, string, error) {
			req, err := http.NewRequest("GET", a.url, nil)
			if err != nil {
				return nil, 0, "", err
			}
			req.Header.Set("Accept", "application/vnd.github+json")
			if withTok != "" {
				req.Header.Set("Authorization", "Bearer "+withTok)
			}
			c := *cl
			c.Timeout = a.timeout
			resp, err := c.Do(req)
			if err != nil {
				return nil, 0, "", err
			}
			remain := resp.Header.Get("X-RateLimit-Remaining")
			body, rerr := io.ReadAll(resp.Body)
			_ = resp.Body.Close()
			if rerr != nil {
				return nil, resp.StatusCode, remain, rerr
			}
			return body, resp.StatusCode, remain, nil
		}

		body, code, remain, err := do(tok)
		if err != nil {
			lastErr = err
			continue
		}
		// token 不被接受 → 匿名重试同一个源
		rejected := isGHAuthRejected(code, remain)
		if tok != "" && rejected {
			log.Printf("[panel] GitHub token 无效(HTTP %d), 改用匿名请求", code)
			body, code, remain, err = do("")
			if err != nil {
				lastErr = err
				continue
			}
			rejected = isGHAuthRejected(code, remain)
		}
		if code != 200 {
			lastErr = fmt.Errorf("HTTP %d", code)
			// 认证类错误已试过匿名, 不再视为"确定的答案"; 其他 4xx 立即返回
			if code >= 400 && code < 500 && !rejected {
				return nil, "", lastErr
			}
			continue
		}
		return body, a.label, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("无可用下载源")
	}
	return nil, "", lastErr
}

// isGHAuthRejected 该响应是否表示"凭证不被接受"(而非资源不存在/限流)。
//
// 401 = Bad credentials / token 过期或撤销 —— 一定是凭证问题。
// 403 要区分: X-RateLimit-Remaining=0 是触发限流(换匿名请求只会更差, 别重试),
// 其余 403(如 token 权限不足)才算凭证问题。
func isGHAuthRejected(code int, rateRemaining string) bool {
	switch code {
	case http.StatusUnauthorized:
		return true
	case http.StatusForbidden:
		return rateRemaining != "0"
	default:
		return false
	}
}

// panelGHDownload 下载 Release 资产。
// 直连 github.com 在国内网络下常常"能连但极慢"(实测 30KB/s, 10MB 要几分钟),
// 所以直连只给 45s, 超时立刻换镜像; 镜像也不通时再用长超时重试直连(慢速但可用)。
func panelGHDownload(url string) ([]byte, string, error) {
	atts := []ghAttempt{{url: url, label: "直连", timeout: 45 * time.Second, token: true}}
	if m := ghMirror(); m != "" {
		atts = append(atts, ghAttempt{url: m + url, label: "镜像", timeout: 300 * time.Second})
	}
	atts = append(atts, ghAttempt{url: url, label: "直连(慢速重试)", timeout: 300 * time.Second, token: true})
	return ghTry(atts)
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
		if rel.Draft || !panelTagRe.MatchString(rel.TagName) {
			continue // 草稿与非面板版本(如 env-offline-0.1.0 环境包)不进版本列表
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
	// 取语义最大版本, 而不是 GitHub 返回的第一条(避免草稿/乱序导致误报)
	for _, v := range list {
		if ver := v["version"].(string); verLess(latest, ver) {
			latest = ver
		}
	}
	out["latest"] = latest
	// 只有「最新 > 当前」才算有更新; 版本号不同不代表更新(曾把 6.0.0 判成 1.0.0 有更新)
	out["has_update"] = latest != "" && cur != "" && verLess(cur, latest)
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

// reconcileUpdateState 启动时校正"待重启"标记。
//
// 已经跑在 Applied 版本上 = 重启已经完成（不管是用户点「立即重启」、外部
// systemctl restart，还是掉电重启）。此时 pending 必须清掉，
// 否则前端会永远提示"待重启，请立即重启"，而用户重启多少次都不消失 ——
// 只有走一次 handlePanelUpdateRestart 才会被清。
func (s *server) reconcileUpdateState() {
	st := s.readUpdateState()
	if !st.Pending || st.Applied == "" {
		return
	}
	cur := s.panelVersion()
	if cur != st.Applied {
		return
	}
	st.Pending = false
	s.writeUpdateState(st)
	log.Printf("[panel] 已运行在 v%s，清除待重启标记(重启已完成)", cur)
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
	if want != "" && !panelVerRe.MatchString(want) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "版本号非法"})
		return
	}
	select {
	case panelUpdMu <- struct{}{}:
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "已有面板更新任务进行中"})
		return
	}
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
		data, via, err := panelGHDownload(assetURL)
		if err != nil {
			fail("下载失败(直连与镜像均不通): " + err.Error())
			return
		}
		globalTasks.Update(tid, "下载", 45, "已下载 "+assetName+" ("+via+")")
		ud := s.updateDir()
		dl := filepath.Join(ud, "dl")
		_ = os.RemoveAll(dl)
		if err := os.MkdirAll(dl, 0o755); err != nil {
			fail("准备目录失败: " + err.Error())
			return
		}
		zf := filepath.Join(dl, assetName)
		if err := os.WriteFile(zf, data, 0o644); err != nil {
			fail("写入资产失败: " + err.Error())
			return
		}

		// 3) 应用(解包 → 校验 → 备份 → 覆盖)
		//    与"上传更新包"(handlePanelUpdateUpload)共用同一实现 ——
		//    备份/校验是安全关键路径, 两处各写一份迟早会漂。
		applied, _, aerr := s.applyPanelArchive(zf, target, "apply",
			func(phase string, pct int, msg string) { globalTasks.Update(tid, phase, pct, msg) })
		if aerr != nil {
			fail(aerr.Error())
			return
		}
		done = true
		globalTasks.Finish(tid, true, "已应用 v"+applied+", 待确认重启", "", 100)
	}()
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "queued", "version": want})
}

// applyPanelArchive 把已下载到本地的面板包应用上去(解包 → 校验 → 备份 → 覆盖), 不重启。
//
// via:  "apply"(在线 Release) / "upload"(本地上传包)，只用于审计历史里的来源标记。
// want: 期望版本；空串表示只校验包内 VERSION 非空(本地包不知道应该是哪个版本)。
// prog: 进度回调(阶段, 百分比, 说明)，可传 nil。
//
// ★ 顺序是有讲究的: 先 stage → 再校验 → 校验通过才备份 → 备份成功才覆盖。
//
//	任何一步失败都不动现网 —— 绝不能出现"新版本没上去、旧版本也没了"。
func (s *server) applyPanelArchive(zf, want, via string, prog func(string, int, string)) (string, string, error) {
	if s.cfg == nil || s.cfg.BaseDir == "" {
		return "", "", errors.New("面板根目录未配置")
	}
	base := s.cfg.BaseDir
	ud := s.updateDir()
	if ud == "" {
		return "", "", errors.New("更新目录不可用")
	}
	report := func(phase string, pct int, msg string) {
		if prog != nil {
			prog(phase, pct, msg)
		}
	}

	stage := filepath.Join(ud, "stage")
	_ = os.RemoveAll(stage)
	if err := os.MkdirAll(stage, 0o755); err != nil {
		return "", "", fmt.Errorf("准备 stage 失败: %w", err)
	}

	report("解包", 60, "解包到 stage")
	if err := extractTarGzStrip(zf, stage); err != nil {
		return "", "", fmt.Errorf("解包失败: %w", err)
	}

	report("校验", 75, "校验新版本文件")
	verRaw, err := os.ReadFile(filepath.Join(stage, "VERSION"))
	if err != nil {
		// 最常见的错是包结构不对(扁平包 / 少了顶层目录)。直接说清期望结构,
		// 否则运维只会看到"缺少 VERSION"去翻代码。
		return "", "", errors.New("校验失败: 包内缺少 VERSION —— " +
			"包结构应为 <顶层目录>/{raincough, VERSION, public/}(解包时会去掉第一层目录)")
	}
	ver := strings.TrimSpace(string(verRaw))
	if ver == "" {
		return "", "", errors.New("校验失败: 包内 VERSION 为空")
	}
	if want != "" && ver != want {
		return "", "", fmt.Errorf("校验失败: VERSION 不匹配(期望 %s, 实际 %s)", want, ver)
	}
	if st, err := os.Stat(filepath.Join(stage, "raincough")); err != nil || st.Size() < 1<<20 {
		return "", "", errors.New("校验失败: 二进制缺失或异常")
	}
	if _, err := os.Stat(filepath.Join(stage, "public", "index.html")); err != nil {
		return "", "", errors.New("校验失败: 前端产物缺失")
	}
	// 打包可能丢执行位(Windows 侧打 tar), 补回; 否则覆盖后重启起不来
	_ = os.Chmod(filepath.Join(stage, "raincough"), 0o755)

	report("备份", 85, "备份当前版本")
	cur := s.panelVersion()
	bk := filepath.Join(ud, fmt.Sprintf("backup-%s-%d", cur, time.Now().Unix()))
	if err := os.MkdirAll(bk, 0o755); err != nil {
		return "", "", fmt.Errorf("备份目录创建失败: %w", err)
	}
	_ = copyFileInto(filepath.Join(base, "raincough"), filepath.Join(bk, "raincough"), 0o755)
	_ = copyFileInto(filepath.Join(base, "VERSION"), filepath.Join(bk, "VERSION"), 0o644)
	_ = copyDir(filepath.Join(base, "public"), filepath.Join(bk, "public"))
	if _, err := os.Stat(filepath.Join(bk, "raincough")); err != nil {
		return "", "", errors.New("备份失败: 未取到当前二进制")
	}

	// 覆盖(运行中的进程不受影响, 不重启)
	report("应用", 95, "覆盖面板文件(不重启)")
	if out, err := copyTreeInto(stage, base); err != nil {
		return "", "", fmt.Errorf("应用失败: %s", out)
	}
	_ = os.Chmod(filepath.Join(base, "raincough"), 0o755)
	pruneStaleAssets(filepath.Join(base, "public"))
	alignOwnership(base, "raincough", "public")
	s.writeUpdateState(updateState{Applied: ver, Pending: true, Backup: bk, At: time.Now().Unix()})
	note := "已应用, 待确认重启"
	if via == "upload" {
		note = "已应用上传包, 待确认重启"
	}
	s.appendHistory(panelHistoryEntry{At: time.Now().Unix(), From: cur, To: ver, Action: via, Result: "ok", Message: note, Backup: bk})
	pruneBackups(ud, 3)
	return ver, bk, nil
}

// alignOwnership 把刚解出来的文件属主对齐到面板根目录。
//
// 为什么需要: tar 会原样保留打包机的 uid/gid。在 Windows 上打的包带到 Linux
// 解压, 落出来就是 197609:197121 这种本机不存在的属主(root 解包时不会自动纠正)。
// 结果是 public/ 属于一个幽灵用户 —— 现在不影响读, 但换成非 root 运行就写不进去。
//
// 用 --reference 指向 BaseDir 而不是写死 root: 面板以什么身份装的就该以什么身份持有。
func alignOwnership(base string, names ...string) {
	if runtime.GOOS != "linux" || base == "" {
		return
	}
	for _, n := range names {
		p := filepath.Join(base, n)
		if _, err := os.Stat(p); err != nil {
			continue
		}
		if err := exec.Command("chown", "-R", "--reference="+base, p).Run(); err != nil {
			log.Printf("[panel] 属主对齐失败(%s): %v —— 不影响当前运行", p, err)
		}
	}
}

// handlePanelUpdateUpload POST /api/panel/update/upload
//
// 本地上传面板包(.tar.gz) —— 不依赖 GitHub Release。
//
// 为什么需要: 在线更新只认 GitHub 上的 Release 资产。自己构建的版本(改了代码但没发版)
// 永远进不去, 只能手工 scp 二进制 + systemctl restart。这条通道把
// "改代码 → 打包 → 上传 → 确认重启" 收进面板, 且落盘/校验/备份/回滚与在线更新完全共用。
//
// form-data: file = raincough-linux-x86_64-<版本>.tar.gz(内含 raincough / VERSION / public/)
func (s *server) handlePanelUpdateUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
		return
	}
	if globalTasks == nil || s.cfg == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"error": "环境未就绪"})
		return
	}

	const maxPack = 256 << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxPack+(1<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error": "上传解析失败(需 multipart/form-data, 字段名 file, 上限 256MB)",
		})
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	part, hdr, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "缺少 file 字段(面板包)"})
		return
	}
	defer part.Close()

	filename := filepath.Base(strings.ReplaceAll(strings.TrimSpace(hdr.Filename), `\`, "/"))
	lower := strings.ToLower(filename)
	if !strings.HasSuffix(lower, ".tar.gz") && !strings.HasSuffix(lower, ".tgz") {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "只支持 .tar.gz / .tgz"})
		return
	}

	select {
	case panelUpdMu <- struct{}{}:
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "已有面板更新任务进行中"})
		return
	}

	ud := s.updateDir()
	dl := filepath.Join(ud, "dl")
	_ = os.RemoveAll(dl)
	if err := os.MkdirAll(dl, 0o755); err != nil {
		<-panelUpdMu
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "准备目录失败: " + err.Error()})
		return
	}
	zf := filepath.Join(dl, filename)
	out, cerr := os.Create(zf)
	if cerr != nil {
		<-panelUpdMu
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "创建文件失败: " + cerr.Error()})
		return
	}
	n, cpErr := io.Copy(out, part)
	if e := out.Close(); e != nil && cpErr == nil {
		cpErr = e
	}
	if cpErr != nil {
		<-panelUpdMu
		_ = os.Remove(zf)
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "接收文件失败: " + cpErr.Error()})
		return
	}
	if n < 1<<20 {
		<-panelUpdMu
		_ = os.Remove(zf)
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "包过小, 不像是面板包(至少 1MB)"})
		return
	}

	go func() {
		defer func() { <-panelUpdMu }()
		tid := globalTasks.Begin("panel", "面板上传更新 "+filename, "update", nil)
		done := false
		defer func() {
			if !done {
				globalTasks.Finish(tid, false, "", "上传包应用失败", 0)
			}
		}()
		applied, _, aerr := s.applyPanelArchive(zf, "", "upload",
			func(phase string, pct int, msg string) { globalTasks.Update(tid, phase, pct, msg) })
		if aerr != nil {
			globalTasks.Update(tid, "", 0, aerr.Error())
			return
		}
		done = true
		globalTasks.Finish(tid, true, "已应用上传包 v"+applied+", 待确认重启", "", 100)
	}()

	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "queued", "file": filename, "bytes": n})
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
	// 自重启: 不调用 systemctl, 由进程自己重新 exec 自身(保留 PID 由调用方决定)。
	unit := os.Getenv("RC_UNIT_NAME")
	if unit == "" {
		unit = "raincough"
	}
	st := s.readUpdateState()
	st.Pending = false
	s.writeUpdateState(st)
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "unit": unit})
	go selfRestart()
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
	if out, err := copyTreeInto(bk, s.cfg.BaseDir); err != nil {
		s.appendHistory(panelHistoryEntry{At: time.Now().Unix(), From: from, Action: "rollback", Result: "fail", Message: out, Backup: bk})
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": "回滚失败: " + out})
		return
	}
	_ = os.Chmod(filepath.Join(s.cfg.BaseDir, "raincough"), 0o755)
	pruneStaleAssets(filepath.Join(s.cfg.BaseDir, "public"))
	to := s.panelVersion()
	s.writeUpdateState(updateState{Applied: "", Pending: true, Backup: bk, At: time.Now().Unix()})
	s.appendHistory(panelHistoryEntry{At: time.Now().Unix(), From: from, To: to, Action: "rollback", Result: "ok", Message: "已回滚, 待确认重启", Backup: bk})
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "from": from, "to": to, "backup": bk})
}

// verParts 把 "1.2.3" 拆成数值段(非数字段按 0 处理)。
// verParts 取主版本号数字段(丢弃预发布后缀)。
// 注意: 单靠它无法区分 1.0.0-beta 与 1.0.0 —— 预发布比较见 verLess。
func verParts(s string) []int {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "v")
	s = strings.TrimPrefix(s, "V")
	// 丢掉 -beta / +build
	if i := strings.IndexAny(s, "-+"); i >= 0 {
		s = s[:i]
	}
	segs := strings.Split(s, ".")
	out := make([]int, len(segs))
	for i, seg := range segs {
		n := 0
		for _, c := range seg {
			if c < '0' || c > '9' {
				break
			}
			n = n*10 + int(c-'0')
		}
		out[i] = n
	}
	return out
}

// verPre 取预发布标识("1.0.0-beta" → "beta"; 正式版 → "")
func verPre(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "v")
	s = strings.TrimPrefix(s, "V")
	if i := strings.Index(s, "+"); i >= 0 {
		s = s[:i] // 丢弃 build metadata
	}
	if i := strings.Index(s, "-"); i >= 0 {
		return s[i+1:]
	}
	return ""
}

// verLess 语义比较 a < b。
//
// ★ 必须处理预发布后缀(2026-10-17): 面板进入 1.0.0-beta 阶段后,
// 只比数字段会把 1.0.0-beta 与 1.0.0 判成"相等", 于是「beta → 正式版」
// 这个最典型的升级路径永远检测不到更新。规则同 semver:
// 主版本号相同时, 有预发布后缀的更低(beta < rc < 正式版)。
func verLess(a, b string) bool {
	pa, pb := verParts(a), verParts(b)
	n := len(pa)
	if len(pb) > n {
		n = len(pb)
	}
	for i := 0; i < n; i++ {
		var x, y int
		if i < len(pa) {
			x = pa[i]
		}
		if i < len(pb) {
			y = pb[i]
		}
		if x != y {
			return x < y
		}
	}
	// 主版本号相同 → 比预发布
	preA, preB := verPre(a), verPre(b)
	switch {
	case preA == preB:
		return false
	case preA == "": // a 是正式版, b 是预发布 → a 更大
		return false
	case preB == "": // b 是正式版, a 是预发布 → a 更小
		return true
	default:
		return preA < preB // beta < rc
	}
}
