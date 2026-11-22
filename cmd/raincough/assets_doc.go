package main

import (
	"archive/zip"
	"encoding/xml"
	"html"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
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

func xlsxText(z *zip.ReadCloser) string {
	shared := []string{}
	if f := findZipFile(z, "xl/sharedStrings.xml"); f != nil {
		if rc, err := f.Open(); err == nil {
			b, _ := io.ReadAll(io.LimitReader(rc, 4<<20))
			rc.Close()
			var sst struct {
				SI []struct {
					T string `xml:"t"`
					R []struct {
						T string `xml:"t"`
					} `xml:"r"`
				} `xml:"si"`
			}
			if xml.Unmarshal(b, &sst) == nil {
				for _, si := range sst.SI {
					if si.T != "" {
						shared = append(shared, html.UnescapeString(si.T))
					} else {
						var sb strings.Builder
						for _, r := range si.R {
							sb.WriteString(r.T)
						}
						shared = append(shared, html.UnescapeString(sb.String()))
					}
				}
			}
		}
	}
	var names []string
	for _, f := range z.File {
		if strings.HasPrefix(f.Name, "xl/worksheets/sheet") && strings.HasSuffix(f.Name, ".xml") {
			names = append(names, f.Name)
		}
	}
	sort.Strings(names)
	var out []string
	for _, name := range names {
		f := findZipFile(z, name)
		if f == nil {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			continue
		}
		b, _ := io.ReadAll(io.LimitReader(rc, 8<<20))
		rc.Close()
		var sheet struct {
			Rows []struct {
				Cells []struct {
					R  string `xml:"r,attr"`
					T  string `xml:"t,attr"`
					V  string `xml:"v"`
					IS struct {
						T string `xml:"t"`
					} `xml:"is"`
				} `xml:"c"`
			} `xml:"sheetData>row"`
		}
		if xml.Unmarshal(b, &sheet) != nil {
			continue
		}
		out = append(out, "--- "+filepath.Base(name)+" ---")
		for _, row := range sheet.Rows {
			vals := make([]string, 0, len(row.Cells))
			for _, c := range row.Cells {
				v := c.V
				if c.T == "s" {
					if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && n >= 0 && n < len(shared) {
						v = shared[n]
					}
				} else if c.T == "inlineStr" {
					v = c.IS.T
				}
				vals = append(vals, strings.ReplaceAll(strings.ReplaceAll(v, "\t", " "), "\n", " "))
			}
			out = append(out, strings.Join(vals, "\t"))
		}
	}
	return strings.Join(out, "\n")
}

func findZipFile(z *zip.ReadCloser, name string) *zip.File {
	for _, f := range z.File {
		if f.Name == name {
			return f
		}
	}
	return nil
}

// handleAssetDoc GET /api/assets/doc?plugin=&path=
// 仅提取 docx/pptx/xlsx 的文本；不执行宏、不解析外部关系。
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
	if ext != ".docx" && ext != ".pptx" && ext != ".xlsx" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "仅支持 docx/pptx/xlsx 文本预览"})
		return
	}
	z, err := zip.OpenReader(p)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "无法打开文档: " + err.Error()})
		return
	}
	defer z.Close()
	var parts []string
	if ext == ".xlsx" {
		parts = append(parts, xlsxText(z))
	} else if ext == ".docx" {
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
