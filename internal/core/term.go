package core

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
)

// ---- 终端(与旧面板 terminal.py 契约兼容) ----

// TermSession pty 终端会话。
type TermSession struct {
	ID       string
	Rows     int
	Cols     int
	Created  time.Time
	LastSeen time.Time

	ptmx     *os.File
	cmd      *exec.Cmd
	mu       sync.Mutex
	closed   bool
	closedAt time.Time

	// 输出缓冲(base64 块), SSE 分块推送
	buf  []string
	cond *sync.Cond
}

// TermManager 终端会话管理器。
type TermManager struct {
	mu       sync.Mutex
	sessions map[string]*TermSession
	seq      int
}

// NewTermManager 创建终端管理器。
func NewTermManager() *TermManager {
	return &TermManager{sessions: map[string]*TermSession{}}
}

// Open 创建新会话(pty 运行登录 shell)。
func (m *TermManager) Open(rows, cols int) (*TermSession, error) {
	if rows <= 0 {
		rows = 24
	}
	if cols <= 0 {
		cols = 80
	}
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, fmt.Errorf("pty 启动失败: %w", err)
	}
	if err := pty.Setsize(ptmx, &pty.Winsize{Rows: uint16(rows), Cols: uint16(cols)}); err != nil {
		// 尺寸设置失败不致命
	}

	m.mu.Lock()
	m.seq++
	sid := fmt.Sprintf("t%d", m.seq)
	s := &TermSession{
		ID: sid, Rows: rows, Cols: cols,
		Created: time.Now(), LastSeen: time.Now(),
		ptmx: ptmx, cmd: cmd,
		cond: sync.NewCond(&sync.Mutex{}),
	}
	m.sessions[sid] = s
	m.mu.Unlock()

	// 读循环: pty 输出 -> 增量 UTF-8 解码 -> 缓冲 + 广播
	go s.readLoop()

	// 退出回收
	go func() {
		_ = cmd.Wait()
		m.mu.Lock()
		if cur := m.sessions[sid]; cur == s {
			delete(m.sessions, sid)
		}
		m.mu.Unlock()
		s.markClosed()
	}()
	return s, nil
}

// Get 获取会话。
func (m *TermManager) Get(sid string) (*TermSession, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[sid]
	if ok {
		s.LastSeen = time.Now()
	}
	return s, ok
}

// Close 关闭会话。
func (m *TermManager) Close(sid string) {
	m.mu.Lock()
	s, ok := m.sessions[sid]
	if ok {
		delete(m.sessions, sid)
	}
	m.mu.Unlock()
	if ok {
		s.Close()
	}
}

// List 会话列表。
func (m *TermManager) List() []map[string]interface{} {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []map[string]interface{}{}
	for _, s := range m.sessions {
		age := time.Since(s.Created).Seconds()
		idle := time.Since(s.LastSeen).Seconds()
		out = append(out, map[string]interface{}{
			"sid": s.ID, "user": os.Getenv("USER"), "host": hostname(),
			"age": int(age), "idle": int(idle),
		})
	}
	return out
}

// Cleanup 清理闲置会话(超过 maxIdleMin 分钟)。
func (m *TermManager) Cleanup(maxIdleMin int) int {
	if maxIdleMin <= 0 {
		maxIdleMin = 60
	}
	m.mu.Lock()
	var stale []string
	for _, s := range m.sessions {
		if time.Since(s.LastSeen) > time.Duration(maxIdleMin)*time.Minute {
			stale = append(stale, s.ID)
		}
	}
	m.mu.Unlock()
	for _, id := range stale {
		m.Close(id)
	}
	return len(stale)
}

// ---- 会话方法 ----

// Write 写入输入到 pty。
func (s *TermSession) Write(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return fmt.Errorf("会话已关闭")
	}
	_, err := s.ptmx.Write(data)
	return err
}

// Resize 调整终端尺寸。
func (s *TermSession) Resize(rows, cols int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return fmt.Errorf("会话已关闭")
	}
	s.Rows, s.Cols = rows, cols
	return pty.Setsize(s.ptmx, &pty.Winsize{Rows: uint16(rows), Cols: uint16(cols)})
}

// Close 关闭会话。
func (s *TermSession) Close() {
	s.markClosed()
	if s.ptmx != nil {
		_ = s.ptmx.Close()
	}
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
}

// Closed 会话是否已关闭。
func (s *TermSession) Closed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.closed
}

func (s *TermSession) markClosed() {
	s.mu.Lock()
	s.closed = true
	s.closedAt = time.Now()
	s.mu.Unlock()
	// 唤醒可能的 SSE 等待者
	s.cond.L.Lock()
	s.cond.Broadcast()
	s.cond.L.Unlock()
}

// readLoop 读 pty 输出, 增量 UTF-8 解码入缓冲。
func (s *TermSession) readLoop() {
	raw := make([]byte, 8192)
	var pending []byte // 未完成的 UTF-8 尾部
	for {
		s.mu.Lock()
		if s.closed {
			s.mu.Unlock()
			return
		}
		s.mu.Unlock()
		n, err := s.ptmx.Read(raw)
		if n > 0 {
			data := append(pending, raw[:n]...)
			// 保留可能的 UTF-8 尾部(最多 3 字节)
			cut := len(data)
			for cut > 0 && data[cut-1] >= 0x80 && data[cut-1] < 0xC0 {
				cut--
			}
			if cut < len(data) && len(data)-cut <= 3 {
				// 尾部可能是未完成的多字节: 完整部分入队
				pending = append(pending[:0], data[cut:]...)
				data = data[:cut]
			} else {
				pending = pending[:0]
			}
			if len(data) > 0 {
				s.appendOutput(data)
			}
		}
		if err != nil {
			s.markClosed()
			return
		}
		if n == 0 {
			time.Sleep(10 * time.Millisecond)
		}
	}
}

// appendOutput 追加输出到缓冲并广播。
func (s *TermSession) appendOutput(data []byte) {
	chunk := base64.StdEncoding.EncodeToString(data)
	// 简化: 直接累加 buf(前端合并)
	s.cond.L.Lock()
	s.buf = append(s.buf, chunk)
	if len(s.buf) > 10000 {
		s.buf = s.buf[len(s.buf)-10000:]
	}
	s.cond.Broadcast()
	s.cond.L.Unlock()
}

// DrainAll 返回自 fromSeq 以来的全部输出(base64 列表), 并传回最新序号。
// 为空且未关闭时调用方应等待。
func (s *TermSession) DrainAll() ([]string, int, bool) {
	s.cond.L.Lock()
	defer s.cond.L.Unlock()
	out := make([]string, len(s.buf))
	copy(out, s.buf)
	s.buf = s.buf[:0]
	return out, len(out), s.Closed()
}

// WaitOutput 阻塞等待新输出或关闭(超时后返回 false)。
func (s *TermSession) WaitOutput(timeout time.Duration) bool {
	s.cond.L.Lock()
	defer s.cond.L.Unlock()
	if len(s.buf) > 0 || s.Closed() {
		return true
	}
	done := make(chan struct{})
	go func() {
		s.cond.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(timeout):
	}
	return len(s.buf) > 0 || s.Closed()
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return ""
	}
	return h
}

var _ = strings.TrimSpace
