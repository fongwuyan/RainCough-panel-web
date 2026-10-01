package core

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ---- 系统扩展 ----
//
// 面板功能分两层:
//   内置功能 = 随面板主体安装的 7 个页面(工作台/文件管理/终端/系统扩展/插件/设置/开发文档),
//   系统扩展 = 其余功能(媒体中心/任务队列/调度器/系统中心…), 以扩展包形式存放在主面板库
//   (panel_repo) 的 extensions/ 目录, 面板安装后按需从「系统扩展」页安装。
//
// 扩展包结构(<repo>/extensions/<name>/):
//   extension.json     清单(name/label/version/description/author/icon/entry)
//   frontend/*.js      前端源码(esbuild 打包, 见 tools/build-extension.js)
//   assets/extension.js 构建产物(注册 window.__rcExt__[name]), 随库提交
// <repo>/extensions/registry.json 为可用扩展清单。

// BuiltinPages 内置系统功能(不可卸载, 不参与扩展商店)。
var BuiltinPages = []Extension{
	{Name: "workspace", Label: "工作台", Icon: "WD", Description: "概览与状态", Route: "/", Builtin: true},
	{Name: "fm", Label: "文件管理", Icon: "FM", Description: "文件系统", Route: "/fm", Builtin: true},
	{Name: "terminal", Label: "终端", Icon: "TM", Description: "Shell", Route: "/terminal", Builtin: true},
	{Name: "ext", Label: "系统扩展", Icon: "EX", Description: "扩展安装与管理", Route: "/ext", Builtin: true},
	{Name: "plugins", Label: "插件", Icon: "PL", Description: "插件管理与市场", Route: "/plugins", Builtin: true},
	{Name: "settings", Label: "设置", Icon: "SG", Description: "偏好与仓库配置", Route: "/settings", Builtin: true},
	{Name: "docs", Label: "开发文档", Icon: "DC", Description: "插件与扩展开发指南", Route: "/docs", Builtin: true},
}

