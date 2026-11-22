package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"context"
	"io"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type archiveEntry struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	IsDir bool   `json:"is_dir"`
	Kind  string `json:"kind"`
}

const archiveMaxEntries = 5000
const archiveMaxEntryBytes = 64 << 20

func sevenZipBin() string {
	for _, n := range []string{"7z", "7zz", "7za"} {
		if p, err := exec.LookPath(n); err == nil {
			return p
		}
	}
	return ""
}

func archiveEntries7z(p string) ([]archiveEntry, error) {
	bin := sevenZipBin()
	if bin == "" {
		return nil, os.ErrInvalid
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, "l", "-slt", "-ba", p).Output()
	if err != nil {
		return nil, err
	}
	entries := make([]archiveEntry, 0)
	var name string
	var size int64
	var isDir bool
	flush := func() {
		if name == "" {
			return
		}
		entries = append(entries, archiveEntry{Name: name, Size: size, IsDir: isDir, Kind: assetKind(name)})
		name, size, isDir = "", 0, false
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			flush()
			continue
		}
		switch {
		case strings.HasPrefix(line, "Path = "):
			name = strings.TrimPrefix(line, "Path = ")
		case strings.HasPrefix(line, "Size = "):
			size = parseInt64(strings.TrimPrefix(line, "Size = "))
		case strings.HasPrefix(line, "Folder = "):
			isDir = strings.TrimPrefix(line, "Folder = ") == "+"
		}
	}
	flush()
	return entries, nil
}

func archiveReadEntry7z(p, name string) ([]byte, error) {
	bin := sevenZipBin()
	if bin == "" {
		return nil, os.ErrNotExist
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, bin, "x", "-so", p, name)
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	b, _ := io.ReadAll(io.LimitReader(pipe, archiveMaxEntryBytes+1))
	_ = cmd.Wait()
	if len(b) == 0 {
		return nil, os.ErrNotExist
	}
	return b, nil
}

func parseInt64(s string) int64 {
	var n int64
	for _, c := range s {
		if c < '0' || c > '9' {
			break
		}
		n = n*10 + int64(c-'0')
	}
	return n
}

func archiveEntries(p string) ([]archiveEntry, error) {
	lower := strings.ToLower(p)
	out := make([]archiveEntry, 0)
	add := func(name string, size int64, isDir bool) {
		if len(out) >= archiveMaxEntries {
			return
		}
		name = strings.TrimPrefix(filepath.ToSlash(name), "/")
		out = append(out, archiveEntry{Name: name, Size: size, IsDir: isDir, Kind: assetKind(name)})
	}
	switch {
	case strings.HasSuffix(lower, ".zip"):
		z, err := zip.OpenReader(p)
		if err != nil {
			return nil, err
		}
		defer z.Close()
		for _, f := range z.File {
			add(f.Name, int64(f.UncompressedSize64), f.FileInfo().IsDir())
		}
	case strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz"):
		f, err := os.Open(p)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		gz, err := gzip.NewReader(f)
		if err != nil {
			return nil, err
		}
		defer gz.Close()
		tr := tar.NewReader(gz)
		for {
			h, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				return nil, err
			}
			add(h.Name, h.Size, h.Typeflag == tar.TypeDir)
		}
	case strings.HasSuffix(lower, ".tar"):
		f, err := os.Open(p)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		tr := tar.NewReader(f)
		for {
			h, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				return nil, err
			}
			add(h.Name, h.Size, h.Typeflag == tar.TypeDir)
		}
	case strings.HasSuffix(lower, ".7z"), strings.HasSuffix(lower, ".rar"), strings.HasSuffix(lower, ".cb7"), strings.HasSuffix(lower, ".cbr"):
		return archiveEntries7z(p)
	default:
		return out, os.ErrInvalid
	}
	return out, nil
}

func archiveReadEntry(p, name string) ([]byte, error) {
	lower := strings.ToLower(p)
	name = strings.TrimPrefix(filepath.ToSlash(name), "/")
	switch {
	case strings.HasSuffix(lower, ".zip"):
		z, err := zip.OpenReader(p)
		if err != nil {
			return nil, err
		}
		defer z.Close()
		for _, f := range z.File {
			if strings.TrimPrefix(filepath.ToSlash(f.Name), "/") != name {
				continue
			}
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			defer rc.Close()
			return io.ReadAll(io.LimitReader(rc, archiveMaxEntryBytes+1))
		}
	case strings.HasSuffix(lower, ".tar.gz") || strings.HasSuffix(lower, ".tgz"):
		f, err := os.Open(p)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		gz, err := gzip.NewReader(f)
		if err != nil {
			return nil, err
		}
		defer gz.Close()
		return readTarEntry(tar.NewReader(gz), name)
	case strings.HasSuffix(lower, ".tar"):
		f, err := os.Open(p)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		return readTarEntry(tar.NewReader(f), name)
	case strings.HasSuffix(lower, ".7z"), strings.HasSuffix(lower, ".rar"), strings.HasSuffix(lower, ".cb7"), strings.HasSuffix(lower, ".cbr"):
		return archiveReadEntry7z(p, name)
	}
	return nil, os.ErrNotExist
}

func readTarEntry(tr *tar.Reader, name string) ([]byte, error) {
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if strings.TrimPrefix(filepath.ToSlash(h.Name), "/") != name {
			continue
		}
		return io.ReadAll(io.LimitReader(tr, archiveMaxEntryBytes+1))
	}
	return nil, os.ErrNotExist
}

func (s *server) handleAssetArchive(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "GET required"})
		return
	}
	q := r.URL.Query()
	p, err := s.assetPath(q.Get("plugin"), q.Get("path"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "路径非法"})
		return
	}
	entries, err := archiveEntries(p)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "不支持或无法读取该压缩包: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"entries": entries, "total": len(entries)})
}

func (s *server) handleAssetArchiveEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "GET required"})
		return
	}
	q := r.URL.Query()
	p, err := s.assetPath(q.Get("plugin"), q.Get("path"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "路径非法"})
		return
	}
	b, err := archiveReadEntry(p, q.Get("entry"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "压缩包内文件不存在或读取失败"})
		return
	}
	if len(b) > archiveMaxEntryBytes {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]interface{}{"error": "文件过大，不能在线预览"})
		return
	}
	if ct := mime.TypeByExtension(filepath.Ext(q.Get("entry"))); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.Header().Set("Content-Disposition", "inline")
	_, _ = w.Write(b)
}
