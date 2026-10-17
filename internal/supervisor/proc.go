package supervisor

import (
	"os/exec"
	"sync"
	"time"
)

// State 单进程生命周期阶段。
type State int

const (
	StateStopped  State = iota // 未启动 / 已收到 stop
	StateStarting              // fork/exec 后, 正在等待握手
	StateRunning               // 已启动且插件已连上(如果 connAlive)或 5s 内未崩
	StateBackoff               // 崩溃后等待下一次重启
	StateCrashed               // 累计崩溃次数达上限, 暂停重启(等用户手动 restart)
)

func (s State) String() string {
	switch s {
	case StateStopped:
		return "stopped"
	case StateStarting:
		return "starting"
	case StateRunning:
		return "running"
	case StateBackoff:
		return "backoff"
	case StateCrashed:
		return "crashed"
	}
	return "unknown"
}

// Proc 单插件进程状态。Supervisor 持有一张 map[string]*Proc。
type Proc struct {
	Name string // 插件名(= 插件目录 basename)

	Dir       string   // 工作目录(插件根)
	Args      []string // 启动命令(对应 manifest.backend.exec)
	Endpoint  string   // 子进程连 UDS/TCP 的端点(.rc.endpoint 里写的)
	LogPath   string   // stdout/stderr 文件路径
	Autostart bool     // panel 启动时是否自动起(写盘)

	mu          sync.Mutex
	state       State
	cmd         *exec.Cmd
	pid         int
	startedAt   time.Time
	lastExit    int // 上一次退出码
	crashCount  int // 累计连续崩溃次数(手动 restart 清零)
	backoffIdx  int // 当前 backoff 步 0..n
	connSeen    bool // 已观察到至少一次 UDS 握手
	connSeenAt  time.Time
	stopReason  string // 主动 stop 时填, 区别于"进程自己崩了"
	bootRunning bool   // 等待 cmd.Wait 退出的 goroutine 是否仍在

	stopOnce sync.Once     // stopLocked 的 close(stopCh) 只能发生一次
	stopCh   chan struct{} // 取消未运行的 backoff 计时
}

// Snapshot 视图层用的不可变快照。锁内填, 锁外返。
type Snapshot struct {
	Name        string `json:"name"`
	State       string `json:"state"`        // stopped/starting/running/backoff/crashed
	Pid         int    `json:"pid"`          // 0 表示无
	CrashCount  int    `json:"crash_count"`  // 累计连续崩
	LastExit    int    `json:"last_exit"`    // 上次退出码
	StartedAt   int64  `json:"started_at"`   // 最近一次拉起的 unix 时间
	UpSec       int64  `json:"up_sec"`       // 当前 running 累计秒(若不是 running=0)
	ConnSeen    bool   `json:"conn_seen"`    // 是否至少握手过一次
	ConnSeenAt  int64  `json:"conn_seen_at"` // 最近一次握手 unix
	Autostart   bool   `json:"autostart"`
	StopReason  string `json:"stop_reason,omitempty"`
}

// snapshot 锁内构造。
func (p *Proc) snapshot() Snapshot {
	p.mu.Lock()
	defer p.mu.Unlock()
	up := int64(0)
	if p.state == StateRunning && !p.startedAt.IsZero() {
		up = int64(time.Since(p.startedAt).Seconds())
	}
	cs := int64(0)
	if p.connSeen {
		cs = p.connSeenAt.Unix()
	}
	return Snapshot{
		Name: p.Name, State: p.state.String(),
		Pid: p.pid, CrashCount: p.crashCount, LastExit: p.lastExit,
		StartedAt: timeOrZero(p.startedAt), UpSec: up,
		ConnSeen: p.connSeen, ConnSeenAt: cs,
		Autostart: p.Autostart, StopReason: p.stopReason,
	}
}

func timeOrZero(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.Unix()
}
