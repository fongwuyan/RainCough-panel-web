package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

const policyTestAdminPW = "adminPW_policy_test_123456"

// newPolicyManager 造一个既能用系统密码、也能用面板密码的管理器。
//
// shadowHash 直接注入: 测试进程通常不是 root, 读不到真实的 /etc/shadow。
func newPolicyManager(t *testing.T) *Manager {
	t.Helper()
	m, err := New(Options{DataDir: t.TempDir(), AdminPassword: policyTestAdminPW})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	h, err := HashPassword("sshPW_test_2026")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	m.shadowHash = h
	m.shadowUser = "tester"
	return m
}

func TestLoginPolicy_default_allows_ssh(t *testing.T) {
	m := newPolicyManager(t)
	if !m.AllowSSHPassword() {
		t.Fatalf("默认应允许系统密码登录")
	}
	if _, method, ok := m.Verify("sshPW_test_2026"); !ok || method != MethodSSH {
		t.Fatalf("默认应能用系统密码登录, ok=%v method=%q", ok, method)
	}
}

func TestSetAllowSSHPassword_blocks_ssh_but_keeps_admin(t *testing.T) {
	m := newPolicyManager(t)

	if err := m.SetAllowSSHPassword(false); err != nil {
		t.Fatalf("SetAllowSSHPassword(false): %v", err)
	}
	if m.AllowSSHPassword() {
		t.Fatalf("关闭后 AllowSSHPassword 应为 false")
	}
	// SSH 密码不再能登录
	if _, method, ok := m.Verify("sshPW_test_2026"); ok {
		t.Fatalf("关闭后系统密码不该通过, 实际 method=%q", method)
	}
	// 面板密码必须仍然可用, 否则等于把用户锁在门外
	if _, method, ok := m.Verify(policyTestAdminPW); !ok || method != MethodAdmin {
		t.Fatalf("面板密码应仍可用, ok=%v method=%q", ok, method)
	}

	// 再打开, 立刻恢复
	if err := m.SetAllowSSHPassword(true); err != nil {
		t.Fatalf("SetAllowSSHPassword(true): %v", err)
	}
	if _, method, ok := m.Verify("sshPW_test_2026"); !ok || method != MethodSSH {
		t.Fatalf("重新打开后系统密码应可用, ok=%v method=%q", ok, method)
	}
}

func TestLoginPolicy_persists_across_restart(t *testing.T) {
	dir := t.TempDir()
	m, err := New(Options{DataDir: dir, AdminPassword: policyTestAdminPW})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if err := m.SetAllowSSHPassword(false); err != nil {
		t.Fatalf("SetAllowSSHPassword: %v", err)
	}

	// 文件应落在 secret/login.json, 且权限 0600
	path := LoginPolicyPath(dir)
	st, err := os.Stat(path)
	if err != nil {
		t.Fatalf("策略文件不存在: %v", err)
	}
	// Windows 不认 POSIX 权限位, 只在类 Unix 上断言
	if runtime.GOOS != "windows" && st.Mode().Perm() != 0o600 {
		t.Fatalf("策略文件权限 = %v, 应为 0600", st.Mode().Perm())
	}

	m2, err := New(Options{DataDir: dir, AdminPassword: policyTestAdminPW})
	if err != nil {
		t.Fatalf("New(2): %v", err)
	}
	if m2.AllowSSHPassword() {
		t.Fatalf("重启后应保持关闭")
	}
}

// 坏文件不该把用户锁在门外: 解析失败 -> 按默认(允许)处理。
func TestLoginPolicy_corrupt_file_falls_back_to_allow(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, SecretDir), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(LoginPolicyPath(dir), []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	m, err := New(Options{DataDir: dir, AdminPassword: policyTestAdminPW})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if !m.AllowSSHPassword() {
		t.Fatalf("策略文件损坏时应回退为允许系统密码")
	}
}

func TestStatus_reports_switch_and_capability_separately(t *testing.T) {
	m := newPolicyManager(t)

	st := m.Status(Session{}, false)
	if !st.AllowSSHPassword || !st.ShadowAvailable || !st.CanSSHPassword {
		t.Fatalf("初始状态不对: %+v", st)
	}

	if err := m.SetAllowSSHPassword(false); err != nil {
		t.Fatal(err)
	}
	st = m.Status(Session{}, false)
	if st.AllowSSHPassword {
		t.Fatalf("关闭后 allow_ssh_password 应为 false")
	}
	// 能力还在(哈希读得到), 只是被开关挡住 —— 登录页要能区分这两种情况
	if !st.ShadowAvailable {
		t.Fatalf("关闭开关不该影响 shadow_available")
	}
	if st.CanSSHPassword {
		t.Fatalf("关闭后 can_ssh_password 应为 false")
	}
}

func TestHandleLoginPolicy_get_and_post(t *testing.T) {
	m := newPolicyManager(t)

	// GET
	rec := httptest.NewRecorder()
	m.handleLoginPolicy(rec, httptest.NewRequest(http.MethodGet, "/api/auth/login-policy", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET 状态码 = %d", rec.Code)
	}
	var got LoginPolicy
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("GET 响应不是 JSON: %v", err)
	}
	if !got.AllowSSHPassword {
		t.Fatalf("默认应为允许")
	}

	// POST 关闭
	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login-policy",
		strings.NewReader(`{"allow_ssh_password":false}`))
	m.handleLoginPolicy(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST 状态码 = %d, body=%s", rec.Code, rec.Body.String())
	}
	if m.AllowSSHPassword() {
		t.Fatalf("POST 后应为关闭")
	}

	// 缺字段 -> 400, 且不能把状态改成零值
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login-policy", strings.NewReader(`{}`))
	m.handleLoginPolicy(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("缺字段应 400, 实际 %d", rec.Code)
	}
	if m.AllowSSHPassword() {
		t.Fatalf("非法请求不该改变状态")
	}

	// 非 GET/POST
	rec = httptest.NewRecorder()
	m.handleLoginPolicy(rec, httptest.NewRequest(http.MethodDelete, "/api/auth/login-policy", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("DELETE 应 405, 实际 %d", rec.Code)
	}
}

// 新接口必须要求登录态: 白名单里不能出现它。
func TestLoginPolicy_not_whitelisted(t *testing.T) {
	if isAuthWhitelist("/api/auth/login-policy") {
		t.Fatalf("登录策略接口不该免登录")
	}
}
