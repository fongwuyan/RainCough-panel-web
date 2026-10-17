package auth

import (
	"bufio"
	"errors"
	"os"
	"os/user"
	"strings"
)

// ReadShadowHash 读取 /etc/shadow 中指定用户名的密码哈希字段(第 2 列)。
//
// 权限要求: /etc/shadow 通常 mode 0640 root:shadow, 因此要求进程以 root 运行
// (或在 shadow 组里)。非 root 调用应视为预期失败, 调用方降级到 admin 密码验证。
//
// 支持的哈希格式:
//   · $1$  MD5-crypt      → 暂不实现(系统 v6 只支持 SHA-512)
//   · $5$  SHA-256 crypt  → 暂不实现
//   · $6$  SHA-512 crypt  → ✓ 走 VerifySha512Crypt
//   · $y$  yescrypt       → 暂不实现(主流发行版默认仍是 $6$)
//   · 空 / * / !          → 账户锁定或无密码, 直接报错
//
// 返回:
//   · nil + hash          → 找到用户的哈希
//   · ErrShadowUnavailable → 无法读 /etc/shadow(权限不够 / 文件不存在)
//   · ErrNoSuchUser        → 该用户不在 shadow 中
//   · ErrUnsupportedHash   → 哈希算法不在支持列表
//   · ErrAccountLocked     → 账户被锁(空 / * / !)
func ReadShadowHash(username string) (string, error) {
	if username == "" {
		u, err := user.Current()
		if err != nil {
			return "", ErrShadowUnavailable
		}
		username = u.Username
	}
	f, err := os.Open("/etc/shadow")
	if err != nil {
		if errors.Is(err, os.ErrPermission) || errors.Is(err, os.ErrNotExist) {
			return "", ErrShadowUnavailable
		}
		return "", err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		// 跳过空行 / 注释
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.SplitN(line, ":", 3)
		if len(fields) < 2 || fields[0] != username {
			continue
		}
		hash := fields[1]
		switch {
		case hash == "" || hash == "*" || hash == "!" || hash == "!!":
			return "", ErrAccountLocked
		case strings.HasPrefix(hash, "$6$"):
			return hash, nil
		case strings.HasPrefix(hash, "$y$"):
			// Debian 12 / Ubuntu 24.04+ 默认 yescrypt —— 算法复杂(C 参考实现 ~1500 行),
			// 零依赖 Go 暂不实现。降级到面板密码通道, 由 install.sh 引导设成同一个 SSH 密码。
			return "", ErrYescrypt
		case strings.HasPrefix(hash, "$2"):
			return "", ErrBcrypt
		case strings.HasPrefix(hash, "$"):
			return "", ErrUnsupportedHash
		default:
			// 老式 DES crypt (13 字符), v6 不支持
			return "", ErrUnsupportedHash
		}
	}
	return "", ErrNoSuchUser
}

var (
	ErrShadowUnavailable = errors.New("无法读取 /etc/shadow(需 root 或 shadow 组)")
	ErrNoSuchUser        = errors.New("/etc/shadow 中无此用户")
	ErrUnsupportedHash   = errors.New("shadow 哈希算法不受支持")
	ErrAccountLocked     = errors.New("账户已锁定(*/!/空)")
	ErrYescrypt          = errors.New("shadow 使用 yescrypt($y$), 无法离线验证 → 请用面板密码")
	ErrBcrypt            = errors.New("shadow 使用 bcrypt($2*), 无法离线验证 → 请用面板密码")
)