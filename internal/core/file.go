// Package core 主系统核心功能(系统功能, 开发者维护)。
package core

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// ---- 文件管理(与旧面板 /api/fm/* 契约兼容) ----

// FileEntry 文件列表项。
type FileEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"is_dir"`
	Size      int64  `json:"size"`
	MTime     int64  `json:"mtime"`
	Mode      string `json:"mode,omitempty"`
	Extension string `json:"ext,omitempty"`
	// Kind 取值域与前端 kindName/kindIcon 完全一致:
	// dir|image|video|audio|archive|text|file —— 前端的类型列、图标、
	// 文本"查看/编辑"、图片灯箱、右键"解压"全部由它把门, 缺失即整组功能失效。
	Kind string `json:"kind"`
	// 软链接信息(前端链接箭头 + 悬停提示)
	IsLink     bool   `json:"is_link"`
	LinkTarget string `json:"link_target,omitempty"`
}

// fmExtSet 扩展名集合(小写、不带点)。
func fmExtSet(items ...string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, s := range items {
		m[s] = true
	}
	return m
}

var (
	fmImageExt   = fmExtSet("jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tif", "tiff", "heic", "heif", "avif", "raw")
	fmVideoExt   = fmExtSet("mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpg", "mpeg", "ts", "m2ts")
	fmAudioExt   = fmExtSet("mp3", "wav", "flac", "ogg", "aac", "m4a", "wma", "opus", "mid", "midi")
	fmArchiveExt = fmExtSet("zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "zst", "lz4", "lzma", "iso", "jar")
	fmTextExt    = fmExtSet("txt", "md", "log", "json", "xml", "yaml", "yml", "ini", "conf", "cfg", "csv", "tsv",
		"html", "htm", "css", "js", "mjs", "cjs", "ts", "jsx", "tsx", "vue", "go", "py", "sh", "bash", "zsh",
		"fish", "java", "c", "cpp", "h", "hpp", "cs", "rb", "php", "sql", "toml", "env", "rst", "bat", "ps1", "lock")
	// 无扩展名但天然是文本的文件名
	fmTextNames = fmExtSet("dockerfile", "makefile", "license", "readme", "procfile", "gemfile", "rakefile",
		".gitignore", ".gitattributes", ".editorconfig", ".bashrc", ".profile", ".npmrc", ".env", ".vimrc")
)

// FileKind 文件分类(与前端 kindName/kindIcon 的键一一对应)。
func FileKind(isDir bool, name string) string {
	if isDir {
		return "dir"
	}
	// 先按【整名】匹配: Dockerfile/README/.gitignore/.env 等
	// (注意 .gitignore 的 filepath.Ext 是 ".gitignore", 走扩展会判成 file)
	if fmTextNames[strings.ToLower(name)] {
		return "text"
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	if ext == "" {
		return "file"
	}
	switch {
	case fmImageExt[ext]:
		return "image"
	case fmVideoExt[ext]:
		return "video"
	case fmAudioExt[ext]:
		return "audio"
	case fmArchiveExt[ext]:
		return "archive"
	case fmTextExt[ext]:
		return "text"
	}
	return "file"
}

// EntryFrom 由目录项构造列表项(ListDir 与搜索结果共用同一口径)。
func EntryFrom(dir, name string, info os.FileInfo) FileEntry {
	fe := FileEntry{
		Name:  name,
		Path:  filepath.Join(dir, name),
		IsDir: info.IsDir(),
		Size:  info.Size(),
		MTime: info.ModTime().Unix(),
		Mode:  info.Mode().String(),
		Kind:  FileKind(info.IsDir(), name),
	}
	if info.Mode()&os.ModeSymlink != 0 {
		fe.IsLink = true
		if t, err := os.Readlink(fe.Path); err == nil {
			fe.LinkTarget = t
		}
	}
	if !info.IsDir() {
		fe.Extension = strings.TrimPrefix(filepath.Ext(name), ".")
	}
	return fe
}

const (
	ReadLimitMax = 5 * 1024 * 1024  // 在线编辑最大读 5MB
	SaveLimitMax = 10 * 1024 * 1024 // 保存最大 10MB
	PreviewLimit = 512 * 1024       // 预览最大 512KB
	UploadChunk  = 8 * 1024 * 1024  // 分块 8MB
)

// ListDir 列出目录(排序: 目录优先, 再按名称)。
func ListDir(dir string) ([]FileEntry, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]FileEntry, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, EntryFrom(dir, e.Name(), info))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	return out, nil
}

// ReadFileText 读取文本文件(限制大小)。
func ReadFileText(path string, limit int64) (string, bool, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", false, err
	}
	defer f.Close()
	// 判定是否超限
	st, err := f.Stat()
	if err != nil {
		return "", false, err
	}
	if st.Size() > limit {
		return "", true, fmt.Errorf("文件过大 (%d > %d 字节)", st.Size(), limit)
	}
	b, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil {
		return "", false, err
	}
	return string(b), false, nil
}

// SaveFileText 写入文本文件(限制大小)。
func SaveFileText(path string, content []byte, limit int64) error {
	if int64(len(content)) > limit {
		return fmt.Errorf("内容过大 (%d > %d 字节)", len(content), limit)
	}
	// 原子写入: 临时文件 + rename
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".rc_save_*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.Write(content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

// Mkdir 创建目录(含父级)。
func Mkdir(path string) error {
	return os.MkdirAll(path, 0o755)
}

// Rename 重命名/移动。
func Rename(oldPath, newPath string) error {
	// 目标已存在(非目录)时 Windows/Go rename 会失败, 统一走 rename(兼容 linux)
	return os.Rename(oldPath, newPath)
}

// Copy 复制文件或目录。
func Copy(src, dst string) error {
	st, err := os.Stat(src)
	if err != nil {
		return err
	}
	if st.IsDir() {
		return copyDir(src, dst)
	}
	return copyFile(src, dst)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, path)
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyFile(path, target)
	})
}

// Delete 删除文件或目录。
func Delete(path string) error {
	return os.RemoveAll(path)
}

// DirSize 计算目录总大小(byte)。
// 注意: 遇到不可读项(如 700 root 目录)【跳过继续】, 绝不中断统计 ——
// 旧实现一处权限错误即中止, 导致 /tmp 这类目录被严重低报(实测 31.5M vs 真实 1.1G)。
func DirSize(path string) (int64, error) {
	var total int64
	_ = filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // 跳过不可读文件/目录, 继续累计
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total, nil
}

// PreviewType 由扩展名推断预览类型。
func PreviewType(name string) string {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return "image"
	case ".mp4", ".webm", ".mkv", ".mov", ".avi":
		return "video"
	case ".mp3", ".wav", ".flac", ".ogg", ".m4a":
		return "audio"
	case ".pdf":
		return "pdf"
	default:
		return "text"
	}
}

// FileHash 计算文件 MD5。
func FileHash(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := md5.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// SafeJoin 安全拼接: 拒绝路径穿越。
func SafeJoin(base, name string) (string, error) {
	// 拒绝含 .. / 绝对路径 / 反斜杠(跨平台: Windows 反斜杠也是危险字符)
	if strings.Contains(name, "..") || strings.HasPrefix(name, "/") ||
		strings.HasPrefix(name, "\\") || strings.Contains(name, "\\") {
		return "", fmt.Errorf("非法路径: %q", name)
	}
	cleanBase := strings.TrimRight(base, "/\\")
	p := cleanBase + "/" + name
	return p, nil
}

var _ = time.Now
