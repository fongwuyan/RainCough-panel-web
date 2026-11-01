package pluginrt

import (
	"net"
	"strconv"
	"strings"
	"testing"
)

func TestPidFromSSLine(t *testing.T) {
	cases := []struct {
		line string
		want int
	}{
		// ↓ 以下两行是从生产机 ss -ltnp 原样抓的, 不要"美化"
		{`LISTEN 0      128        127.0.0.1:6710       0.0.0.0:*    users:(("python",pid=1142697,fd=8))`, 1142697},
		{`LISTEN 0      511          0.0.0.0:6099       0.0.0.0:*    users:(("qq",pid=1144261,fd=66))`, 1144261},
		{`LISTEN 0      511        127.0.0.1:6700       0.0.0.0:*    users:(("qq",pid=1144261,fd=242))`, 1144261},
		{`LISTEN 0 511 0.0.0.0:6099 0.0.0.0:*`, 0}, // 非 root: 没有 users 段
		{``, 0},
	}
	for _, c := range cases {
		if got := pidFromSSLine(c.line); got != c.want {
			t.Errorf("line=%q 期望 %d, 得到 %d", c.line, c.want, got)
		}
	}
}

// ss 的本地地址在第 4 列(fields[3]), 且必须整段后缀匹配 ——
// 用 grep 端口号会误命中对端端口(127.0.0.1:6710 的 peer 也可能是 6710)。
func TestSSLineLocalField(t *testing.T) {
	line := `LISTEN 0      128        127.0.0.1:6710       0.0.0.0:*    users:(("python",pid=1142697,fd=8))`
	fields := strings.Fields(line)
	if len(fields) < 4 {
		t.Fatalf("字段数不足: %v", fields)
	}
	if fields[3] != "127.0.0.1:6710" {
		t.Fatalf("本地地址不在 fields[3], 实际: %q", fields[3])
	}
	if !strings.HasSuffix(fields[3], ":6710") {
		t.Error("端口后缀匹配失败")
	}
	// 端口 16710 不能被 :6710 命中
	if strings.HasSuffix("127.0.0.1:16710", ":6710") {
		t.Error(":6710 误匹配了 16710")
	}
}

// 这是整套端口检查的核心: 自己占的不能算冲突, 否则每次升级都误报。
func TestOwnerMatches(t *testing.T) {
	unitMain := func(unit string) int {
		if unit == "rcbot.service" {
			return 4242
		}
		return 0
	}
	cases := []struct {
		name      string
		owner     *Owner
		holderPID int
		selfPID   int
		want      bool
	}{
		{"无 owner 一律不算自己", nil, 4242, 777, false},
		{"unit 的 MainPID 命中", &Owner{Unit: "rcbot.service"}, 4242, 0, true},
		{"unit 的 MainPID 不命中", &Owner{Unit: "rcbot.service"}, 9999, 0, false},
		{"self 命中", &Owner{Plugin: "self"}, 777, 777, true},
		{"self 不命中", &Owner{Plugin: "self"}, 888, 777, false},
		{"self 但进程未运行", &Owner{Plugin: "self"}, 777, 0, false},
		{"holder 未知时不能判成自己", &Owner{Plugin: "self"}, 0, 0, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ownerMatches(c.owner, c.holderPID, unitMain, c.selfPID); got != c.want {
				t.Errorf("期望 %v, 得到 %v", c.want, got)
			}
		})
	}
}

func TestProbePort_FreeAndOccupied(t *testing.T) {
	// 先占一个端口
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("无法监听随机端口: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port

	if p := probePort("127.0.0.1", port); p.Free {
		t.Errorf("端口 %d 正被监听, 不该判空闲", port)
	}

	_ = ln.Close()

	// 关掉后应恢复空闲(监听 socket 关闭即可重新绑定)
	if p := probePort("127.0.0.1", port); !p.Free {
		t.Errorf("关闭监听后端口 %d 应可绑定", port)
	}
}

// 占用但查不出占用者(非 root / 无 ss)时必须降级而不是判缺失,
// 因为有可能就是自己。
func TestCheckPort_UnknownHolderDegrades(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("无法监听: %v", err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port

	it := (&EnvRunner{Dir: t.TempDir()}).checkPort(CheckDef{
		ID: "p", Type: CheckTypePort, Port: port, Bind: "127.0.0.1",
	})
	if it.Status == StatusOK {
		t.Fatal("端口被自己占着且没有 owner 声明, 不能判 ok")
	}
	if it.Kind != "port" {
		t.Errorf("kind 应为 port, 得到 %q", it.Kind)
	}
	if it.Detail == "" {
		t.Error("detail 应说明端口状态")
	}
}

func TestCheckPort_FreeIsOK(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("无法监听: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()

	it := (&EnvRunner{Dir: t.TempDir()}).checkPort(CheckDef{
		ID: "p", Type: CheckTypePort, Port: port, Bind: "127.0.0.1",
	})
	if it.Status != StatusOK {
		t.Errorf("空闲端口应为 ok, 得到 %s (%s)", it.Status, it.Detail)
	}
}

func TestTailRunes(t *testing.T) {
	if got := tailRunes("abcdef", 3); got != "…def" {
		t.Errorf("期望 …def, 得到 %q", got)
	}
	if got := tailRunes("ab", 5); got != "ab" {
		t.Errorf("不超长时应原样返回, 得到 %q", got)
	}
	if got := tailRunes("abc", 0); got != "" {
		t.Errorf("n=0 应返回空串, 得到 %q", got)
	}
	// 中文按字符切, 不能切出半个字节
	r := "中文测试"
	if got := tailRunes(r, 2); got != "…测试" {
		t.Errorf("按 rune 截断失败, 得到 %q", got)
	}
}

func TestIsRoot_NoPanic(t *testing.T) {
	// 只是确保这个跨平台函数能被调用(Windows 分支恒 false)
	_ = IsRoot()
	_ = strconv.Itoa(0)
}
