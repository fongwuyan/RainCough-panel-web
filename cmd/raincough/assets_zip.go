package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type assetZipItem struct {
	Plugin string `json:"plugin"`
	Path   string `json:"path"`
}

func (s *server) handleAssetsZip(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Items []assetZipItem `json:"items"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if len(b.Items) == 0 || len(b.Items) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "一次打包 1-500 个资产"})
		return
	}
	tmp, err := os.CreateTemp("", "rc-assets-*.zip")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	name := tmp.Name()
	defer os.Remove(name)
	defer tmp.Close()
	zw := zip.NewWriter(tmp)
	used := map[string]int{}
	count := 0
	for _, it := range b.Items {
		p, err := s.assetPath(it.Plugin, it.Path)
		if err != nil {
			continue
		}
		fi, err := os.Stat(p)
		if err != nil || !fi.Mode().IsRegular() {
			continue
		}
		entryName := filepath.ToSlash(filepath.Join(it.Plugin, it.Path))
		if n := used[entryName]; n > 0 {
			entryName = fmt.Sprintf("%s (%d)", entryName, n)
		}
		used[entryName]++
		h, err := zip.FileInfoHeader(fi)
		if err != nil {
			continue
		}
		h.Name = strings.TrimPrefix(entryName, "/")
		h.Method = zip.Deflate
		dst, err := zw.CreateHeader(h)
		if err != nil {
			continue
		}
		src, err := os.Open(p)
		if err != nil {
			continue
		}
		_, cerr := io.Copy(dst, src)
		src.Close()
		if cerr != nil {
			continue
		}
		count++
	}
	if err := zw.Close(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	if count == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "没有可打包的资产"})
		return
	}
	if _, err := tmp.Seek(0, io.SeekStart); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="raincough-assets.zip"`)
	_, _ = io.Copy(w, tmp)
}
