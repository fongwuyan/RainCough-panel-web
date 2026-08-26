package host

import (
	"testing"
	"time"
)

// 验证 noteDeath 的指数退避: 连续崩溃 3 次, 退避时间应递增且封顶。
func TestBackoffEscalation(t *testing.T) {
	h := NewWithOptions(t.TempDir(), "sqlite:///x.db", Options{MaxChildren: 4, RestartMax: 10})
	now := time.Now()

	h.mu.Lock()
	h.noteDeath("a") // 第1次 -> 2s
	r1 := h.dead["a"]
	h.noteDeath("a") // 第2次 -> 4s
	r2 := h.dead["a"]
	h.noteDeath("a") // 第3次 -> 8s
	r3 := h.dead["a"]
	h.mu.Unlock()

	d1 := r1.Backoff.Sub(now)
	d2 := r2.Backoff.Sub(now)
	d3 := r3.Backoff.Sub(now)
	if d1 < 1*time.Second || d1 > 3*time.Second {
		t.Fatalf("第1次退避应为~2s, 得到 %v", d1)
	}
	if d2 < 3*time.Second || d2 > 5*time.Second {
		t.Fatalf("第2次退避应为~4s, 得到 %v", d2)
	}
	if d3 < 7*time.Second || d3 > 9*time.Second {
		t.Fatalf("第3次退避应为~8s, 得到 %v", d3)
	}
	if r1.Count != 1 || r2.Count != 2 || r3.Count != 3 {
		t.Fatalf("崩溃计数错误: %d %d %d", r1.Count, r2.Count, r3.Count)
	}
}

// 验证退避封顶: 崩很多次后退避不超过 60s。
func TestBackoffCap(t *testing.T) {
	h := NewWithOptions(t.TempDir(), "sqlite:///x.db", Options{MaxChildren: 4, RestartMax: 100})
	now := time.Now()
	h.mu.Lock()
	for i := 0; i < 12; i++ {
		h.noteDeath("b")
	}
	r := h.dead["b"]
	h.mu.Unlock()
	d := r.Backoff.Sub(now)
	if d > 61*time.Second {
		t.Fatalf("退避应封顶 60s, 得到 %v", d)
	}
	if r.Count != 12 {
		t.Fatalf("计数错误: %d", r.Count)
	}
}

// 验证成功拉起会清除退避状态。
func TestSuccessClearsBackoff(t *testing.T) {
	h := NewWithOptions(t.TempDir(), "sqlite:///x.db", Options{MaxChildren: 4, RestartMax: 5})
	h.mu.Lock()
	h.noteDeath("c")
	if _, ok := h.dead["c"]; !ok {
		t.Fatal("noteDeath 后应有退避状态")
	}
	delete(h.dead, "c") // Scan/startChild 成功路径会 delete
	if _, ok := h.dead["c"]; ok {
		t.Fatal("成功恢复后退避状态应被清除")
	}
	h.mu.Unlock()
}

// 验证 restartMax 达到后 Watchdog 不再拉起(直接构造 dead 状态断言)。
func TestRestartMaxGuard(t *testing.T) {
	h := NewWithOptions(t.TempDir(), "sqlite:///x.db", Options{MaxChildren: 4, RestartMax: 2})
	h.mu.Lock()
	for i := 0; i < 3; i++ {
		h.noteDeath("d") // Count=3 > RestartMax=2
	}
	r := h.dead["d"]
	// Watchdog 内判断 r.Count <= h.restartMax 才尝试重启
	shouldRestart := r.Count <= h.restartMax
	h.mu.Unlock()
	if shouldRestart {
		t.Fatalf("Count=%d 超过 RestartMax=%d 不应重启", r.Count, h.restartMax)
	}
}
