//go:build !linux

package pty

import (
	"errors"
	"os"
	"os/exec"
)

// 非 Linux 平台占位: 终端只在 Linux 上可用, 这里仅为开发机编译通过。

// Winsize 终端窗口尺寸。
type Winsize struct {
	Rows uint16
	Cols uint16
	X    uint16
	Y    uint16
}

// Open 打开伪终端。
func Open() (*os.File, string, error) { return nil, "", errors.New("伪终端仅支持 Linux") }

// Start 在伪终端里启动命令。
func Start(cmd *exec.Cmd) (*os.File, error) { return nil, errors.New("伪终端仅支持 Linux") }

// Setsize 设置窗口大小。
func Setsize(f *os.File, ws *Winsize) error { return errors.New("伪终端仅支持 Linux") }
