package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"raincough/internal/shared"
)

// ---- 终端主机/命令 CRUD: 校验与数据防御(F3/F4/F5) + 排序契约(F2) ----

// termTestNS 建临时 sqlite 并初始化 termNS(测试后关闭)。
func termTestNS(t *testing.T) {
	t.Helper()
	dsn := "sqlite:///" + filepath.ToSlash(filepath.Join(t.TempDir(), "t.db"))
	sd, err := shared.OpenWithTimeout(dsn, 5*time.Second)
	if err != nil {
		t.Fatalf("open shared: %v", err)
	}
	t.Cleanup(func() { sd.Close() })
	initTermNS(sd)
	if termNS == nil {
		t.Fatal("termNS 未初始化")
	}
}

// termDo 以指定方法/请求体调用处理器。
func termDo(t *testing.T, fn func(http.ResponseWriter, *http.Request), method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, target, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	rec := httptest.NewRecorder()
	fn(rec, req)
	return rec
}

func termHosts(t *testing.T, s *server) []map[string]interface{} {
	t.Helper()
	rec := termDo(t, s.handleTermHosts, "GET", "/api/terminal/hosts", "")
	if rec.Code != 200 {
		t.Fatalf("GET hosts code=%d", rec.Code)
	}
	var arr []map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &arr); err != nil {
		t.Fatalf("GET hosts 非 JSON 数组: %s", rec.Body.String())
	}
	return arr
}

func TestTermHostsValidation(t *testing.T) {
	termTestNS(t)
	s := &server{}

	// [F3] 畸形项(缺 host)必须被过滤, 否则前端渲染"无名主机行"
	if err := termNS.Set("hosts", []map[string]interface{}{
		{"list": map[string]interface{}{}},
		{"host": "h1", "port": "22"},
	}); err != nil {
		t.Fatal(err)
	}
	list := termHosts(t, s)
	if len(list) != 1 || list[0]["host"] != "h1" {
		t.Fatalf("畸形项未被过滤: %+v", list)
	}

	// [F4] PUT 空体 → 400(原 200 静默)
	if rec := termDo(t, s.handleTermHosts, "PUT", "/api/terminal/hosts", ""); rec.Code != 400 {
		t.Fatalf("PUT 空体应 400, 实际 %d", rec.Code)
	}
	// [F4] PUT 缺 old_host → 400
	if rec := termDo(t, s.handleTermHosts, "PUT", "/api/terminal/hosts", `{"host":"h2"}`); rec.Code != 400 {
		t.Fatalf("PUT 缺 old_host 应 400, 实际 %d", rec.Code)
	}
	// [F4] PUT 未命中 → 404(原 200 静默)
	if rec := termDo(t, s.handleTermHosts, "PUT", "/api/terminal/hosts", `{"old_host":"nope","host":"h2"}`); rec.Code != 404 {
		t.Fatalf("PUT 未命中应 404, 实际 %d", rec.Code)
	}
	// [F4] PUT 合法 → 200 且真的改名
	if rec := termDo(t, s.handleTermHosts, "PUT", "/api/terminal/hosts", `{"old_host":"h1","host":"h1-renamed","port":"22"}`); rec.Code != 200 {
		t.Fatalf("PUT 合法应 200, 实际 %d body=%s", rec.Code, rec.Body.String())
	}
	if got := termHosts(t, s); len(got) != 1 || got[0]["host"] != "h1-renamed" {
		t.Fatalf("PUT 未生效: %+v", got)
	}

	// [F5] DELETE 无参 → 400(原 200)
	if rec := termDo(t, s.handleTermHosts, "DELETE", "/api/terminal/hosts", ""); rec.Code != 400 {
		t.Fatalf("DELETE 无参应 400, 实际 %d", rec.Code)
	}
	// DELETE 合法 → 200 且删除
	if rec := termDo(t, s.handleTermHosts, "DELETE", "/api/terminal/hosts?host=h1-renamed", ""); rec.Code != 200 {
		t.Fatalf("DELETE 合法应 200, 实际 %d", rec.Code)
	}
	if got := termHosts(t, s); len(got) != 0 {
		t.Fatalf("DELETE 未生效: %+v", got)
	}
}

