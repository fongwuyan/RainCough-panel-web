package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"raincough/internal/core"
	"raincough/internal/shared"
)

// ---- 系统扩展 API: 方法守卫 / 内置保护 / 安装链路 / 产物服务 ----

// extTestSetup 建临时目录与任务队列, 并把 globalExt 指向它(测试后还原)。
func extTestSetup(t *testing.T) (instDir, srcDir string) {
	t.Helper()
	root := t.TempDir()
	instDir = filepath.Join(root, "extensions")
	srcDir = filepath.Join(root, "extension-src", "extensions")
	if err := os.MkdirAll(instDir, 0o755); err != nil {
		t.Fatal(err)
	}

	// 任务队列(安装是异步任务)
	dsn := "sqlite:///" + filepath.ToSlash(filepath.Join(root, "t.db"))
	sd, err := shared.OpenWithTimeout(dsn, 5*time.Second)
	if err != nil {
		t.Fatalf("open shared: %v", err)
	}
	t.Cleanup(func() { sd.Close() })
	ns, err := sd.Namespace("core_tasks")
	if err != nil {
		t.Fatal(err)
	}
	oldTasks := globalTasks
	globalTasks = core.NewTaskStore(ns)
	t.Cleanup(func() { globalTasks = oldTasks })

	oldExt := globalExt
	globalExt = core.NewExtStore(instDir, srcDir, nil) // store=nil: 走本地源/错误分支
	t.Cleanup(func() { globalExt = oldExt })
	return instDir, srcDir
}

