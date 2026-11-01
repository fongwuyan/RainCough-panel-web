package pluginrt

// 端口检查 —— 判断"这个端口能不能用"以及"占着它的是不是自己"。
//
// 为什么不交给插件作者写 shell:
//   · ss 的输出要按"本地地址以 :端口 结尾"匹配, 直接 grep 端口号会误命中对端端口
//   · 只有 root 才看得到别人进程的 pid= 字段(非 root 下 ss -p 只显示自己的进程)
//   · 最要命的是"自己占的不能算冲突": 升级插件时老进程还在监听, 按裸探测必然误报
//
// 判定顺序对齐 install.sh:68-88 的 port_holder_is_us():
//   先比 systemd 单元的 MainPID, 再比本插件进程 PID, 都对不上才是真冲突。

import (
	"context"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const portProbeTimeout = 3 * time.Second

// PortProbe 端口探测结果。
type PortProbe struct {
	// Free 端口可绑定
	Free bool
	// HolderPID 占用者 PID; 0 表示没查出来(非 root / 缺 ss / 非 Linux)
	HolderPID int
	// HolderName 占用者进程名, 尽量填
	HolderName string
	// Queryable 是否有能力查占用者(缺 ss 等为 false)
	Queryable bool
}

// probePort 先试绑定, 失败再找占用者。
func probePort(bind string, port int) PortProbe {
	addr := net.JoinHostPort(bind, strconv.Itoa(port))
	ln, err := net.Listen("tcp", addr)
	if err == nil {
		_ = ln.Close()
		return PortProbe{Free: true, Queryable: true}
	}

	// 绑定失败 → 多半是 EADDRINUSE; 找占用者
	pid, q := ssHolderPID(port)
	p := PortProbe{Free: false, HolderPID: pid, Queryable: q}
	if pid > 0 {
		p.HolderName = procName(pid)
	}
	return p
}

// ssHolderPID 用 ss -ltnp 找监听该端口的进程。
func ssHolderPID(port int) (int, bool) {
	if runtime.GOOS != "linux" {
		return 0, false
	}
	if _, err := exec.LookPath("ss"); err != nil {
		return 0, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), portProbeTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "ss", "-ltnp").Output()
	if err != nil {
		return 0, false
	}
	want := ":" + strconv.Itoa(port)
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		// ss 列: State Recv-Q Send-Q Local:Port Peer:Port [Process]
		if len(fields) < 4 {
			continue
		}
		if !strings.HasSuffix(fields[3], want) {
			continue
		}
		if pid := pidFromSSLine(line); pid > 0 {
			return pid, true
		}
		// 端口对上了但拿不到 pid —— 非 root 的典型表现
		return 0, false
	}
	return 0, false
}

// pidFromSSLine 从 users:(("python",pid=1234,fd=8)) 里取 pid。
func pidFromSSLine(line string) int {
	const marker = "pid="
	i := strings.Index(line, marker)
	if i < 0 {
		return 0
	}
	rest := line[i+len(marker):]
	end := 0
	for end < len(rest) && rest[end] >= '0' && rest[end] <= '9' {
		end++
	}
	if end == 0 {
		return 0
	}
	n, err := strconv.Atoi(rest[:end])
	if err != nil {
		return 0
	}
	return n
}

// procName 读 /proc/<pid>/comm, 失败返回空串(不报错 —— 只是展示用)。
func procName(pid int) string {
	if pid <= 0 || runtime.GOOS != "linux" {
		return ""
	}
	b, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "comm"))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// unitMainPID 取 systemd 单元的 MainPID, 取不到返回 0。
func unitMainPID(unit string) int {
	unit = strings.TrimSpace(unit)
	if unit == "" || runtime.GOOS != "linux" {
		return 0
	}
	if _, err := exec.LookPath("systemctl"); err != nil {
		return 0
	}
	ctx, cancel := context.WithTimeout(context.Background(), portProbeTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, "systemctl", "show", "-p", "MainPID", "--value", unit).Output()
	if err != nil {
		return 0
	}
	n, err := strconv.Atoi(strings.TrimSpace(string(out)))
	if err != nil || n <= 0 {
		return 0
	}
	return n
}

// ownerMatches 占用者是否属于声明方。
//
// 独立成纯函数是为了可测: 不碰进程, 只做比对。
func ownerMatches(owner *Owner, holderPID int, unitMain func(string) int, selfPID int) bool {
	if owner == nil || holderPID <= 0 {
		return false
	}
	if owner.Unit != "" && unitMain != nil {
		if main := unitMain(owner.Unit); main > 0 && main == holderPID {
			return true
		}
	}
	if owner.Plugin == "self" && selfPID > 0 && selfPID == holderPID {
		return true
	}
	return false
}
