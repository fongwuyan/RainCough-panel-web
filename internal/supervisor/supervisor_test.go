package supervisor

import (
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// makeFakePlugin 把一个 sh 脚本写到 <dir>/<name>/run.sh, 再写 plugin.json v4。
// 脚本行为:
//   - 默认: 接受 SIGTERM 后退出 0, 同时 echo fake-start pid=$BASHPID env=<FAKE_TAG>
//   - FAKE_TAG=crash: 立刻 exit 1
//   - FAKE_TAG=connect: 连一次 pluginx 端点(TCP)再退出 0
func makeFakePlugin(t *testing.T, baseDir, name, tag string) string {
	t.Helper()
	dir := filepath.Join(baseDir, name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	shPath := filepath.Join(dir, "run.sh")
	var script string
	switch tag {
	case "crash":
		script = "#!/bin/sh\necho fake-plugin-crash $*\nexit 1\n"
	case "connect":
		script = "#!/bin/sh\nEP=${RC_ENDPOINT#tcp:}\n[ -n \"$EP\" ] && (exec 3<>\"$EP\" && echo HELLO >&3 2>/dev/null)\necho fake-plugin-started $*\ntrap 'exit 0' TERM\nwhile :; do sleep 10; done\n"
	case "long":
		script = "#!/bin/sh\necho fake-plugin-long $*\ntrap 'exit 0' TERM\nwhile :; do sleep 10; done\n"
	default:
		script = "#!/bin/sh\necho fake-plugin $*\ntrap 'exit 0' TERM\nwhile :; do sleep 10; done\n"
	}
	if runtime.GOOS == "windows" {
		// sh 不一定可用, 用内置 busybox 不存在, 退到 cmd /c
		script = "fake-plugin " + tag + "\r\n" + script
	}
	if err := os.WriteFile(shPath, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	mf := struct {
		Name     string `json:"name"`
		Frontend struct {
			Entry string `json:"entry"`
		} `json:"frontend"`
		Backend struct {
			Lang string   `json:"lang,omitempty"`
			Exec []string `json:"exec"`
		} `json:"backend"`
	}{}
	mf.Name = name
	mf.Frontend.Entry = "ui/index.html"
	mf.Backend.Lang = "sh"
	mf.Backend.Exec = []string{"/bin/sh", "./run.sh"}
	if runtime.GOOS == "windows" {
		mf.Backend.Exec = []string{"cmd", "/c", ".\\run.sh"}
	}
	mfBytes, _ := json.Marshal(mf)
	if err := os.WriteFile(filepath.Join(dir, "plugin.json"), mfBytes, 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

// startTCPListener 给"连一次端点"测试用: 在 127.0.0.1 随机端口 accept 一下。
func startTCPListener(t *testing.T) (addr string, stop func()) {
	t.Helper()
	if runtime.GOOS == "windows" {
		// 跳过 connect 测试
		return "", func() {}
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				buf := make([]byte, 256)
				c.SetReadDeadline(time.Now().Add(2 * time.Second))
				c.Read(buf)
				c.Close()
			}(c)
		}
	}()
	return ln.Addr().String(), func() { ln.Close() }
}

// waitForState 等待 plugin 进入目标 state 或 timeout。
func waitForState(t *testing.T, s *Supervisor, name string, target string, timeout time.Duration) Snapshot {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		snap, _ := s.View(name)
		if snap.State == target {
			return snap
		}
		time.Sleep(50 * time.Millisecond)
	}
	snap, _ := s.View(name)
	t.Fatalf("%s 期望 state=%s, 实际=%s (last_exit=%d crash=%d)", name, target, snap.State, snap.LastExit, snap.CrashCount)
	return snap
}

// ---- 测试用例 ----

func TestStartHappyPath(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix-only: sh")
	}
	tmp := t.TempDir()
	makeFakePlugin(t, tmp, "longpi", "long")
	sup := New(Options{PluginsDir: tmp, LogDir: filepath.Join(tmp, "logs"), BackoffBase: 50 * time.Millisecond, BackoffMax: 200 * time.Millisecond, StartGrace: 100 * time.Millisecond}, nil)
	if err := sup.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(sup.Shutdown)
	if err := sup.StartPlugin("longpi"); err != nil {
		t.Fatalf("StartPlugin: %v", err)
	}
	waitForState(t, sup, "longpi", StateRunning.String(), 3*time.Second)
}

func TestAutoRestartAfterCrash(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix-only: sh")
	}
	tmp := t.TempDir()
	makeFakePlugin(t, tmp, "crashpi", "crash")
	sup := New(Options{PluginsDir: tmp, LogDir: filepath.Join(tmp, "logs"), RestartMax: 3, BackoffBase: 50 * time.Millisecond, BackoffMax: 150 * time.Millisecond, StartGrace: 50 * time.Millisecond}, nil)
	if err := sup.Start(); err != nil {
		t.Fatalf("Start: %v", err)
	}
	t.Cleanup(sup.Shutdown)
	if err := sup.StartPlugin("crashpi"); err != nil {
		t.Fatal(err)
	}
	waitForState(t, sup, "crashpi", StateCrashed.String(), 5*time.Second)
	snap, _ := sup.View("crashpi")
	if snap.CrashCount < 3 {
		t.Fatalf("期望 crashCount≥3, 实际 %d", snap.CrashCount)
	}
}

