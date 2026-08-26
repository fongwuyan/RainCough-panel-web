package core

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

// runCommand 执行 shell 命令(带超时, 返回合并输出)。
func runCommand(cmd string, timeoutSec int) (string, error) {
	ctx := context.Background()
	if timeoutSec > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(timeoutSec)*time.Second)
		defer cancel()
	}
	c := exec.CommandContext(ctx, "sh", "-lc", cmd)
	var out strings.Builder
	c.Stdout = &out
	c.Stderr = &out
	err := c.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return out.String(), &TimeoutError{Seconds: timeoutSec}
	}
	return out.String(), err
}

// TimeoutError 命令超时错误。
type TimeoutError struct{ Seconds int }

func (e *TimeoutError) Error() string {
	return "命令执行超时(>" + itoa(e.Seconds) + "s)"
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
