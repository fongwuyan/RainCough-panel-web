package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"raincough/internal/core"
)

// handleFmBatchRename POST /api/fm/batch-rename
// 规则: 可选正则替换 + 前后缀 + 起始序号; 保留扩展名, 目录名不参与扩展名拆分。
func (s *server) handleFmBatchRename(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Paths    []string `json:"paths"`
		Find     string   `json:"find"`
		Replace  string   `json:"replace"`
		Prefix   string   `json:"prefix"`
		Suffix   string   `json:"suffix"`
		Start    int      `json:"start"`
		Padding  int      `json:"padding"`
		UseRegex bool     `json:"use_regex"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "bad json"})
		return
	}
	if len(b.Paths) == 0 || len(b.Paths) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "一次批量重命名 1-500 项"})
		return
	}
	if b.Padding < 0 || b.Padding > 12 {
		b.Padding = 0
	}
	var re *regexp.Regexp
	if b.UseRegex {
		var err error
		re, err = regexp.Compile(b.Find)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "正则无效: " + err.Error()})
			return
		}
	}

	type plan struct{ old, next string }
	plans := make([]plan, 0, len(b.Paths))
	for i, p := range b.Paths {
		abs, err := resolveFM(p)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": err.Error()})
			return
		}
		fi, err := os.Stat(abs)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "文件不存在: " + p})
			return
		}
		name := filepath.Base(abs)
		ext := ""
		stem := name
		if !fi.IsDir() {
			ext = filepath.Ext(name)
			stem = strings.TrimSuffix(name, ext)
		}
		if b.UseRegex {
			stem = re.ReplaceAllString(stem, b.Replace)
		} else if b.Find != "" {
			stem = strings.ReplaceAll(stem, b.Find, b.Replace)
		}
		if b.Start > 0 {
			n := strconv.Itoa(b.Start + i)
			if b.Padding > len(n) {
				n = strings.Repeat("0", b.Padding-len(n)) + n
			}
			stem = stem + n
		}
		next := b.Prefix + stem + b.Suffix + ext
		if next == "" || next == "." || next == ".." || strings.ContainsAny(next, `/\`) {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "生成的文件名非法: " + next})
			return
		}
		np := filepath.Join(filepath.Dir(abs), next)
		if np != abs {
			if _, err := os.Stat(np); err == nil {
				writeJSON(w, http.StatusConflict, map[string]interface{}{"error": "目标已存在: " + next})
				return
			}
		}
		plans = append(plans, plan{abs, np})
	}

	done := make([]map[string]string, 0, len(plans))
	for _, p := range plans {
		if p.old == p.next {
			continue
		}
		if err := core.Rename(p.old, p.next); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
				"error": fmt.Sprintf("重命名失败 %s: %v", filepath.Base(p.old), err),
				"done":  done,
			})
			return
		}
		done = append(done, map[string]string{"from": p.old, "to": p.next})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": true, "renamed": done, "count": len(done)})
}
