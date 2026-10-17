package core

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// extractArchive 解压压缩包到目标目录(自动识别 .tar.gz/.tar.xz/.zip)。
func extractArchive(src, destDir string) error {
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return err
	}
	lower := strings.ToLower(src)
	switch {
	case strings.HasSuffix(lower, ".zip"):
		return UnzipTo(src, destDir)
	case strings.HasSuffix(lower, ".tar.gz"), strings.HasSuffix(lower, ".tgz"):
		return untarGzTo(src, destDir)
	case strings.HasSuffix(lower, ".tar.xz"):
		// xz 需外部 xz 命令(纯 Go 依赖重); 先用 tar 无压缩胶片
		return extractXZ(src, destDir)
	case strings.HasSuffix(lower, ".tar"):
		return untarTo(src, destDir)
	default:
		return fmt.Errorf("不支持的压缩格式: %s", src)
	}
}

// ExtractTarGz 解压 .tar.gz 到目标目录(供面板更新使用)。
func ExtractTarGz(src, destDir string) error { return untarGzTo(src, destDir) }

func untarGzTo(src, destDir string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()
	return untarReader(gz, destDir)
}

func untarTo(src, destDir string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()
	return untarReader(f, destDir)
}

func untarReader(r io.Reader, destDir string) error {
	tr := tar.NewReader(r)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		// 防 zip-slip
		target := filepath.Join(destDir, hdr.Name)
		if !strings.HasPrefix(target, filepath.Clean(destDir)+string(filepath.Separator)) {
			return fmt.Errorf("非法路径: %s", hdr.Name)
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				out.Close()
				return err
			}
			out.Close()
		}
	}
	return nil
}

// UnzipTo 解压 zip 到目标目录(zip-slip 防护, 保留文件权限)。
func UnzipTo(src, destDir string) error {
	zr, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer zr.Close()
	for _, f := range zr.File {
		target := filepath.Join(destDir, f.Name)
		if !strings.HasPrefix(target, filepath.Clean(destDir)+string(filepath.Separator)) {
			return fmt.Errorf("非法路径: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

// extractXZ xz 无标准库解码器, 零依赖前提下不支持(需要时请预先转成 tar.gz)。
func extractXZ(src, destDir string) error {
	return fmt.Errorf("不支持 .tar.xz(零依赖构建仅支持 zip/tar/tar.gz): %s", filepath.Base(src))
}
