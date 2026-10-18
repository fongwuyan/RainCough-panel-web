package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ---- 插件市场(与旧面板 store.py 契约兼容) ----

// StoreConfig 市场配置(GitHub 仓库)。
type StoreConfig struct {
	PluginRepo Repo `json:"plugin_repo"`
	PanelRepo  Repo `json:"panel_repo"`
}

// Repo GitHub 仓库定位。
type Repo struct {
	Owner  string `json:"owner"`
	Repo   string `json:"repo"`
	Branch string `json:"branch"`
}

// StoreRegistry 注册表条目(拉取自 registry.json)。
type StorePlugin struct {
	Name        string `json:"name"`
	Label       string `json:"label"`
	Version     string `json:"version"`
	Author      string `json:"author,omitempty"` // registry.json/plugin.json 的作者(前端有展示位)
	Path        string `json:"path"`
	Description string `json:"description"`
	Installed   bool   `json:"installed"`
	InstalledV  string `json:"installed_version,omitempty"`
	// Lang 后端语言(python/php/java/go/node/…)。前端用于"语言是否受支持"提示。
	Lang string `json:"lang,omitempty"`
}

// Store 插件市场: GitHub 私有仓库 registry 拉取/安装/更新/卸载。
// onInstalled 回调: 安装成功后触发 PluginHost 重扫。
type Store struct {
	ns          Namespacelike
	config      StoreConfig
	token       string // GitHub token(解密后)
	client      *http.Client
	pluginsDir  string
	onInstalled func() // 安装/卸载后回调(宿主注入: PluginHost.Scan)
	// onBeforeRemove 卸载前回调(宿主注入: supervisor.RemovePlugin 停进程)。
	// 必须先停进程再删目录, 否则插件进程会变成持有已删文件的孤儿。
	onBeforeRemove func(name string)
	mu             chan struct{} // 并发控制(1)
}

// NewStore 创建插件市场。
func NewStore(ns Namespacelike, pluginsDir string, onInstalled func()) *Store {
	s := &Store{
		ns: ns, pluginsDir: pluginsDir, onInstalled: onInstalled,
		client: &http.Client{Timeout: 30 * time.Second},
		mu:     make(chan struct{}, 1),
	}
	s.Config(StoreConfig{}) // 加载默认/持久化配置
	return s
}

// SetRemoveHook 注入"卸载前停进程"回调(宿主启动时调用)。
func (s *Store) SetRemoveHook(fn func(name string)) { s.onBeforeRemove = fn }

// PluginsDir 插件根目录(只读; 供上层做版本/清单校验)。
func (s *Store) PluginsDir() string { return s.pluginsDir }

// InstalledVersion 已装插件版本(未装或读不到返回空串)。供更新前校验版本方向。
func (s *Store) InstalledVersion(name string) string {
	ok, ver := s.installedVersion(name)
	if !ok {
		return ""
	}
	return ver
}

// Config 读取/设置配置(空值保留现有)。
func (s *Store) Config(cfg StoreConfig) StoreConfig {
	if cfg.PluginRepo.Owner != "" {
		s.config.PluginRepo = cfg.PluginRepo
	}
	if cfg.PanelRepo.Owner != "" {
		s.config.PanelRepo = cfg.PanelRepo
	}
	if s.config.PluginRepo.Owner == "" {
		s.config.PluginRepo = Repo{Owner: "fongwuyan", Repo: "RainCough-Plugin", Branch: "main"}
	}
	if s.config.PanelRepo.Owner == "" {
		s.config.PanelRepo = Repo{Owner: "fongwuyan", Repo: "RainCough-panel-web", Branch: "main"}
	}
	return s.config
}

// GetConfig 当前配置(脱敏: 不含 token)。
func (s *Store) GetConfig() StoreConfig { return s.config }

// SetToken 保存 GitHub token(AES-GCM 加密落库)。
func (s *Store) SetToken(token string) error {
	enc, err := s.encrypt(token)
	if err != nil {
		return err
	}
	return s.ns.Set("store:token_enc", enc)
}

