package pluginx

import (
	"net/http"
	"testing"
)

// REST 桥的核心逻辑测试: 路由匹配与优先级。
//
// ★ 为什么专门测"优先级": /download/batch 与 /download/{aid} 段数相同,
// 若 {aid} 先匹配, batch 会被当成 aid="batch" 走进单本下载 —— 这类
// "变量段抢走字面段"的 bug 在路由实现里极常见, 且只在大批量下载时才暴露。

func mkRoutes() []RESTRoute {
	return []RESTRoute{
		{Method: "GET", Path: "/download/{aid}", Iface: "jmcomic.download.status"},
		{Method: "POST", Path: "/download/batch", Iface: "jmcomic.batch.start"},
		{Method: "GET", Path: "/download/batch", Iface: "jmcomic.batch.status"},
		{Method: "POST", Path: "/download/batch/stop", Iface: "jmcomic.batch.stop"},
		{Method: "GET", Path: "/album/{aid}", Iface: "jmcomic.album"},
		{Method: "GET", Path: "/search", Iface: "jmcomic.search"},
		{Method: "DELETE", Path: "/library/{aid}", Iface: "jmcomic.library.delete"},
	}
}

func newRESTPluginX(routes []RESTRoute) *PluginX {
	x := New(Options{UseTCP: true, PluginsDir: t_pluginsDir()}, nil)
	x.mu.Lock()
	x.restRoutes["JMComic"] = sortRoutes(routes)
	x.restPublic["JMComic"] = true
	x.mu.Unlock()
	return x
}

// t_pluginsDir 返回一个临时目录(仅用于避免空字符串)
func t_pluginsDir() string { return "/tmp" }

// sortRoutes 与 compileREST 的排序规则保持一致(字面段多的优先)
func sortRoutes(routes []RESTRoute) []RESTRoute {
	out := append([]RESTRoute{}, routes...)
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if countLiteral(out[j].Path) > countLiteral(out[i].Path) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

// TestREST_literalBeatsVariable 字面段必须优先于变量段
func TestREST_literalBeatsVariable(t *testing.T) {
	x := newRESTPluginX(mkRoutes())

	// GET /download/batch 应命中 batch.status, 而不是 download.status(aid=batch)
	r, params, ok := x.matchREST("JMComic", "GET", "/download/batch")
	if !ok {
		t.Fatalf("未匹配 /download/batch")
	}
	if r.Iface != "jmcomic.batch.status" {
		t.Fatalf("★ 被变量段抢走: 命中 %q, 期望 jmcomic.batch.status", r.Iface)
	}
	if len(params) != 0 {
		t.Fatalf("字面路由不应有路径参数, 实得 %v", params)
	}

	// 单本下载仍要走变量路由
	r2, p2, ok2 := x.matchREST("JMComic", "GET", "/download/1231152")
	if !ok2 || r2.Iface != "jmcomic.download.status" {
		t.Fatalf("单本状态路由不对: %v %v", r2, ok2)
	}
	if p2["aid"] != "1231152" {
		t.Fatalf("aid 参数 = %q", p2["aid"])
	}
}

// TestREST_methodDistinguishes 同路径不同方法要分到不同接口
func TestREST_methodDistinguishes(t *testing.T) {
	x := newRESTPluginX(mkRoutes())

	cases := []struct {
		method, path, wantIface string
	}{
		{"GET", "/download/batch", "jmcomic.batch.status"},
		{"POST", "/download/batch", "jmcomic.batch.start"},
		{"POST", "/download/batch/stop", "jmcomic.batch.stop"},
		{"GET", "/album/123", "jmcomic.album"},
		{"GET", "/search", "jmcomic.search"},
		{"DELETE", "/library/123", "jmcomic.library.delete"},
	}
	for _, c := range cases {
		r, _, ok := x.matchREST("JMComic", c.method, c.path)
		if !ok {
			t.Errorf("%s %s 未匹配", c.method, c.path)
			continue
		}
		if r.Iface != c.wantIface {
			t.Errorf("%s %s → %q, 期望 %q", c.method, c.path, r.Iface, c.wantIface)
		}
	}
	// 未声明的方法不应匹配
	if _, _, ok := x.matchREST("JMComic", "PUT", "/album/1"); ok {
		t.Errorf("PUT /album/1 不应匹配(未声明)")
	}
}

// TestREST_resolveNameCaseInsensitive App 传小写 jmcomic, 目录是 JMComic
func TestREST_resolveNameCaseInsensitive(t *testing.T) {
	x := newRESTPluginX(mkRoutes())
	for _, in := range []string{"JMComic", "jmcomic", "JMCOMIC", "JmComic"} {
		if got := x.ResolveName(in); got != "JMComic" {
			t.Errorf("ResolveName(%q) = %q, want JMComic", in, got)
		}
	}
	if got := x.ResolveName("nosuch"); got != "" {
		t.Errorf("未知插件应返回空, 实得 %q", got)
	}
}

// TestREST_publicMatch 只有同时"命中声明路由 + 声明 public"才免登录
func TestREST_publicMatch(t *testing.T) {
	x := newRESTPluginX(mkRoutes())

	req, _ := http.NewRequest("GET", "/api/plugins/jmcomic/library", nil)
	// /library 未在路由表(只有 DELETE /library/{aid}), 不应被视为公开
	if x.RESTPublicMatch(req) {
		t.Errorf("未声明的路径不应免登录")
	}

	req2, _ := http.NewRequest("GET", "/api/plugins/jmcomic/album/123", nil)
	if !x.RESTPublicMatch(req2) {
		t.Errorf("声明过且大小写不敏感的 REST 路由应免登录")
	}

	// 声明为非公开时一律不放行
	x.mu.Lock()
	x.restPublic["JMComic"] = false
	x.mu.Unlock()
	if x.RESTPublicMatch(req2) {
		t.Errorf("rest_public=false 时不应免登录")
	}
}

// TestREST_coerce 参数类型归一: 短数字转 int, 长 ID 保持字符串
func TestREST_coerce(t *testing.T) {
	if v := coerce("1"); v != 1 {
		t.Errorf("coerce(\"1\") = %v, 期望 int 1", v)
	}
	if v := coerce("abc"); v != "abc" {
		t.Errorf("coerce(\"abc\") = %v", v)
	}
	// ★ 超过 9 位的 ID 必须保持字符串: 转成 int 会丢精度/jm 的 aid 可能带前导零
	long := "1234567890123"
	if v := coerce(long); v != long {
		t.Errorf("长 ID 应保持字符串, 实得 %T %v", v, v)
	}
	if v := coerce(""); v != "" {
		t.Errorf("空串应保持")
	}
}

// TestREST_countLiteral 字面段计数
func TestREST_countLiteral(t *testing.T) {
	cases := map[string]int{
		"/search":              1,
		"/album/{aid}":         1,
		"/download/batch":      2,
		"/download/batch/stop": 3,
		"/image/{a}/{b}/{c}":   1,
	}
	for p, want := range cases {
		if got := countLiteral(p); got != want {
			t.Errorf("countLiteral(%q) = %d, want %d", p, got, want)
		}
	}
}
