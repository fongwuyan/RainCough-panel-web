package main

import (
	"archive/zip"
	"html"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var xmlTagRe = regexp.MustCompile(`<[^>]+>`)

func xmlText(b []byte) string {
	s := string(b)
	s = strings.ReplaceAll(s, "</w:p>", "\n")
	s = strings.ReplaceAll(s, "</a:p>", "\n")
	s = strings.ReplaceAll(s, "<w:br/>", "\n")
	s = xmlTagRe.ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	s = strings.ReplaceAll(s, "\r", "")
	for strings.Contains(s, "\n\n\n") {
		s = strings.ReplaceAll(s, "\n\n\n", "\n\n")
	}
	return strings.TrimSpace(s)
}

// handleAssetDoc GET /api/assets/doc?plugin=&path=
// 仅提取 docx/pptx 的文本；不执行宏、不解析外部关系。
func (s *server) handleAssetDoc(w http.ResponseWriter, r *http.Request) {
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
	ext := strings.ToLower(filepath.Ext(p))
	if ext != ".docx" && ext != ".pptx" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "仅支持 docx/pptx 文本预览"})
		return
	}
	z, err := zip.OpenReader(p)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "无法打开文档: " + err.Error()})
		return
	}
	defer z.Close()
	var parts []string
	if ext == ".docx" {
		for _, f := range z.File {
			if f.Name != "word/document.xml" {
				continue
			}
			rc, err := f.Open()
			if err != nil {
				continue
			}
			b, _ := io.ReadAll(io.LimitReader(rc, 4<<20))
			rc.Close()
			parts = append(parts, xmlText(b))
		}
	} else {
		var slides []*zip.File
		for _, f := range z.File {
			if strings.HasPrefix(f.Name, "ppt/slides/slide") && strings.HasSuffix(f.Name, ".xml") {
				slides = append(slides, f)
			}
		}
		sort.Slice(slides, func(i, j int) bool { return slides[i].Name < slides[j].Name })
		for _, f := range slides {
			rc, err := f.Open()
			if err != nil {
				continue
			}
			b, _ := io.ReadAll(io.LimitReader(rc, 2<<20))
			rc.Close()
			parts = append(parts, "--- "+filepath.Base(f.Name)+" ---\n"+xmlText(b))
		}
	}
	text := strings.Join(parts, "\n\n")
	if text == "" {
		text = "文档中没有可提取的文本。"
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = io.WriteString(w, text)
}