// Token 取回 token。
func (s *Store) Token() string {
	v, ok, err := s.ns.Get("store:token_enc")
	if err != nil || !ok {
		return s.token
	}
	tok, err := s.decrypt(v.(string))
	if err != nil {
		return ""
	}
	return tok
}

// Ping 测试 GitHub 连通性与 token。
//
// 返回值语义(前端据此给提示):
//
//	net       能否到达 api.github.com
//	auth      配置的 token 是否被接受(未配 token 时恒 false, 属正常)
//	public    匿名能否读到插件库清单 —— 公开仓库靠这个就够用
//
// 为什么要 public: 仓库改成公开后, 面板里遗留的旧 token 常常已失效。
// 此时 auth=false 会让用户以为"配置坏了、装不了插件", 而实际匿名完全可用。
// 2026-10-18 实测踩到: 面板 source 一直是 local(回退本地扫描), 市场装不了新插件。
func (s *Store) Ping() (map[string]bool, error) {
	token := s.Token()
	req, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return map[string]bool{"net": false}, err
	}
	resp.Body.Close()
	out := map[string]bool{"net": true, "auth": resp.StatusCode == 200}

	// 匿名能否读到插件库的 registry.json
	repo := s.config.PluginRepo
	if repo.Owner != "" && repo.Repo != "" {
		p := fmt.Sprintf("/repos/%s/%s/contents/registry.json?ref=%s", repo.Owner, repo.Repo, repo.Branch)
		if r2, err2 := s.ghGetWithToken(p, ""); err2 == nil {
			out["public"] = r2.StatusCode == 200
			r2.Body.Close()
		}
	}
	return out, nil
}

// Registry 拉取插件注册表(GitHub, 失败时回退本地扫描)。
func (s *Store) Registry() ([]StorePlugin, error) {
	plugins, _, err := s.RegistryWithSource()
	return plugins, err
}

