package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// memKV 内存 KV, 满足 GateKV
type memKV struct {
	mu sync.Mutex
	m  map[string]interface{}
}

func newMemKV() *memKV { return &memKV{m: map[string]interface{}{}} }

func (k *memKV) Set(key string, v interface{}) error {
	k.mu.Lock()
	defer k.mu.Unlock()
	k.m[key] = v
	return nil
}

func (k *memKV) Get(key string) (interface{}, bool, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	v, ok := k.m[key]
	return v, ok, nil
}

func reqFrom(ip string) *http.Request {
	r := httptest.NewRequest("POST", "/api/store/gate/unlock", nil)
	r.RemoteAddr = ip + ":12345"
	return r
}

// TestStoreGate_correct_password 正确口令应放行并下发 cookie
func TestStoreGate_correct_password(t *testing.T) {
	g, err := NewStoreGate(newMemKV())
	if err != nil {
		t.Fatalf("NewStoreGate: %v", err)
	}
	r := reqFrom("10.0.0.1")
	w := httptest.NewRecorder()

	// 未解锁
	if g.Unlocked(r) {
		t.Fatalf("初始状态应 locked")
	}

	remaining, err := g.Unlock(r, w, "REDACTED-GATE-PW")
	if err != nil {
		t.Fatalf("正确口令应通过, 实得: %v", err)
	}
	if remaining != gateMaxFails {
		t.Fatalf("成功后剩余次数应重置为 %d, 实得 %d", gateMaxFails, remaining)
	}

	// 取 cookie 再验证
	cookies := w.Result().Cookies()
	var ck *http.Cookie
	for _, c := range cookies {
		if c.Name == StoreGateCookie {
			ck = c
		}
	}
	if ck == nil {
		t.Fatalf("未下发 %s cookie", StoreGateCookie)
	}
	if !ck.HttpOnly {
		t.Fatalf("cookie 应 HttpOnly")
	}
	if ck.SameSite != http.SameSiteStrictMode {
		t.Fatalf("cookie 应 SameSite=Strict")
	}
	if ck.MaxAge <= 0 {
		t.Fatalf("cookie 应有正 MaxAge, 实得 %d", ck.MaxAge)
	}

	r2 := reqFrom("10.0.0.1")
	r2.AddCookie(ck)
	if !g.Unlocked(r2) {
		t.Fatalf("带正确 cookie 应已解锁")
	}
}

// TestStoreGate_wrong_password 错口令应拒绝且不写 cookie
func TestStoreGate_wrong_password(t *testing.T) {
	g, _ := NewStoreGate(newMemKV())
	r := reqFrom("10.0.0.2")
	w := httptest.NewRecorder()

	remaining, err := g.Unlock(r, w, "wrong-password")
	if err == nil {
		t.Fatalf("错口令应报错")
	}
	if remaining != gateMaxFails-1 {
		t.Fatalf("剩余次数应为 %d, 实得 %d", gateMaxFails-1, remaining)
	}
	for _, c := range w.Result().Cookies() {
		if c.Name == StoreGateCookie && c.Value != "" {
			t.Fatalf("失败时不应下发有效 cookie")
		}
	}
	if g.Unlocked(r) {
		t.Fatalf("失败后应仍 locked")
	}
	// 大小写敏感 + 空口令
	for _, bad := range []string{"rianqingfengww", "RianQingfengw", "", "REDACTED-GATE-PW "} {
		g2, _ := NewStoreGate(newMemKV())
		if _, err := g2.Unlock(reqFrom("10.0.0.9"), httptest.NewRecorder(), bad); err == nil {
			t.Fatalf("口令 %q 不应通过", bad)
		}
	}
}

