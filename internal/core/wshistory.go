package core

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

// ---- 工作台常驻历史 (Workspace persistent history) ----
//
// 需求: 工作台图表数据【常驻存储】、【不限期】(永不过期/不轮转/不自动清理)、
//       且【仅】"存储清理"(sysfunc/clean, key=workspace)可删除。
//
// 实现:
//   - 每 1s 采样一次 → 追加式 NDJSON(首行 header, 之后每行一个采样点), 文件只增不减;
//   - 内存只保留尾部 wsTailMax 点(有界 RAM, 与"不限期"的磁盘语义解耦);
//   - 读取只逆读文件尾 wsTailBytes, GB 级文件也秒开(绝不全量解析);
//   - 写入走 bufio, 每 wsFlushEvery 或 Stop 时 flush;
//   - 除 Clear()(仅供"存储清理"调用)外, 任何路径都不删除/截断该文件。

const (
	wsTailMax    = 1800            // 内存尾部点数(30 分钟 @1s)
	wsTailBytes  = 2 << 20         // 尾部逆读窗口 2MB
	wsFlushEvery = 5 * time.Second // 刷盘周期
	wsVer        = 1
)

// WSPoint 一个采样点。V 与 header.Series 对齐; If 只记当秒有流量的网卡 [up,down]。
type WSPoint struct {
	T  int64                `json:"t"`
	V  []float64             `json:"v"`
	If map[string][]float64 `json:"if,omitempty"`
}

type wsHeader struct {
	Ver    int      `json:"ver"`
	Series []string `json:"series"`
	Since  int64    `json:"since"`
}

// WSHistory 工作台常驻历史存储。
type WSHistory struct {
	mu        sync.Mutex
	path      string
	series    []string
	idx       map[string]int
	since     int64
	tail      []WSPoint
	file      *os.File
	buf       *bufio.Writer
	lastFlush time.Time
	stopCh    chan struct{}
	stopOnce  sync.Once
}

// NewWSHistory 打开(或创建)常驻历史; 只读尾部, 不解析全文件。
func NewWSHistory(path string) *WSHistory {
	h := &WSHistory{path: path, stopCh: make(chan struct{}), idx: map[string]int{}}
	h.loadTail()
	return h
}

// Path 历史文件绝对路径(存储清理展示用)。
func (h *WSHistory) Path() string { return h.path }

// Size 历史文件字节数(不存在返回 0)。
func (h *WSHistory) Size() int64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.sizeLocked()
}

func (h *WSHistory) sizeLocked() int64 {
	st, err := os.Stat(h.path)
	if err != nil {
		return 0
	}
	return st.Size()
}

// loadTail 读 header + 尾部若干行(出错按空历史处理)。
func (h *WSHistory) loadTail() {
	h.mu.Lock()
	defer h.mu.Unlock()
	f, err := os.Open(h.path)
	if err != nil {
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || st.Size() == 0 {
		return
	}
	// header: 首行
	head := make([]byte, 0, 4096)
	one := make([]byte, 1)
	for len(head) < 4096 {
		if _, err := f.Read(one); err != nil || one[0] == '\n' {
			break
		}
		head = append(head, one[0])
	}
	var hd wsHeader
	if err := json.Unmarshal(head, &hd); err == nil && len(hd.Series) > 0 {
		h.series = hd.Series
		h.since = hd.Since
		h.reindex()
	}
	// 尾部: 逆读 wsTailBytes
	var start int64
	if st.Size() > wsTailBytes {
		start = st.Size() - wsTailBytes
	}
	buf := make([]byte, st.Size()-start)
	if _, err := f.ReadAt(buf, start); err != nil && len(buf) == 0 {
		return
	}
	s := string(buf)
	if start > 0 { // 丢弃被截断的半行
		if i := strings.IndexByte(s, '\n'); i >= 0 {
			s = s[i+1:]
		}
	}
	lines := strings.Split(strings.TrimRight(s, "\n"), "\n")
	if len(lines) > wsTailMax {
		lines = lines[len(lines)-wsTailMax:]
	}
	pts := make([]WSPoint, 0, len(lines))
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l == "" || !strings.HasPrefix(l, "{") {
			continue
		}
		var p WSPoint
		if json.Unmarshal([]byte(l), &p) == nil && p.T > 0 {
			pts = append(pts, p)
		}
	}
	h.tail = pts
}

func (h *WSHistory) reindex() {
	h.idx = map[string]int{}
	for i, s := range h.series {
		h.idx[s] = i
	}
}

// Start 启动每秒采样 goroutine。
func (h *WSHistory) Start(mon *SystemMonitor) {
	if mon == nil {
		return
	}
	go func() {
		t := time.NewTicker(time.Second)
		defer t.Stop()
		for {
			select {
			case <-h.stopCh:
				return
			case <-t.C:
				h.sample(mon)
			}
		}
	}()
}

// Stop 停止采样并刷盘关闭。
func (h *WSHistory) Stop() {
	h.stopOnce.Do(func() { close(h.stopCh) })
	h.mu.Lock()
	defer h.mu.Unlock()
	h.flushLocked(true)
	if h.file != nil {
		_ = h.file.Close()
		h.file = nil
		h.buf = nil
	}
}