// RegistryWithSource 同 Registry, 额外返回数据来源: "github"(仓库清单)
// 或 "local"(GitHub 拉取失败后回退的本机扫描)。
// 来源给前端做明确提示: local 模式下列表全是已装插件, 安装按钮永不出现,
// 用户若不知情会以为"市场里没有新插件"(2026-09-28 审计定位)。
func (s *Store) RegistryWithSource() ([]StorePlugin, string, error) {
	repo := s.config.PluginRepo
	path := fmt.Sprintf("/repos/%s/%s/contents/registry.json?ref=%s",
		repo.Owner, repo.Repo, repo.Branch)
	resp, err := s.ghGet(path)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == 200 {
			var gh struct {
				Content string `json:"content"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&gh); err == nil {
				if raw, err := base64.StdEncoding.DecodeString(gh.Content); err == nil {
					var reg struct {
						Plugins []struct {
							Name        string `json:"name"`
							Label       string `json:"label"`
							Version     string `json:"version"`
							Author      string `json:"author"`
							Path        string `json:"path"`
							Description string `json:"description"`
							// Lang 后端语言(registry.json 可选字段)。
							// 前端据此判断"语言是否受支持"; 缺省时前端不拦(按二进制处理)。
							Lang string `json:"lang"`
						} `json:"plugins"`
					}
					if err := json.Unmarshal(raw, &reg); err == nil {
						out := []StorePlugin{}
						for _, p := range reg.Plugins {
							installed, ver := s.installedVersion(p.Name)
							// registry 没写 lang 时, 从已装插件的 plugin.json 里补一个
							// (已装的才知道真实语言; 未装的只能等装完)
							lang := p.Lang
							if lang == "" && installed {
								lang = s.installedLang(p.Name)
							}
							out = append(out, StorePlugin{
								Name: p.Name, Label: p.Label, Version: p.Version,
								Author: p.Author, Path: p.Path, Description: p.Description,
								Lang:      lang,
								Installed: installed, InstalledV: ver,
							})
						}
						return out, "github", nil
					}
				}
			}
		}
	}
	// 回退: 扫描本地插件目录生成注册表
	out, err := s.localRegistry()
	return out, "local", err
}

// localRegistry 从本地插件目录扫描生成注册表(无 GitHub 时兜底)。
func (s *Store) localRegistry() ([]StorePlugin, error) {
	entries, err := os.ReadDir(s.pluginsDir)
	if err != nil {
		// ★全新安装还没有 plugins 目录: 这不是错误, 视为"已装 0 个", 并顺手建出来
		// (否则 /api/store/registry 会 502, 整个插件市场打不开, 也装不了插件)
		if os.IsNotExist(err) {
			_ = os.MkdirAll(s.pluginsDir, 0o755)
			return []StorePlugin{}, nil
		}
		return []StorePlugin{}, err
	}
	out := []StorePlugin{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		dir := filepath.Join(s.pluginsDir, name)
		label, version, desc, author := name, "", "", ""
		// 读 plugin.json(若有)
		if raw, err := os.ReadFile(filepath.Join(dir, "plugin.json")); err == nil {
			var m struct {
				Name        string `json:"name"`
				Label       string `json:"label"`
				Version     string `json:"version"`
				Author      string `json:"author"`
				Description string `json:"description"`
			}
			if json.Unmarshal(raw, &m) == nil {
				if m.Label != "" {
					label = m.Label
				}
				version = m.Version
				author = m.Author
				desc = m.Description
			}
		}
		installed, ver := s.installedVersion(name)
		out = append(out, StorePlugin{
			Name: name, Label: label, Version: orDefault(version, ver),
			Author: author, Path: dir, Description: desc,
			Lang:      s.installedLang(name),
			Installed: installed, InstalledV: ver,
		})
	}
	return out, nil
}

func orDefault(v, def string) string {
	if v != "" {
		return v
	}
	return def
}

// InstallPlugin 安装插件(异步任务)。
func (s *Store) InstallPlugin(name string, task *TaskStore) (string, error) {
	if !validPluginName(name) {
		return "", fmt.Errorf("非法插件名: %q", name)
	}
	select {
	case s.mu <- struct{}{}:
	default:
		return "", fmt.Errorf("已有安装任务进行中")
	}
	go func() {
		defer func() { <-s.mu }()
		tid := task.Begin("store", "安装插件 "+name, "install", nil)
		// 失败兜底收尾: 仅当没走到成功 Finish 时才置失败。
		// 旧版用 `defer task.Finish(tid, false, ..., 0)` 直接收尾 — 任务成功后 defer
		// 仍会执行, 把 status=done 翻回 failed、error=安装失败、progress 100 归 0,
		// 导致装成功也永远在任务队列里显示"安装失败"(2026-09-28 审计定位)。
		done := false
		defer func() {
			if !done {
				task.Finish(tid, false, "", "安装失败", 0)
			}
		}()
		task.Update(tid, "", 20, "拉取插件仓库...")
		// 下载 zipball
		repo := s.config.PluginRepo
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/zipball/%s",
			repo.Owner, repo.Repo, repo.Branch)
		data, err := s.ghDownload(url)
		if err != nil {
			task.Update(tid, "", 0, "下载失败: "+err.Error())
			return
		}
		task.Update(tid, "", 50, "解压安装...")

		// ★ 已装同名插件 = 更新。更新必须先停进程:
		//   插件正在运行时, 我们马上要替换它的目录; 不停进程会得到
		//   "进程还在跑旧代码/持有已删文件" 的孤儿, 且新版本文件可能写不进去
		//   (二进制被占用在部分文件系统上会失败)。卸载路径早就有这个钩子,
		//   更新路径之前漏了 —— 2026-10-17 检查时发现。
		alreadyInstalled, _ := s.installedVersion(name)
		if alreadyInstalled && s.onBeforeRemove != nil {
			task.Update(tid, "", 55, "停止旧版本进程...")
			s.onBeforeRemove(name)
		}
		// 从 zip 提取插件目录
		if _, err = extractPluginFromZip(data, name, s.pluginsDir); err != nil {
			task.Update(tid, "", 0, "安装失败: "+err.Error())
			return
		}
		if s.onInstalled != nil {
			s.onInstalled()
		}
		done = true
		verb := "安装"
		if alreadyInstalled {
			verb = "更新"
		}
		task.Finish(tid, true, "插件"+verb+"成功: "+name, "", 100)
	}()
	return "queued", nil
}

// validPluginName 插件名校验: 防空名/路径穿越(空名会让 filepath.Join 指向插件根目录,
// RemoveAll 会把全部插件连根删掉 — 2026-09-27 审计实测踩过)。
func validPluginName(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 64 || name == "." || name == ".." {
		return false
	}
	return filepath.Base(name) == name && !strings.ContainsAny(name, `/\`)
}

// RemovePlugin 卸载插件(停进程 + 删目录 + 重扫)。
//
// ★ 顺序很重要: 必须先停进程再删目录。
// 旧实现直接 os.RemoveAll, 插件进程还活着时会把文件从它脚下抽走(Linux 允许),
// 结果是"目录没了但进程成孤儿", 而且 supervisor 里的记录不会消失 ——
// 界面上插件仍显示 running, 用户以为卸载失败(2026-10-17 实测 echopi)。
func (s *Store) RemovePlugin(name string) error {
	if !validPluginName(name) {
		return fmt.Errorf("非法插件名: %q", name)
	}
	if name == "filemanager" {
		return fmt.Errorf("filemanager 为系统模块不可卸载")
	}
	dir := filepath.Join(s.pluginsDir, name)
	if _, err := os.Stat(dir); err != nil {
		if os.IsNotExist(err) {
			// 目录本来就不在: 仍然走一遍清理, 把残留注册/进程记录扫掉(幂等)
			if s.onInstalled != nil {
				s.onInstalled()
			}
			return nil
		}
		return err
	}
	// 先停进程(由宿主注入的回调负责; 未注入时直接删目录)
	if s.onBeforeRemove != nil {
		s.onBeforeRemove(name)
	}
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("删除插件目录失败: %w", err)
	}
	// 校验: 目录必须真的没了, 否则明确报错而不是装作成功
	if _, err := os.Stat(dir); err == nil {
		return fmt.Errorf("插件目录删除后仍存在: %s", dir)
	}
	// 重扫: 触发 supervisor 摘掉进程记录 + PluginX 摘掉注册
	if s.onInstalled != nil {
		s.onInstalled()
	}
	return nil
}

// ---- 内部 ----

// StoreChangelog 插件仓的仓级版本与更新日志(CHANGELOG.md)。
// 私有仓必须带 token; 仓库不可用时返回错误, 前端统一提示"仓库不可用"。
type StoreChangelog struct {
	Version   string `json:"version"`
	Changelog string `json:"changelog"`
	Source    string `json:"source"`
}

// Changelog 取插件仓 VERSION 与 CHANGELOG.md(均为仓级, 与面板版本解耦)。
func (s *Store) Changelog() (StoreChangelog, error) {
	repo := s.config.PluginRepo
	if repo.Owner == "" || repo.Repo == "" {
		return StoreChangelog{}, fmt.Errorf("未配置插件仓库")
	}
	get := func(file string) (string, error) {
		path := fmt.Sprintf("/repos/%s/%s/contents/%s?ref=%s",
			repo.Owner, repo.Repo, file, repo.Branch)
		resp, err := s.ghGet(path)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			return "", fmt.Errorf("HTTP %d", resp.StatusCode)
		}
		var gh struct {
			Content string `json:"content"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&gh); err != nil {
			return "", err
		}
		raw, err := base64.StdEncoding.DecodeString(gh.Content)
		if err != nil {
			return "", err
		}
		return string(raw), nil
	}
	ver, err := get("VERSION")
	if err != nil {
		return StoreChangelog{}, err
	}
	text, err := get("CHANGELOG.md")
	if err != nil {
		return StoreChangelog{}, err
	}
	return StoreChangelog{Version: strings.TrimSpace(ver), Changelog: text, Source: "github"}, nil
}

