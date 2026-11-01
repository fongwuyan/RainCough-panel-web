package auth

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// 首次加载必须自动生成并落库, 再次加载要拿到同一个值(重启后 App 不能失效)。
func TestLoadAPIKey_generateAndPersist(t *testing.T) {
	kv := newMemKV()

	s1, err := LoadAPIKey(kv)
	if err != nil {
		t.Fatalf("LoadAPIKey: %v", err)
	}
	k1 := s1.Key()
	if len(k1) < restKeyMinLen {
		t.Fatalf("密钥过短: %q", k1)
	}

	s2, err := LoadAPIKey(kv) // 模拟重启
	if err != nil {
		t.Fatalf("LoadAPIKey(二次): %v", err)
	}
	if s2.Key() != k1 {
		t.Fatalf("重启后密钥变了: %q != %q", s2.Key(), k1)
	}
}

// KV 里塞了脏数据(太短)要重新生成, 不能拿来用。
func TestLoadAPIKey_replacesJunk(t *testing.T) {
	kv := newMemKV()
	_ = kv.Set(restKeyKVKey, "abc")

	s, err := LoadAPIKey(kv)
	if err != nil {
		t.Fatalf("LoadAPIKey: %v", err)
	}
	if s.Key() == "abc" || len(s.Key()) < restKeyMinLen {
		t.Fatalf("脏数据未被替换: %q", s.Key())
	}
}

// 三种携带方式: header / query / 都没有。
func TestAPIKeyCheck(t *testing.T) {
	s, err := LoadAPIKey(newMemKV())
	if err != nil {
		t.Fatalf("LoadAPIKey: %v", err)
	}
	key := s.Key()

	cases := []struct {
		name   string
		header string
		query  string
		want   bool
	}{
		{"请求头正确", key, "", true},
		{"query 正确", "", key, true},
		{"两者都没有", "", "", false},
		{"请求头错误", "wrong-key-value", "", false},
		{"query 错误", "", "wrong", false},
		{"前缀截断", key[:len(key)-1], "", false},
		{"多一个字符", key + "x", "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			url := "http://x/api/plugins/jmcomic/search"
			if c.query != "" {
				url += "?key=" + c.query
			}
			req := httptest.NewRequest("GET", url, nil)
			if c.header != "" {
				req.Header.Set(RESTKeyHeader, c.header)
			}
			if got := s.Check(req); got != c.want {
				t.Fatalf("期望 %v, 得到 %v", c.want, got)
			}
		})
	}
}

// 重置后旧密钥必须立刻失效 —— 否则"重置"没有意义。
func TestAPIKeyRotate(t *testing.T) {
	s, err := LoadAPIKey(newMemKV())
	if err != nil {
		t.Fatalf("LoadAPIKey: %v", err)
	}
	old := s.Key()

	neu, err := s.Rotate()
	if err != nil {
		t.Fatalf("Rotate: %v", err)
	}
	if neu == old {
		t.Fatal("重置后密钥没变")
	}
	if s.Key() != neu {
		t.Fatal("Key() 没跟上新值")
	}

	reqOld := httptest.NewRequest("GET", "http://x/a?key="+old, nil)
	if s.Check(reqOld) {
		t.Fatal("旧密钥仍能通过")
	}
	reqNew := httptest.NewRequest("GET", "http://x/a?key="+neu, nil)
	if !s.Check(reqNew) {
		t.Fatal("新密钥不能通过")
	}
}

// 默认必须要求校验; 只有显式 off/0/false 才关。
func TestRESTKeyRequired_default_on(t *testing.T) {
	for _, v := range []string{"", "on", "1", "true", "yes"} {
		t.Setenv("RC_REST_KEY", v)
		if !RESTKeyRequired() {
			t.Fatalf("RC_REST_KEY=%q 应要求校验", v)
		}
	}
	for _, v := range []string{"off", "OFF", "0", "false", " false "} {
		t.Setenv("RC_REST_KEY", v)
		if RESTKeyRequired() {
			t.Fatalf("RC_REST_KEY=%q 应关闭校验", v)
		}
	}
}

// 密钥不该带换行/空格(复制粘贴容易带上), TrimSpace 后仍要能匹配。
func TestAPIKeyCheck_trimsWhitespace(t *testing.T) {
	s, _ := LoadAPIKey(newMemKV())
	req := httptest.NewRequest("GET", "http://x/a", nil)
	req.Header.Set(RESTKeyHeader, "  "+strings.TrimSpace(s.Key())+"  ")
	if !s.Check(req) {
		t.Fatal("前后空格应被容忍")
	}
}
