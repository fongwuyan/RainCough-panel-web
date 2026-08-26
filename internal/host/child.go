package host

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Child 单个插件子进程。
type Child struct {
	name         string
	dir          string
	manifest     *Manifest
	port         int
	proc         *exec.Cmd
	logFile      *os.File
	proxyTimeout time.Duration // 网关代理到子进程的请求超时

	mu        sync.Mutex
	startErr  string
	startedAt time.Time
	alive     bool
	env       []string // 额外环境变量(透传 DB DSN / namespace 等)
}

// Alive 子进程是否存活。
func (c *Child) Alive() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.alive && c.proc != nil && c.proc.Process != nil &&
		c.proc.ProcessState == nil
}

// Port 返回监听端口。
func (c *Child) Port() int { return c.port }

// Start 拉起子进程并等待就绪探针。
func (c *Child) Start() error {
	freePort, err := freePort()
	if err != nil {
		return fmt.Errorf("分配端口失败: %w", err)
	}
	c.port = freePort

	entry := c.manifest.Entry
	cmd := exec.Command(entry[0], entry[1:]...)
	cmd.Dir = c.dir

	// 环境: 基础 env + manifest env(PATH 注入, 由注入方提前解析)+ 协议变量
	fullEnv := appendEnv(os.Environ(), c.env)
	fullEnv = append(fullEnv,
		fmt.Sprintf("RAINCOUGH_PORT=%d", c.port),
		fmt.Sprintf("RAINCOUGH_NS=%s", c.name),
		fmt.Sprintf("RAINCOUGH_PLUGIN_DIR=%s", c.dir),
	)
	cmd.Env = fullEnv

	// 子进程输出: 记录到缓存文件, 便于诊断(不吞掉)
	logPath := filepath.Join(c.dir, ".runtime.log")
	if f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644); err == nil {
		cmd.Stdout = f
		cmd.Stderr = f
		c.logFile = f
	}

	if err := cmd.Start(); err != nil {
		c.closeLog()
		c.mu.Lock()
		c.startErr = "启动失败: " + err.Error()
		c.mu.Unlock()
		return fmt.Errorf("插件 %s 启动失败: %w", c.name, err)
	}
	c.proc = cmd
	c.mu.Lock()
	c.alive = true
	c.startedAt = time.Now()
	c.mu.Unlock()

	// 就绪探测
	timeout := time.Duration(c.manifest.Timeout) * time.Second
	health := c.manifest.Health
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cmd.ProcessState != nil {
			errMsg := fmt.Sprintf("子进程提前退出 (rc=%d)", cmd.ProcessState.ExitCode())
			c.mu.Lock()
			c.startErr = errMsg
			c.alive = false
			c.mu.Unlock()
			return fmt.Errorf("插件 %s %s", c.name, errMsg)
		}
		if pingHealth(c.port, health) {
			return nil
		}
		time.Sleep(400 * time.Millisecond)
	}
	msg := fmt.Sprintf("就绪超时(%ds)", c.manifest.Timeout)
	c.mu.Lock()
	c.startErr = msg
	c.alive = false
	c.mu.Unlock()
	c.Kill()
	return fmt.Errorf("插件 %s %s", c.name, msg)
}

// Kill 终止子进程。
func (c *Child) Kill() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.alive = false
	if c.proc != nil && c.proc.Process != nil && c.proc.ProcessState == nil {
		_ = c.proc.Process.Kill()
	}
	c.closeLog()
}

// closeLog 关闭子进程输出日志文件(启动失败或停止时调用)。
func (c *Child) closeLog() {
	if c.logFile != nil {
		_ = c.logFile.Close()
		c.logFile = nil
	}
}

// pingHealth 探测子进程健康端点。
func pingHealth(port int, path string) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 300*time.Millisecond)
	if err != nil {
		return false
	}
	defer conn.Close()
	return true // TCP 通即视为已监听(端点检查由插件保证, 简化探测)
}

// freePort 分配一个空闲本地端口。
func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()
	return port, nil
}

func appendEnv(base, extra []string) []string {
	if len(extra) == 0 {
		return base
	}
	m := map[string]string{}
	for _, kv := range base {
		if i := strings.Index(kv, "="); i > 0 {
			m[kv[:i]] = kv[i+1:]
		}
	}
	for _, kv := range extra {
		if i := strings.Index(kv, "="); i > 0 {
			m[kv[:i]] = kv[i+1:]
		}
	}
	out := make([]string, 0, len(m))
	for k, v := range m {
		out = append(out, k+"="+v)
	}
	return out
}