// Extension 扩展条目(清单 + 安装态)。
type Extension struct {
	Name        string `json:"name"`
	Label       string `json:"label"`
	Version     string `json:"version"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Icon        string `json:"icon,omitempty"`
	Entry       string `json:"entry,omitempty"`
	Route       string `json:"route,omitempty"`
	Builtin     bool   `json:"builtin"`
	Installed   bool   `json:"installed"`
	InstalledV  string `json:"installed_version,omitempty"`
	HasAssets   bool   `json:"has_assets"`
}

// ExtStore 系统扩展仓储: 从主面板库拉取/安装/卸载, 本地目录存已装扩展。
type ExtStore struct {
	dir    string // 已装扩展目录 <BaseDir>/extensions
	srcDir string // 本地回退源 <BaseDir>/extension-src/extensions(离线/开发用, 可不存在)
	store  *Store // 复用主面板库配置与 token
	client *http.Client
	mu     chan struct{} // 安装并发控制(1)
}

// NewExtStore 创建扩展仓储。
func NewExtStore(dir, srcDir string, store *Store) *ExtStore {
	return &ExtStore{
		dir: dir, srcDir: srcDir, store: store,
		client: &http.Client{Timeout: 60 * time.Second},
		mu:     make(chan struct{}, 1),
	}
}

// Dir 已装扩展目录。
func (e *ExtStore) Dir() string { return e.dir }

// Builtins 内置功能清单。
func (e *ExtStore) Builtins() []Extension { return BuiltinPages }

// isBuiltinName 内置功能名(不允许当扩展安装/卸载)。
func isBuiltinName(name string) bool {
	for _, b := range BuiltinPages {
		if strings.EqualFold(b.Name, name) {
			return true
		}
	}
	return false
}

// validExtName 扩展名校验: 防空名与路径穿越(空名会让 RemoveAll 命中扩展根目录)。
func validExtName(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 64 || name == "." || name == ".." {
		return false
	}
	return filepath.Base(name) == name && !strings.ContainsAny(name, `/\`)
}

// readExtManifest 读取扩展清单(缺 entry 时给默认产物路径)。
func readExtManifest(dir string) (Extension, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "extension.json"))
	if err != nil {
		return Extension{}, err
	}
	var m Extension
	if err := json.Unmarshal(raw, &m); err != nil {
		return Extension{}, err
	}
	if m.Entry == "" {
		m.Entry = "assets/extension.js"
	}
	return m, nil
}

// Installed 已装扩展列表(目录扫描, 清单缺失的目录忽略)。
func (e *ExtStore) Installed() []Extension {
	out := []Extension{}
	entries, err := os.ReadDir(e.dir)
	if err != nil {
		return out
	}
	for _, ent := range entries {
		if !ent.IsDir() || ent.Name() == "" {
			continue
		}
		sub := filepath.Join(e.dir, ent.Name())
		m, err := readExtManifest(sub)
		if err != nil {
			continue
		}
		if m.Name == "" {
			m.Name = ent.Name()
		}
		m.Builtin = false
		m.Installed = true
		m.InstalledV = m.Version
		if _, err := os.Stat(filepath.Join(sub, m.Entry)); err == nil {
			m.HasAssets = true
		}
		if m.Route == "" {
			m.Route = "/ext/" + m.Name
		}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// InstalledByName 查单个已装扩展。
func (e *ExtStore) InstalledByName(name string) (Extension, bool) {
	for _, x := range e.Installed() {
		if strings.EqualFold(x.Name, name) {
			return x, true
		}
	}
	return Extension{}, false
}

// Registry 可用扩展清单 + 来源(github / local)。
func (e *ExtStore) Registry() ([]Extension, string, error) {
	list, err := e.ghRegistry()
	if err == nil {
		return e.markInstalled(list), "github", nil
	}
	if local, lerr := e.localRegistry(); lerr == nil && len(local) > 0 {
		return e.markInstalled(local), "local", nil
	}
	return nil, "", err
}

// markInstalled 标注 installed/installed_version/has_assets(供前端比对更新)。
func (e *ExtStore) markInstalled(list []Extension) []Extension {
	inst := map[string]Extension{}
	for _, x := range e.Installed() {
		inst[strings.ToLower(x.Name)] = x
	}
	out := make([]Extension, 0, len(list))
	for _, x := range list {
		if x.Name == "" {
			continue
		}
		if x.Entry == "" {
			x.Entry = "assets/extension.js"
		}
		if x.Route == "" {
			x.Route = "/ext/" + x.Name
		}
		if got, ok := inst[strings.ToLower(x.Name)]; ok {
			x.Installed = true
			x.InstalledV = got.InstalledV
			x.HasAssets = got.HasAssets
		}
		out = append(out, x)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// registryJSON 主面板库清单结构。
type extRegistryFile struct {
	Extensions []Extension `json:"extensions"`
}

// ghRegistry 从主面板库拉 extensions/registry.json。
func (e *ExtStore) ghRegistry() ([]Extension, error) {
	if e.store == nil {
		return nil, fmt.Errorf("市场未初始化")
	}
	repo := e.store.GetConfig().PanelRepo
	if repo.Owner == "" || repo.Repo == "" {
		return nil, fmt.Errorf("未配置面板仓库")
	}
	branch := repo.Branch
	if branch == "" {
		branch = "main"
	}
	path := fmt.Sprintf("/repos/%s/%s/contents/extensions/registry.json?ref=%s",
		repo.Owner, repo.Repo, branch)
	raw, err := e.ghRaw(path)
	if err != nil {
		return nil, err
	}
	return parseExtRegistry(raw)
}

// parseExtRegistry 兼容 {"extensions":[...]} 与裸数组两种写法。
func parseExtRegistry(raw []byte) ([]Extension, error) {
	var f extRegistryFile
	if err := json.Unmarshal(raw, &f); err == nil && len(f.Extensions) > 0 {
		return f.Extensions, nil
	}
	var arr []Extension
	if err := json.Unmarshal(raw, &arr); err == nil {
		return arr, nil
	}
	return nil, fmt.Errorf("注册表格式无法识别")
}

// localRegistry 本地回退: 扫描 srcDir 下各扩展的清单。
func (e *ExtStore) localRegistry() ([]Extension, error) {
	out := []Extension{}
	entries, err := os.ReadDir(e.srcDir)
	if err != nil {
		return nil, err
	}
	for _, ent := range entries {
		if !ent.IsDir() {
			continue
		}
		m, err := readExtManifest(filepath.Join(e.srcDir, ent.Name()))
		if err != nil {
			continue
		}
		if m.Name == "" {
			m.Name = ent.Name()
		}
		if _, err := os.Stat(filepath.Join(e.srcDir, ent.Name(), m.Entry)); err == nil {
			m.HasAssets = true
		}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// ghRaw 取仓库文件原文(contents API + raw accept)。
func (e *ExtStore) ghRaw(path string) ([]byte, error) {
	req, _ := http.NewRequest("GET", "https://api.github.com"+path, nil)
	if tok := e.store.Token(); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	req.Header.Set("Accept", "application/vnd.github.raw")
	resp, err := e.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// Install 安装扩展(异步任务, source=ext)。update 与 install 同路径(覆盖安装)。
func (e *ExtStore) Install(name string, task *TaskStore) (string, error) {
	if !validExtName(name) {
		return "", fmt.Errorf("非法扩展名: %q", name)
	}
	if isBuiltinName(name) {
		return "", fmt.Errorf("%s 是内置功能, 无需安装", name)
	}
	select {
	case e.mu <- struct{}{}:
	default:
		return "", fmt.Errorf("已有扩展任务进行中")
	}
	go func() {
		defer func() { <-e.mu }()
		tid := task.Begin("ext", "安装扩展 "+name, "install", nil)
		done := false
		defer func() {
			if !done {
				task.Finish(tid, false, "", "安装失败", 0)
			}
		}()

		task.Update(tid, "取件", 20, "从主面板库取件...")
		// 与清单同源: 清单(Route)来自主面板库, 安装也先走主面板库 ——
		// 否则会出现"列表写的是仓库里的 1.0.0、装进来的却是本地源那份"的错位
		// (旧实现本地源优先, 部署机上恰好有 extension-src, 于是永远不拉主面板库)。
		// 主面板库不可用(离线/未配仓库/dev)时才回退本地源。
		if err := e.installFromGitHub(name); err != nil {
			task.Update(tid, "本地源", 45, "主面板库不可用, 改用本地源...")
			if err2 := e.installFromLocal(name); err2 != nil {
				task.Update(tid, "", 0, "安装失败: 主面板库与本地源均不可用 ("+err.Error()+"; "+err2.Error()+")")
				return
			}
		}

		task.Update(tid, "校验产物", 85, "校验扩展清单与产物...")
		sub := filepath.Join(e.dir, name)
		m, err := readExtManifest(sub)
		if err != nil {
			_ = os.RemoveAll(sub)
			task.Update(tid, "", 0, "扩展清单缺失或损坏: extension.json")
			return
		}
		if _, err := os.Stat(filepath.Join(sub, m.Entry)); err != nil {
			_ = os.RemoveAll(sub)
			task.Update(tid, "", 0, "扩展前端产物缺失: "+m.Entry+" (需先构建)")
			return
		}
		done = true
		task.Finish(tid, true, "扩展安装成功: "+m.Label+" ("+name+")", "", 100)
	}()
	return "queued", nil
}

// installFromGitHub 从主面板库取扩展目录。
// 走 contents API 逐级取件(扩展只有清单 + 十几个 KB 产物), 不下载整仓 zipball ——
// 主仓包含 plugins/web 等, 整包下载在慢网络上会让安装卡到分钟级。
func (e *ExtStore) installFromGitHub(name string) error {
	if e.store == nil {
		return fmt.Errorf("市场未初始化")
	}
	repo := e.store.GetConfig().PanelRepo
	branch := repo.Branch
	if branch == "" {
		branch = "main"
	}
	tmp := filepath.Join(e.dir, name+".tmp")
	_ = os.RemoveAll(tmp)
	if err := e.fetchGitHubDir(repo, branch, "extensions/"+name, tmp); err != nil {
		_ = os.RemoveAll(tmp)
		return err
	}
	if _, err := readExtManifest(tmp); err != nil {
		_ = os.RemoveAll(tmp)
		return fmt.Errorf("主面板库中的扩展缺少 extension.json")
	}
	dst := filepath.Join(e.dir, name)
	if err := os.RemoveAll(dst); err != nil {
		_ = os.RemoveAll(tmp)
		return err
	}
	return os.Rename(tmp, dst)
}

// ghEntry contents API 目录项。
type ghEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"`
}