// writeTestExt 造扩展(含清单与产物)。
func writeTestExt(t *testing.T, root, name, version, label string) {
	t.Helper()
	dir := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	m := map[string]interface{}{
		"name": name, "label": label, "version": version,
		"entry": "assets/extension.js", "route": "/ext/" + name,
	}
	raw, _ := json.Marshal(m)
	if err := os.WriteFile(filepath.Join(dir, "extension.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "extension.js"),
		[]byte("window.__rcExt__=window.__rcExt__||{};window.__rcExt__."+name+"={mount:function(){}};"), 0o644); err != nil {
		t.Fatal(err)
	}
}

func extDo(t *testing.T, fn func(http.ResponseWriter, *http.Request), method, target, body string) *httptest.ResponseRecorder {
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

func TestExtListBuiltinsAndGuards(t *testing.T) {
	extTestSetup(t)
	s := &server{}

	// GET /api/ext: 内置 7 项 + 已装 0 条
	rec := extDo(t, s.handleExtList, "GET", "/api/ext", "")
	if rec.Code != 200 {
		t.Fatalf("GET /api/ext code=%d", rec.Code)
	}
	var d struct {
		Extensions []core.Extension `json:"extensions"`
		Builtin    []core.Extension `json:"builtin"`
		Dir        string           `json:"dir"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &d); err != nil {
		t.Fatalf("非 JSON: %s", rec.Body.String())
	}
	if len(d.Builtin) != 7 {
		t.Fatalf("内置功能应为 7 项, 实得 %d", len(d.Builtin))
	}
	if len(d.Extensions) != 0 {
		t.Fatalf("初始应无已装扩展, 实得 %d", len(d.Extensions))
	}
	for _, b := range d.Builtin {
		if b.Route == "" || b.Label == "" {
			t.Fatalf("内置项缺 route/label: %+v", b)
		}
	}

	// 写方法守卫
	for _, tc := range []struct {
		fn     func(http.ResponseWriter, *http.Request)
		method string
		target string
	}{
		{s.handleExtList, "POST", "/api/ext"},
		{s.handleExtRegistry, "POST", "/api/ext/registry"},
		{s.handleExtInstall, "GET", "/api/ext/install"},
		{s.handleExtUpdate, "PUT", "/api/ext/update"},
		{s.handleExtRemove, "GET", "/api/ext/remove"},
		{s.handleExtAsset, "POST", "/api/ext/media/assets/extension.js"},
	} {
		rec := extDo(t, tc.fn, tc.method, tc.target, "")
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s %s code=%d want 405", tc.method, tc.target, rec.Code)
		}
	}
}

func TestExtInstallGuardsAndLocalInstall(t *testing.T) {
	instDir, srcDir := extTestSetup(t)
	s := &server{}
	writeTestExt(t, srcDir, "media", "1.0.0", "媒体中心")

	// 内置功能不可当扩展安装
	rec := extDo(t, s.handleExtInstall, "POST", "/api/ext/install", `{"name":"fm"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("安装内置功能应 400, 实得 %d body=%s", rec.Code, rec.Body.String())
	}
	// 非法名
	rec = extDo(t, s.handleExtInstall, "POST", "/api/ext/install", `{"name":"../etc"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("非法名应 400, 实得 %d", rec.Code)
	}
	// 空名
	rec = extDo(t, s.handleExtInstall, "POST", "/api/ext/install", `{}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("空名应 400, 实得 %d", rec.Code)
	}
	// 未装扩展的产物请求
	rec = extDo(t, s.handleExtAsset, "GET", "/api/ext/media/assets/extension.js", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("未装扩展产物应 404, 实得 %d", rec.Code)
	}
	// 卸载未装扩展
	rec = extDo(t, s.handleExtRemove, "POST", "/api/ext/remove", `{"name":"media"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("卸载未装扩展应 400, 实得 %d", rec.Code)
	}

	// 正常安装(store=nil → GitHub 失败 → 本地源成功), 异步任务
	rec = extDo(t, s.handleExtInstall, "POST", "/api/ext/install", `{"name":"media"}`)
	if rec.Code != 200 {
		t.Fatalf("安装应 200, 实得 %d body=%s", rec.Code, rec.Body.String())
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if _, ok := globalExt.InstalledByName("media"); ok {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if _, ok := globalExt.InstalledByName("media"); !ok {
		t.Fatal("本地源安装未生效")
	}
	if _, err := os.Stat(filepath.Join(instDir, "media", "assets", "extension.js")); err != nil {
		t.Fatalf("产物未落盘: %v", err)
	}

	// 已装后可取清单与产物
	rec = extDo(t, s.handleExtAsset, "GET", "/api/ext/media", "")
	if rec.Code != 200 {
		t.Fatalf("取清单应 200, 实得 %d", rec.Code)
	}
	rec = extDo(t, s.handleExtAsset, "GET", "/api/ext/media/assets/extension.js", "")
	if rec.Code != 200 {
		t.Fatalf("取产物应 200, 实得 %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/javascript") {
		t.Fatalf("产物 Content-Type 不对: %q", ct)
	}
	// 目录穿越
	rec = extDo(t, s.handleExtAsset, "GET", "/api/ext/media/assets/../../secret.txt", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("穿越路径应 404, 实得 %d", rec.Code)
	}
	// 卸载已装扩展
	rec = extDo(t, s.handleExtRemove, "POST", "/api/ext/remove", `{"name":"media"}`)
	if rec.Code != 200 {
		t.Fatalf("卸载应 200, 实得 %d body=%s", rec.Code, rec.Body.String())
	}
	if _, ok := globalExt.InstalledByName("media"); ok {
		t.Fatal("卸载后不应仍在已装列表")
	}
}

func TestExtRegistryLocalFallback(t *testing.T) {
	_, srcDir := extTestSetup(t)
	s := &server{}
	// store=nil → GitHub 不可用; 本地源有 media → 回退 local
	writeTestExt(t, srcDir, "media", "1.2.0", "媒体中心")

	rec := extDo(t, s.handleExtRegistry, "GET", "/api/ext/registry", "")
	if rec.Code != 200 {
		t.Fatalf("registry code=%d", rec.Code)
	}
	var d struct {
		Extensions []core.Extension `json:"extensions"`
		Source     string           `json:"source"`
		HasToken   bool             `json:"has_token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &d); err != nil {
		t.Fatalf("非 JSON: %s", rec.Body.String())
	}
	if d.Source != "local" {
		t.Fatalf("应回退本地源, 实得 source=%q", d.Source)
	}
	if len(d.Extensions) != 1 || d.Extensions[0].Name != "media" || d.Extensions[0].Installed {
		t.Fatalf("本地源清单不对: %+v", d.Extensions)
	}
}
