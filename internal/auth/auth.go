// Package auth 提供面板登录鉴权:
//
//	· session 生命周期(创建/校验/过期清理)
//	· SHA-512 crypt(3) 验证(/etc/shadow 哈希字段比对)
//	· admin 密码验证(自动生成 + RC_ADMIN_PASSWORD 覆盖)
//	· HTTP 中间件: 除登录/静态外的接口全部要求 session
//
// v6 零依赖红线: 仅使用标准库, 手写 crypt(3) SHA-512 算法(参考 mvo5/sha512crypt-node BSD-2)。
//
// 设计要点:
//
//	· 默认走 SSH 密码(= 服务器登录密码), 用户不用多记一个密码
//	  —— 读 /etc/shadow 当前用户的哈希字段, SHA-512 crypt(3) 比对
//	· 可在「设置 → 登录」关掉系统密码通道, 只留面板密码
//	  —— 开关存 <data>/secret/login.json, 立即生效, 不需要重启
//	· admin 密码降级: 若面板以非 root 运行, 读不到 shadow, 则改用面板自带的 admin 密码
//	  —— 安装时随机生成 32 字符密码, 写到 <data>/secret/admin.pw(mode 0600), 打印到 journal
//	  —— 也可用 RC_ADMIN_PASSWORD 环境变量覆盖(便于测试/迁移)
//	· session 持久化: <data>/sessions/<id>.json, 默认 30 天过期(用户感知"永久保留")
//	· cookie 名: rc_session, HttpOnly + SameSite=Strict
//	· 中间件: 白名单 /api/auth/login + /api/auth/status + /login + 静态资源, 其余需 session
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// 默认 session 有效期(用户感知"永久保留"; 实际 30 天, 与浏览器 cookie 同步)
const DefaultSessionTTL = 30 * 24 * time.Hour

// Cookie 名 + 文件名约定
const (
	CookieName       = "rc_session"
	SecretDir        = "secret"
	AdminPasswordFn  = "admin.pw"
	LoginPolicyFn    = "login.json"
	SessionsDir      = "sessions"
	minAdminPassword = 24 // 至少 24 字符
)

// Method 登录方式(给前端 / 设置页展示用)
const (
	MethodSSH   = "ssh"   // 服务器 SSH 登录密码(/etc/shadow $6$ 验证)
	MethodAdmin = "admin" // 面板自带 admin 密码(<data>/secret/admin.pw 明文 sha256 比对)
)

