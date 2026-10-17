// Package shared 共用数据层: 纯标准库实现的 namespace 级 KV 存储。
//
// 设计:
//   - 每个 namespace 一个 append-only 日志 <dir>/<ns>.log, 每行一条 JSON 记录。
//   - 启动时回放日志构建内存索引, 读操作走内存, 写操作追加一行。
//   - 删除写墓碑(x:true), 压缩时物理清除。
//   - 日志行数明显多于存活键数时自动压缩(写临时文件 → 原子 rename)。
//   - 不依赖任何第三方包, 不依赖外部数据库服务。
//
// 记录格式(单行 JSON):
//
//	{"k":"key","v":<任意 JSON>,"t":1700000000}     写入
//	{"k":"key","x":true,"t":1700000000}            删除
package shared

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	nsRE = regexp.MustCompile(`^[a-zA-Z0-9_]{1,32}$`)

	// ErrClosed 数据层已关闭。
	ErrClosed = errors.New("数据层已关闭")
)

// 压缩阈值: 日志超过该行数, 且行数 > 存活键数 * compactRatio 时压缩。
const (
	compactMinLines = 4096
	compactRatio    = 4
	syncInterval    = time.Second
)

// ValidateNS 校验 namespace 合法性。
func ValidateNS(ns string) bool { return nsRE.MatchString(ns) }

// Shared 全局数据层入口。
type Shared struct {
	dir    string
	mu     sync.Mutex // 保护 spaces 映射与关闭状态
	spaces map[string]*space
	closed bool
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// space 单个 namespace 的运行时状态。
type space struct {
	mu    sync.RWMutex
	name  string
	path  string
	f     *os.File
	data  map[string]json.RawMessage
	stamp map[string]int64
	lines int  // 日志中的记录数(含墓碑)
	dirty bool // 有未 fsync 的写入
}

type record struct {
	K string          `json:"k"`
	V json.RawMessage `json:"v,omitempty"`
	X bool            `json:"x,omitempty"`
	T int64           `json:"t"`
}

// Open 打开数据层。dir 为存放 *.log 的目录, 不存在则创建。
//
// 兼容旧的 DSN 写法(便于平滑迁移):
//
//	kv:///<dir>        直接作为目录
//	sqlite:///<file>   取 <file> 所在目录下的 kv/ 子目录
//	<path>             直接作为目录
func Open(dsn string) (*Shared, error) {
	dir, err := resolveDir(dsn)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("创建数据目录失败: %w", err)
	}
	s := &Shared{dir: dir, spaces: map[string]*space{}, stopCh: make(chan struct{})}
	s.wg.Add(1)
	go s.syncLoop()
	return s, nil
}

// OpenWithTimeout 保留旧签名; timeout 已无意义(纯文件存储无查询超时)。
func OpenWithTimeout(dsn string, _ time.Duration) (*Shared, error) { return Open(dsn) }

func resolveDir(dsn string) (string, error) {
	switch {
	case dsn == "":
		return "data/kv", nil
	case strings.HasPrefix(dsn, "kv:///"):
		return filepath.FromSlash(strings.TrimPrefix(dsn, "kv:///")), nil
	case strings.HasPrefix(dsn, "sqlite:///"):
		f := filepath.FromSlash(strings.TrimPrefix(dsn, "sqlite:///"))
		return filepath.Join(filepath.Dir(f), "kv"), nil
	case strings.HasPrefix(dsn, "mysql://"):
		return "", errors.New("mysql 后端已移除(零依赖改造), 请改用 kv:///<dir>")
	default:
		return filepath.FromSlash(dsn), nil
	}
}

// Namespace 返回指定 namespace 的访问句柄(惰性打开, 并发安全)。
func (s *Shared) Namespace(ns string) (*Namespace, error) {
	ns = strings.ToLower(strings.TrimSpace(ns))
	if !ValidateNS(ns) {
		return nil, fmt.Errorf("非法 namespace: %q (仅 a-z0-9_ 1-32 字符)", ns)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, ErrClosed
	}
	sp, ok := s.spaces[ns]
	if !ok {
		var err error
		sp, err = s.openSpace(ns)
		if err != nil {
			return nil, err
		}
		s.spaces[ns] = sp
	}
	return &Namespace{s: s, sp: sp, ns: ns}, nil
}

// openSpace 打开(或创建)一个 namespace 日志并回放。
func (s *Shared) openSpace(ns string) (*space, error) {
	sp := &space{
		name:  ns,
		path:  filepath.Join(s.dir, ns+".log"),
		data:  map[string]json.RawMessage{},
		stamp: map[string]int64{},
	}
	if err := sp.replay(); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(sp.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		return nil, fmt.Errorf("打开日志失败 %s: %w", sp.path, err)
	}
	sp.f = f
	return sp, nil
}

// replay 回放日志。末尾不完整的行(崩溃残留)直接丢弃。
func (sp *space) replay() error {
	f, err := os.Open(sp.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer f.Close()
	br := bufio.NewReaderSize(f, 64*1024)
	for {
		line, err := br.ReadBytes('\n')
		if len(line) > 0 && line[len(line)-1] == '\n' {
			sp.applyLine(line)
		}
		// 最后一行没有换行符 = 写入被截断, 丢弃
		if err != nil {
			break
		}
	}
	return nil
}

func (sp *space) applyLine(line []byte) {
	var r record
	if json.Unmarshal(line, &r) != nil || r.K == "" {
		return
	}
	sp.lines++
	if r.X {
		delete(sp.data, r.K)
		delete(sp.stamp, r.K)
		return
	}
	sp.data[r.K] = r.V
	sp.stamp[r.K] = r.T
}

// Close 刷盘并关闭所有日志。
func (s *Shared) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	spaces := make([]*space, 0, len(s.spaces))
	for _, sp := range s.spaces {
		spaces = append(spaces, sp)
	}
	s.mu.Unlock()

	close(s.stopCh)
	s.wg.Wait()

	var first error
	for _, sp := range spaces {
		if err := sp.close(); err != nil && first == nil {
			first = err
		}
	}
	return first
}

