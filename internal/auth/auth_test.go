package auth

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestNew_loads_sessions_and_admin: 验证启动时加载 sessions + admin 密码
func TestNew_creates_data_dirs(t *testing.T) {
	tmp := t.TempDir()
	m, err := New(Options{
		DataDir: tmp,
		// AdminPassword 留空 -> 自动生成
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	// 应建好 secret/ 与 sessions/
	if _, err := os.Stat(filepath.Join(tmp, SecretDir)); err != nil {
		t.Fatalf("缺少 secret 目录: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tmp, SessionsDir)); err != nil {
		t.Fatalf("缺少 sessions 目录: %v", err)
	}
	// admin.pw 应已生成
	pw, err := os.ReadFile(filepath.Join(tmp, SecretDir, AdminPasswordFn))
	if err != nil {
		t.Fatalf("admin.pw 不存在: %v", err)
	}
	if len(strings.TrimSpace(string(pw))) < minAdminPassword {
		t.Fatalf("admin.pw 长度不够: %d", len(pw))
	}
	// Verify 应该接受这个密码
	user, method, ok := m.Verify(strings.TrimSpace(string(pw)))
	if !ok {
		t.Fatalf("Verify(admin.pw) 应通过")
	}
	if method != MethodAdmin {
		t.Fatalf("method=%q want %q", method, MethodAdmin)
	}
	// 面板密码登录时把"当前运行用户"作为身份返回(面板只有管理员一种角色, 但展示真实用户名更友好)
	if user == "" {
		t.Fatalf("user 不应为空")
	}
	// 错密码应失败
	if _, _, ok := m.Verify("WRONG"); ok {
		t.Fatalf("Verify(WRONG) 应失败")
	}
}

// TestNew_rc_admin_password_override: 环境变量覆盖
func TestNew_rc_admin_password_override(t *testing.T) {
	tmp := t.TempDir()
	const wantPW = "TestPW_for_ci_only_xxxxxxxxx"
	m, err := New(Options{DataDir: tmp, AdminPassword: wantPW})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if _, _, ok := m.Verify(wantPW); !ok {
		t.Fatalf("覆盖密码应通过")
	}
	// 不应写文件(override 不持久化)
	if _, err := os.Stat(filepath.Join(tmp, SecretDir, AdminPasswordFn)); err == nil {
		t.Fatalf("override 模式不应写 admin.pw")
	}
}

// TestIssueSession_持久化与查找
func TestIssueSession_persistence(t *testing.T) {
	tmp := t.TempDir()
	m, err := New(Options{DataDir: tmp, AdminPassword: "fixedPWfor_test1234"})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	s, err := m.IssueSession("tester", MethodAdmin)
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	// 立即查找应能找到
	if got, ok := m.Lookup(s.ID); !ok {
		t.Fatalf("Lookup 找不到刚创建的 session")
	} else if got.User != "tester" {
		t.Fatalf("user mismatch: %s", got.User)
	}
	// 文件应已写
	if _, err := os.Stat(filepath.Join(tmp, SessionsDir, s.ID+".json")); err != nil {
		t.Fatalf("session 文件没写: %v", err)
	}
	// Revoke 后 Lookup 应返 false
	m.Revoke(s.ID)
	if _, ok := m.Lookup(s.ID); ok {
		t.Fatalf("Revoke 后仍能找到")
	}
	if _, err := os.Stat(filepath.Join(tmp, SessionsDir, s.ID+".json")); err == nil {
		t.Fatalf("Revoke 后文件仍在")
	}
}

// TestLookup_过期自动清理
func TestLookup_expired(t *testing.T) {
	tmp := t.TempDir()
	m, err := New(Options{DataDir: tmp, AdminPassword: "fixedPWfor_test1234", SessionTTL: 10 * time.Millisecond})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	s, _ := m.IssueSession("admin", MethodAdmin)
	time.Sleep(50 * time.Millisecond)
	if _, ok := m.Lookup(s.ID); ok {
		t.Fatalf("过期 session 应被拒")
	}
}

// TestMiddleware_放行白名单
func TestMiddleware_whitelist(t *testing.T) {
	tmp := t.TempDir()
	m, err := New(Options{DataDir: tmp, AdminPassword: "fixedPWfor_test1234"})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	// 构造下游 handler, 看是否被调用
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(200)
	})
	h := m.Middleware(next)

	for _, p := range []string{"/api/auth/login", "/api/auth/status", "/api/auth/logout"} {
		req := httptest.NewRequest("GET", p, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if !called {
			t.Fatalf("%s 应放行但被拦", p)
		}
		called = false
	}
}

// TestMiddleware_未登录API_401
func TestMiddleware_unauth_api_401(t *testing.T) {
	tmp := t.TempDir()
	m, err := New(Options{DataDir: tmp, AdminPassword: "fixedPWfor_test1234"})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	})
	h := m.Middleware(next)

	req := httptest.NewRequest("GET", "/api/system", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Fatalf("/api/system 未登录应返 401, 实得 %d", w.Code)
	}

	// 带正确 cookie 应放行
	sess, _ := m.IssueSession("admin", MethodAdmin)
	req = httptest.NewRequest("GET", "/api/system", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: sess.ID})
	w = httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("带 cookie 应放行, 实得 %d", w.Code)
	}

	// 错 cookie 应拒
	req = httptest.NewRequest("GET", "/api/system", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: "deadbeef"})
	w = httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Fatalf("错 cookie 应 401, 实得 %d", w.Code)
	}
}