// fetchGitHubDir 递归取仓库目录到本地(apiPath 为仓库相对路径)。
func (e *ExtStore) fetchGitHubDir(repo Repo, branch, apiPath, dst string) error {
	url := fmt.Sprintf("/repos/%s/%s/contents/%s?ref=%s", repo.Owner, repo.Repo, apiPath, branch)
	raw, err := e.ghRaw(url)
	if err != nil {
		return err
	}
	var entries []ghEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		return fmt.Errorf("目录列表解析失败: %s", apiPath)
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	for _, ent := range entries {
		switch ent.Type {
		case "dir":
			if err := e.fetchGitHubDir(repo, branch, ent.Path, filepath.Join(dst, ent.Name)); err != nil {
				return err
			}
		case "file":
			data, err := e.ghRaw(fmt.Sprintf("/repos/%s/%s/contents/%s?ref=%s", repo.Owner, repo.Repo, ent.Path, branch))
			if err != nil {
				return err
			}
			if err := os.WriteFile(filepath.Join(dst, ent.Name), data, 0o644); err != nil {
				return err
			}
		}
	}
	return nil
}

// installFromLocal 从本地源目录复制(离线/开发)。
func (e *ExtStore) installFromLocal(name string) error {
	if e.srcDir == "" {
		return fmt.Errorf("未配置本地扩展源")
	}
	src := filepath.Join(e.srcDir, name)
	if st, err := os.Stat(src); err != nil || !st.IsDir() {
		return fmt.Errorf("本地源无此扩展: %s", name)
	}
	return e.copyInto(src, name)
}