// ghGet 带 token(若有)请求 GitHub API。
//
// ★ token 失效时自动降级为匿名请求(2026-10-18):
// 仓库从私有切成公开后, 面板里往往还留着当时配的 token。如果那个 token 被撤销/
// 过期, GitHub 返回 401 Bad credentials, 于是"清单拉取失败 → 回退本地扫描",
// 表现为市场里只剩已装插件、装不了新插件 —— 而实际上匿名访问完全可用。
// 公开仓库根本不需要 token, 所以认证类错误(401/403)时去掉 token 重试一次。
// 注意只对认证错误重试: 404/限流(403 secondary rate limit)等情况语义不同,
// 盲目重试会掩盖真实原因。
func (s *Store) ghGet(path string) (*http.Response, error) {
	token := s.Token()
	resp, err := s.ghGetWithToken(path, token)
	if err != nil {
		return resp, err
	}
	if token == "" || !isGitHubAuthFailure(resp) {
		return resp, nil
	}
	// token 不被接受 → 关掉这次响应, 匿名重试
	resp.Body.Close()
	log.Printf("[store] GitHub token 无效, 改用匿名请求(公开仓库无需 token)")
	return s.ghGetWithToken(path, "")
}

// isGitHubAuthFailure 判断响应是否是"token 不被接受"(而不是限流/不存在)。
//
// 401 = Bad credentials / token 过期或撤销 —— 一定重试匿名。
// 403 要区分: X-RateLimit-Remaining=0 是触发限流, 换匿名请求只会更差;
// 其余 403(如 token 权限不足, 私有仓库场景)才值得用匿名再试一次。
func isGitHubAuthFailure(resp *http.Response) bool {
	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return true
	case http.StatusForbidden:
		return resp.Header.Get("X-RateLimit-Remaining") != "0"
	default:
		return false
	}
}

