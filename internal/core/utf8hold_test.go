package core

import (
	"testing"
	"unicode/utf8"
)

// utf8HoldIdx: 保证 SSE 分块永远是"完整 UTF-8 序列", 否则客户端解码出乱码。
// 实测缺陷: 读停在首字节(如只读到 密=E5 AF 86 的 E5)时旧逻辑不挂起 → 乱码。

func TestUtf8HoldIdx(t *testing.T) {
	cases := []struct {
		name string
		in   []byte
		want int // -1 = 完整可直接发出
	}{
		{"空", nil, -1},
		{"纯 ASCII", []byte("root@f:~$ "), -1},
		{"完整中文(密码)", []byte("\xe5\xaf\x86\xe7\xa2\xbc"), -1},
		{"完整中文带全角冒号", []byte("\xe5\xaf\x86\xe7\xa2\xbc\xef\xbc\x9a"), -1},
		{"末尾3字节序缺1(ab+中 E4 B8)", []byte("ab\xe4\xb8"), 2},
		{"末尾只有3字节序的首字节(x+E5)", []byte("x\xe5"), 1},
		{"末尾首字节+1连续(x+E5 AF)", []byte("x\xe5\xaf"), 1},
		{"末尾首字节+2连续(完整密 x+E5 AF 86)", []byte("x\xe5\xaf\x86"), -1},
		{"末尾4字节序缺2(x+F0 9F)", []byte("x\xf0\x9f"), 1},
		{"末尾4字节序缺1(x+F0 9F 98)", []byte("x\xf0\x9f\x98"), 1},
		{"完整4字节序", []byte("x\xf0\x9f\x98\x80"), -1},
		{"孤儿连续字节(上游损坏)不挂起", []byte("x\x86"), -1},
		{"尾部ASCII前面的孤立连续字节不挂起", []byte("abc\x80"), -1},
		{"只有首字节", []byte("\xe5"), 0},
	}
	for _, c := range cases {
		got := utf8HoldIdx(c.in)
		if got != c.want {
			t.Errorf("%s: utf8HoldIdx(% x) = %d, want %d", c.name, c.in, got, c.want)
		}
	}

	// 组合性质: 任意前缀切分下, "发出的块"必须是完整 UTF-8(不产生 U+FFFD/乱码)
	full := []byte("密码:root")
	for cut := 1; cut <= len(full); cut++ {
		part := full[:cut]
		emit := part
		if hold := utf8HoldIdx(part); hold >= 0 {
			emit = part[:hold]
		}
		if len(emit) > 0 && !isCompleteUTF8(emit) {
			t.Errorf("cut=%d 发出块不是完整 UTF-8: % x", cut, emit)
		}
	}
	// 模拟分段消费: 每段挂起的部分喂给下一段, 拼起来必须还原原文
	var pending []byte
	var out []byte
	for _, b := range full {
		data := append(append([]byte{}, pending...), b)
		pending = nil
		if hold := utf8HoldIdx(data); hold >= 0 {
			pending = append([]byte{}, data[hold:]...)
			data = data[:hold]
		}
		out = append(out, data...)
	}
	out = append(out, pending...)
	if string(out) != string(full) {
		t.Errorf("分段拼装结果不符: got % x want % x", out, full)
	}
}

// sanitizeUTF8: pty 的 8KB 缓冲可能把多字节字符从中间截断(大输出 tty 写半截),
// 残首字节+后续 ASCII 让整块变成非法 UTF-8(实测 VM 大中文输出 iconv 报 INVALID)
// → 换成 U+FFFD 占位, 保证每个 SSE 分块都合法。
// 用数值字节字面量(0xE5), 避免字符串转义在编辑链路中被改写。
func TestSanitizeUTF8(t *testing.T) {
	cases := []struct {
		name string
		in   []byte
		want string
	}{
		{"合法中文不变", []byte("密码测试"), "密码测试"},
		{"合法 ASCII 不变", []byte("root@f:~$ "), "root@f:~$ "},
		{"残首字节+ASCII", []byte{0xE5, 'a', '@'}, "\uFFFD" + "a@"},
		{"残首2字节+ASCII", []byte{0xE5, 0xAF, 'b'}, "\uFFFD" + "b"},
		{"合法中间夹残余", []byte{'x', 0xE5, 'y'}, "x" + "\uFFFD" + "y"},
		{"仅残首字节", []byte{0xE5}, "\uFFFD"},
		{"多段残余", []byte{0xE5, 'k', 0xE7, 'm'}, "\uFFFD" + "k" + "\uFFFD" + "m"},
	}
	for _, c := range cases {
		out := sanitizeUTF8(c.in)
		if string(out) != c.want {
			t.Errorf("%s: sanitizeUTF8(% x) = %q, want %q", c.name, c.in, string(out), c.want)
		}
		if !utf8.Valid(out) {
			t.Errorf("%s: 消毒后仍非合法 UTF-8: % x", c.name, out)
		}
	}
	if len(sanitizeUTF8(nil)) != 0 {
		t.Error("空输入应返回空")
	}
}

// 集成: 模拟 readLoop 在"输出被截断"后的下一次读, 消毒后必须合法。
func TestHoldThenSanitizeIntegration(t *testing.T) {
	// 第一次读只到首字节 → 挂起
	first := []byte{0xE5}
	hold := utf8HoldIdx(first)
	if hold != 0 {
		t.Fatalf("首字节应被挂起, got %d", hold)
	}
	pending := append([]byte{}, first[hold:]...)
	// 第二次读: 新数据是 ASCII 提示符(前面的字符永远补不齐)
	second := append(append([]byte{}, pending...), []byte("f@f:~$ ")...)
	pending = nil
	if h := utf8HoldIdx(second); h >= 0 {
		pending = append([]byte{}, second[h:]...)
		second = second[:h]
	}
	got := sanitizeUTF8(second)
	if !utf8.Valid(got) {
		t.Fatalf("消毒后非合法 UTF-8: % x", got)
	}
	if string(got) != "\uFFFD" + "f@f:~$ " {
		t.Fatalf("结果不符: %q", string(got))
	}
}

func isCompleteUTF8(b []byte) bool {
	for i := 0; i < len(b); {
		c := b[i]
		var need int
		switch {
		case c < 0x80:
			need = 1
		case c < 0xC0:
			return false // 连续字节起头 = 不完整/非法
		case c < 0xE0:
			need = 2
		case c < 0xF0:
			need = 3
		case c < 0xF8:
			need = 4
		default:
			return false
		}
		if i+need > len(b) {
			return false
		}
		for k := 1; k < need; k++ {
			if (b[i+k]&0xC0) != 0x80 {
				return false
			}
		}
		i += need
	}
	return true
}
