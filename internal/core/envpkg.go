package core

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ---- 环境包(与旧面板 envpkg.py 契约兼容) ----

// EnvRuntime 已安装的运行时。
type EnvRuntime struct {
	Name      string `json:"name"` // node-22 / python-3.11
	Type      string `json:"type"` // node|python|go|java|php|maven|cpp
	Version   string `json:"version"`
	Path      string `json:"path"`     // 安装根
	BinPath   string `json:"bin_path"` // bin 目录(注入 PATH)
	Installed int64  `json:"installed"`
	Size      int64  `json:"size,omitempty"`
	Running   bool   `json:"running,omitempty"` // 是否被某插件使用(简单标记)
}

// EnvManager 环境包管理器: 下载运行时/管理安装/提供运行前缀。
type EnvManager struct {
	root  string // ENV_ROOT 安装根
	ns    Namespacelike
	mu    sync.Mutex
	envs  map[string]*EnvRuntime
	tasks map[string]*EnvTask
}

// EnvTask 运行时装任务。
type EnvTask struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Status   string `json:"status"` // queued|running|done|failed
	Progress int    `json:"progress"`
	Message  string `json:"message"`
	Error    string `json:"error"`
}

// NewEnvManager 创建环境包管理器。
func NewEnvManager(root string, ns Namespacelike) *EnvManager {
	m := &EnvManager{
		root:  root,
		ns:    ns,
		envs:  map[string]*EnvRuntime{},
		tasks: map[string]*EnvTask{},
	}
	m.loadPersisted()
	return m
}

// List 已安装运行时。
func (m *EnvManager) List() []*EnvRuntime {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]*EnvRuntime, 0, len(m.envs))
	for _, e := range m.envs {
		out = append(out, e)
	}
	return out
}

// Get 单个运行时。
func (m *EnvManager) Get(name string) (*EnvRuntime, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.envs[name]
	return e, ok
}

// Has 是否已安装某 type-version。
func (m *EnvManager) Has(typ, version string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, e := range m.envs {
		if e.Type == typ && e.Version == version {
			return true
		}
	}
	return false
}

// EnvRunPrefix 返回某运行时的环境变量前缀(插件子进程注入 PATH 用)。
// 返回 nil 表示未安装。envpkg.env_run_prefix 的 Go 对应。
func (m *EnvManager) EnvRunPrefix(name string) (map[string]string, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.envs[name]
	if !ok {
		return nil, false
	}
	env := map[string]string{}
	if e.BinPath != "" {
		env["PATH"] = e.BinPath + ":" + os.Getenv("PATH")
	}
	// 常用运行时变量
	switch e.Type {
	case "node":
		env["NODE_HOME"] = e.Path
	case "python":
		env["PYTHON_HOME"] = e.Path
	case "go":
		env["GOROOT"] = e.Path
		env["GOPATH"] = filepath.Join(e.Path, "gopath")
	case "java":
		env["JAVA_HOME"] = e.Path
	}
	return env, true
}

// TaskStatus 查询安装任务。
func (m *EnvManager) TaskStatus(id string) (*EnvTask, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.tasks[id]
	return t, ok
}

// Install 后台安装运行时(下载 -> 解压 -> 登记)。异步执行。
func (m *EnvManager) Install(rtype, version string, downloader func(url, dest string) error) (string, error) {
	name := rtype + "-" + version
	// 已安装直接返回
	if _, ok := m.Get(name); ok {
		return "", fmt.Errorf("运行时已存在: %s", name)
	}
	id := "env-" + fmt.Sprint(time.Now().UnixNano())
	m.mu.Lock()
	m.tasks[id] = &EnvTask{ID: id, Name: name, Status: "queued", Progress: 0}
	m.mu.Unlock()

	go func() {
		m.setTask(id, func(t *EnvTask) {
			t.Status = "running"
			t.Message = "开始下载 " + name + " ..."
			t.Progress = 10
		})
		// 由宿主提供真实下载器(内网镜像/直连差异大)
		if downloader == nil {
			m.setTask(id, func(t *EnvTask) {
				t.Status = "failed"
				t.Error = "未配置下载器"
			})
			return
		}
		url := urlFor(rtype, version)
		// 保持 URL 的实际扩展名(如 .tar.xz), 否则解压走错分支
		ext := archiveExt(url)
		dest := filepath.Join(m.root, name+ext)
		if err := os.MkdirAll(m.root, 0o755); err != nil {
			m.failTask(id, err.Error())
			return
		}
		m.setTask(id, func(t *EnvTask) { t.Message = "下载中: " + name; t.Progress = 40 })
		if err := downloader(url, dest); err != nil {
			m.failTask(id, "下载失败: "+err.Error())
			return
		}
		m.setTask(id, func(t *EnvTask) { t.Message = "解压安装中..."; t.Progress = 70 })
		// 解压(安装根)
		installDir := filepath.Join(m.root, name)
		if err := extractArchive(dest, installDir); err != nil {
			m.failTask(id, "解压失败: "+err.Error())
			return
		}
		// 找 bin 目录(常见: <installDir>/<top>/bin 或直接 bin)
		binPath := discoverBinDir(installDir)

		m.mu.Lock()
		m.envs[name] = &EnvRuntime{
			Name: name, Type: rtype, Version: version,
			Path: installDir, BinPath: binPath,
			Installed: time.Now().Unix(),
			Size:      dirSizeQuick(installDir),
		}
		_ = m.ns.Set("env:"+name, m.envs[name])
		m.mu.Unlock()
		_ = os.Remove(dest) // 清理安装包

		m.setTask(id, func(t *EnvTask) {
			t.Status = "done"
			t.Progress = 100
			t.Message = "安装完成: " + binPath
		})
	}()
	return id, nil
}

