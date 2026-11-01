package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// 设置页改密码: 立即生效 + 保留当前会话 + 注销其它会话 + 落盘。
func TestSetAdminPassword_keeps_current_session(t *testing.T) {
	dir := t.TempDir()
	m, err := New(Options{DataDir: dir, AdminPassword: "oldPanelPW_2026"})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	cur, err := m.IssueSession("tester", MethodAdmin)
	if err != nil {
		t.Fatal(err)
	}
	other, err := m.IssueSession("tester", MethodAdmin)
	if err != nil {
		t.Fatal(err)
	}

	const newPW = "newPanelPW_2026!"
	if err := m.SetAdminPassword(newPW, cur.ID); err != nil {
		t.Fatalf("SetAdminPassword: %v", err)
	}

	if _, method, ok := m.Verify(newPW); !ok || method != MethodAdmin {
		t.Fatalf("新密码应可用, ok=%v method=%q", ok, method)
	}
	if _, _, ok := m.Verify("oldPanelPW_2026"); ok {
		t.Fatalf("旧密码应失效")
	}

	if _, ok := m.Lookup(cur.ID); !ok {
		t.Fatalf("当前会话应保留, 否则用户点完保存就被踢回登录页")
	}
	if _, ok := m.Lookup(other.ID); ok {
		t.Fatalf("其它会话应被注销")
	}

	// 重启后仍是新密码(哈希已落盘)
	m2, err := New(Options{DataDir: dir})
	if err != nil {
		t.Fatalf("New(2): %v", err)
	}
	if _, method, ok := m2.Verify(newPW); !ok || method != MethodAdmin {
		t.Fatalf("重启后新密码应仍可用, ok=%v method=%q", ok, method)
	}
}

func TestHandleSetPassword_validation(t *testing.T) {
	m, err := New(Options{DataDir: t.TempDir(), AdminPassword: "oldPanelPW_2026"})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	cases := []struct {
		name string
		body string
		want int
	}{
		{"空请求体", `{}`, http.StatusBadRequest},
		{"空密码", `{"new_password":"   "}`, http.StatusBadRequest},
		{"太短", `{"new_password":"1234567"}`, http.StatusBadRequest},
		{"刚好 8 位", `{"new_password":"12345678"}`, http.StatusOK},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/auth/password", strings.NewReader(c.body))
		m.handleSetPassword(rec, req)
		if rec.Code != c.want {
			t.Fatalf("%s: 状态码 = %d, 期望 %d, body=%s", c.name, rec.Code, c.want, rec.Body.String())
		}
	}

	// 非 POST 一律 405
	rec := httptest.NewRecorder()
	m.handleSetPassword(rec, httptest.NewRequest(http.MethodGet, "/api/auth/password", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET 应 405, 实际 %d", rec.Code)
	}
}
