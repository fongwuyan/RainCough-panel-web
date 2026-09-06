package core

import (
	"testing"
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