// copyInto 覆盖安装到 <dir>/<name>(先清旧目录, 避免残留旧产物)。
func (e *ExtStore) copyInto(src, name string) error {
	dst := filepath.Join(e.dir, name)
	if err := os.RemoveAll(dst); err != nil {
		return err
	}
	if err := os.MkdirAll(e.dir, 0o755); err != nil {
		return err
	}
	return Copy(src, dst)
}

// Remove 卸载扩展。
func (e *ExtStore) Remove(name string) error {
	if !validExtName(name) {
		return fmt.Errorf("非法扩展名: %q", name)
	}
	if isBuiltinName(name) {
		return fmt.Errorf("%s 是内置功能, 不可卸载", name)
	}
	if _, ok := e.InstalledByName(name); !ok {
		return fmt.Errorf("扩展未安装: %s", name)
	}
	return os.RemoveAll(filepath.Join(e.dir, name))
}

// AssetPath 解析扩展静态产物路径(防目录穿越), 返回绝对路径。
func (e *ExtStore) AssetPath(name, rel string) (string, bool) {
	if !validExtName(name) {
		return "", false
	}
	rel = strings.TrimPrefix(rel, "/")
	if rel == "" {
		return "", false
	}
	base := filepath.Join(e.dir, name)
	full := filepath.Join(base, filepath.Clean("/"+rel))
	if full != base && !strings.HasPrefix(full, base+string(os.PathSeparator)) {
		return "", false
	}
	st, err := os.Stat(full)
	if err != nil || st.IsDir() {
		return "", false
	}
	return full, true
}