// Sync 立即把所有 namespace 刷盘(测试与优雅退出用)。
func (s *Shared) Sync() error {
	s.mu.Lock()
	spaces := make([]*space, 0, len(s.spaces))
	for _, sp := range s.spaces {
		spaces = append(spaces, sp)
	}
	s.mu.Unlock()
	var first error
	for _, sp := range spaces {
		if err := sp.sync(); err != nil && first == nil {
			first = err
		}
	}
	return first
}

func (s *Shared) syncLoop() {
	defer s.wg.Done()
	t := time.NewTicker(syncInterval)
	defer t.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-t.C:
			s.mu.Lock()
			spaces := make([]*space, 0, len(s.spaces))
			for _, sp := range s.spaces {
				spaces = append(spaces, sp)
			}
			s.mu.Unlock()
			for _, sp := range spaces {
				_ = sp.sync()
			}
		}
	}
}

// ---- space 写路径 ----

func (sp *space) set(key string, raw json.RawMessage) error {
	now := time.Now().Unix()
	line, err := json.Marshal(record{K: key, V: raw, T: now})
	if err != nil {
		return err
	}
	sp.mu.Lock()
	defer sp.mu.Unlock()
	if err := sp.append(line); err != nil {
		return err
	}
	sp.data[key] = raw
	sp.stamp[key] = now
	return nil
}

func (sp *space) del(key string) error {
	now := time.Now().Unix()
	line, err := json.Marshal(record{K: key, X: true, T: now})
	if err != nil {
		return err
	}
	sp.mu.Lock()
	defer sp.mu.Unlock()
	if err := sp.append(line); err != nil {
		return err
	}
	delete(sp.data, key)
	delete(sp.stamp, key)
	return nil
}

// append 追加一行并维护计数; 调用方需持有 sp.mu。
func (sp *space) append(line []byte) error {
	if sp.f == nil {
		return ErrClosed
	}
	line = append(line, '\n')
	if _, err := sp.f.Write(line); err != nil {
		return fmt.Errorf("写日志失败: %w", err)
	}
	sp.lines++
	sp.dirty = true
	if sp.shouldCompact() {
		return sp.compact()
	}
	return nil
}

func (sp *space) shouldCompact() bool {
	return sp.lines > compactMinLines && sp.lines > len(sp.data)*compactRatio
}

// compact 把当前存活键重写为临时文件后原子替换。调用方需持有 sp.mu。
func (sp *space) compact() error {
	tmp := sp.path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o640)
	if err != nil {
		return err
	}
	bw := bufio.NewWriterSize(f, 64*1024)
	keys := make([]string, 0, len(sp.data))
	for k := range sp.data {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		line, err := json.Marshal(record{K: k, V: sp.data[k], T: sp.stamp[k]})
		if err != nil {
			continue
		}
		if _, err := bw.Write(append(line, '\n')); err != nil {
			f.Close()
			os.Remove(tmp)
			return err
		}
	}
	if err := bw.Flush(); err != nil {
		f.Close()
		os.Remove(tmp)
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		os.Remove(tmp)
		return err
	}
	f.Close()

	if sp.f != nil {
		sp.f.Close()
		sp.f = nil
	}
	// Windows 上 rename 不能覆盖已存在文件; 先删再改名(仅开发机受影响)。
	if err := os.Rename(tmp, sp.path); err != nil {
		os.Remove(sp.path)
		if err2 := os.Rename(tmp, sp.path); err2 != nil {
			os.Remove(tmp)
			sp.f, _ = os.OpenFile(sp.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
			return fmt.Errorf("压缩替换失败: %w", err2)
		}
	}
	f2, err := os.OpenFile(sp.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		return err
	}
	sp.f = f2
	sp.lines = len(sp.data)
	sp.dirty = false
	return nil
}

func (sp *space) sync() error {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	if sp.f == nil || !sp.dirty {
		return nil
	}
	sp.dirty = false
	return sp.f.Sync()
}

func (sp *space) close() error {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	if sp.f == nil {
		return nil
	}
	err := sp.f.Sync()
	if e := sp.f.Close(); err == nil {
		err = e
	}
	sp.f = nil
	return err
}

// ---- 读路径 ----

func (sp *space) get(key string) (json.RawMessage, bool) {
	sp.mu.RLock()
	defer sp.mu.RUnlock()
	raw, ok := sp.data[key]
	return raw, ok
}

func (sp *space) list(prefix string, limit int) map[string]json.RawMessage {
	sp.mu.RLock()
	defer sp.mu.RUnlock()
	keys := make([]string, 0, len(sp.data))
	for k := range sp.data {
		if strings.HasPrefix(k, prefix) {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	if limit > 0 && len(keys) > limit {
		keys = keys[:limit]
	}
	out := make(map[string]json.RawMessage, len(keys))
	for _, k := range keys {
		out[k] = sp.data[k]
	}
	return out
}

// Stats 返回某 namespace 的存储状态(诊断用)。
func (s *Shared) Stats() map[string]map[string]int {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := map[string]map[string]int{}
	for name, sp := range s.spaces {
		sp.mu.RLock()
		out[name] = map[string]int{"keys": len(sp.data), "lines": sp.lines}
		sp.mu.RUnlock()
	}
	return out
}

// atoi 兼容老代码里可能的字符串键序号解析。
func atoi(s string) int { n, _ := strconv.Atoi(s); return n }
