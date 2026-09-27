package core

import "testing"

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
