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
		fe := FileEntry{
			Name:  e.Name(),
			Path:  filepath.Join(dir, e.Name()),
			IsDir: e.IsDir(),
			Size:  info.Size(),
			MTime: info.ModTime().Unix(),
			Mode:  info.Mode().String(),
		}
		if !e.IsDir() {
			fe.Extension = strings.TrimPrefix(filepath.Ext(e.Name()), ".")
		}
		out = append(out, fe)
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
func DirSize(path string) (int64, error) {
	var total int64
	err := filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total, err
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
