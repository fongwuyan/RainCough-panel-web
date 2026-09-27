package main

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"raincough/internal/core"
)

// ---- 文件管理: 名称/类型/大小/时间 搜索 ----
// 修复: 前端一直调用 GET /api/fm/search, 后端从未实现 → 实测 404, 搜索框完全不可用。
// 契约(对齐 FmMain.doSearch):
//   请求  ?path=&q=&kind=&min_size=&max_size=&mtime_days=&offset=
//   响应  {results:[FileEntry], offset:int, has_more:bool} (offset=本批起始, 前端续拉)

const (
	fmSearchPageSize = 200 // 每批条数(前端"加载更多"按 offset 续拉)
	fmSearchMaxVisit = 200000 // 单次遍历上限, 防根目录全盘遍历卡死
)

// fmSkipDirs 遍历时整体跳过的伪文件系统/运行时目录(无用户数据, 极慢)。
var fmSkipDirs = map[string]bool{
	"/proc": true,
	"/sys":  true,
	"/dev":  true,
	"/run":  true,
}

// fmAtoi 安全解析 int(失败返回 0)。
func fmAtoi(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

// fmAtoi64 安全解析 int64(失败返回 0)。
func fmAtoi64(s string) int64 {
	n, _ := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	return n
}

// handleFmSearch GET /api/fm/search
func (s *server) handleFmSearch(w http.ResponseWriter, r *http.Request, root string) {
	q := r.URL.Query()
	nameQ := strings.ToLower(strings.TrimSpace(q.Get("q")))
	kindF := q.Get("kind")
	minSize := fmAtoi64(q.Get("min_size"))
	maxSize := fmAtoi64(q.Get("max_size"))
	days := fmAtoi64(q.Get("mtime_days"))
	offset := fmAtoi(q.Get("offset"))
	if offset < 0 {
		offset = 0
	}
	var cutoff int64
	if days > 0 {
		cutoff = time.Now().Unix() - days*86400
	}

	if fi, err := os.Stat(root); err != nil || !fi.IsDir() {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "搜索起点不是目录: " + root})
		return
	}

	results := make([]core.FileEntry, 0, fmSearchPageSize)
	skipped, matched, visited := 0, 0, 0
	hasMore := false
	errStop := errors.New("search-stop")

	_ = filepath.Walk(root, func(p string, fi os.FileInfo, err error) error {
		if err != nil {
			return nil // 不可读项跳过, 不中断
		}
		if p == root {
			return nil
		}
		if visited >= fmSearchMaxVisit {
			hasMore = true
			return errStop
		}
		visited++
		if fi.IsDir() && fmSkipDirs[filepath.Clean(p)] {
			return filepath.SkipDir
		}

		name := filepath.Base(p)
		kind := core.FileKind(fi.IsDir(), name)
		keep := true
		if nameQ != "" && !strings.Contains(strings.ToLower(name), nameQ) {
			keep = false // 目录名不匹配仍需下探(子项可能匹配), 故只在此标记不收
		}
		if keep && kindF != "" && kind != kindF {
			keep = false
		}
		if keep && !fi.IsDir() {
			if minSize > 0 && fi.Size() < minSize {
				keep = false
			}
			if maxSize > 0 && fi.Size() > maxSize {
				keep = false
			}
			if cutoff > 0 && fi.ModTime().Unix() < cutoff {
				keep = false
			}
		}
		if keep && fi.IsDir() {
			// 目录只在"按名称命中"时作为结果(类型/大小/时间过滤针对文件)
			keep = nameQ != "" && strings.Contains(strings.ToLower(name), nameQ) &&
				(kindF == "" || kindF == "dir")
		}
		if !keep {
			return nil
		}

		matched++
		if skipped < offset {
			skipped++
			return nil
		}
		if len(results) < fmSearchPageSize {
			results = append(results, core.EntryFrom(filepath.Dir(p), name, fi))
			return nil
		}
		hasMore = true
		return errStop
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"results":  results,
		"offset":   offset,
		"has_more": hasMore,
		"matched":  matched,
		"scanned":  visited,
	})
}