// Session 表示一个登录会话
type Session struct {
	ID        string    `json:"id"`
	User      string    `json:"user"`   // 当前用户名(如 "f", "root")
	Method    string    `json:"method"` // "ssh" | "admin"
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Status 当前登录状态(给前端 /api/auth/status 用)
type Status struct {
	LoggedIn  bool       `json:"logged_in"`
	User      string     `json:"user,omitempty"`
	Method    string     `json:"method,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// 下面字段给登录页用 —— 用户能登录的方式 + 密码提示
	CanSSHPassword   bool   `json:"can_ssh_password"`       // 系统密码通道当前是否可用(有 $6$ 哈希 且 开关打开)
	AllowSSHPassword bool   `json:"allow_ssh_password"`     // 设置项: 是否允许用系统密码登录(默认 true)
	ShadowAvailable  bool   `json:"shadow_available"`       // 能力: /etc/shadow 是否读得到 $6$ 哈希
	SSHUsername      string `json:"ssh_username,omitempty"` // 当前运行用户名
	ShadowNote       string `json:"shadow_note,omitempty"`  // 系统密码不可用的原因(给用户解释)
	HasAdminPW       bool   `json:"has_admin_pw"`           // 面板密码通道是否可用(总是可用)
	AdminKind        string `json:"admin_kind,omitempty"`   // 面板密码形态: "随机生成" / "$6$ 哈希"
}

// Manager 鉴权管理器(单例, 主程序启动时 New 一次)
type Manager struct {
	dataDir  string
	mu       sync.RWMutex
	sessions map[string]Session
	ttl      time.Duration

	// 启动时一次性加载:
	shadowHash string   // /etc/shadow 的 $6$ 哈希; 空 = 不可用(非 $6$ 或无权限)
	shadowUser string   // /etc/shadow 里的用户名(默认 = 当前运行用户)
	shadowWhy  string   // shadowHash 为空的原因(给前端/日志解释)
	adminCrypt string   // 面板密码的 $6$ 哈希; 空 = 用 adminPlainHash
	adminSHA   [32]byte // 面板密码明文 SHA-256(兼容 RC_ADMIN_PASSWORD / 旧明文文件)
	hasAdmin   bool     // 是否启用面板密码通道

	// allowSSH 是否允许用系统(SSH)密码登录。运行期可改(设置页开关), 用 mu 保护。
	allowSSH bool
}

// Options 构造参数
type Options struct {
	DataDir       string        // 数据目录(默认 <base>/data), sessions/ + secret/ 都在它下面
	SessionTTL    time.Duration // 0 = 用 DefaultSessionTTL
	AdminPassword string        // 明文密码覆盖; 空 = 自动生成(写到 <data>/secret/admin.pw)
}

// New 创建 Manager 并:
//
//	· 加载已有 sessions(过期自动清理)
//	· 检测 /etc/shadow 当前用户(权限不足则降级)
//	· 初始化 admin 密码(环境变量 / 自动生成)
func New(opts Options) (*Manager, error) {
	if opts.DataDir == "" {
		return nil, errors.New("auth: DataDir 必填")
	}
	if opts.SessionTTL <= 0 {
		opts.SessionTTL = DefaultSessionTTL
	}
	m := &Manager{
		dataDir:  opts.DataDir,
		sessions: make(map[string]Session),
		ttl:      opts.SessionTTL,
	}

	// sessions/ 目录
	if err := os.MkdirAll(filepath.Join(opts.DataDir, SessionsDir), 0o700); err != nil {
		return nil, fmt.Errorf("auth: 建 sessions 目录失败: %w", err)
	}

	// /etc/shadow
	curUser, _ := user.Current()
	if curUser != nil {
		m.shadowUser = curUser.Username
		hash, err := ReadShadowHash(curUser.Username)
		if err != nil {
			m.shadowWhy = err.Error()
		} else {
			m.shadowHash = hash
		}
	}

	// 面板密码
	if err := m.loadOrInitAdminPassword(opts.AdminPassword); err != nil {
		return nil, fmt.Errorf("auth: 初始化面板密码失败: %w", err)
	}

	// 登录策略(默认允许系统密码)
	m.loadLoginPolicy()

	// 加载 sessions
	if err := m.loadSessions(); err != nil {
		// 非致命: 第一次启动 sessions/ 是空的
		fmt.Fprintf(os.Stderr, "[auth] 加载 sessions 失败(非致命, 清空重来): %v\n", err)
	}

	// 启动日志: 说清当前可用的登录通道(运维排障靠这个)
	fmt.Fprintf(os.Stderr, "[auth] 登录通道: ")
	if m.shadowHash != "" {
		if m.allowSSH {
			fmt.Fprintf(os.Stderr, "系统密码(%s, /etc/shadow $6$)", m.shadowUser)
		} else {
			fmt.Fprintf(os.Stderr, "系统密码已被设置关闭(仍读得到 %s 的哈希)", m.shadowUser)
		}
	} else {
		fmt.Fprintf(os.Stderr, "系统密码不可用(%s)", m.shadowWhy)
	}
	if m.hasAdmin {
		fmt.Fprintf(os.Stderr, " + 面板密码(%s)", m.adminKind())
	}
	fmt.Fprintf(os.Stderr, "\n")

	return m, nil
}

// adminKind 面板密码的存储形态(给日志/前端展示)
func (m *Manager) adminKind() string {
	if m.adminCrypt != "" {
		return "已设置, $6$ 哈希"
	}
	return "已设置, 随机生成"
}

// loadOrInitAdminPassword 加载或生成面板密码:
//  1. RC_ADMIN_PASSWORD 环境变量非空 -> 直接用(不写文件, 只在内存; 明文)
//  2. <data>/secret/admin.pw 已存在 ->
//     · 内容以 "$6$" 开头: 当作 SHA-512 crypt 哈希(由 install.sh / -set-password 写入)
//     · 否则: 当作明文(兼容旧版本, 向后兼容)
//  3. 否则随机生成 32 字符密码, 写明文文件, 打印到 stderr(走 journal 可查)
func (m *Manager) loadOrInitAdminPassword(override string) error {
	secretDir := filepath.Join(m.dataDir, SecretDir)
	if err := os.MkdirAll(secretDir, 0o700); err != nil {
		return err
	}
	pwPath := filepath.Join(secretDir, AdminPasswordFn)

	if override != "" {
		m.setPlain(override)
		return nil
	}

	if data, err := os.ReadFile(pwPath); err == nil {
		v := strings.TrimRight(string(data), "\r\n")
		if v != "" {
			if strings.HasPrefix(v, "$6$") {
				m.adminCrypt = v
				m.hasAdmin = true
				return nil
			}
			m.setPlain(v)
			return nil
		}
	}

	// 生成随机密码
	pw, err := randomPassword(32)
	if err != nil {
		return err
	}
	if err := os.WriteFile(pwPath, []byte(pw+"\n"), 0o600); err != nil {
		return err
	}
	m.setPlain(pw)
	fmt.Fprintf(os.Stderr, "\n==========================================================\n")
	fmt.Fprintf(os.Stderr, "[auth] 已生成面板密码(首次启动, 请妥善保存):\n")
	fmt.Fprintf(os.Stderr, "       %s\n", pw)
	fmt.Fprintf(os.Stderr, "       已保存到 %s (mode 0600)\n", pwPath)
	fmt.Fprintf(os.Stderr, "       ★ 想改成自己的 SSH 密码: raincough -set-password\n")
	fmt.Fprintf(os.Stderr, "==========================================================\n\n")
	return nil
}

func (m *Manager) setPlain(pw string) {
	m.adminSHA = sha256.Sum256([]byte(pw))
	m.adminCrypt = ""
	m.hasAdmin = true
}

// ---------------------------------------------------------------- 登录策略

// LoginPolicyPath 登录策略文件路径(<data>/secret/login.json)。
func LoginPolicyPath(dataDir string) string {
	return filepath.Join(dataDir, SecretDir, LoginPolicyFn)
}

// loadLoginPolicy 读取登录策略。
//
// 文件不存在 / 读不懂 -> 默认允许系统密码登录。宁可让老部署行为不变,
// 也不要因为一个坏文件把用户锁在门外。
func (m *Manager) loadLoginPolicy() {
	m.allowSSH = true
	data, err := os.ReadFile(LoginPolicyPath(m.dataDir))
	if err != nil {
		return
	}
	var p struct {
		AllowSSHPassword *bool `json:"allow_ssh_password"`
	}
	if err := json.Unmarshal(data, &p); err != nil || p.AllowSSHPassword == nil {
		fmt.Fprintf(os.Stderr, "[auth] 登录策略文件无法解析, 按默认(允许系统密码)处理: %v\n", err)
		return
	}
	m.allowSSH = *p.AllowSSHPassword
}

// AllowSSHPassword 当前是否允许用系统(SSH)密码登录。
func (m *Manager) AllowSSHPassword() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.allowSSH
}

// SetAllowSSHPassword 开关"用系统(SSH)密码登录", 立即生效并落盘。
//
// 落盘失败会把内存状态回滚 —— 界面上显示已关闭、重启后却又能用 SSH 密码,
// 比开关失败更糟。
func (m *Manager) SetAllowSSHPassword(v bool) error {
	m.mu.Lock()
	prev := m.allowSSH
	m.allowSSH = v
	m.mu.Unlock()

	if err := m.writeLoginPolicy(v); err != nil {
		m.mu.Lock()
		m.allowSSH = prev
		m.mu.Unlock()
		return err
	}
	if v {
		fmt.Fprintf(os.Stderr, "[auth] 系统(SSH)密码登录已启用\n")
	} else {
		fmt.Fprintf(os.Stderr, "[auth] 系统(SSH)密码登录已关闭, 只能用面板密码登录\n")
	}
	return nil
}

// writeLoginPolicy 原子写入策略文件(先写临时文件再 rename)。
func (m *Manager) writeLoginPolicy(v bool) error {
	secretDir := filepath.Join(m.dataDir, SecretDir)
	if err := os.MkdirAll(secretDir, 0o700); err != nil {
		return err
	}
	body, err := json.Marshal(map[string]bool{"allow_ssh_password": v})
	if err != nil {
		return err
	}
	path := LoginPolicyPath(m.dataDir)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(body, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// loadSessions 从 <data>/sessions/ 加载所有未过期 session, 过期则删文件
func (m *Manager) loadSessions() error {
	dir := filepath.Join(m.dataDir, SessionsDir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	now := time.Now()
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var s Session
		if err := json.Unmarshal(data, &s); err != nil {
			os.Remove(path) // 损坏文件清理
			continue
		}
		if now.After(s.ExpiresAt) {
			os.Remove(path)
			continue
		}
		m.sessions[s.ID] = s
	}
	return nil
}

// Verify 验证密码 — 先尝试系统密码(/etc/shadow $6$), 再尝试面板密码
// 返回 (user, method, true) = 成功; ( "", "", false ) = 失败
// 注意: 故意不返回错误细节, 防止账号枚举
func (m *Manager) Verify(password string) (string, string, bool) {
	// 1. 系统 SSH 密码(/etc/shadow, 仅 $6$ SHA-512 可用)
	//    开关关掉时这条通道直接不参与 —— 要在设置里关得彻底, 不能只是界面藏起来
	if m.AllowSSHPassword() && m.shadowHash != "" {
		if err := VerifySha512Crypt([]byte(password), m.shadowHash); err == nil {
			return m.shadowUser, MethodSSH, true
		}
	}
	// 2. 面板密码: 优先 $6$ 哈希, 其次明文 sha256
	if m.hasAdmin {
		if m.adminCrypt != "" {
			if err := VerifySha512Crypt([]byte(password), m.adminCrypt); err == nil {
				return m.shadowUser, MethodAdmin, true
			}
		} else {
			h := sha256.Sum256([]byte(password))
			if subtle.ConstantTimeCompare(h[:], m.adminSHA[:]) == 1 {
				return m.shadowUser, MethodAdmin, true
			}
		}
	}
	return "", "", false
}

// IssueSession 创建 + 持久化 + 返回(给登录路由调用)
func (m *Manager) IssueSession(user, method string) (Session, error) {
	id, err := randomToken(32)
	if err != nil {
		return Session{}, err
	}
	now := time.Now()
	s := Session{
		ID:        id,
		User:      user,
		Method:    method,
		CreatedAt: now,
		ExpiresAt: now.Add(m.ttl),
	}
	if err := m.persist(s); err != nil {
		return Session{}, err
	}
	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()
	return s, nil
}

// Revoke 删除 session(注销)
func (m *Manager) Revoke(id string) {
	m.mu.Lock()
	delete(m.sessions, id)
	m.mu.Unlock()
	os.Remove(filepath.Join(m.dataDir, SessionsDir, id+".json"))
}

// Lookup 根据 session id 找 session(过期返回 false)
func (m *Manager) Lookup(id string) (Session, bool) {
	m.mu.RLock()
	s, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return Session{}, false
	}
	if time.Now().After(s.ExpiresAt) {
		m.Revoke(id)
		return Session{}, false
	}
	return s, true
}

// Status 当前状态(给前端 /api/auth/status 用)
func (m *Manager) Status(sess Session, loggedIn bool) Status {
	allowSSH := m.AllowSSHPassword()
	st := Status{
		HasAdminPW:       m.hasAdmin,
		AdminKind:        m.adminKind(),
		CanSSHPassword:   m.shadowHash != "" && allowSSH,
		AllowSSHPassword: allowSSH,
		ShadowAvailable:  m.shadowHash != "",
		SSHUsername:      m.shadowUser,
		ShadowNote:       m.shadowWhy,
	}
	if loggedIn {
		exp := sess.ExpiresAt
		st.LoggedIn = true
		st.User = sess.User
		st.Method = sess.Method
		st.ExpiresAt = &exp
	}
	return st
}

// SetPassword 把面板密码写成 $6$ 哈希存到 <dataDir>/secret/admin.pw(mode 0600)。
// 供 `raincough -set-password` 与 install.sh 调用 —— 用户可以把面板密码设成自己的 SSH 密码,
// 这样在 yescrypt($y$)/bcrypt 等无法离线验证的系统上也能"用 SSH 密码登录"(用户感知一致)。
//
// ★ 同时清空 <dataDir>/sessions/ —— 改密码就必须让旧登录失效,
//
//	否则密码泄露后改密码也踢不掉已在线的设备(安全默认)。
//
// 不设硬下限: 面板密码通常就是复用系统 SSH 密码, 若系统本身允许短密码, 面板不该比它更严
// (那样会让用户"SSH 能进、面板进不去", 反而困惑)。但 < 8 位会往 stderr 打告警。
func SetPassword(dataDir, password string) error {
	if password == "" {
		return errors.New("密码不能为空")
	}
	if len(password) < 8 {
		fmt.Fprintf(os.Stderr, "提示: 密码长度 %d 位, 较弱。若系统本身允许则可用, 但建议 12 位以上。\n", len(password))
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	if err := writeAdminHash(dataDir, hash); err != nil {
		return err
	}
	// 清空旧 session(改密码 = 所有设备重新登录)
	n := clearSessions(dataDir)
	if n > 0 {
		fmt.Fprintf(os.Stderr, "已注销 %d 个现有登录会话(改密码后需要重新登录)\n", n)
	}
	return nil
}

// writeAdminHash 原子写入面板密码哈希(先写临时文件再 rename)。
func writeAdminHash(dataDir, hash string) error {
	secretDir := filepath.Join(dataDir, SecretDir)
	if err := os.MkdirAll(secretDir, 0o700); err != nil {
		return err
	}
	path := filepath.Join(secretDir, AdminPasswordFn)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(hash+"\n"), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// minPanelPassword 设置页改密码时的下限。
//
// CLI 的 SetPassword 不设硬下限(可能是在复用系统密码, 系统本身允许短密码),
// 但设置页是主动新建一个面板密码, 8 位以下没有理由放行。
const minPanelPassword = 8

// SetAdminPassword 在运行期修改面板密码(设置页用), 立即生效。
//
// 与 CLI 的 SetPassword 的差别: 保留 keepSessionID 这台设备的登录,
// 否则用户刚点完"保存"就被踢回登录页。其余会话一律注销 ——
// 改密码本来就是为了让别处的登录失效。
func (m *Manager) SetAdminPassword(password, keepSessionID string) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	if err := writeAdminHash(m.dataDir, hash); err != nil {
		return err
	}

	m.mu.Lock()
	m.adminCrypt = hash
	m.adminSHA = [32]byte{}
	m.hasAdmin = true
	revoked := 0
	for id := range m.sessions {
		if id == keepSessionID {
			continue
		}
		delete(m.sessions, id)
		_ = os.Remove(filepath.Join(m.dataDir, SessionsDir, id+".json"))
		revoked++
	}
	m.mu.Unlock()

	fmt.Fprintf(os.Stderr, "[auth] 面板密码已更新, 已注销 %d 个其它会话\n", revoked)
	return nil
}

// clearSessions 删除 <dataDir>/sessions/*.json, 返回删除数量
func clearSessions(dataDir string) int {
	dir := filepath.Join(dataDir, SessionsDir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	n := 0
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		if os.Remove(filepath.Join(dir, e.Name())) == nil {
			n++
		}
	}
	return n
}

// PasswordPath 返回面板密码文件路径(给 CLI/install.sh 提示用)
func PasswordPath(dataDir string) string {
	return filepath.Join(dataDir, SecretDir, AdminPasswordFn)
}

func (m *Manager) persist(s Session) error {
	path := filepath.Join(m.dataDir, SessionsDir, s.ID+".json")
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

// --- HTTP handlers ---

// Routes 注册 /api/auth/{login,logout,status} 到 mux
func (m *Manager) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/api/auth/login", m.handleLogin)
	mux.HandleFunc("/api/auth/logout", m.handleLogout)
	mux.HandleFunc("/api/auth/status", m.handleStatus)
	mux.HandleFunc("/api/auth/login-policy", m.handleLoginPolicy)
	mux.HandleFunc("/api/auth/password", m.handleSetPassword)
}

func (m *Manager) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthErr(w, 405, "仅 POST")
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeAuthErr(w, 400, "请求体解析失败")
		return
	}
	user, method, ok := m.Verify(req.Password)
	if !ok {
		// 防爆破: 故意睡 500ms(与一次成功验证耗时相当, 降低暴力速度)
		time.Sleep(500 * time.Millisecond)
		writeAuthErr(w, 401, "密码错误")
		return
	}
	sess, err := m.IssueSession(user, method)
	if err != nil {
		writeAuthErr(w, 500, "session 创建失败: "+err.Error())
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    sess.ID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Expires:  sess.ExpiresAt,
		// 面板默认 http(局域网); 若站点配 TLS 加 Secure
	})
	writeAuthOK(w, map[string]any{
		"ok":         true,
		"user":       user,
		"method":     method,
		"expires_at": sess.ExpiresAt,
	})
}

func (m *Manager) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(CookieName); err == nil {
		m.Revoke(c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
	writeAuthOK(w, map[string]any{"ok": true})
}

func (m *Manager) handleStatus(w http.ResponseWriter, r *http.Request) {
	var sess Session
	loggedIn := false
	if c, err := r.Cookie(CookieName); err == nil {
		if s, ok := m.Lookup(c.Value); ok {
			sess = s
			loggedIn = true
		}
	}
	writeAuthOK(w, m.Status(sess, loggedIn))
}

// LoginPolicy 登录策略(给「设置 → 登录」用)。
type LoginPolicy struct {
	AllowSSHPassword bool   `json:"allow_ssh_password"` // 是否允许用系统(SSH)密码登录
	ShadowAvailable  bool   `json:"shadow_available"`   // 这台机器上系统密码通道是否可用
	SSHUsername      string `json:"ssh_username,omitempty"`
	ShadowNote       string `json:"shadow_note,omitempty"`
	HasAdminPW       bool   `json:"has_admin_pw"`
	AdminKind        string `json:"admin_kind,omitempty"`
}

func (m *Manager) loginPolicy() LoginPolicy {
	return LoginPolicy{
		AllowSSHPassword: m.AllowSSHPassword(),
		ShadowAvailable:  m.shadowHash != "",
		SSHUsername:      m.shadowUser,
		ShadowNote:       m.shadowWhy,
		HasAdminPW:       m.hasAdmin,
		AdminKind:        m.adminKind(),
	}
}

// handleLoginPolicy GET 读取 / POST 切换"是否允许系统密码登录"。
// 需要登录态(不在白名单里, 由中间件把关)。
func (m *Manager) handleLoginPolicy(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeAuthOK(w, m.loginPolicy())
	case http.MethodPost:
		var req struct {
			AllowSSHPassword *bool `json:"allow_ssh_password"`
		}
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.AllowSSHPassword == nil {
			writeAuthErr(w, 400, "请求体需要 {allow_ssh_password: bool}")
			return
		}
		if err := m.SetAllowSSHPassword(*req.AllowSSHPassword); err != nil {
			writeAuthErr(w, 500, "保存失败: "+err.Error())
			return
		}
		writeAuthOK(w, m.loginPolicy())
	default:
		writeAuthErr(w, 405, "仅 GET/POST")
	}
}

// handleSetPassword POST {new_password} 修改面板密码(设置页用, 需要登录态)。
//
// 不要求输入旧密码: 能拿到已登录的 session 已经等同于持有凭据;
// 真正的风险是"别人拿着你的浏览器", 那和面板里其它操作同级。
func (m *Manager) handleSetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthErr(w, 405, "仅 POST")
		return
	}
	var req struct {
		NewPassword string `json:"new_password"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeAuthErr(w, 400, "请求体解析失败")
		return
	}
	if strings.TrimSpace(req.NewPassword) == "" {
		writeAuthErr(w, 400, "密码不能为空")
		return
	}
	if len([]rune(req.NewPassword)) < minPanelPassword {
		writeAuthErr(w, 400, "密码至少 8 位")
		return
	}
	keep := ""
	if c, err := r.Cookie(CookieName); err == nil {
		keep = c.Value
	}
	if err := m.SetAdminPassword(req.NewPassword, keep); err != nil {
		writeAuthErr(w, 500, "保存失败: "+err.Error())
		return
	}
	writeAuthOK(w, map[string]any{"ok": true, "admin_kind": m.adminKind()})
}

func writeAuthErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": msg})
}

func writeAuthOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

// Middleware HTTP 中间件: 白名单外的接口要求 session
//
//	· 白名单: /api/auth/login, /api/auth/status, /api/auth/logout
//	· SPA 资源(非 /api/): 任何都放行(让前端路由处理 /login 跳转)
//	· API: 未登录返 401
//
// 注: 移动端 App(JMReader)没有登录能力, 走的是 /<插件名>/... 前缀的 REST 桥,
// 该前缀不在 /api/ 下, 天然不经过本中间件(见 cmd/raincough 的插件前缀改写)。
func (m *Manager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isAuthWhitelist(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		// API: 必须 session
		if strings.HasPrefix(r.URL.Path, "/api/") {
			c, err := r.Cookie(CookieName)
			if err != nil {
				writeAuthErr(w, 401, "未登录")
				return
			}
			if _, ok := m.Lookup(c.Value); !ok {
				writeAuthErr(w, 401, "session 已过期或无效")
				return
			}
		}
		// 非 API 路径(前端路由): 放行(由前端 router 决定跳 /login)
		next.ServeHTTP(w, r)
	})
}

func isAuthWhitelist(path string) bool {
	switch path {
	case "/api/auth/login", "/api/auth/status", "/api/auth/logout":
		return true
	}
	return false
}

// --- 工具 ---

// randomToken 返回 hex 编码的随机 token(用于 session id)
func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// randomPassword 返回 [a-zA-Z0-9] 中随机字符组成的密码(避开易混淆字符 0/O/1/l/I)
func randomPassword(n int) (string, error) {
	const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b), nil
}

// SensitiveFiles 返回所有敏感文件路径(供 uninstall.sh 清理)
func (m *Manager) SensitiveFiles() []string {
	return []string{
		filepath.Join(m.dataDir, SecretDir),
		filepath.Join(m.dataDir, SessionsDir),
	}
}
