//go:build !linux

package supervisor

import (
	"os/exec"
	"syscall"
)

func setupSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{}
}

// killProcess 非 Linux 走进程级信号(无 setpgid 概念)。仅用于开发期在 Windows 编译。
func killProcess(pid int, sig syscall.Signal) error {
	switch sig {
	case syscall.SIGTERM:
		return exec.Command("taskkill", "/F", "/PID", itoa(pid)).Run()
	default:
		// 非 Linux 走 Process.Kill
		// 这里取 pid 直接调 process.Kill 也不现实(没有 process 引用)。
		return nil
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
