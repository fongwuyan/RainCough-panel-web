package core

// 插件包"面板内直接安装"
//
// ★ 与「从仓库安装」是两套完全不同的逻辑, 不要混在一起改:
//
//	从仓库安装 (store.go InstallPlugin):
//	  读 registry.json → 下载【整仓 zipball】→ 从 `<repo>-<sha>/<name>/` 提取子目录
//	  —— 需要外网 + GitHub token(私有仓), 包结构由 GitHub 决定
//
//	面板内直接安装 (本文件 InstallFromPackage):
//	  用户上传【单个插件包】→ 解到临时目录 → 定位 plugin.json → 校验 v4 清单 → 落盘
//	  —— 完全离线, 不需要 token, 支持第三方/自研/离线部署的插件
//
// 支持的包格式: .zip / .tar.gz / .tgz / .tar (零依赖, 不支援 .tar.xz)
// 支持两种包内结构:
//   · 扁平:  plugin.json 在压缩包根目录
//   · 套一层目录: <随便什么名>/plugin.json  (常见于 git archive / zip -r 的产物)
//
// 校验:
//   · 必须能定位到 plugin.json 且符合 v4 契约(name/frontend.entry/backend.exec)
//   · 清单里的 name 必须是安全目录名(复用 validPluginName, 防路径穿越)
//   · 解压有 zip-slip 防护(复用 UnzipTo/untarReader)
//   · 包大小上限由调用方(http 层)控制
//
// 落盘:
//   · 先解到 pluginsDir/.<name>.installing-<ts> 临时目录
//   · 校验通过后原子 rename 到 pluginsDir/<name>; 已存在则先备份再替换, 失败自动回滚

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"raincough/internal/pluginx"
)

const (
	// PluginPackMaxBytes 单个插件包上限 —— 插件是静态 Go 二进制, 几十 MB 已很宽松
	PluginPackMaxBytes = 128 << 20 // 128MB
	// pluginPackTempPrefix 安装临时目录前缀(在 pluginsDir 下, 保证同一文件系统可原子 rename)
	pluginPackTempPrefix = ".installing-"
	pluginPackBackupDir  = ".backup"
)

// PluginPackInfo 面板内安装的结果摘要(给前端展示)
type PluginPackInfo struct {
	Name    string `json:"name"`
	Label   string `json:"label"`
	Version string `json:"version"`
	Author  string `json:"author,omitempty"`
	Dir     string `json:"dir"`
	Files   int    `json:"files"`
	Bytes   int64  `json:"bytes"`
	// Replaced 为 true 表示覆盖了同名旧版本
	Replaced bool `json:"replaced"`
}

// InstallFromPackage 把上传的插件包安装到 pluginsDir。
//
// filename 只用于判断压缩格式(按扩展名), 不用于决定安装目录 ——
// 安装目录一律取 plugin.json 里的 name, 避免"包名与插件名不一致"造成的错位安装
// (旧版系统扩展踩过: 错位后既打不开也卸不掉)。
//
// 返回安装信息; 出错时不会留下半个插件目录(已有同名插件保持原样)。
func InstallFromPackage(pkgPath, filename, pluginsDir string) (*PluginPackInfo, error) {
	if pluginsDir == "" {
		return nil, errors.New("插件目录未配置")
	}
	if err := os.MkdirAll(pluginsDir, 0o755); err != nil {
		return nil, fmt.Errorf("创建插件目录失败: %w", err)
	}

	// 1) 解到临时目录(与最终目录同一文件系统, 才能原子 rename)
	stamp := time.Now().UnixNano()
	tmpDir := filepath.Join(pluginsDir, fmt.Sprintf("%s%d", pluginPackTempPrefix, stamp))
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		return nil, fmt.Errorf("创建临时目录失败: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// 包扩展名必须与内容一致, 否则 extractArchive 会把内容当另一种格式解(报错信息也会很怪)
	ext := strings.ToLower(filename)
	src := filepath.Join(tmpDir, "package"+packExt(ext))
	if err := os.Rename(pkgPath, src); err != nil {
		// 跨设备等场景 rename 失败 → 退化为拷贝
		if err2 := copyFile(pkgPath, src); err2 != nil {
			return nil, fmt.Errorf("保存上传包失败: %w", err2)
		}
		_ = os.Remove(pkgPath)
	}
	unpackDir := filepath.Join(tmpDir, "unpack")
	if err := extractArchive(src, unpackDir); err != nil {
		return nil, fmt.Errorf("解压失败(仅支持 zip/tar/tar.gz): %w", err)
	}

	// 2) 定位插件根(plugin.json 所在目录)
	root, err := locatePluginRoot(unpackDir)
	if err != nil {
		return nil, err
	}

	// 3) 校验 v4 清单
	m, err := pluginx.LoadManifestV4(root)
	if err != nil {
		return nil, fmt.Errorf("插件清单无效: %w", err)
	}
	name := strings.TrimSpace(m.Name)
	if !validPluginName(name) {
		return nil, fmt.Errorf("插件清单里的 name 非法: %q", name)
	}

	// 4) 统计 + 补执行位
	files, bytes, err := chmodBackendExec(root, m.Backend.Exec)
	if err != nil {
		return nil, err
	}

	// 5) 落盘: 备份旧的 → 原子替换 → 失败回滚
	dst := filepath.Join(pluginsDir, name)
	replaced, err := replaceDir(root, dst)
	if err != nil {
		return nil, err
	}

	return &PluginPackInfo{
		Name: name, Label: m.Label, Version: m.Version, Author: m.Author,
		Dir: dst, Files: files, Bytes: bytes, Replaced: replaced,
	}, nil
}

// packExt 归一化扩展名(用于把上传的临时文件命名成 extractArchive 认识的名字)
func packExt(filename string) string {
	switch {
	case strings.HasSuffix(filename, ".zip"):
		return ".zip"
	case strings.HasSuffix(filename, ".tar.gz"):
		return ".tar.gz"
	case strings.HasSuffix(filename, ".tgz"):
		return ".tgz"
	case strings.HasSuffix(filename, ".tar"):
		return ".tar"
	default:
		return filepath.Ext(filename) // 让 extractArchive 自己报"不支持"
	}
}

// locatePluginRoot 在解压目录里找 plugin.json 所在目录。
//
//	优先根目录; 否则找"唯一一层子目录"里的 plugin.json(兼容 zip -r / git archive 产物)。
func locatePluginRoot(dir string) (string, error) {
	// 根目录直接有
	if _, err := os.Stat(filepath.Join(dir, "plugin.json")); err == nil {
		return dir, nil
	}
	// 一层子目录(可能有 macOS 的 __MACOSX 之类的杂项目录, 逐个看)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}
	var hits []string
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), "__MACOSX") || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		sub := filepath.Join(dir, e.Name())
		if _, err := os.Stat(filepath.Join(sub, "plugin.json")); err == nil {
			hits = append(hits, sub)
		}
	}
	switch len(hits) {
	case 1:
		return hits[0], nil
	case 0:
		return "", errors.New("包内未找到 plugin.json(插件包根目录或唯一子目录下必须有它)")
	default:
		names := make([]string, 0, len(hits))
		for _, h := range hits {
			names = append(names, filepath.Base(h))
		}
		return "", fmt.Errorf("包内有多个 plugin.json(%s), 一个插件包只能装一个插件",
			strings.Join(names, ", "))
	}
}

