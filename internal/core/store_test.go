package core

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestStoreConfig(t *testing.T) {
	ns := newMockNS()
	s := NewStore(ns, t.TempDir(), nil)

	// 默认配置
	cfg := s.GetConfig()
	if cfg.PluginRepo.Owner != "fongwuyan" || cfg.PluginRepo.Repo != "RainCough-Plugin" {
		t.Fatalf("默认配置错误: %+v", cfg.PluginRepo)
	}

	// 自定义
	s.Config(StoreConfig{PluginRepo: Repo{Owner: "me", Repo: "my-plugins", Branch: "dev"}})
	cfg = s.GetConfig()
	if cfg.PluginRepo.Owner != "me" || cfg.PluginRepo.Branch != "dev" {
		t.Fatalf("配置未更新: %+v", cfg.PluginRepo)
	}
}

func TestStoreTokenEncryptRoundtrip(t *testing.T) {
	ns := newMockNS()
	s := NewStore(ns, t.TempDir(), nil)
	token := "ghp_test_token_1234567890"

	if err := s.SetToken(token); err != nil {
		t.Fatalf("SetToken: %v", err)
	}
	// 落库的是密文, 不是明文
	v, ok, _ := ns.Get("store:token_enc")
	if !ok {
		t.Fatal("token 未落库")
	}
	if v.(string) == token {
		t.Fatal("token 不应明文存储")
	}
	// 取回
	if got := s.Token(); got != token {
		t.Fatalf("Token 取回失败: %q", got)
	}
	// 密文不可伪造(篡改后解密失败)
}

func TestStoreSecretKeyPersist(t *testing.T) {
	ns := newMockNS()
	s1 := NewStore(ns, t.TempDir(), nil)
	s1.SetToken("abc")

	// 新实例(同一 ns)密钥应复用, token 可解
	s2 := NewStore(ns, t.TempDir(), nil)
	if got := s2.Token(); got != "abc" {
		t.Fatalf("复用密钥后 token 取回失败: %q", got)
	}
}

func TestStoreInstalledVersion(t *testing.T) {
	ns := newMockNS()
	dir := t.TempDir()
	s := NewStore(ns, dir, nil)

	// 未安装
	if ok, _ := s.installedVersion("jmcomic"); ok {
		t.Fatal("未安装应返回 false")
	}
	// 伪造已安装(plugin.json)
	mkPluginJson(t, dir, "jmcomic")
	ok, _ := s.installedVersion("jmcomic")
	if !ok {
		t.Fatal("安装后应返回 true")
	}
}

