// Package auth 提供面板登录鉴权:
//   · session 生命周期(创建/校验/过期清理)
//   · SHA-512 crypt(3) 验证(/etc/shadow 哈希字段比对)
//   · admin 密码验证(自动生成 + RC_ADMIN_PASSWORD 覆盖)
//   · HTTP 中间件: 除登录/静态外的接口全部要求 session
//
// v6 零依赖红线: 仅使用标准库, 手写 crypt(3) SHA-512 算法(参考 mvo5/sha512crypt-node BSD-2)。
package auth

import (
	"crypto/rand"
	"crypto/sha512"
	"crypto/subtle"
	"errors"
	"strconv"
	"strings"
)

// sha512Alphabet SHA-512 crypt(3) 自定义 base64 字母表
// (= RFC 4648 base64 但把 + 和 / 换成 . 和 0~9 起点偏移, 用途是避免与 $ 冲突)
const sha512Alphabet = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// sha512Order 64 个字节的重排顺序(决定 86 字符输出的位序)
var sha512Order = [64]int{
	42, 21, 0,
	1, 43, 22,
	23, 2, 44,
	45, 24, 3,
	4, 46, 25,
	26, 5, 47,
	48, 27, 6,
	7, 49, 28,
	29, 8, 50,
	51, 30, 9,
	10, 52, 31,
	32, 11, 53,
	54, 33, 12,
	13, 55, 34,
	35, 14, 56,
	57, 36, 15,
	16, 58, 37,
	38, 17, 59,
	60, 39, 18,
	19, 61, 40,
	41, 20, 62,
	63,
}

// ErrBadHash 不是 $6$ SHA-512 crypt 格式
var ErrBadHash = errors.New("auth: 不是 $6$ SHA-512 crypt 格式")

// VerifySha512Crypt 验证明文密码是否匹配 crypt(3) SHA-512 哈希字符串。
// fullHash 形如 "$6$salt$hash..." 或 "$6$rounds=N$salt$hash..."。
// 返回 nil=匹配, ErrBadHash=格式不对, 否则=不匹配。
//
// 验证用固定时间比较防止时序攻击; 计算本身需 ~5000 轮 SHA-512, 单次约几毫秒到几十毫秒,
// 足够让在线爆破不可行(对比 bcrypt 的几毫秒到几十毫秒量级)。
func VerifySha512Crypt(password []byte, fullHash string) error {
	magic, rounds, salt, err := parseSha512StoredHash(fullHash)
	if err != nil {
		return err
	}
	computed := computeSha512Crypt(password, salt, rounds)
	if subtle.ConstantTimeCompare([]byte(computed), []byte(fullHash)) != 1 {
		return errors.New("auth: 密码不匹配")
	}
	_ = magic
	return nil
}

// parseSha512StoredHash 解析 "$6$salt$hash" 或 "$6$rounds=N$salt$hash"。
// 返回 magic / rounds / 纯 salt(已截断到 16 字符)。
func parseSha512StoredHash(h string) (string, int, []byte, error) {
	if !strings.HasPrefix(h, "$6$") {
		return "", 0, nil, ErrBadHash
	}
	rest := strings.TrimPrefix(h, "$6$")
	// 必须至少两段 "$" 才合法(否则没 hash 段): salt$hash 或 rounds=N$salt$hash
	parts := strings.Split(rest, "$")
	if len(parts) < 2 {
		return "", 0, nil, ErrBadHash
	}
	rounds := 5000
	var salt []byte
	switch {
	case strings.HasPrefix(parts[0], "rounds="):
		// $6$rounds=N$salt$hash...
		if len(parts) < 3 {
			return "", 0, nil, ErrBadHash
		}
		n, err := strconv.Atoi(strings.TrimPrefix(parts[0], "rounds="))
		if err != nil {
			return "", 0, nil, ErrBadHash
		}
		if n < 1000 {
			n = 1000 // 验证侧: rounds 必须>=1000, 否则按 1000 算
		}
		if n > 999999999 {
			n = 999999999
		}
		rounds = n
		salt = []byte(parts[1])
	default:
		// $6$salt$hash...
		salt = []byte(parts[0])
	}
	if len(salt) > 16 {
		salt = salt[:16]
	}
	return "$6$", rounds, salt, nil
}

// ComputeSha512CryptDebug 对外暴露 computeSha512Crypt, 仅用于调试与对拍测试
// 生产路径只走 VerifySha512Crypt(单向)
func ComputeSha512CryptDebug(password, salt string, rounds int) string {
	return computeSha512Crypt([]byte(password), []byte(salt), rounds)
}

// HashPassword 把明文密码生成标准 "$6$<salt>$<hash>" 字符串(5000 轮, 16 字符随机盐)。
// 用于: 面板存储自有密码时不再存明文, 只存这个哈希。
func HashPassword(password string) (string, error) {
	salt, err := randomSalt(16)
	if err != nil {
		return "", err
	}
	return computeSha512Crypt([]byte(password), []byte(salt), 5000), nil
}

