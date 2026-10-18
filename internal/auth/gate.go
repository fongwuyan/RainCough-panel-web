package auth

// 插件库口令闸门(StoreGate)
//
// 背景: 插件库(RainCough-Plugin)计划改为公开仓库, 但插件本身是要保护的内容 ——
// 公开后任何人都能浏览/下载。所以给面板的"插件市场"加一道写死的口令:
// 只有输入正确口令, 才能拉取插件清单 / 安装 / 更新插件。
//
// 设计要点:
//   · 口令哈希【写死在二进制里】, 仓库里没有明文; 用 SHA-512 crypt(5000 轮 + 随机盐),
//     不是裸 SHA-256 —— 二进制公开后可被离线爆破, 5000 轮 crypt 把单次尝试成本
//     抬到 ~5ms, GPU 批量爆破难度提高约 4 个数量级
//   · 解锁状态用签名 cookie(rc_store_gate)保持, 默认 30 天, 与面板 session 同寿命;
//     签名密钥首次启动随机生成并存 KV, 重启不失效, 但**改口令不会自动失效**
//     (口令是写死的, 本来也改不了), 需要时可 -store-gate-reset 清空
//   · 在线爆破防护: 同一 IP 连续 5 次错误 → 锁定 60s, 且每次错误固定延迟 300ms
//   · 只能防"知道面板地址的人随手拿插件"; **不能防**知道 GitHub 仓库地址的人直接 clone
//     —— 仓库一旦公开, 权限边界就只剩"不被发现"。真要保护内容必须保持私有 + token
//
// 关闭方式: RC_STORE_GATE=off(测试/不想用时不设锁)

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	// StoreGateCookie 解锁状态 cookie 名
	StoreGateCookie = "rc_store_gate"
	// storeGateHash 写死的口令哈希: SHA-512 crypt, 5000 轮 + 随机盐(盐已内嵌在字符串里)。
	// 仓库里只有哈希, 不含明文 —— 明文口令不外传、不写注释、不进测试。
	// 生成方式: raincough -hash-password 后把结果替换到这里。
	storeGateHash = "$6$rBkCCZu1w/KZIo8e$mBaTOIE0gSbYtQICvTuO.3j83r..75UllKBgxzqQh0DYKrNIL.Dren8qhnu6DhJjk7iDI9brTKer3g5ZVvMIR."

	gateKVKey       = "gate_hmac_key"
	gateCookieValue = "store-gate|v1"
	gateMaxFails    = 5
	gateLockFor     = 60 * time.Second
	gateFailDelay   = 300 * time.Millisecond
)

// GateKV 只需要 Set/Get(由 shared.Namespace 满足, 避免 auth 反向依赖 core)
type GateKV interface {
	Set(key string, value interface{}) error
	Get(key string) (interface{}, bool, error)
}

// StoreGate 插件库口令闸门
type StoreGate struct {
	mu    sync.Mutex
	key   []byte               // HMAC 签名密钥
	hash  string               // 口令哈希($6$); 生产用 storeGateHash, 测试可注入
	fails map[string]*failInfo // 按 IP 记录失败次数
}

type failInfo struct {
	count int
	until time.Time
}

// NewStoreGate 创建闸门, 密钥从 KV 读取; 不存在则随机生成并落库(重启后旧 cookie 仍有效)。
func NewStoreGate(kv GateKV) (*StoreGate, error) {
	return NewStoreGateWithHash(kv, storeGateHash)
}

// NewStoreGateWithHash 用指定哈希创建闸门。
//
// 存在的意义: 测试要验证"正确口令能解锁 / 错误口令被拒", 但仓库里不能出现明文口令。
// 让测试自己造一对(哈希, 口令)即可覆盖全部逻辑, 完全不需要知道生产口令。
func NewStoreGateWithHash(kv GateKV, hash string) (*StoreGate, error) {
	g := &StoreGate{fails: make(map[string]*failInfo), hash: hash}
	raw, ok, err := kv.Get(gateKVKey)
	if err == nil && ok {
		if s, isStr := raw.(string); isStr && s != "" {
			if b, decErr := hex.DecodeString(s); decErr == nil && len(b) == 32 {
				g.key = b
			}
		}
	}
	if g.key == nil {
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			return nil, fmt.Errorf("生成闸门密钥失败: %w", err)
		}
		g.key = b
		if err := kv.Set(gateKVKey, hex.EncodeToString(b)); err != nil {
			return nil, fmt.Errorf("持久化闸门密钥失败: %w", err)
		}
	}
	return g, nil
}

// Disabled 由调用方按 RC_STORE_GATE=off 决定是否启用; 此方法仅供注释锚点。
func (g *StoreGate) sign() string {
	m := hmac.New(sha256.New, g.key)
	m.Write([]byte(gateCookieValue))
	return hex.EncodeToString(m.Sum(nil))
}

// Unlocked 请求是否已解锁
func (g *StoreGate) Unlocked(r *http.Request) bool {
	c, err := r.Cookie(StoreGateCookie)
	if err != nil || c.Value == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.Value), []byte(g.sign())) == 1
}

// Unlock 校验口令; 成功则下发签名 cookie。
// 返回 (剩余可试次数, 错误)。remaining<0 表示已被锁定。
func (g *StoreGate) Unlock(r *http.Request, w http.ResponseWriter, password string) (int, error) {
	ip := clientIP(r)
	g.mu.Lock()
	fi := g.fails[ip]
	if fi != nil && time.Now().Before(fi.until) {
		left := int(time.Until(fi.until).Seconds()) + 1
		g.mu.Unlock()
		return -1, fmt.Errorf("尝试过多, 请 %d 秒后再试", left)
	}
	g.mu.Unlock()

	// 固定延迟: 让在线爆破无法通过耗时区分对错/加快速度
	start := time.Now()
	err := VerifySha512Crypt([]byte(password), g.hash)
	if d := gateFailDelay - time.Since(start); d > 0 {
		time.Sleep(d)
	}

	if err != nil {
		g.mu.Lock()
		if g.fails[ip] == nil {
			g.fails[ip] = &failInfo{}
		}
		g.fails[ip].count++
		remaining := gateMaxFails - g.fails[ip].count
		if remaining <= 0 {
			g.fails[ip].until = time.Now().Add(gateLockFor)
			g.fails[ip].count = 0
		}
		g.mu.Unlock()
		if remaining <= 0 {
			return -1, fmt.Errorf("错误次数过多, 已锁定 %d 秒", int(gateLockFor.Seconds()))
		}
		return remaining, errors.New("口令错误")
	}

	// 成功: 清失败计数 + 下发 cookie
	g.mu.Lock()
	delete(g.fails, ip)
	g.mu.Unlock()
	http.SetCookie(w, &http.Cookie{
		Name:     StoreGateCookie,
		Value:    g.sign(),
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
	})
	return gateMaxFails, nil
}

// Lock 清除解锁状态(重新上锁)
func (g *StoreGate) Lock(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     StoreGateCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}

// clientIP 取客户端 IP(不信任 XFF —— 面板多在反向代理后, 由反代自己决定是否透传;
// 这里用 RemoteAddr 足够做单机限速, 伪造 XFF 无法绕过, 只是同一反代后所有人共用一个桶)
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// IsStoreGateOff 环境变量是否显式关闭闸门
func IsStoreGateOff() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("RC_STORE_GATE")))
	return v == "off" || v == "0" || v == "false"
}