// TestMiddleware_前端路径_不拦截(让前端 router 跳 /login)
func TestMiddleware_frontend_path_passes_through(t *testing.T) {
	tmp := t.TempDir()
	m, _ := New(Options{DataDir: tmp, AdminPassword: "fixedPWfor_test1234"})
	called := false
	h := m.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(200)
	}))
	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if !called {
		t.Fatalf("前端路径不应被中间件拦截")
	}
}

// TestHandleLogin_完整流程
func TestHandleLogin_full_flow(t *testing.T) {
	tmp := t.TempDir()
	m, _ := New(Options{DataDir: tmp, AdminPassword: "loginTest123_pw"})
	mux := http.NewServeMux()
	m.Routes(mux)

	// 1. status 未登录
	req := httptest.NewRequest("GET", "/api/auth/status", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if !strings.Contains(w.Body.String(), `"logged_in":false`) {
		t.Fatalf("初始 status 应 logged_in:false, got: %s", w.Body.String())
	}

	// 2. login 错密码
	req = httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{"password":"WRONG"}`))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Fatalf("错密码应 401, got %d", w.Code)
	}

	// 3. login 正确密码
	req = httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(`{"password":"loginTest123_pw"}`))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("正密码应 200, got %d body=%s", w.Code, w.Body.String())
	}
	// 检查 Set-Cookie
	cookies := w.Result().Cookies()
	var sessCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == CookieName {
			sessCookie = c
		}
	}
	if sessCookie == nil {
		t.Fatalf("未设置 session cookie")
	}
	if !sessCookie.HttpOnly {
		t.Fatalf("cookie 应 HttpOnly")
	}
	if sessCookie.SameSite != http.SameSiteStrictMode {
		t.Fatalf("cookie 应 SameSite=Strict")
	}

	// 4. 带 cookie 查 status
	req = httptest.NewRequest("GET", "/api/auth/status", nil)
	req.AddCookie(sessCookie)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if !strings.Contains(w.Body.String(), `"logged_in":true`) {
		t.Fatalf("带 cookie 应 logged_in:true, got: %s", w.Body.String())
	}

	// 5. logout
	req = httptest.NewRequest("POST", "/api/auth/logout", nil)
	req.AddCookie(sessCookie)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("logout 应 200, got %d", w.Code)
	}

	// 6. 再查 status 应未登录
	req = httptest.NewRequest("GET", "/api/auth/status", nil)
	req.AddCookie(sessCookie)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if !strings.Contains(w.Body.String(), `"logged_in":false`) {
		t.Fatalf("logout 后应 logged_in:false, got: %s", w.Body.String())
	}
}

// TestStatus_字段对齐
func TestStatus_fields(t *testing.T) {
	tmp := t.TempDir()
	m, _ := New(Options{DataDir: tmp, AdminPassword: "fixedPWfor_test1234"})
	st := m.Status(Session{}, false)
	if !st.HasAdminPW {
		t.Fatalf("HasAdminPW 应 true")
	}
	if st.LoggedIn {
		t.Fatalf("LoggedIn 应 false")
	}
}

// TestRandomPassword_长度与字符集
func TestRandomPassword(t *testing.T) {
	for _, n := range []int{16, 24, 32, 64} {
		pw, err := randomPassword(n)
		if err != nil {
			t.Fatalf("randomPassword: %v", err)
		}
		if len(pw) != n {
			t.Fatalf("len=%d want %d", len(pw), n)
		}
		for _, c := range pw {
			if !strings.ContainsRune("abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", c) {
				t.Fatalf("字符 %q 不在合法集中", c)
			}
		}
	}
}
// TestSetPassword_stores_crypt_hash: -set-password 应存 $6$ 哈希而不是明文
func TestSetPassword_stores_crypt_hash(t *testing.T) {
	tmp := t.TempDir()
	const pw = "MySSHPassword_2026"
	if err := SetPassword(tmp, pw); err != nil {
		t.Fatalf("SetPassword: %v", err)
	}
	raw, err := os.ReadFile(PasswordPath(tmp))
	if err != nil {
		t.Fatalf("读密码文件: %v", err)
	}
	content := strings.TrimSpace(string(raw))
	if !strings.HasPrefix(content, "$6$") {
		t.Fatalf("应存 $6$ 哈希, 实得: %q", content)
	}
	if strings.Contains(content, pw) {
		t.Fatalf("文件里不应出现明文密码")
	}
	// 用这个文件启动 Manager, 应能用原密码登录
	m, err := New(Options{DataDir: tmp})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if _, method, ok := m.Verify(pw); !ok {
		t.Fatalf("Verify(%q) 应通过", pw)
	} else if method != MethodAdmin {
		t.Fatalf("method=%q", method)
	}
	if _, _, ok := m.Verify(pw + "x"); ok {
		t.Fatalf("错密码应失败")
	}
}

// TestSetPassword_rejects_short
func TestSetPassword_rejects_short(t *testing.T) {
	if err := SetPassword(t.TempDir(), ""); err == nil {
		t.Fatalf("短密码应被拒")
	}
}

// TestHashPassword_verify_roundtrip
func TestHashPassword_roundtrip(t *testing.T) {
	h, err := HashPassword("hello-world-pw")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !strings.HasPrefix(h, "$6$") {
		t.Fatalf("前缀应为 $6$, got %q", h)
	}
	if err := VerifySha512Crypt([]byte("hello-world-pw"), h); err != nil {
		t.Fatalf("自产哈希应能验证通过: %v", err)
	}
	// 两次哈希不同(盐随机)
	h2, _ := HashPassword("hello-world-pw")
	if h == h2 {
		t.Fatalf("两次哈希不应相同(盐应随机)")
	}
}

// TestSetPassword_invalidates_sessions: 改密码必须让旧 session 失效(安全默认)
func TestSetPassword_invalidates_sessions(t *testing.T) {
	tmp := t.TempDir()
	if err := SetPassword(tmp, "first-password"); err != nil {
		t.Fatalf("SetPassword: %v", err)
	}
	m, err := New(Options{DataDir: tmp})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	s, err := m.IssueSession("someone", MethodAdmin)
	if err != nil {
		t.Fatalf("IssueSession: %v", err)
	}
	if _, ok := m.Lookup(s.ID); !ok {
		t.Fatalf("session 应有效")
	}
	// 改密码
	if err := SetPassword(tmp, "second-password"); err != nil {
		t.Fatalf("SetPassword(2): %v", err)
	}
	// 新 Manager 加载后不应再认得旧 session
	m2, err := New(Options{DataDir: tmp})
	if err != nil {
		t.Fatalf("New(2): %v", err)
	}
	if _, ok := m2.Lookup(s.ID); ok {
		t.Fatalf("改密码后旧 session 必须失效")
	}
	// 新密码可用, 旧密码不可用
	if _, _, ok := m2.Verify("second-password"); !ok {
		t.Fatalf("新密码应可用")
	}
	if _, _, ok := m2.Verify("first-password"); ok {
		t.Fatalf("旧密码应失效")
	}
}