// Uninstall 卸载运行时。
func (m *EnvManager) Uninstall(name string) error {
	m.mu.Lock()
	_, ok := m.envs[name]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("运行时不存在: %s", name)
	}
	delete(m.envs, name)
	_ = m.ns.Set("env:"+name, nil)
	m.mu.Unlock()
	return os.RemoveAll(filepath.Join(m.root, name))
}

// ---- 内部 ----

func (m *EnvManager) setTask(id string, fn func(t *EnvTask)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if t, ok := m.tasks[id]; ok {
		fn(t)
	}
}

func (m *EnvManager) failTask(id, errMsg string) {
	m.setTask(id, func(t *EnvTask) {
		t.Status = "failed"
		t.Error = errMsg
	})
}

// loadPersisted 启动恢复已安装运行时。
func (m *EnvManager) loadPersisted() {
	lister, ok := m.ns.(interface {
		List(prefix string, limit int) (map[string]interface{}, error)
	})
	if !ok {
		return
	}
	items, err := lister.List("env:", 1000)
	if err != nil {
		return
	}
	for k, v := range items {
		name := strings.TrimPrefix(k, "env:")
		if e, ok := v.(map[string]interface{}); ok {
			rt := &EnvRuntime{}
			str := func(key string) string {
				if s, ok := e[key].(string); ok {
					return s
				}
				return ""
			}
			rt.Name = str("name")
			rt.Type = str("type")
			rt.Version = str("version")
			rt.Path = str("path")
			rt.BinPath = str("bin_path")
			if n, ok := e["installed"].(float64); ok {
				rt.Installed = int64(n)
			}
			m.envs[name] = rt
		}
	}
}

// urlFor 运行时下载地址模板(实际由宿主覆盖为镜像)。
func urlFor(rtype, version string) string {
	switch rtype {
	case "node":
		return fmt.Sprintf("https://nodejs.org/dist/v%s/node-v%s-linux-x64.tar.xz", version, version)
	case "go":
		return fmt.Sprintf("https://go.dev/dl/go%s.linux-amd64.tar.gz", version)
	case "python":
		return fmt.Sprintf("https://www.python.org/ftp/python/%s/Python-%s.tgz", version, version)
	default:
		return fmt.Sprintf("https://mirror/not-configured/%s-%s", rtype, version)
	}
}

// archiveExt 从 URL 推断归档扩展名(.tar.gz/.tar.xz/.zip/.tgz)。
func archiveExt(url string) string {
	lower := strings.ToLower(url)
	switch {
	case strings.HasSuffix(lower, ".tar.gz"):
		return ".tar.gz"
	case strings.HasSuffix(lower, ".tar.xz"):
		return ".tar.xz"
	case strings.HasSuffix(lower, ".tgz"):
		return ".tgz"
	case strings.HasSuffix(lower, ".zip"):
		return ".zip"
	case strings.HasSuffix(lower, ".tar"):
		return ".tar"
	default:
		return ".tar.gz"
	}
}

// extractTarGz 解压 tar.gz(自动处理 .tar.xz)。
func extractTarGz(src, destDir string) error {
	return extractArchive(src, destDir)
}

// discoverBinDir 在安装根内找 bin 目录(取顶层第一个 bin)。
func discoverBinDir(installDir string) string {
	// 如果 installDir 本身有 bin
	if _, err := os.Stat(filepath.Join(installDir, "bin")); err == nil {
		return filepath.Join(installDir, "bin")
	}
	// 否则在顶层子目录里找
	entries, err := os.ReadDir(installDir)
	if err != nil {
		return installDir
	}
	for _, e := range entries {
		if e.IsDir() {
			p := filepath.Join(installDir, e.Name(), "bin")
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}
	return installDir
}

func dirSizeQuick(dir string) int64 {
	var total int64
	filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total
}

var _ = json.Marshal