func TestRestartPluginManual(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix-only: sh")
	}
	tmp := t.TempDir()
	makeFakePlugin(t, tmp, "repi", "long")
	sup := New(Options{PluginsDir: tmp, LogDir: filepath.Join(tmp, "logs"), BackoffBase: 100 * time.Millisecond, BackoffMax: 300 * time.Millisecond, StartGrace: 100 * time.Millisecond}, nil)
	if err := sup.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(sup.Shutdown)
	if err := sup.StartPlugin("repi"); err != nil {
		t.Fatal(err)
	}
	waitForState(t, sup, "repi", StateRunning.String(), 3*time.Second)

	if err := sup.RestartPlugin("repi"); err != nil {
		t.Fatalf("RestartPlugin: %v", err)
	}
	waitForState(t, sup, "repi", StateRunning.String(), 3*time.Second)
}

func TestStopPlugin(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix-only: sh")
	}
	tmp := t.TempDir()
	makeFakePlugin(t, tmp, "stppi", "long")
	sup := New(Options{PluginsDir: tmp, LogDir: filepath.Join(tmp, "logs"), BackoffBase: 50 * time.Millisecond, BackoffMax: 200 * time.Millisecond, StartGrace: 100 * time.Millisecond}, nil)
	if err := sup.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(sup.Shutdown)
	if err := sup.StartPlugin("stppi"); err != nil {
		t.Fatal(err)
	}
	waitForState(t, sup, "stppi", StateRunning.String(), 3*time.Second)
	if err := sup.StopPlugin("stppi"); err != nil {
		t.Fatal(err)
	}
	waitForState(t, sup, "stppi", StateStopped.String(), 2*time.Second)
}

func TestConnSeenFlipsToRunning(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix-only: sh")
	}
	tmp := t.TempDir()
	makeFakePlugin(t, tmp, "cpi", "connect")
	addr, stop := startTCPListener(t)
	defer stop()
	sup := New(Options{PluginsDir: tmp, LogDir: filepath.Join(tmp, "logs"), BackoffBase: 200 * time.Millisecond, BackoffMax: 500 * time.Millisecond, StartGrace: 100 * time.Millisecond}, nil)
	if err := sup.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(sup.Shutdown)
	if err := sup.StartPlugin("cpi"); err != nil {
		t.Fatal(err)
	}
	// 模拟 pluginx accept 后通知 supervisor
	sup.ConnSeen("cpi")
	snap, _ := sup.View("cpi")
	if !snap.ConnSeen {
		t.Fatal("ConnSeen 应置 true")
	}
	if snap.State != StateRunning.String() {
		t.Fatalf("期望 Running, 实际 %s", snap.State)
	}
	_ = strings.TrimSpace(addr) // 抑制未用
}

// ---- 跨平台纯逻辑(无需 fork)----

func TestListEmptyOnUnknown(t *testing.T) {
	sup := New(Options{}, nil)
	if sup.List() != nil && len(sup.List()) != 0 {
		t.Fatalf("空 supervisor List 应为空, got %v", sup.List())
	}
}

func TestStartPluginUnknown(t *testing.T) {
	sup := New(Options{}, nil)
	err := sup.StartPlugin("ghost")
	if err == nil || !strings.Contains(err.Error(), "未注册") {
		t.Fatalf("期望未注册错误, 实际 %v", err)
	}
}

func TestSpawnWithoutExec(t *testing.T) {
	sup := New(Options{}, nil)
	p := &Proc{Name: "noexec", Dir: t.TempDir()}
	err := sup.spawn(p, "test")
	if err == nil || !strings.Contains(err.Error(), "无 backend.exec") {
		t.Fatalf("期望「无 backend.exec」错, 实际 %v", err)
	}
}

func TestPersistAutostartInMemory(t *testing.T) {
	tmp := t.TempDir()
	sup := New(Options{PluginsDir: tmp, LogDir: tmp}, nil) // sd=nil -> 内存模式
	makeFakePlugin(t, tmp, "alpha", "long")
	if err := sup.Start(); err != nil {
		t.Fatal(err)
	}
	// 即使没起进程, 也可以切 autostart(无 process 崩 + 写盘 noop)
	if err := sup.SetAutostart("alpha", true); err != nil {
		t.Fatalf("SetAutostart: %v", err)
	}
	sup.Shutdown()
}

func TestSnapshotFieldsRoundTrip(t *testing.T) {
	p := &Proc{Name: "x", state: StateRunning, pid: 999, crashCount: 1, Autostart: true, stopCh: make(chan struct{})}
	now := time.Now()
	p.startedAt = now
	p.snapshot() // 触发字段访问, 防编译报错
	if p.snapshot().Name != "x" {
		t.Fatal("snapshot name")
	}
}