// TestStoreGate_lockout 连续错误应锁定
func TestStoreGate_lockout(t *testing.T) {
	g, _ := NewStoreGate(newMemKV())
	ip := "10.0.0.3"
	for i := 0; i < gateMaxFails; i++ {
		g.Unlock(reqFrom(ip), httptest.NewRecorder(), "bad")
	}
	// 第 6 次: 已锁定, remaining 应为 -1
	remaining, err := g.Unlock(reqFrom(ip), httptest.NewRecorder(), "REDACTED-GATE-PW")
	if err == nil {
		t.Fatalf("锁定期间即便口令正确也应拒绝")
	}
	if remaining != -1 {
		t.Fatalf("锁定时应返回 remaining=-1, 实得 %d", remaining)
	}
	if !strings.Contains(err.Error(), "锁定") && !strings.Contains(err.Error(), "再试") {
		t.Fatalf("错误信息应提示锁定, 实得: %v", err)
	}
	// 其它 IP 不受影响
	if _, err := g.Unlock(reqFrom("10.0.0.4"), httptest.NewRecorder(), "REDACTED-GATE-PW"); err != nil {
		t.Fatalf("其它 IP 不应被连带锁定: %v", err)
	}
}

// TestStoreGate_cookie_forged 伪造 cookie 应无效
func TestStoreGate_cookie_forged(t *testing.T) {
	g, _ := NewStoreGate(newMemKV())
	for _, v := range []string{"", "x", strings.Repeat("a", 64), "store-gate|v1"} {
		r := reqFrom("10.0.0.5")
		r.AddCookie(&http.Cookie{Name: StoreGateCookie, Value: v})
		if g.Unlocked(r) {
			t.Fatalf("伪造 cookie %q 不应通过", v)
		}
	}
}

// TestStoreGate_key_persisted 密钥持久化: 换新实例(模拟重启)后旧 cookie 仍有效
func TestStoreGate_key_persisted(t *testing.T) {
	kv := newMemKV()
	g1, _ := NewStoreGate(kv)
	w := httptest.NewRecorder()
	if _, err := g1.Unlock(reqFrom("10.0.0.6"), w, "REDACTED-GATE-PW"); err != nil {
		t.Fatalf("Unlock: %v", err)
	}
	var ck *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == StoreGateCookie {
			ck = c
		}
	}
	// 新实例(同一 KV)
	g2, err := NewStoreGate(kv)
	if err != nil {
		t.Fatalf("NewStoreGate(2): %v", err)
	}
	r := reqFrom("10.0.0.6")
	r.AddCookie(ck)
	if !g2.Unlocked(r) {
		t.Fatalf("重启后旧 cookie 应仍有效(密钥已持久化)")
	}
	// 不同 KV → 不同密钥 → 旧 cookie 无效
	g3, _ := NewStoreGate(newMemKV())
	r2 := reqFrom("10.0.0.6")
	r2.AddCookie(ck)
	if g3.Unlocked(r2) {
		t.Fatalf("不同密钥的实例不应接受旧 cookie")
	}
}

// TestStoreGate_lock 主动上锁应清除 cookie
func TestStoreGate_lock(t *testing.T) {
	g, _ := NewStoreGate(newMemKV())
	w := httptest.NewRecorder()
	g.Lock(w)
	var ck *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == StoreGateCookie {
			ck = c
		}
	}
	if ck == nil || ck.MaxAge >= 0 {
		t.Fatalf("Lock 应下发 MaxAge<0 的清除 cookie, 实得 %+v", ck)
	}
}

// TestStoreGate_disabled_by_env 环境变量关闭
func TestStoreGate_disabled_by_env(t *testing.T) {
	for _, v := range []string{"off", "OFF", "0", "false", " false "} {
		t.Setenv("RC_STORE_GATE", v)
		if !IsStoreGateOff() {
			t.Fatalf("%q 应视为关闭", v)
		}
	}
	for _, v := range []string{"", "on", "1", "true"} {
		t.Setenv("RC_STORE_GATE", v)
		if IsStoreGateOff() {
			t.Fatalf("%q 不应视为关闭", v)
		}
	}
}

// TestStoreGate_hash_not_plaintext 二进制里不应出现明文口令
func TestStoreGate_hash_not_plaintext(t *testing.T) {
	if strings.Contains(storeGateHash, "REDACTED-GATE-PW") {
		t.Fatalf("常量里不应含明文口令")
	}
	if !strings.HasPrefix(storeGateHash, "$6$") {
		t.Fatalf("应为 $6$ SHA-512 crypt 哈希, 实得 %q", storeGateHash[:8])
	}
	// 哈希本身应能验证通过(防手抄错)
	if err := VerifySha512Crypt([]byte("REDACTED-GATE-PW"), storeGateHash); err != nil {
		t.Fatalf("写死的哈希与环境口令不匹配: %v", err)
	}
}
