//go:build !linux

package main

import (
	"os"
	"os/exec"
	"time"
)

// selfRestart 非 Linux 平台: 起一个新进程后退出(仅供开发机验证)。
func selfRestart() {
	time.Sleep(400 * time.Millisecond)
	exe, err := os.Executable()
	if err != nil {
		os.Exit(1)
	}
	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		os.Exit(1)
	}
	os.Exit(0)
}
