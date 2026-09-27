package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// ---- 文件管理: 搜索 + 分块上传 合同测试 ----

// fmTestRoot 建临时根并把 fmRoots 限定到它(避免测试期间越权/污染真实文件)。
func fmTestRoot(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	old := fmRoots
	fmRoots = []string{dir}
	t.Cleanup(func() { fmRoots = old })
	return dir
}

func fmJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var m map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("响应非 JSON: %v body=%s", err, rec.Body.String())
	}
	return m
}

func results(t *testing.T, m map[string]interface{}) []map[string]interface{} {
	t.Helper()
	arr, _ := m["results"].([]interface{})
	out := make([]map[string]interface{}, 0, len(arr))
	for _, v := range arr {
		if mm, ok := v.(map[string]interface{}); ok {
			out = append(out, mm)
		}
	}
	return out
}

func fmSearch(t *testing.T, s *server, root, query string) map[string]interface{} {
	t.Helper()
	req := httptest.NewRequest("GET", "/api/fm/search?"+query, nil)
	rec := httptest.NewRecorder()
	s.handleFmSearch(rec, req, root)
	if rec.Code != 200 {
		t.Fatalf("search code=%d body=%s", rec.Code, rec.Body.String())
	}
	return fmJSON(t, rec)
}

func TestFmSearchHandler(t *testing.T) {
	root := fmTestRoot(t)
	mk := func(p string, data string) {
		if err := os.WriteFile(filepath.Join(root, p), []byte(data), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(root, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	mk("hello.txt", "hello world")
	mk("a.png", "png")
	mk(filepath.Join("sub", "c.md"), "md")
	mk(filepath.Join("sub", "d.zip"), "zip")

	s := &server{}

	// 1) 名称匹配
	m := fmSearch(t, s, root, "q=hello")
	rs := results(t, m)
	if len(rs) != 1 || rs[0]["name"] != "hello.txt" {
		t.Fatalf("q=hello 结果异常: %+v", rs)
	}
	if m["has_more"] != false {
		t.Fatal("has_more 应为 false")
	}
	if off, _ := m["offset"].(float64); int(off) != 0 {
		t.Fatalf("offset 应回显 0, 实际 %v", m["offset"])
	}
	// 2) kind=archive → 只有 zip
	rs = results(t, fmSearch(t, s, root, "kind=archive"))
	if len(rs) != 1 || rs[0]["name"] != "d.zip" {
		t.Fatalf("kind=archive 结果异常: %+v", rs)
	}
	// 3) kind=text → txt + md(跨子目录)
	rs = results(t, fmSearch(t, s, root, "kind=text"))
	if len(rs) != 2 {
		t.Fatalf("kind=text 应 2 条, 实际 %d: %+v", len(rs), rs)
	}
	// 4) kind 必须是前端认识的 7 种之一(含 dir)
	for _, r := range rs {
		k, _ := r["kind"].(string)
		switch k {
		case "dir", "image", "video", "audio", "archive", "text", "file":
		default:
			t.Fatalf("结果 kind 越界: %q", k)
		}
	}
	// 5) 偏移分页: offset=2 → 只剩后 2 条, 且 offset 回显 2
	m = fmSearch(t, s, root, "offset=2")
	rs = results(t, m)
	if len(rs) != 2 {
		t.Fatalf("offset=2 应剩 2 条, 实际 %d", len(rs))
	}
	if off, _ := m["offset"].(float64); int(off) != 2 {
		t.Fatalf("offset 回显错误: %v", m["offset"])
	}
	// 6) 大小过滤: max_size=5 → 只留 ≤5 字节的(a.png=3, d.zip=3), hello.txt(11)必须被排除
	rs = results(t, fmSearch(t, s, root, "max_size=5"))
	found := false
	for _, r := range rs {
		if r["name"] == "hello.txt" {
			t.Fatalf("max_size=5 不应包含 hello.txt: %+v", rs)
		}
		if r["name"] == "d.zip" {
			found = true
		}
	}
	if !found {
		t.Fatalf("max_size=5 应包含 d.zip: %+v", rs)
	}
	// 7) 响应必须带 results/has_more/offset 三个键(前端契约)
	for _, k := range []string{"results", "has_more", "offset"} {
		if _, ok := m[k]; !ok {
			t.Fatalf("缺少契约键 %s", k)
		}
	}
	// 8) 搜索起点不是目录 → 400
	req := httptest.NewRequest("GET", "/api/fm/search", nil)
	rec := httptest.NewRecorder()
	s.handleFmSearch(rec, req, filepath.Join(root, "hello.txt"))
	if rec.Code != 400 {
		t.Fatalf("文件路径作为起点应 400, 实际 %d", rec.Code)
	}
}

// fmChunk 发送一次分块请求。
func fmChunk(t *testing.T, s *server, fields map[string]string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	for k, v := range fields {
		if err := w.WriteField(k, v); err != nil {
			t.Fatal(err)
		}
	}
	if data != nil {
		fw, err := w.CreateFormFile("chunk", "chunk")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := fw.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/fm/upload/chunk", body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rec := httptest.NewRecorder()
	s.handleFmUploadChunk(rec, req)
	return rec
}

func fmFields(root, name, id, conflict string, idx, total int) map[string]string {
	return map[string]string{
		"path": root, "filename": name, "file_id": id,
		"chunk_index": strconv.Itoa(idx), "total_chunks": strconv.Itoa(total),
		"conflict": conflict,
	}
}

func TestFmUploadChunk(t *testing.T) {
	root := fmTestRoot(t)
	s := &server{}

	// 1) 单块上传
	rec := fmChunk(t, s, fmFields(root, "hello.txt", "id-1", "rename", 0, 1), []byte("Hello World"))
	if rec.Code != 200 {
		t.Fatalf("单块上传 code=%d body=%s", rec.Code, rec.Body.String())
	}
	if m := fmJSON(t, rec); m["ok"] != true {
		t.Fatalf("应 ok=true: %v", m)
	}
	got, err := os.ReadFile(filepath.Join(root, "hello.txt"))
	if err != nil || string(got) != "Hello World" {
		t.Fatalf("落盘内容错误: %q err=%v", string(got), err)
	}

	// 2) 同名 + rename → hello (1).txt
	rec = fmChunk(t, s, fmFields(root, "hello.txt", "id-2", "rename", 0, 1), []byte("second"))
	m := fmJSON(t, rec)
	if m["ok"] != true {
		t.Fatalf("rename 上传失败: %v", m)
	}
	p, _ := m["path"].(string)
	if !strings.HasSuffix(p, "hello (1).txt") {
		t.Fatalf("rename 未生效, path=%v", p)
	}

	// 3) 分块 2 块: 中间块 pending, 最后一块拼装
	rec = fmChunk(t, s, fmFields(root, "big.txt", "id-3", "overwrite", 0, 2), []byte("AAAA"))
	m = fmJSON(t, rec)
	if m["ok"] != true || m["pending"] != true {
		t.Fatalf("中间块响应错误: %v", m)
	}
	rec = fmChunk(t, s, fmFields(root, "big.txt", "id-3", "overwrite", 1, 2), []byte("BBBB"))
	m = fmJSON(t, rec)
	if m["ok"] != true {
		t.Fatalf("末块响应错误: %v", m)
	}
	got, _ = os.ReadFile(filepath.Join(root, "big.txt"))
	if string(got) != "AAAABBBB" {
		t.Fatalf("分块拼装错误: %q", string(got))
	}

	// 4) 同名 + skip → 不覆盖
	rec = fmChunk(t, s, fmFields(root, "big.txt", "id-4", "skip", 0, 1), []byte("XX"))
	m = fmJSON(t, rec)
	if m["ok"] != true || m["skipped"] != true {
		t.Fatalf("skip 策略错误: %v", m)
	}
	got, _ = os.ReadFile(filepath.Join(root, "big.txt"))
	if string(got) != "AAAABBBB" {
		t.Fatalf("skip 却覆盖了文件: %q", string(got))
	}

	// 5) 安全: 文件名路径穿越 → 400
	rec = fmChunk(t, s, fmFields(root, "../evil", "x", "rename", 0, 1), []byte("x"))
	if rec.Code != 400 {
		t.Fatalf("穿越文件名应 400, 实际 %d", rec.Code)
	}
	// 5b) 安全: file_id 路径穿越 → 400(不能拿它构造临时目录)
	rec = fmChunk(t, s, fmFields(root, "ok.txt", "../../evil", "rename", 0, 1), []byte("x"))
	if rec.Code != 400 {
		t.Fatalf("非法 file_id 应 400, 实际 %d", rec.Code)
	}
	// 6) 安全: 越界 chunk_index → 400
	rec = fmChunk(t, s, fmFields(root, "z.txt", "id-5", "rename", 5, 2), []byte("x"))
	if rec.Code != 400 {
		t.Fatalf("越界分块应 400, 实际 %d", rec.Code)
	}
	// 7) 安全: 反斜杠文件名(Windows 穿越) → 400
	rec = fmChunk(t, s, fmFields(root, `..\evil.sh`, "id-6", "rename", 0, 1), []byte("x"))
	if rec.Code != 400 {
		t.Fatalf("反斜杠文件名应 400, 实际 %d", rec.Code)
	}
	// 8) 越权: 目标不在 fmRoots 内 → 403
	outside := filepath.Clean(filepath.Join(root, "..", "outside"))
	rec = fmChunk(t, s, fmFields(outside, "x.txt", "id-7", "rename", 0, 1), []byte("x"))
	if rec.Code != 403 {
		t.Fatalf("越权目录应 403, 实际 %d", rec.Code)
	}
}

func TestFmUniquePath(t *testing.T) {
	dir := t.TempDir()
	p := fmUniquePath(dir, "a.txt")
	if filepath.Base(p) != "a.txt" {
		t.Fatalf("无冲突时应保持原名: %s", p)
	}
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("1"), 0o644); err != nil {
		t.Fatal(err)
	}
	p = fmUniquePath(dir, "a.txt")
	if filepath.Base(p) != "a (1).txt" {
		t.Fatalf("首个冲突应为 a (1).txt: %s", p)
	}
	if err := os.WriteFile(p, []byte("2"), 0o644); err != nil {
		t.Fatal(err)
	}
	p = fmUniquePath(dir, "a.txt")
	if filepath.Base(p) != "a (2).txt" {
		t.Fatalf("次个冲突应为 a (2).txt: %s", p)
	}
	// 无扩展名
	if err := os.WriteFile(filepath.Join(dir, "README"), []byte("r"), 0o644); err != nil {
		t.Fatal(err)
	}
	if base := filepath.Base(fmUniquePath(dir, "README")); base != "README (1)" {
		t.Fatalf("无扩展名冲突处理错误: %s", base)
	}
}
