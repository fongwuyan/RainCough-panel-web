package main

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// extractTarGzStrip 解压 .tar.gz 并去掉第一层目录(等价 tar --strip-components=1)。
func extractTarGzStrip(src, destDir string) error {
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

	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return err
	}
	root := filepath.Clean(destDir)
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		name := strings.TrimPrefix(hdr.Name, "./")
		if i := strings.IndexByte(name, '/'); i >= 0 {
			name = name[i+1:] // 去第一层
		} else {
			continue // 顶层目录本身
		}
		if name == "" {
			continue
		}
		target := filepath.Join(destDir, name)
		if !strings.HasPrefix(target, root+string(filepath.Separator)) {
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
			out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode).Perm())
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