// chmodBackendExec 给清单声明的后端二进制补执行位。
// 必要: Windows 侧打包 / 某些 zip 工具会丢权限位, 装上后 supervisor fork 会 EACCES。
// 返回 (文件数, 总字节数)。
func chmodBackendExec(root string, exec []string) (int, int64, error) {
	files, total := 0, int64(0)
	err := filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		files++
		total += info.Size()
		return nil
	})
	if err != nil {
		return 0, 0, fmt.Errorf("扫描插件文件失败: %w", err)
	}
	for _, exe := range exec {
		exe = strings.TrimSpace(exe)
		if exe == "" {
			continue
		}
		// exec 可能是 "./bin/x" 或 "x", 统一按 root 相对路径解析; 绝对路径/穿越一律忽略
		rel := strings.TrimPrefix(exe, "./")
		if filepath.IsAbs(rel) || strings.Contains(rel, "..") {
			continue
		}
		p := filepath.Join(root, rel)
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			_ = os.Chmod(p, st.Mode()|0o111)
		}
	}
	return files, total, nil
}

// replaceDir 用 src 内容替换 dst 目录(原子性: 先挪走旧的, 再 rename 新的进来)。
//
//   - dst 不存在: 直接 rename
//   - dst 存在: 先 rename 到 .backup/<name>-<ts>, 再 rename 新的进来;
//     新的一步失败 → 把备份挪回去, 保证"要么老版本完整, 要么新版本完整"
//
// 返回 replaced 表示是否覆盖了旧目录。
func replaceDir(src, dst string) (bool, error) {
	parent := filepath.Dir(dst)
	name := filepath.Base(dst)

	if _, err := os.Stat(dst); os.IsNotExist(err) {
		if err := os.Rename(src, dst); err != nil {
			return false, fmt.Errorf("安装到 %s 失败: %w", dst, err)
		}
		return false, nil
	}

	// 已存在 → 备份
	bakRoot := filepath.Join(parent, pluginPackBackupDir)
	if err := os.MkdirAll(bakRoot, 0o700); err != nil {
		return false, fmt.Errorf("创建备份目录失败: %w", err)
	}
	bak := filepath.Join(bakRoot, fmt.Sprintf("%s-%d", name, time.Now().UnixNano()))
	if err := os.Rename(dst, bak); err != nil {
		return false, fmt.Errorf("备份旧版本失败(可能有进程占用): %w", err)
	}
	if err := os.Rename(src, dst); err != nil {
		// 回滚: 把备份挪回去
		if rbErr := os.Rename(bak, dst); rbErr != nil {
			return false, fmt.Errorf("安装新版本失败(%v), 且回滚也失败(%v), 旧版本在 %s", err, rbErr, bak)
		}
		return false, fmt.Errorf("安装新版本失败(已回滚到旧版本): %w", err)
	}
	// 成功 → 清掉本次备份(同 name 的旧备份一并清, 免得 .backup 无限膨胀)
	cleanupBackups(bakRoot, name)
	return true, nil
}

// cleanupBackups 删除某个插件名的历史备份(只保留刚成功替换后的最新目录已被 rename 走, 这里全删)
func cleanupBackups(bakRoot, name string) {
	entries, err := os.ReadDir(bakRoot)
	if err != nil {
		return
	}
	prefix := name + "-"
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), prefix) {
			_ = os.RemoveAll(filepath.Join(bakRoot, e.Name()))
		}
	}
}

// CleanupStaleInstalling 清理安装中途崩溃留下的临时目录(启动时调用, 尽力而为)。
func CleanupStaleInstalling(pluginsDir string) int {
	entries, err := os.ReadDir(pluginsDir)
	if err != nil {
		return 0
	}
	n := 0
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), pluginPackTempPrefix) {
			if os.RemoveAll(filepath.Join(pluginsDir, e.Name())) == nil {
				n++
			}
		}
	}
	return n
}
