//go:build linux

// Package pty 纯标准库的伪终端实现(替代 github.com/creack/pty)。
//
// 流程: open("/dev/ptmx") → ioctl(TIOCSPTLCK, 0) 解锁 → ioctl(TIOCGPTN) 取从端号
// → 子进程 setsid + TIOCSCTTY 取得控制终端 → dup2 到 0/1/2 → exec。
package pty

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"syscall"
	"unsafe"
)

const (
	tiocgptn   = 0x80045430 // 取从端编号
	tiocsptlck = 0x40045431 // 解锁从端
	tiocswinsz = 0x5414     // 设置窗口大小
)

// Winsize 终端窗口尺寸(与 creack/pty 同形, 便于替换)。
type Winsize struct {
	Rows uint16
	Cols uint16
	X    uint16
	Y    uint16
}

// Open 打开一对伪终端的主端, 返回主端文件与从端路径。
func Open() (*os.File, string, error) {
	fd, err := syscall.Open("/dev/ptmx", syscall.O_RDWR|syscall.O_NOCTTY|syscall.O_CLOEXEC, 0)
	if err != nil {
		return nil, "", fmt.Errorf("打开 /dev/ptmx 失败: %w", err)
	}
	var unlock int32
	if _, _, e := syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd), tiocsptlck, uintptr(unsafe.Pointer(&unlock))); e != 0 {
		syscall.Close(fd)
		return nil, "", fmt.Errorf("解锁从端失败: %w", e)
	}
	var n uint32
	if _, _, e := syscall.Syscall(syscall.SYS_IOCTL, uintptr(fd), tiocgptn, uintptr(unsafe.Pointer(&n))); e != 0 {
		syscall.Close(fd)
		return nil, "", fmt.Errorf("获取从端编号失败: %w", e)
	}
	master := os.NewFile(uintptr(fd), "/dev/ptmx")
	return master, "/dev/pts/" + strconv.Itoa(int(n)), nil
}

// Start 在伪终端里启动命令, 返回主端(读写即终端的输入输出)。
func Start(cmd *exec.Cmd) (*os.File, error) {
	master, slaveName, err := Open()
	if err != nil {
		return nil, err
	}
	slave, err := os.OpenFile(slaveName, os.O_RDWR|syscall.O_NOCTTY, 0)
	if err != nil {
		master.Close()
		return nil, fmt.Errorf("打开从端 %s 失败: %w", slaveName, err)
	}

	cmd.Stdin = slave
	cmd.Stdout = slave
	cmd.Stderr = slave
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	// 新会话 + 以 0 号 fd 为控制终端; 子进程 exec 后成为会话首进程
	cmd.SysProcAttr.Setsid = true
	cmd.SysProcAttr.Setctty = true
	cmd.SysProcAttr.Ctty = 0

	if err := cmd.Start(); err != nil {
		slave.Close()
		master.Close()
		return nil, err
	}
	// 父进程必须关掉从端, 否则主端读不到 EOF
	slave.Close()
	return master, nil
}

// Setsize 设置终端窗口大小(发 SIGWINCH 由内核完成)。
func Setsize(f *os.File, ws *Winsize) error {
	if f == nil || ws == nil {
		return nil
	}
	if _, _, e := syscall.Syscall(syscall.SYS_IOCTL, f.Fd(), tiocswinsz, uintptr(unsafe.Pointer(ws))); e != 0 {
		return fmt.Errorf("设置窗口大小失败: %w", e)
	}
	return nil
}
