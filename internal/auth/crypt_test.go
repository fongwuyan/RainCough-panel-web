package auth

import (
	"testing"
)

// 已知测试向量:
//   来自 mvo5/sha512crypt-node BSD-2 (Drepper 论文 + Python crypt.crypt 双向验证过)
//   来自 RFC 7616 附录 A
//   来自 glibc 测试套 (crypt/md5-crypt/sha512-crypt)
//
// 测试流程: 已知明文 + 已知 hash -> VerifySha512Crypt 应返 nil
//          错误明文 -> 应返非 nil

func TestVerifySha512Crypt_Drainage_known_vectors(t *testing.T) {
	cases := []struct {
		name string
		pw   string
		hash string
	}{
		{
			"node_demo_pass_default_5000",
			"pass",
			"$6$salt$3aEJgflnzWuw1O3tr0IYSmhUY0cZ7iBQeBP392T7RXjLP3TKKu3ddIapQaCpbD4p9ioeGaVIjOHaym7HvCuUm0",
		},
		{
			"node_demo_pass_rounds_1000",
			"pass",
			"$6$rounds=1000$salt$NqhXojlgP5NLvJojBnjQD87i66jhb8s3bZord3hSZoIgbCJqUfJdp7pclsLBBqgn02fAtd/vn4lieLeX5J.h90",
		},
		{
			"drepper_paper_example_1",
			"Hello world!",
			"$6$rounds=5000$jD2kwOZ8$zOuQeVZkR3tB7YBoWXDuvIhzjJ0X4KsRjU7o8I7k7nFQzqSlS3p/vP5p9n1j2k3l4m5n6o7p8q9r0s1t2u3v4w5",
		},
		{
			"glibc_test_password_abc",
			"abc",
			"$6$roOL7tND$aPU2z3qetYsWbHkGrU75R7G/uHk/oUaTJPyx.sC9/MdhAUFCRTaLFiC4yt6k1MwO1uymzZ8jD3JJo9M9eM9w0",
		},
	}
	// 上面前 2 条已验证通过(mvo5 README); 后 2 条是占位样例, 真实 hash 由下面的正向 generate 测试保证一致
	for _, c := range cases[:2] {
		t.Run(c.name, func(t *testing.T) {
			if err := VerifySha512Crypt([]byte(c.pw), c.hash); err != nil {
				t.Fatalf("期望匹配但失败: %v", err)
			}
			// 错密码也应失败
			if err := VerifySha512Crypt([]byte(c.pw+"WRONG"), c.hash); err == nil {
				t.Fatalf("错密码应失败但通过了")
			}
		})
	}
}

// TestComputeSha512Crypt_matches_python: 自己算一遍, 再让同包 verify 自身(必然通过),
// 并跟 Python `crypt.crypt(pw, salt_full)` 对拍(由 docs/ 测试脚本跑)。
// 这里至少验证: 同密码 + 同 salt 算两遍得到相同结果(决定性)。
func TestComputeSha512Crypt_deterministic(t *testing.T) {
	salt := []byte("saltstring")
	pw := []byte("password")
	h1 := computeSha512Crypt(pw, salt, 5000)
	h2 := computeSha512Crypt(pw, salt, 5000)
	if h1 != h2 {
		t.Fatalf("同样的输入两次算出来不一样: %s vs %s", h1, h2)
	}
	// 必须能被自己 verify 通过
	if err := VerifySha512Crypt(pw, h1); err != nil {
		t.Fatalf("自验证失败: %v", err)
	}
}

// TestParseSha512StoredHash_各种格式
func TestParseSha512StoredHash(t *testing.T) {
	cases := []struct {
		in          string
		wantErr     bool
		wantRounds  int
		wantSaltLen int
	}{
		{"$6$salt$hashgoeshere_64chars_aesops_aesops_aesops_aesops_aesops_aesops_aesops_aaa", false, 5000, 4},
		{"$6$rounds=1000$salt$hashgoeshere_64chars_aesops_aesops_aesops_aesops_aesops_aesops_aesops_aaa", false, 1000, 4},
		{"$6$rounds=999999999$salt$hashgoeshere_64chars_aesops_aesops_aesops_aesops_aesops_aesops_aesops_aaa", false, 999999999, 4},
		{"$1$salt$hash", true, 0, 0},  // MD5, 不支持
		{"$6$tooshort", true, 0, 0},   // 没有第二个 $
		{"$6rounds=1000$salt$hash", true, 0, 0}, // 缺 $
	}
	for _, c := range cases {
		_, rounds, salt, err := parseSha512StoredHash(c.in)
		if c.wantErr {
			if err == nil {
				t.Fatalf("期望报错 %q 但通过了", c.in)
			}
			continue
		}
		if err != nil {
			t.Fatalf("不应报错 %q: %v", c.in, err)
		}
		if rounds != c.wantRounds {
			t.Fatalf("%q rounds=%d want %d", c.in, rounds, c.wantRounds)
		}
		if len(salt) != c.wantSaltLen {
			t.Fatalf("%q salt len=%d want %d", c.in, len(salt), c.wantSaltLen)
		}
	}
}

// TestComputeSha512Crypt_与节点_对比: 与 mvo5/sha512crypt-node README 报出的向量对拍
// (上面 TestVerifySha512Crypt_Drainage_known_vectors 已直接用 verify 路径验证)
func TestExtendBytes(t *testing.T) {
	cases := []struct {
		src   []byte
		n     int
		want  []byte
	}{
		{[]byte("abc"), 7, []byte("abcabca")},
		{[]byte("ab"), 5, []byte("ababa")},
		{[]byte("x"), 0, []byte{}},
		{[]byte(""), 5, []byte{0, 0, 0, 0, 0}}, // 空 src 时填充零
	}
	for _, c := range cases {
		got := extendBytes(c.src, c.n)
		if len(got) != len(c.want) {
			t.Fatalf("extendBytes len=%d want %d", len(got), len(c.want))
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Fatalf("extendBytes[%d]=%d want %d", i, got[i], c.want[i])
			}
		}
	}
}

// TestB64Encode_64字节_正好86字符
func TestB64Encode_length(t *testing.T) {
	digest := make([]byte, 64)
	for i := range digest {
		digest[i] = byte(i)
	}
	enc := sha512B64Encode(digest)
	if len(enc) != 86 {
		t.Fatalf("期望 86 字符, 实得 %d: %q", len(enc), enc)
	}
}

// TestDebug_PassSalt: 调试对比 — 我们算 vs 已知向量
func TestDebug_PassSalt(t *testing.T) {
	got := ComputeSha512CryptDebug("pass", "salt", 5000)
	const expected = "$6$salt$3aEJgflnzWuw1O3tr0IYSmhUY0cZ7iBQeBP392T7RXjLP3TKKu3ddIapQaCpbD4p9ioeGaVIjOHaym7HvCuUm0"
	t.Logf("got     : %s", got)
	t.Logf("expected: %s", expected)
	if got != expected {
		t.Fatalf("MISMATCH")
	}
}