// ghGetWithToken 指定 token 的请求(空串 = 匿名)。供 ghGet 的重试逻辑复用。
func (s *Store) ghGetWithToken(path, token string) (*http.Response, error) {
	req, _ := http.NewRequest("GET", "https://api.github.com"+path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	return s.client.Do(req)
}

func (s *Store) ghDownload(url string) ([]byte, error) {
	req, _ := http.NewRequest("GET", url, nil)
	token := s.Token()
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// installedLang 读已装插件的后端语言(plugin.json → backend.lang)。
// 读不到返回空串(前端按"未知"处理, 不拦)。
func (s *Store) installedLang(name string) string {
	raw, err := os.ReadFile(filepath.Join(s.pluginsDir, name, "plugin.json"))
	if err != nil {
		return ""
	}
	var m struct {
		Backend struct {
			Lang string   `json:"lang"`
			Exec []string `json:"exec"`
		} `json:"backend"`
	}
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	if m.Backend.Lang != "" {
		return m.Backend.Lang
	}
	// 没声明 lang: 从 exec[0] 猜一个(与后端 pluginrt 的推断保持一致)
	if len(m.Backend.Exec) > 0 {
		return guessLangFromExec(m.Backend.Exec[0])
	}
	return ""
}

// guessLangFromExec 从可执行文件名猜语言(只覆盖常见情况, 猜不出返回空)
func guessLangFromExec(s string) string {
	b := strings.ToLower(filepath.Base(s))
	switch {
	case strings.HasPrefix(b, "python"):
		return "python"
	case strings.HasPrefix(b, "php"):
		return "php"
	case b == "java", b == "javaw":
		return "java"
	case strings.HasPrefix(b, "node"):
		return "node"
	case b == "sh", b == "bash", b == "dash", b == "zsh":
		return "bash"
	case strings.HasSuffix(b, ".py"):
		return "python"
	case strings.HasSuffix(b, ".php"):
		return "php"
	case strings.HasSuffix(b, ".jar"):
		return "java"
	case strings.HasSuffix(b, ".js"):
		return "node"
	case strings.HasSuffix(b, ".sh"):
		return "bash"
	}
	return ""
}

// installedVersion 检查插件是否已安装, 并返回 plugin.json 里的真实版本。
// 旧版固定返回字面量 "installed" — 前端芯片因此显示"已装 installed",
// 且拿不到真实版本就永远无法提示"有更新"(2026-09-28 审计定位)。
// 版本读不到时返回空串, 前端按"已装"显示且不参与更新对比。
func (s *Store) installedVersion(name string) (bool, string) {
	dir := filepath.Join(s.pluginsDir, name)
	if raw, err := os.ReadFile(filepath.Join(dir, "plugin.json")); err == nil {
		var m struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(raw, &m) == nil {
			return true, m.Version
		}
		return true, ""
	}
	if _, err := os.Stat(filepath.Join(dir, "plugin.py")); err == nil {
		return true, ""
	}
	return false, ""
}

// extractPluginFromZip 从 GitHub zipball 提取插件目录。
// zipball 结构: <repo>-<sha>/<plugin_dir>/...
func extractPluginFromZip(data []byte, name, pluginsDir string) (string, error) {
	tmp, err := os.MkdirTemp("", "rc-store-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmp)
	zipPath := filepath.Join(tmp, "repo.zip")
	if err := os.WriteFile(zipPath, data, 0o644); err != nil {
		return "", err
	}
	if err := extractArchive(zipPath, tmp); err != nil {
		return "", err
	}
	// 顶层是 <repo>-<sha> 目录, 插件在其下 <name>/
	entries, err := os.ReadDir(tmp)
	if err != nil {
		return "", err
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		// 检查该顶层目录下是否有 <name> 目录(带 registry.json 或插件文件)
		root := filepath.Join(tmp, e.Name())
		src := filepath.Join(root, name)
		if st, err := os.Stat(src); err == nil && st.IsDir() {
			dst := filepath.Join(pluginsDir, name)
			if err := os.MkdirAll(pluginsDir, 0o755); err != nil {
				return "", err
			}
			// ★ 用 replaceDir 而不是 Copy:
			//   Copy 是"合并"语义 —— 旧版本有、新版本没删掉的文件会残留下来。
			//   插件更新时这会留下废弃的 .py/.js/二进制, 甚至让旧前端产物继续被加载。
			//   replaceDir 做"整目录替换 + 备份 + 失败回滚"(与面板内上传安装同一条路径)。
			if _, err := replaceDir(src, dst); err != nil {
				return "", err
			}
			return dst, nil
		}
	}
	return "", fmt.Errorf("zip 中未找到插件目录: %s", name)
}

// ---- token 加密(AES-GCM, 密钥存文件) ----

func (s *Store) encrypt(plain string) (string, error) {
	key := s.secretKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return base64.StdEncoding.EncodeToString(ct), nil
}

func (s *Store) decrypt(enc string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}
	key := s.secretKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce, ct := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// secretKey 持久密钥(存 data/ 下, 与旧版 .term_secret 同模式)。
func (s *Store) secretKey() []byte {
	key := make([]byte, 32)
	// 从 ns 读或生成
	v, ok, _ := s.ns.Get("store:key")
	if ok {
		if s, isStr := v.(string); isStr && len(s) == 44 {
			if b, err := base64.StdEncoding.DecodeString(s); err == nil && len(b) == 32 {
				return b
			}
		}
	}
	rand.Read(key)
	s.ns.Set("store:key", base64.StdEncoding.EncodeToString(key))
	return key
}

// ---- 插件依赖安装(安装插件时执行; 设计: 插件依赖不属于面板环境包) ----

// readPluginRequirements 读取 plugin.json 声明的 requirements 列表。