// TestStoreInstalledVersionReal 回归 M2: 旧版固定返回字面量 "installed",
// 前端芯片显示"已装 installed"。现在必须读 plugin.json 的真实版本。
func TestStoreInstalledVersionReal(t *testing.T) {
	s := NewStore(newMockNS(), t.TempDir(), nil)
	if ok, v := s.installedVersion("nope"); ok || v != "" {
		t.Fatalf("未安装应返回 (false, \"\"), 得到 (%v,%q)", ok, v)
	}
	dir := t.TempDir()
	s = NewStore(newMockNS(), dir, nil)
	if err := os.MkdirAll(filepath.Join(dir, "demo"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "demo", "plugin.json"),
		[]byte(`{"name":"demo","version":"2.1.0"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	ok, v := s.installedVersion("demo")
	if !ok || v != "2.1.0" {
		t.Fatalf("installedVersion 应返回 (true,\"2.1.0\"), 得到 (%v,%q)", ok, v)
	}
}

// ---- 回归 S2: 安装任务的终态(修复前 defer 无条件 Finish 把 done 翻成 failed) ----

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func httpResp(code int, body []byte) *http.Response {
	return &http.Response{
		StatusCode: code,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     make(http.Header),
	}
}

// fakeZipball 构造 GitHub zipball: 顶层 <repo>-<sha>/<plugin>/...
func fakeZipball(t *testing.T, files map[string]string) []byte {
	t.Helper()
	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	for p, body := range files {
		w, err := zw.Create(p)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// waitStoreTask 等 store 任务收尾(终态), 5s 超时。
func waitStoreTask(t *testing.T, ts *TaskStore) *Task {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		for _, tk := range ts.List(true, 20) {
			if tk.Source == "store" && (tk.Status == "done" || tk.Status == "failed") {
				return tk
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("store 任务 5s 内未收尾")
	return nil
}

func TestStoreInstallSuccessTaskDone(t *testing.T) {
	dir := t.TempDir()
	s := NewStore(newMockNS(), dir, nil)
	zipball := fakeZipball(t, map[string]string{
		"repo-abc123/demo/plugin.json": `{"name":"demo","label":"演示","version":"1.2.3"}`,
		"repo-abc123/demo/plugin.py":   "print('hi')",
	})
	s.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return httpResp(200, zipball), nil
	})}

	ts := NewTaskStore(newMockNS())
	if _, err := s.InstallPlugin("demo", ts); err != nil {
		t.Fatalf("InstallPlugin: %v", err)
	}
	task := waitStoreTask(t, ts)
	if task.Status != "done" {
		t.Fatalf("安装成功任务应为 done, 实为 %q (error=%q message=%q) — 修复前 defer 会把它翻成 failed",
			task.Status, task.Error, task.Message)
	}
	if task.Error != "" {
		t.Fatalf("成功任务不应带 error, 得 %q", task.Error)
	}
	if task.Progress != 100 {
		t.Fatalf("成功任务 progress 应为 100, 得 %d", task.Progress)
	}
	if !strings.Contains(task.Message, "插件安装成功") {
		t.Fatalf("成功任务 message 不对: %q", task.Message)
	}
	if _, err := os.Stat(filepath.Join(dir, "demo", "plugin.json")); err != nil {
		t.Fatalf("插件未落地: %v", err)
	}
}

func TestStoreInstallFailureTaskFailed(t *testing.T) {
	s := NewStore(newMockNS(), t.TempDir(), nil)
	s.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return httpResp(500, []byte("boom")), nil
	})}

	ts := NewTaskStore(newMockNS())
	if _, err := s.InstallPlugin("demo", ts); err != nil {
		t.Fatalf("InstallPlugin: %v", err)
	}
	task := waitStoreTask(t, ts)
	if task.Status != "failed" {
		t.Fatalf("安装失败任务应为 failed, 实为 %q", task.Status)
	}
	if task.Error == "" {
		t.Fatal("失败任务应带 error")
	}
}

// ---- 回归 M3/M4: 清单来源 github|local + author 字段 ----

func TestStoreRegistryLocalFallback(t *testing.T) {
	dir := t.TempDir()
	s := NewStore(newMockNS(), dir, nil)
	// 仓库读不到(实测私有仓 404)
	s.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return httpResp(404, []byte(`{"message":"Not Found"}`)), nil
	})}
	if err := os.MkdirAll(filepath.Join(dir, "demo"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "demo", "plugin.json"),
		[]byte(`{"name":"demo","label":"演示","version":"1.0.0","author":"RainCough"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	list, source, err := s.RegistryWithSource()
	if err != nil {
		t.Fatalf("回退不应报错: %v", err)
	}
	if source != "local" {
		t.Fatalf("来源应为 local, 得 %q", source)
	}
	if len(list) != 1 {
		t.Fatalf("本机清单应 1 条, 得 %d", len(list))
	}
	if list[0].Author != "RainCough" {
		t.Fatalf("author 未解析(前端有展示位): %q", list[0].Author)
	}
	if !list[0].Installed || list[0].InstalledV != "1.0.0" {
		t.Fatalf("已装标记/版本不对: %+v", list[0])
	}
	// Registry() 薄壳仍可用(protected 调用方 sysproviders)
	if _, err := s.Registry(); err != nil {
		t.Fatalf("Registry: %v", err)
	}
}

func TestStoreRegistryGithubAuthor(t *testing.T) {
	s := NewStore(newMockNS(), t.TempDir(), nil)
	reg := `{"plugins":[{"name":"demo","label":"演示","version":"1.2.3","author":"RainCough","path":"plugins/demo","description":"d"}]}`
	b64 := base64.StdEncoding.EncodeToString([]byte(reg))
	body := `{"content":"` + b64 + `"}`
	s.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return httpResp(200, []byte(body)), nil
	})}

	list, source, err := s.RegistryWithSource()
	if err != nil {
		t.Fatalf("RegistryWithSource: %v", err)
	}
	if source != "github" {
		t.Fatalf("来源应为 github, 得 %q", source)
	}
	if len(list) != 1 {
		t.Fatalf("应 1 条, 得 %d", len(list))
	}
	if list[0].Author != "RainCough" || list[0].Version != "1.2.3" {
		t.Fatalf("author/version 未从 registry.json 解析: %+v", list[0])
	}
	if list[0].Installed {
		t.Fatal("本机未装该插件, installed 应为 false")
	}
}

func mkPluginJson(t *testing.T, pluginsDir, name string) {
	t.Helper()
	dir := pluginsDir + "/" + name
	if err := Mkdir(dir); err != nil {
		t.Fatal(err)
	}
	if err := SaveFileText(dir+"/plugin.json",
		[]byte(`{"name":"`+name+`","label":"test"}`), 1024); err != nil {
		t.Fatal(err)
	}
}
