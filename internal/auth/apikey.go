package auth

// 移动端 REST 访问密钥。
//
// 背景: 配套 Android App(JMReader)没有登录能力, 走 /<插件名>/api/... 前缀绕开
// 登录中间件(见 cmd/raincough 的 rewritePluginPrefix)。这条通道此前完全裸奔 ——
// 局域网里任何人知道面板地址, 就能拉漫画库、读元数据、下整本图片。
//
// 另一个事实: 插件清单里的 rest_public 开关(RESTPublicMatch)从来没有被任何地方调用过,
// 是个死标志 —— 所以"要不要对外开放"其实一直由前缀决定, 跟那个字段无关。
// 现在统一改成: 前缀通道一律要密钥。
//
// 密钥存 KV, 首次启动自动生成(48 位 hex), 可在面板「设置」查看与重置。
// 排障时可以 RC_REST_KEY=off 临时关掉校验(会把通道重新变回裸奔, 别常开)。

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"
	"sync"
)

const (
	// RESTKeyHeader App 携带密钥的请求头
	RESTKeyHeader = "X-RC-Key"
	// RESTKeyQuery 同上的 query 形式。
	// 必须有: 图片由 Coil 直接下载, 塞不进自定义头, 只能在 URL 上带。
	RESTKeyQuery = "key"
	// 密钥在 KV 里的键名
	restKeyKVKey = "rest_api_key"
	// 密钥最短长度: 小于这个值视为脏数据, 重新生成
	restKeyMinLen = 16
)

// APIKeyStore 访问密钥的读写与校验。
type APIKeyStore struct {
	mu  sync.Mutex
	kv  GateKV
	key string
}

// LoadAPIKey 从 KV 读密钥, 不存在则生成并落库。
//
// 复用 GateKV 接口(Set/Get), 与插件库口令闸门共用同一个 namespace 实现,
// 不为一个字符串再引一层依赖。
func LoadAPIKey(kv GateKV) (*APIKeyStore, error) {
	s := &APIKeyStore{kv: kv}
	if raw, ok, err := kv.Get(restKeyKVKey); err == nil && ok {
		if v, isStr := raw.(string); isStr && len(v) >= restKeyMinLen {
			s.key = v
			return s, nil
		}
	}
	k, err := randomToken(24) // 48 位 hex
	if err != nil {
		return nil, err
	}
	if err := kv.Set(restKeyKVKey, k); err != nil {
		return nil, err
	}
	s.key = k
	return s, nil
}

// Key 当前密钥。
func (s *APIKeyStore) Key() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.key
}

// Rotate 重置密钥并返回新值。旧值立刻失效 —— App 需要重新填。
func (s *APIKeyStore) Rotate() (string, error) {
	k, err := randomToken(24)
	if err != nil {
		return "", err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.kv.Set(restKeyKVKey, k); err != nil {
		return "", err
	}
	s.key = k
	return k, nil
}

// Check 校验请求携带的密钥。
//
// 支持两种携带方式: 请求头 X-RC-Key(接口调用), query ?key=(图片直链)。
// 用常数时间比较, 避免按前缀逐字节试探。
func (s *APIKeyStore) Check(r *http.Request) bool {
	want := s.Key()
	if want == "" {
		return false
	}
	got := strings.TrimSpace(r.Header.Get(RESTKeyHeader))
	if got == "" {
		got = strings.TrimSpace(r.URL.Query().Get(RESTKeyQuery))
	}
	if got == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

// RESTKeyRequired 是否需要校验。
//
// 默认需要。RC_REST_KEY=off/0/false 可关闭 —— 只用于排障,
// 关掉等于把插件数据重新暴露到局域网。
func RESTKeyRequired() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("RC_REST_KEY")))
	return !(v == "off" || v == "0" || v == "false")
}
