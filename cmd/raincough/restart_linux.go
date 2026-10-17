//go:build linux

package main

import (
	"log"
	"os"
	"syscall"
	"time"
)

// selfRestart 用 execve 原地替换进程镜像完成重启, 不依赖 systemd。
// 端口由内核在重新 bind 时接回, 中断窗口在毫秒级。
func selfRestart() {
	time.Sleep(400 * time.Millisecond)
	exe, err := os.Executable()
	if err != nil {
		log.Printf("[restart] 取可执行路径失败: %v", err)
		os.Exit(1)
	}
	if err := syscall.Exec(exe, os.Args, os.Environ()); err != nil {
		log.Printf("[restart] exec 失败: %v", err)
		os.Exit(1)
	}
}