func TestTermHostsSetSortContract(t *testing.T) {
	termTestNS(t)
	s := &server{}
	// [F2] 契约已定为 {hosts:[...]}: 旧的 sort_list 键必须 400(键名+形状双错的历史 bug)
	if rec := termDo(t, s.handleTermHostsSetSort, "POST", "/api/terminal/hosts/set_sort", `{"sort_list":{"a":0}}`); rec.Code != 400 {
		t.Fatalf("sort_list 键应 400, 实际 %d", rec.Code)
	}
	// 正确契约 → 200 且按给定顺序保存
	if rec := termDo(t, s.handleTermHostsSetSort, "POST", "/api/terminal/hosts/set_sort", `{"hosts":[{"host":"z1"},{"host":"a1"}]}`); rec.Code != 200 {
		t.Fatalf("hosts 键应 200, 实际 %d body=%s", rec.Code, rec.Body.String())
	}
	got := termHosts(t, s)
	if len(got) != 2 || got[0]["host"] != "z1" || got[1]["host"] != "a1" {
		t.Fatalf("排序未按给定顺序保存: %+v", got)
	}
}

func TestTermCommandsValidation(t *testing.T) {
	termTestNS(t)
	s := &server{}

	// [F3] 缺 title 的畸形项被过滤
	if err := termNS.Set("commands", []map[string]interface{}{
		{"list": map[string]interface{}{}},
		{"title": "c1", "shell": "bash"},
	}); err != nil {
		t.Fatal(err)
	}
	rec := termDo(t, s.handleTermCommands, "GET", "/api/terminal/commands", "")
	var arr []map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &arr); err != nil || len(arr) != 1 || arr[0]["title"] != "c1" {
		t.Fatalf("命令畸形项未被过滤: %s", rec.Body.String())
	}

	// [F4] PUT 空体/缺 old_title/缺 shell/未命中
	if rec := termDo(t, s.handleTermCommands, "PUT", "/api/terminal/commands", ""); rec.Code != 400 {
		t.Fatalf("PUT 空体应 400, 实际 %d", rec.Code)
	}
	if rec := termDo(t, s.handleTermCommands, "PUT", "/api/terminal/commands", `{"title":"t","shell":"sh"}`); rec.Code != 400 {
		t.Fatalf("PUT 缺 old_title 应 400, 实际 %d", rec.Code)
	}
	if rec := termDo(t, s.handleTermCommands, "PUT", "/api/terminal/commands", `{"old_title":"c1","title":"","shell":""}`); rec.Code != 400 {
		t.Fatalf("PUT 缺 title/shell 应 400, 实际 %d", rec.Code)
	}
	if rec := termDo(t, s.handleTermCommands, "PUT", "/api/terminal/commands", `{"old_title":"nope","title":"t","shell":"sh"}`); rec.Code != 404 {
		t.Fatalf("PUT 未命中应 404, 实际 %d", rec.Code)
	}
	// 合法编辑
	if rec := termDo(t, s.handleTermCommands, "PUT", "/api/terminal/commands", `{"old_title":"c1","title":"c1-renamed","shell":"zsh"}`); rec.Code != 200 {
		t.Fatalf("PUT 合法应 200, 实际 %d", rec.Code)
	}

	// [F5] DELETE 无参 → 400; 合法 → 200
	if rec := termDo(t, s.handleTermCommands, "DELETE", "/api/terminal/commands", ""); rec.Code != 400 {
		t.Fatalf("DELETE 无参应 400, 实际 %d", rec.Code)
	}
	if rec := termDo(t, s.handleTermCommands, "DELETE", "/api/terminal/commands?title=c1-renamed", ""); rec.Code != 200 {
		t.Fatalf("DELETE 合法应 200, 实际 %d", rec.Code)
	}
}
