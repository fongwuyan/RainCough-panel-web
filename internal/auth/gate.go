package auth

// 插件库口令闸门(StoreGate)
//
// 背景: 插件库(RainCough-Plugin)曾计划公开, 而插件本身是要保护的内容 ——
// 公开后任何人都能浏览/下载。所以给面板的"插件市场"加一道口令:
// 只有输入正确口令, 才能拉取插件清单 / 安装 / 更新插件。
//
// ★ 默认关闭。不设任何环境变量时市场无需口令 —— 这道锁只服务
//   "确实要把插件内容挡起来"的部署, 不该默认架在所有人面前。
//
// 开启方式(两个都要):
//
//	Environment=RC_STORE_GATE=on
//	Environment=RC_STORE_GATE_HASH=$6$xxxx        # raincough -hash-password 生成
//
// 设计要点:
//   · 口令哈希来自环境变量, **不再写死在二进制里**。写死的口令会随二进制分发,
//     等于"所有人都能拿到密文、只有主人不知道明文" —— 忘口令只能重编译。
//   · 用 SHA-512 crypt(5000 轮 + 随机盐), 不是裸 SHA-256: 二进制公开后可被离线爆破,
//     5000 轮把单次尝试成本抬到 ~5ms
//   · 解锁状态用签名 cookie(rc_store_gate)保持, 30 天; 签名密钥首次启动随机生成并存 KV,
//     重启不失效。改口令不会让已解锁的浏览器立刻失效(那是签名密钥的事)
//   · 在线爆破防护: 同一 IP 连续 5 次错误 → 锁定 60s, 每次错误固定延迟 300ms
//   · 只能防"知道面板地址的人随手拿插件"; **不能防**知道 GitHub 仓库地址的人直接 clone
//     —— 仓库一旦公开, 权限边界就只剩"不被发现"。真要保护内容必须保持私有 + token
//
// 关闭方式: 不设 RC_STORE_GATE 即关闭; 显式 RC_STORE_GATE=off 也一样。

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
	hash  string               // 口令哈希($6$); 来自 RC_STORE_GATE_HASH, 测试可注入
	fails map[string]*failInfo // 按 IP 记录失败次数
}

type failInfo struct {
	count int
	until time.Time
}

// NewStoreGate 创建闸门, 口令哈希取自 RC_STORE_GATE_HASH。
// 密钥从 KV 读取; 不存在则随机生成并落库(重启后旧 cookie 仍有效)。
//
// 未配置哈希时返回错误而不是用某个"默认口令"兜底: 兜底口令等于没有口令,
// 却会让运维以为门是锁着的。
func NewStoreGate(kv GateKV) (*StoreGate, error) {
	hash := GatePasswordHash()
	if hash == "" {
		return nil, errors.New("已启用插件库闸门(RC_STORE_GATE=on)但未设置 RC_STORE_GATE_HASH; " +
			"先用 raincough -hash-password 生成, 再写进 systemd 的 Environment=")
	}
	return NewStoreGateWithHash(kv, hash)
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

// GateEnabled 是否启用插件库口令闸门。
//
// 默认关闭: 不设 RC_STORE_GATE 就没有口令, 市场直接可见。
// 只有显式 on/1/true/yes 才启用 —— 这道锁服务于"确实要挡插件内容"的部署,
// 不该默认架在所有人面前(2026-11-01 改: 此前是"默认开、写死口令", 忘口令无法恢复)。
func GateEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("RC_STORE_GATE"))) {
	case "on", "1", "true", "yes":
		return true
	}
	return false
}

// GatePasswordHash 口令哈希($6$ SHA-512 crypt), 取自 RC_STORE_GATE_HASH。
//
// 放环境变量而不是写死进二进制: 写死的口令会随二进制一起分发, 变成
// "所有人都拿得到密文、只有主人不知道明文", 忘掉就只能重编译。
func GatePasswordHash() string {
	return strings.TrimSpace(os.Getenv("RC_STORE_GATE_HASH"))
}
