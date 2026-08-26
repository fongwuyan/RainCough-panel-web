package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
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
	Path        string `json:"path"`
	Description string `json:"description"`
	Installed   bool   `json:"installed"`
	InstalledV  string `json:"installed_version,omitempty"`
}

// Store 插件市场: GitHub 私有仓库 registry 拉取/安装/更新/卸载。
// onInstalled 回调: 安装成功后触发 PluginHost 重扫。
type Store struct {
	ns Namespacelike
	config StoreConfig
	token  string // GitHub token(解密后)
	client *http.Client
	pluginsDir string
	onInstalled func()  // 安装/卸载后回调(宿主注入: PluginHost.Scan)
	mu          chan struct{} // 并发控制(1)
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
	defer resp.Body.Close()
	return map[string]bool{"net": true, "auth": resp.StatusCode == 200}, nil
}

// Registry 拉取插件注册表(GitHub, 失败时回退本地扫描)。
func (s *Store) Registry() ([]StorePlugin, error) {
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
							Path        string `json:"path"`
							Description string `json:"description"`
						} `json:"plugins"`
					}
					if err := json.Unmarshal(raw, &reg); err == nil {
						out := []StorePlugin{}
						for _, p := range reg.Plugins {
							installed, ver := s.installedVersion(p.Name)
							out = append(out, StorePlugin{
								Name: p.Name, Label: p.Label, Version: p.Version,
								Path: p.Path, Description: p.Description,
								Installed: installed, InstalledV: ver,
							})
						}
						return out, nil
					}
				}
			}
		}
	}
	// 回退: 扫描本地插件目录生成注册表
	return s.localRegistry()
}

// localRegistry 从本地插件目录扫描生成注册表(无 GitHub 时兜底)。
func (s *Store) localRegistry() ([]StorePlugin, error) {
	entries, err := os.ReadDir(s.pluginsDir)
	if err != nil {
		return nil, err
	}
	out := []StorePlugin{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		dir := filepath.Join(s.pluginsDir, name)
		label, version, desc := name, "", ""
		// 读 plugin.json(若有)
		if raw, err := os.ReadFile(filepath.Join(dir, "plugin.json")); err == nil {
			var m struct {
				Name        string `json:"name"`
				Label       string `json:"label"`
				Version     string `json:"version"`
				Description string `json:"description"`
			}
			if json.Unmarshal(raw, &m) == nil {
				if m.Label != "" {
					label = m.Label
				}
				version = m.Version
				desc = m.Description
			}
		}
		installed, ver := s.installedVersion(name)
		out = append(out, StorePlugin{
			Name: name, Label: label, Version: orDefault(version, ver),
			Path: dir, Description: desc,
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
	select {
	case s.mu <- struct{}{}:
	default:
		return "", fmt.Errorf("已有安装任务进行中")
	}
	go func() {
		defer func() { <-s.mu }()
		tid := task.Begin("store", "安装插件 "+name, "install", nil)
		defer task.Finish(tid, false, "", "安装失败", 0)
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
		// 从 zip 提取插件目录
		pluginDir, err := extractPluginFromZip(data, name, s.pluginsDir)
		if err != nil {
			task.Update(tid, "", 0, "安装失败: "+err.Error())
			return
		}
		_ = pluginDir
		if s.onInstalled != nil {
			s.onInstalled()
		}
		task.Finish(tid, true, "插件安装成功: "+name, "", 100)
	}()
	return "queued", nil
}

// RemovePlugin 卸载插件(目录删除 + 重扫)。
func (s *Store) RemovePlugin(name string) error {
	if name == "filemanager" {
		return fmt.Errorf("filemanager 为系统模块不可卸载")
	}
	dir := filepath.Join(s.pluginsDir, name)
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	if s.onInstalled != nil {
		s.onInstalled()
	}
	return nil
}

// ---- 内部 ----

func (s *Store) ghGet(path string) (*http.Response, error) {
	req, _ := http.NewRequest("GET", "https://api.github.com"+path, nil)
	token := s.Token()
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

// installedVersion 检查插件目录是否存在(版本从 plugin.json/registry 获取)。
func (s *Store) installedVersion(name string) (bool, string) {
	dir := filepath.Join(s.pluginsDir, name)
	if _, err := os.Stat(filepath.Join(dir, "plugin.json")); err == nil {
		return true, "installed"
	}
	if _, err := os.Stat(filepath.Join(dir, "plugin.py")); err == nil {
		return true, "installed"
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
			if err := Copy(src, dst); err != nil {
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