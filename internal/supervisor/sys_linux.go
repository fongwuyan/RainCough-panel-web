//go:build linux

package supervisor

import (
	"os/exec"
	"syscall"
)

// setupSysProcAttr 在 Linux 上把子进程置成新进程组, 以便 SIGTERM/SIGKILL 发到整组。
func setupSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

// killProcess 发信号到进程组(负 pid)。5 秒 SIGKILL 兜底由调用方计时。
func killProcess(pid int, sig syscall.Signal) error {
	return syscall.Kill(-pid, sig)
}