// sample 采样一条并追加落盘。
func (h *WSHistory) sample(mon *SystemMonitor) {
	snap := mon.Snapshot()
	h.mu.Lock()
	defer h.mu.Unlock()

	// 首次采样: 按当前 CPU 核数建 series(文件已存在则沿用旧 header, 保持索引稳定)
	if len(h.series) == 0 {
		h.series = []string{"cpu", "mem", "swap", "up", "down", "disk", "l1", "l5", "l15"}
		for i := 0; i < snap.CPUCount && i < 64; i++ {
			h.series = append(h.series, fmt.Sprintf("pc%d", i))
		}
		h.since = time.Now().Unix()
		h.reindex()
		if err := h.ensureFileLocked(); err != nil {
			return
		}
		if b, err := json.Marshal(wsHeader{Ver: wsVer, Series: h.series, Since: h.since}); err == nil {
			_, _ = h.buf.Write(append(b, '\n'))
			h.flushLocked(false)
		}
	}
	if h.buf == nil {
		if err := h.ensureFileLocked(); err != nil {
			return
		}
	}

	diskPct := snap.DiskPercent
	if diskPct == 0 && len(snap.Disks) > 0 { // 与工作台 diskAgg 同口径兜底
		var used, total float64
		for _, d := range snap.Disks {
			used += float64(d.Used)
			total += float64(d.Total)
		}
		if total > 0 {
			diskPct = used / total * 100
		}
	}
	load := []float64{0, 0, 0}
	for i := 0; i < 3 && i < len(snap.LoadAvg); i++ {
		load[i] = round2(snap.LoadAvg[i])
	}

	v := make([]float64, len(h.series))
	set := func(name string, val float64) {
		if i, ok := h.idx[name]; ok && i < len(v) {
			v[i] = val
		}
	}
	set("cpu", round1(snap.CPUPercent))
	set("mem", round1(snap.MemoryPercent))
	set("swap", round1(snap.SwapPercent))
	set("up", round0(snap.NetUpRate))
	set("down", round0(snap.NetDownRate))
	set("disk", round1(diskPct))
	set("l1", load[0])
	set("l5", load[1])
	set("l15", load[2])
	for i, c := range snap.CPUPerCore {
		set(fmt.Sprintf("pc%d", i), round1(c))
	}

	// 分网卡: 只记当秒有流量的(空闲时零开销, 体积贴近估算)
	var ifm map[string][]float64
	for _, ni := range snap.NetIfaces {
		up, down := round0(ni.UpRate), round0(ni.DownRate)
		if up == 0 && down == 0 {
			continue
		}
		if ifm == nil {
			ifm = map[string][]float64{}
		}
		ifm[ni.Name] = []float64{up, down}
	}

	p := WSPoint{T: time.Now().Unix(), V: v, If: ifm}
	b, err := json.Marshal(p)
	if err != nil {
		return
	}
	if _, err := h.buf.Write(append(b, '\n')); err != nil {
		return
	}
	h.tail = append(h.tail, p)
	if len(h.tail) > wsTailMax {
		h.tail = h.tail[len(h.tail)-wsTailMax:]
	}
	if time.Since(h.lastFlush) >= wsFlushEvery {
		h.flushLocked(false)
	}
}

// ensureFileLocked 打开追加句柄(文件不存在则创建)。
func (h *WSHistory) ensureFileLocked() error {
	if h.buf != nil {
		return nil
	}
	f, err := os.OpenFile(h.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	h.file = f
	h.buf = bufio.NewWriterSize(f, 64*1024)
	return nil
}

func (h *WSHistory) flushLocked(force bool) {
	if h.buf == nil {
		return
	}
	if force || time.Since(h.lastFlush) >= wsFlushEvery {
		_ = h.buf.Flush()
		h.lastFlush = time.Now()
	}
}

// Status 取尾部最多 points 个采样点 + 元信息(供前端回填图表)。
func (h *WSHistory) Status(points int) (series []string, pts []WSPoint, bytes int64, since int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if points <= 0 || points > wsTailMax {
		points = wsTailMax
	}
	out := []WSPoint{}
	if n := len(h.tail); n > 0 {
		s := n - points
		if s < 0 {
			s = 0
		}
		out = append(out, h.tail[s:]...)
	}
	return append([]string{}, h.series...), out, h.sizeLocked(), h.since
}

// Count 内存尾部点数(接口展示用)。
func (h *WSHistory) Count() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.tail)
}

// Clear 删除常驻历史 —— 【唯一】清理入口(由"存储清理" sysfunc/clean 调用)。
// 文件删除 + 内存尾部清空; 之后重新采样会以新 header 重新开始。
func (h *WSHistory) Clear() (string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	bytes := h.sizeLocked()
	points := len(h.tail)
	h.flushLocked(true)
	if h.file != nil {
		_ = h.file.Close()
		h.file = nil
		h.buf = nil
	}
	if err := os.Remove(h.path); err != nil && !os.IsNotExist(err) {
		return "", err
	}
	h.tail = nil
	h.series = nil
	h.idx = map[string]int{}
	h.since = 0
	return fmt.Sprintf("已清除工作台常驻历史 %d 点, 释放 %s", points, wsHumanBytes(uint64(bytes))), nil
}

// wsHumanBytes 字节数人类可读化(本文件专用, 避免依赖 cmd 层)。
func wsHumanBytes(b uint64) string {
	switch {
	case b >= 1<<40:
		return fmt.Sprintf("%.1fT", float64(b)/float64(1<<40))
	case b >= 1<<30:
		return fmt.Sprintf("%.1fG", float64(b)/float64(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.1fM", float64(b)/float64(1<<20))
	case b >= 1<<10:
		return fmt.Sprintf("%.1fK", float64(b)/float64(1<<10))
	}
	return fmt.Sprintf("%dB", b)
}

func round0(v float64) float64 {
	if v < 0 {
		return 0
	}
	return float64(int64(v + 0.5))
}
func round1(v float64) float64 {
	if v < 0 {
		return 0
	}
	return float64(int64(v*10+0.5)) / 10
}
func round2(v float64) float64 {
	if v < 0 {
		return 0
	}
	return float64(int64(v*100+0.5)) / 100
}
