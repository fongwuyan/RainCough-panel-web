package main

import (
	"archive/tar"
	"compress/gzip"
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

type backupInfo struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	Time int64  `json:"time"`
}

func (s *server) backupDir() string { return filepath.Join(s.cfg.BaseDir, "data", "backups") }

func (s *server) listBackups() []backupInfo {
	ents, _ := os.ReadDir(s.backupDir())
	out := make([]backupInfo, 0)
	for _, e := range ents {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".tar.gz") {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, backupInfo{Name: e.Name(), Size: fi.Size(), Time: fi.ModTime().Unix()})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Time > out[j].Time })
	return out
}

func (s *server) handleBackup(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": s.listBackups()})
	case http.MethodPost:
		name, err := s.createBackup()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "name": name})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "method not allowed"})
	}
}

func (s *server) handleBackupRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "POST required"})
		return
	}
	var b struct {
		Name   string `json:"name"`
		DryRun bool   `json:"dry_run"`
	}
	if json.NewDecoder(r.Body).Decode(&b) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	name := filepath.Base(strings.TrimSpace(b.Name))
	p := filepath.Join(s.backupDir(), name)
	if name == "" || name == "." || !strings.HasSuffix(name, ".tar.gz") {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "备份名非法"})
		return
	}
	if _, err := os.Stat(p); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "备份不存在"})
		return
	}
	allowed := func(n string) bool {
		n = filepath.ToSlash(filepath.Clean("/" + n))[1:]
		if n == "VERSION" || n == "releases.json" {
			return true
		}
		if strings.HasPrefix(n, "data/") && !strings.HasPrefix(n, "data/backups/") && !strings.HasPrefix(n, "data/trash/") {
			return true
		}
		if strings.HasPrefix(n, "plugins/") && strings.HasSuffix(n, "/config.json") {
			return true
		}
		return false
	}
	safety := ""
	if !b.DryRun {
		if sn, err := s.createBackup(); err == nil {
			safety = sn
		}
	}
	f, err := os.Open(p)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
		return
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "不是合法 gzip: " + err.Error()})
		return
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	count := 0
	var total int64
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": err.Error()})
			return
		}
		if h.Typeflag != tar.TypeReg || !allowed(h.Name) {
			continue
		}
		count++
		total += h.Size
		if b.DryRun {
			continue
		}
		dst := filepath.Join(s.cfg.BaseDir, filepath.FromSlash(h.Name))
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		_, cerr := io.Copy(out, tr)
		out.Close()
		if cerr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": cerr.Error()})
			return
		}
	}
	if b.DryRun {
		writeJSON(w, http.StatusOK, map[string]interface{}{"dry_run": true, "files": count, "bytes": total, "name": name})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "files": count, "bytes": total, "safety_backup": safety, "restart_required": true})
}

func (s *server) handleBackupDownload(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(r.URL.Query().Get("name"))
	if name == "" || name == "." || !strings.HasSuffix(name, ".tar.gz") {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "name 非法"})
		return
	}
	p := filepath.Join(s.backupDir(), name)
	if _, err := os.Stat(p); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "备份不存在"})
		return
	}
	w.Header().Set("Content-Disposition", "attachment; filename="+name)
	http.ServeFile(w, r, p)
}

func (s *server) createBackup() (string, error) {
	if err := os.MkdirAll(s.backupDir(), 0o700); err != nil {
		return "", err
	}
	name := "backup-" + time.Now().Format("20060102-150405") + ".tar.gz"
	p := filepath.Join(s.backupDir(), name)
	f, err := os.Create(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	gz := gzip.NewWriter(f)
	defer gz.Close()
	tw := tar.NewWriter(gz)
	defer tw.Close()

	add := func(src, rel string) error {
		fi, err := os.Stat(src)
		if err != nil || !fi.Mode().IsRegular() {
			return nil
		}
		h := &tar.Header{Name: filepath.ToSlash(rel), Mode: 0o600, Size: fi.Size(), ModTime: fi.ModTime()}
		if err := tw.WriteHeader(h); err != nil {
			return err
		}
		in, err := os.Open(src)
		if err != nil {
			return err
		}
		defer in.Close()
		_, err = io.Copy(tw, in)
		return err
	}
	// 面板元数据
	for _, n := range []string{"VERSION", "releases.json"} {
		_ = add(filepath.Join(s.cfg.BaseDir, n), n)
	}
	// data 下除 backups/trash 之外的配置/状态
	_ = filepath.Walk(filepath.Join(s.cfg.BaseDir, "data"), func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil || !info.Mode().IsRegular() {
			return nil
		}
		rel, _ := filepath.Rel(s.cfg.BaseDir, path)
		if strings.HasPrefix(filepath.ToSlash(rel), "data/backups/") || strings.HasPrefix(filepath.ToSlash(rel), "data/trash/") {
			return nil
		}
		return add(path, rel)
	})
	// 每个插件根 config.json
	ents, _ := os.ReadDir(s.cfg.PluginsDir)
	for _, e := range ents {
		if !e.IsDir() {
			continue
		}
		_ = add(filepath.Join(s.cfg.PluginsDir, e.Name(), "config.json"), filepath.Join("plugins", e.Name(), "config.json"))
	}
	manifest := map[string]interface{}{"version": "1.0.2", "created": time.Now().Unix(), "base": s.cfg.BaseDir}
	b, _ := json.MarshalIndent(manifest, "", "  ")
	if err := tw.WriteHeader(&tar.Header{Name: "backup-manifest.json", Mode: 0o600, Size: int64(len(b)), ModTime: time.Now()}); err != nil {
		return "", err
	}
	if _, err := tw.Write(b); err != nil {
		return "", err
	}
	if err := tw.Close(); err != nil {
		return "", err
	}
	if err := gz.Close(); err != nil {
		return "", err
	}
	fi, err := os.Stat(p)
	if err != nil {
		return "", err
	}
	if fi.Size() == 0 {
		return "", fmt.Errorf("备份为空")
	}
	return name, nil
}
