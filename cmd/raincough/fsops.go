package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// 文件操作工具: 替代 cp -a / tar 等外部命令, 全部走标准库。

// copyTreeInto 把 src 目录内容合并覆盖到 dst。
// 必须先删目标再写: 运行中的可执行文件不能被 truncate 打开(ETXTBSY),
// 直接覆盖会得到 "text file busy"; 删掉路径只是解除链接, 进程照常运行。
func copyTreeInto(src, dst string) (string, error) {
	src = filepath.Clean(src)
	dst = filepath.Clean(dst)
	err := filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return os.MkdirAll(dst, 0o755)
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm())
		}
		if info.Mode()&os.ModeSymlink != 0 {
			link, err := os.Readlink(path)
			if err != nil {
				return err
			}
			_ = os.Remove(target)
			return os.Symlink(link, target)
		}
		return copyFileInto(path, target, info.Mode().Perm())
	})
	if err != nil {
		return err.Error(), err
	}
	return "", nil
}

// copyFileInto 复制单文件(先删后建, 避开 ETXTBSY)。
func copyFileInto(src, dst string, perm os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	_ = os.Remove(dst)
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	if err := out.Sync(); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// copyDir 递归复制目录(备份用)。
func copyDir(src, dst string) error {
	src = filepath.Clean(src)
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm())
		}
		if info.Mode()&os.ModeSymlink != 0 {
			link, err := os.Readlink(path)
			if err != nil {
				return err
			}
			_ = os.Remove(target)
			return os.Symlink(link, target)
		}
		return copyFileInto(path, target, info.Mode().Perm())
	})
}

// safeJoin 防路径穿越。
func safeJoin(base, rel string) (string, error) {
	full := filepath.Join(base, filepath.Clean("/"+rel))
	if !strings.HasPrefix(full, filepath.Clean(base)+string(filepath.Separator)) {
		return "", fmt.Errorf("非法路径: %s", rel)
	}
	return full, nil
}