// randomSalt 生成 [a-zA-Z0-9./] 组成的盐(crypt(3) 允许的字母表), 长度 n。
func randomSalt(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	const alphabet = sha512Alphabet
	out := make([]byte, n)
	for i := range b {
		out[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(out), nil
}

// computeSha512Crypt 按 glibc crypt/sha512-crypt.c + mvo5/sha512crypt-node BSD-2 移植
// 输入: 明文密码, 纯 salt (不含 "$6$" 前缀和 rounds), rounds
// 输出: 完整 "$6$salt$hash" 字符串
// (必须按以上引用标注保留来源, MIT/BSD-2 兼容)
func computeSha512Crypt(password []byte, salt []byte, rounds int) string {
	pw := string(password)
	st := string(salt)

	// Phase 1-12: intermediate digest(也是 phase 21 起始 digest, 同时取首字节给 phase 17 的 repeatDS)
	digest := sha512CryptIntermediate(pw, st)
	repeatDS := 16 + int(digest[0]) // ★ JS 里 _rstr_sha512crypt 拿的是 intermediate[0], 不是 SHA512(pw+salt)[0]

	// Phase 13-16: dp = SHA512(pw 重复 len(pw) 次), p = extend(dp, len(pw))
	var dpInput []byte
	for i := 0; i < len(pw); i++ {
		dpInput = append(dpInput, password...)
	}
	dpHash := sha512.Sum512(dpInput)
	p := extendBytes(dpHash[:], len(pw))

	// Phase 17-20: ds = SHA512(salt 重复 repeatDS 次), s = extend(ds, len(salt))
	var dsInput []byte
	for i := 0; i < repeatDS; i++ {
		dsInput = append(dsInput, salt...)
	}
	dsHash := sha512.Sum512(dsInput)
	s := extendBytes(dsHash[:], len(st))

	// Phase 21: 主循环
	var cInput []byte
	for i := 0; i < rounds; i++ {
		cInput = cInput[:0]

		if i&1 != 0 {
			cInput = append(cInput, p...)
		} else {
			cInput = append(cInput, digest...)
		}
		if i%3 != 0 {
			cInput = append(cInput, s...)
		}
		if i%7 != 0 {
			cInput = append(cInput, p...)
		}
		if i&1 != 0 {
			cInput = append(cInput, digest...)
		} else {
			cInput = append(cInput, p...)
		}
		d := sha512.Sum512(cInput)
		digest = d[:]
	}

	encoded := sha512B64Encode(digest)

	// 还原前缀: rounds 必须是 5000 才是标准 $6$; 否则输出 rounds=N$
	prefix := "$6$"
	if rounds != 5000 {
		prefix = "$6$rounds=" + strconv.Itoa(rounds) + "$"
	}
	return prefix + st + "$" + encoded
}

// sha512CryptIntermediate 步骤 1-12: 计算中间摘要(intermediate, 也是 phase 21 起始的 digest)
//
//   digest_b = SHA512(password + salt + password)
//   digest_b_extended = extend(digest_b, len(password))
//   intermediate_input = password + salt + digest_b_extended
//   for cnt = key_len; cnt > 0; cnt >>= 1:
//       if cnt & 1: append digest_b
//       else:       append password
//   intermediate = SHA512(intermediate_input)
//
// 注: Drepper 论文里还有 digest_a = SHA512(password+salt), 但 mvo5 实现里这一项没在
// 后续使用(变量复用导致阅读时容易混淆), 我们也保持同样的省略。
func sha512CryptIntermediate(password, salt string) []byte {
	pwLen := len(password)

	digestBHash := sha512.Sum512([]byte(password + salt + password))
	digestB := digestBHash[:]

	digestBExtended := extendBytes(digestB, pwLen)

	var input []byte
	input = append(input, password...)
	input = append(input, salt...)
	input = append(input, digestBExtended...)

	for cnt := pwLen; cnt > 0; cnt >>= 1 {
		if cnt&1 != 0 {
			input = append(input, digestB...)
		} else {
			input = append(input, password...)
		}
	}

	result := sha512.Sum512(input)
	return result[:]
}

// extendBytes 把 src 字节按周期重复到指定长度。
// 比如 extendBytes([1,2,3], 7) = [1,2,3,1,2,3,1]
func extendBytes(src []byte, length int) []byte {
	if length <= 0 {
		return []byte{}
	}
	srcLen := len(src)
	if srcLen == 0 {
		return make([]byte, length)
	}
	out := make([]byte, length)
	for i := 0; i < length; i++ {
		out[i] = src[i%srcLen]
	}
	return out
}

// sha512B64Encode 用 crypt(3) 自定义字母表 + sha512Order 重排 64 字节 = 86 字符。
// 每 3 字节 -> 4 字符, 最后一组 1 字节 -> 2 字符(64 % 3 == 1)。
func sha512B64Encode(digest []byte) string {
	var out strings.Builder
	out.Grow(86)
	for i := 0; i < 64; i += 3 {
		if i+3 > 64 { // 最后一组(只剩 1 字节): 1 -> 2 chars
			b := digest[sha512Order[i]]
			out.WriteByte(sha512Alphabet[b&0x3F])
			out.WriteByte(sha512Alphabet[(b&0xC0)>>6])
			break
		}
		b0 := digest[sha512Order[i]]
		b1 := digest[sha512Order[i+1]]
		b2 := digest[sha512Order[i+2]]
		c1 := b0 & 0x3F
		c2 := ((b0 & 0xC0) >> 6) | ((b1 & 0x0F) << 2)
		c3 := ((b1 & 0xF0) >> 4) | ((b2 & 0x03) << 4)
		c4 := (b2 & 0xFC) >> 2
		out.WriteByte(sha512Alphabet[c1])
		out.WriteByte(sha512Alphabet[c2])
		out.WriteByte(sha512Alphabet[c3])
		out.WriteByte(sha512Alphabet[c4])
	}
	return out.String()
}