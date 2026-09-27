package core

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// ---- 工作台常驻历史: 追加/尾部读取/重启恢复/仅清理入口删除 ----

func TestWSHistoryAppendAndTail(t *testing.T) {
	p := filepath.Join(t.TempDir(), "ws.ndjson")
	h := NewWSHistory(p)

	// 手工造一条 header + 若干点(模拟运行态)
	h.mu.Lock()
	h.series = []string{"cpu", "mem", "swap", "up", "down", "disk", "l1", "l5", "l15"}
	h.reindex()
	h.since = time.Now().Unix()
	if err := h.ensureFileLocked(); err != nil {
		t.Fatalf("open: %v", err)
	}
	hb, _ := json.Marshal(wsHeader{Ver: wsVer, Series: h.series, Since: h.since})
	if _, err := h.buf.Write(append(hb, '\n')); err != nil {
		t.Fatalf("header: %v", err)
	}
	for i := 0; i < 5; i++ {
		p := WSPoint{T: time.Now().Unix() + int64(i), V: []float64{float64(i), 30, 0, 1, 2, 33, 0.1, 0.2, 0.3}}
		b, _ := json.Marshal(p)
		if _, err := h.buf.Write(append(b, '\n')); err != nil {
			t.Fatalf("point: %v", err)
		}
		h.tail = append(h.tail, p)
	}
	h.flushLocked(true)
	h.mu.Unlock()

	ser, pts, size, since := h.Status(100)
	if len(ser) != 9 || len(pts) != 5 {
		t.Fatalf("series=%d pts=%d", len(ser), len(pts))
	}
	if size <= 0 || since == 0 {
		t.Fatalf("size=%d since=%d", size, since)
	}
	if pts[0].V[0] != 0 || pts[4].V[0] != 4 {
		t.Fatalf("点序错误: %+v", pts)
	}
	h.Stop() // 关闭句柄(否则 Windows TempDir 清理失败)
}

func TestWSHistoryRestartRecover(t *testing.T) {
	p := filepath.Join(t.TempDir(), "ws.ndjson")
	h := NewWSHistory(p)
	h.mu.Lock()
	h.series = []string{"cpu", "mem", "swap", "up", "down", "disk", "l1", "l5", "l15"}
	h.reindex()
	h.since = 42
	_ = h.ensureFileLocked()
	hb, _ := json.Marshal(wsHeader{Ver: wsVer, Series: h.series, Since: h.since})
	_, _ = h.buf.Write(append(hb, '\n'))
	for i := 0; i < 3; i++ {
		b, _ := json.Marshal(WSPoint{T: 1000 + int64(i), V: make([]float64, 9)})
		_, _ = h.buf.Write(append(b, '\n'))
	}
	h.flushLocked(true)
	_ = h.file.Close()
	h.file, h.buf = nil, nil
	h.mu.Unlock()

	// 重启: 新实例只读尾部
	h2 := NewWSHistory(p)
	ser, pts, _, since := h2.Status(10)
	if len(ser) != 9 || len(pts) != 3 || since != 42 {
		t.Fatalf("恢复失败 series=%d pts=%d since=%d", len(ser), len(pts), since)
	}
	if pts[2].T != 1002 {
		t.Fatalf("尾部点错误: %+v", pts[2])
	}
}

func TestWSHistoryTailOnlyReadLargeFile(t *testing.T) {
	// 造一个 > 逆读窗口的文件, 验证不全量解析也能取到尾部
	p := filepath.Join(t.TempDir(), "ws.ndjson")
	f, _ := os.Create(p)
	hb, _ := json.Marshal(wsHeader{Ver: wsVer, Series: []string{"cpu"}, Since: 1})
	_, _ = f.Write(append(hb, '\n'))
	line, _ := json.Marshal(WSPoint{T: 7, V: []float64{1}})
	pad := make([]byte, wsTailBytes)
	_, _ = f.Write(pad)
	for i := 0; i < 20; i++ {
		_, _ = f.Write(append(line, '\n'))
	}
	_ = f.Close()

	h := NewWSHistory(p)
	_, pts, size, _ := h.Status(10)
	if len(pts) == 0 {
		t.Fatal("大文件尾部读取失败")
	}
	if pts[len(pts)-1].T != 7 {
		t.Fatalf("尾点错误: %+v", pts[len(pts)-1])
	}
	if size <= int64(wsTailBytes) {
		t.Fatalf("size 应大于逆读窗口: %d", size)
	}
}

func TestWSHistoryClearIsOnlyExit(t *testing.T) {
	p := filepath.Join(t.TempDir(), "ws.ndjson")
	h := NewWSHistory(p)
	h.mu.Lock()
	h.series = []string{"cpu"}
	h.reindex()
	_ = h.ensureFileLocked()
	b, _ := json.Marshal(wsHeader{Ver: wsVer, Series: h.series, Since: 9})
	_, _ = h.buf.Write(append(b, '\n'))
	h.tail = []WSPoint{{T: 1, V: []float64{1}}}
	h.flushLocked(true)
	h.mu.Unlock()

	if h.Size() <= 0 {
		t.Fatal("文件应存在")
	}
	msg, err := h.Clear()
	if err != nil {
		t.Fatalf("Clear: %v", err)
	}
	if msg == "" {
		t.Fatal("应返回清理说明")
	}
	if _, err := os.Stat(p); !os.IsNotExist(err) {
		t.Fatal("文件应已删除")
	}
	if h.Size() != 0 || h.Count() != 0 {
		t.Fatalf("清理后应归零 size=%d count=%d", h.Size(), h.Count())
	}
	// 清理后仍可继续采样写入(重新建 header)
	h.mu.Lock()
	ok := h.ensureFileLocked() == nil && len(h.series) == 0 // series 将在下次 sample 重建
	h.mu.Unlock()
	if !ok {
		t.Fatal("清理后应能重新打开写入")
	}
	h.Stop() // 关闭句柄(否则 Windows TempDir 清理失败)
}

func TestWSHistoryRounding(t *testing.T) {
	if round1(12.34) != 12.3 || round1(-5) != 0 {
		t.Fatalf("round1: %v", round1(12.34))
	}
	if round0(1234.6) != 1235 || round0(-1) != 0 {
		t.Fatalf("round0: %v", round0(1234.6))
	}
	if round2(0.1234) != 0.12 {
		t.Fatalf("round2: %v", round2(0.1234))
	}
	// NaN/Inf 必须归 0(int64(NaN) 会产生 -9223372036854775808 毒化数据)
	if round0(math.NaN()) != 0 || round1(math.NaN()) != 0 || round2(math.NaN()) != 0 {
		t.Fatalf("NaN 未归零: %v %v %v", round0(math.NaN()), round1(math.NaN()), round2(math.NaN()))
	}
	if round0(math.Inf(1)) != 0 || round1(math.Inf(-1)) != 0 {
		t.Fatal("Inf 未归零")
	}
}
