// Package legacy 负责把旧版面板(SQLite, rc.db)的数据迁移到 v6 的 KV 存储。
//
// 为什么自己写 SQLite 读取器:
//
//	· v6 的红线是"零第三方依赖"(纯标准库), 不能用 mattn/go-sqlite3 或 modernc
//	· 迁移只需要"读整张表", 不需要索引/事务/写入, 所以实现面比完整驱动小得多
//
// 本文件只做读取(SELECT * 级), 支持:
//
//	· 表 b-tree(leaf 0x0D / interior 0x05), 支持任意深度
//	· varint / record 序列类型(NULL/整数/浮点/文本/BLOB)
//	· payload overflow 链(旧库里有 310KB 的单值, 必须支持)
//	· WAL 回放(旧面板用 journal_mode=wal, WAL 可能比主库还大)
//	· 页大小 512..65536, 文本编码 UTF-8 / UTF-16
//
// 不支持(用不到): 索引页、WITHOUT ROWID 表、虚拟表、加密库、写操作。
// 遇到不支持的情况一律返回明确错误, 不做"猜着读" —— 迁移丢数据比报错严重得多。
package legacy

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"unicode/utf16"
)

const (
	sqliteHeaderSize = 100
	sqliteMagic      = "SQLite format 3\x00"

	// b-tree 页类型
	pageTypeInteriorIndex = 0x02
	pageTypeInteriorTable = 0x05
	pageTypeLeafIndex     = 0x0A
	pageTypeLeafTable     = 0x0D

	maxBTreeDepth = 64
	maxOverflow   = 1 << 20 // 单条 payload 最多追多少页(防御损坏文件导致死循环)
)

var (
	ErrNotSQLite   = errors.New("不是 SQLite 3 数据库(文件头不匹配)")
	ErrCorrupt     = errors.New("数据库文件损坏")
	ErrUnsupported = errors.New("数据库使用了不支持的特性")
)

// Value SQLite 的一个列值
type Value struct {
	Kind  byte // 'n' NULL, 'i' 整数, 'f' 浮点, 't' 文本, 'b' BLOB
	Int   int64
	Float float64
	Text  string // UTF-8 文本(Kind=='t')
	Blob  []byte
}

// IsNull 是否 NULL
func (v Value) IsNull() bool { return v.Kind == 'n' }

// AsString 转字符串: 文本原样; 整数/浮点取十进制; NULL 空串
func (v Value) AsString() string {
	switch v.Kind {
	case 't':
		return v.Text
	case 'i':
		return fmt.Sprintf("%d", v.Int)
	case 'f':
		return fmt.Sprintf("%g", v.Float)
	case 'b':
		return string(v.Blob)
	}
	return ""
}

// AsInt 转整数(NULL/非数值返回 0, ok=false)
func (v Value) AsInt() (int64, bool) {
	switch v.Kind {
	case 'i':
		return v.Int, true
	case 'f':
		return int64(v.Float), true
	}
	return 0, false
}

// Row 一行记录(sqlite_master 与业务表共用)
type Row struct {
	RowID int64
	Cols  []Value
}

// DB 只读 SQLite 数据库句柄
type DB struct {
	path     string
	f        *os.File
	pageSize int
	usable   int
	encoding int // 1=UTF-8, 2=UTF-16LE, 3=UTF-16BE
	npages   int

	// pages 被 WAL 覆盖后的页内容(仅缓存 WAL 里出现过的页)
	pages  map[uint32][]byte
	walErr error // WAL 回放遇到的问题(非致命, 供调用方提示)
}

// OpenDB 打开(只读)一个 SQLite 数据库。若存在同名 -wal 文件, 会先回放 WAL。
func OpenDB(path string) (*DB, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	hdr := make([]byte, sqliteHeaderSize)
	if _, err := io.ReadFull(f, hdr); err != nil {
		f.Close()
		return nil, fmt.Errorf("%w: 文件过短", ErrNotSQLite)
	}
	if string(hdr[:16]) != sqliteMagic {
		f.Close()
		return nil, ErrNotSQLite
	}
	ps := int(binary.BigEndian.Uint16(hdr[16:18]))
	if ps == 1 { // 规范里 1 表示 65536
		ps = 65536
	}
	if ps < 512 || ps > 65536 || ps&(ps-1) != 0 {
		f.Close()
		return nil, fmt.Errorf("%w: 页大小 %d", ErrCorrupt, ps)
	}
	reserved := int(hdr[20])
	if reserved >= ps {
		f.Close()
		return nil, fmt.Errorf("%w: reserved %d >= pageSize %d", ErrCorrupt, reserved, ps)
	}
	enc := int(binary.BigEndian.Uint32(hdr[56:60]))
	if enc == 0 {
		enc = 1 // 空库时读写器可写 0, 按 UTF-8 处理
	}
	if enc < 1 || enc > 3 {
		f.Close()
		return nil, fmt.Errorf("%w: 文本编码 %d", ErrUnsupported, enc)
	}

	db := &DB{
		path:     path,
		f:        f,
		pageSize: ps,
		usable:   ps - reserved,
		encoding: enc,
		npages:   int(binary.BigEndian.Uint32(hdr[28:32])),
		pages:    map[uint32][]byte{},
	}

	// WAL 回放(尽力而为: WAL 不存在就跳过; 校验失败则用主库)
	if err := db.applyWAL(path + "-wal"); err != nil && !errors.Is(err, os.ErrNotExist) {
		// WAL 损坏不应该让整个迁移失败 —— 主库仍然可用, 但要说清
		db.walErr = err
	}
	return db, nil
}

// walErr WAL 回放遇到的问题(非致命, 供调用方提示)
func (db *DB) WALWarning() error { return db.walErr }

// Close 关闭文件
func (db *DB) Close() error {
	if db.f == nil {
		return nil
	}
	err := db.f.Close()
	db.f = nil
	return err
}

// PageSize 页大小(诊断用)
func (db *DB) PageSize() int { return db.pageSize }

// Encoding 文本编码(1=UTF-8)
func (db *DB) Encoding() int { return db.encoding }

// page 取第 n 页(1-based)的完整内容。WAL 覆盖优先。
func (db *DB) page(n uint32) ([]byte, error) {
	if n == 0 {
		return nil, fmt.Errorf("%w: 页号 0", ErrCorrupt)
	}
	if p, ok := db.pages[n]; ok {
		return p, nil
	}
	buf := make([]byte, db.pageSize)
	off := int64(n-1) * int64(db.pageSize)
	if _, err := db.f.ReadAt(buf, off); err != nil {
		return nil, fmt.Errorf("%w: 读第 %d 页失败: %v", ErrCorrupt, n, err)
	}
	return buf, nil
}

// pageHeaderOffset 页 1 的前 100 字节是文件头, 内容从 100 开始
func pageHeaderOffset(n uint32) int {
	if n == 1 {
		return sqliteHeaderSize
	}
	return 0
}

// Tables 返回所有表: 表名 → 根页号
func (db *DB) Tables() (map[string]uint32, error) {
	rows, err := db.TableRows(1) // sqlite_master 的根页固定是 1
	if err != nil {
		return nil, err
	}
	out := map[string]uint32{}
	for _, r := range rows {
		if len(r.Cols) < 4 {
			continue
		}
		typ := r.Cols[0].AsString()
		name := r.Cols[1].AsString()
		root, ok := r.Cols[3].AsInt()
		if typ != "table" || !ok || root <= 0 {
			continue
		}
		out[name] = uint32(root)
	}
	return out, nil
}

// TableRows 读取某张表的全部行(按 b-tree 顺序, 不保证按 rowid 排序)。
func (db *DB) TableRows(root uint32) ([]Row, error) {
	var rows []Row
	if err := db.walkTable(root, 0, func(r Row) error {
		rows = append(rows, r)
		return nil
	}); err != nil {
		return nil, err
	}
	return rows, nil
}

// walkTable 递归遍历表 b-tree。
func (db *DB) walkTable(pgno uint32, depth int, fn func(Row) error) error {
	if depth > maxBTreeDepth {
		return fmt.Errorf("%w: b-tree 深度超过 %d", ErrCorrupt, maxBTreeDepth)
	}
	p, err := db.page(pgno)
	if err != nil {
		return err
	}
	hdr := pageHeaderOffset(pgno)
	if len(p) < hdr+8 {
		return fmt.Errorf("%w: 第 %d 页过短", ErrCorrupt, pgno)
	}
	typ := p[hdr]
	ncells := int(binary.BigEndian.Uint16(p[hdr+3 : hdr+5]))

	switch typ {
	case pageTypeLeafTable:
		ptrBase := hdr + 8
		if len(p) < ptrBase+2*ncells {
			return fmt.Errorf("%w: 第 %d 页 cell 指针越界", ErrCorrupt, pgno)
		}
		for i := 0; i < ncells; i++ {
			off := int(binary.BigEndian.Uint16(p[ptrBase+2*i : ptrBase+2*i+2]))
			if off <= 0 || off >= len(p) {
				return fmt.Errorf("%w: 第 %d 页 cell 偏移 %d 越界", ErrCorrupt, pgno, off)
			}
			rowid, payload, err := db.readLeafCell(p, off)
			if err != nil {
				return fmt.Errorf("第 %d 页第 %d 个 cell: %w", pgno, i, err)
			}
			cols, err := db.parseRecord(payload)
			if err != nil {
				return fmt.Errorf("第 %d 页第 %d 个 cell 记录: %w", pgno, i, err)
			}
			if err := fn(Row{RowID: rowid, Cols: cols}); err != nil {
				return err
			}
		}
		return nil

	case pageTypeInteriorTable:
		ptrBase := hdr + 12 // interior 页多一个 4 字节 right-most 指针
		if len(p) < ptrBase+2*ncells+4 {
			return fmt.Errorf("%w: 第 %d 页 cell 指针越界", ErrCorrupt, pgno)
		}
		for i := 0; i < ncells; i++ {
			off := int(binary.BigEndian.Uint16(p[ptrBase+2*i : ptrBase+2*i+2]))
			if off <= 0 || off+4 > len(p) {
				return fmt.Errorf("%w: 第 %d 页 cell 偏移 %d 越界", ErrCorrupt, pgno, off)
			}
			child := binary.BigEndian.Uint32(p[off : off+4])
			if err := db.walkTable(child, depth+1, fn); err != nil {
				return err
			}
		}
		right := binary.BigEndian.Uint32(p[hdr+8 : hdr+12])
		if right != 0 {
			return db.walkTable(right, depth+1, fn)
		}
		return nil

	case pageTypeLeafIndex, pageTypeInteriorIndex:
		// 索引页: 迁移不需要(我们只按表扫全量), 直接跳过
		return nil

	default:
		return fmt.Errorf("%w: 第 %d 页类型 0x%02x", ErrCorrupt, pgno, typ)
	}
}

// readLeafCell 解析表 b-tree 叶子 cell: [payloadLen varint][rowid varint][payload...]
func (db *DB) readLeafCell(p []byte, off int) (rowid int64, payload []byte, err error) {
	plen, n1, ok := readVarint(p, off)
	if !ok {
		return 0, nil, fmt.Errorf("%w: payload 长度 varint 越界", ErrCorrupt)
	}
	off += n1
	rid, n2, ok := readVarint(p, off)
	if !ok {
		return 0, nil, fmt.Errorf("%w: rowid varint 越界", ErrCorrupt)
	}
	off += n2
	if plen > uint64(1)<<32 {
		return 0, nil, fmt.Errorf("%w: payload 长度 %d 异常", ErrCorrupt, plen)
	}
	payload, err = db.readPayload(p, off, int(plen))
	if err != nil {
		return 0, nil, err
	}
	return int64(rid), payload, nil
}

// readPayload 读取 payload: 页内本地部分 + 溢出页链。
// 本地长度按 SQLite 规范计算(表 b-tree, 页大小 U):
//
//	X = U - 35
//	若 P <= X  -> 全部在本地
//	否则 M = ((U-12)*32/255) - 23
//	     K = M + (P-M) % (U-4)
//	     local = K (K<=X) 否则 M
func (db *DB) readPayload(p []byte, off int, plen int) ([]byte, error) {
	U := db.usable
	X := U - 35
	var local int
	if plen <= X {
		local = plen
	} else {
		M := ((U-12)*32)/255 - 23
		if M < 0 {
			M = 0
		}
		K := M + (plen-M)%(U-4)
		if K <= X {
			local = K
		} else {
			local = M
		}
	}
	if local < 0 || local > plen {
		return nil, fmt.Errorf("%w: 本地 payload 长度 %d (总 %d)", ErrCorrupt, local, plen)
	}
	if off+local > len(p) {
		return nil, fmt.Errorf("%w: payload 本地部分越界 (off=%d local=%d page=%d)", ErrCorrupt, off, local, len(p))
	}
	out := make([]byte, 0, plen)
	out = append(out, p[off:off+local]...)

	if local == plen {
		return out, nil
	}
	// 跟着 overflow 链读完剩余部分
	if off+local+4 > len(p) {
		return nil, fmt.Errorf("%w: overflow 指针越界", ErrCorrupt)
	}
	next := binary.BigEndian.Uint32(p[off+local : off+local+4])
	remaining := plen - local
	for hops := 0; remaining > 0; hops++ {
		if hops > maxOverflow {
			return nil, fmt.Errorf("%w: overflow 链过长(>%d 页)", ErrCorrupt, maxOverflow)
		}
		if next == 0 {
			return nil, fmt.Errorf("%w: overflow 链提前结束, 还缺 %d 字节", ErrCorrupt, remaining)
		}
		op, err := db.page(next)
		if err != nil {
			return nil, err
		}
		// overflow 页: 前 4 字节是下一页号, 后面是数据
		chunk := U - 4
		if chunk <= 0 || chunk > len(op)-4 {
			return nil, fmt.Errorf("%w: overflow 页 %d 可用容量异常", ErrCorrupt, next)
		}
		n := remaining
		if n > chunk {
			n = chunk
		}
		out = append(out, op[4:4+n]...)
		remaining -= n
		next = binary.BigEndian.Uint32(op[0:4])
	}
	return out, nil
}

// parseRecord 解析一条 record(header + body)。
func (db *DB) parseRecord(payload []byte) ([]Value, error) {
	if len(payload) == 0 {
		return nil, nil
	}
	hsize, n, ok := readVarint(payload, 0)
	if !ok {
		return nil, fmt.Errorf("%w: record 头长度越界", ErrCorrupt)
	}
	if hsize < uint64(n) || hsize > uint64(len(payload)) {
		return nil, fmt.Errorf("%w: record 头长度 %d 非法(总长 %d)", ErrCorrupt, hsize, len(payload))
	}
	// 先收集所有 serial type
	var serials []uint64
	pos := n
	for pos < int(hsize) {
		st, sn, ok := readVarint(payload, pos)
		if !ok {
			return nil, fmt.Errorf("%w: serial type 越界", ErrCorrupt)
		}
		serials = append(serials, st)
		pos += sn
	}
	// 再按 serial type 取 body
	body := int(hsize)
	cols := make([]Value, 0, len(serials))
	for _, st := range serials {
		v, used, err := db.decodeValue(st, payload, body)
		if err != nil {
			return nil, err
		}
		body += used
		cols = append(cols, v)
	}
	return cols, nil
}

// decodeValue 按 serial type 解出一个列值, 返回占用字节数。
func (db *DB) decodeValue(st uint64, p []byte, off int) (Value, int, error) {
	sizeOf := func(n int) ([]byte, int, error) {
		if off+n > len(p) {
			return nil, 0, fmt.Errorf("%w: 列数据越界(需要 %d, 剩余 %d)", ErrCorrupt, n, len(p)-off)
		}
		return p[off : off+n], n, nil
	}
	switch {
	case st == 0:
		return Value{Kind: 'n'}, 0, nil
	case st >= 1 && st <= 6:
		sizes := []int{1, 2, 3, 4, 6, 8}
		n := sizes[st-1]
		b, used, err := sizeOf(n)
		if err != nil {
			return Value{}, 0, err
		}
		var v int64
		for _, c := range b {
			v = v<<8 | int64(c)
		}
		// 符号扩展
		shift := uint(64 - 8*n)
		v = v << shift >> shift
		return Value{Kind: 'i', Int: v}, used, nil
	case st == 7:
		b, used, err := sizeOf(8)
		if err != nil {
			return Value{}, 0, err
		}
		bits := binary.BigEndian.Uint64(b)
		return Value{Kind: 'f', Float: math.Float64frombits(bits)}, used, nil
	case st == 8:
		return Value{Kind: 'i', Int: 0}, 0, nil
	case st == 9:
		return Value{Kind: 'i', Int: 1}, 0, nil
	case st >= 12:
		n := int((st - 12) / 2)
		b, used, err := sizeOf(n)
		if err != nil {
			return Value{}, 0, err
		}
		if st%2 == 0 {
			blob := make([]byte, n)
			copy(blob, b)
			return Value{Kind: 'b', Blob: blob}, used, nil
		}
		return Value{Kind: 't', Text: db.decodeText(b)}, used, nil
	default:
		return Value{}, 0, fmt.Errorf("%w: serial type %d", ErrCorrupt, st)
	}
}

// decodeText 按库编码把字节解成 UTF-8 字符串。
func (db *DB) decodeText(b []byte) string {
	switch db.encoding {
	case 2, 3: // UTF-16 LE / BE
		if len(b)%2 != 0 {
			b = b[:len(b)-1]
		}
		u := make([]uint16, 0, len(b)/2)
		for i := 0; i+2 <= len(b); i += 2 {
			if db.encoding == 2 {
				u = append(u, binary.LittleEndian.Uint16(b[i:i+2]))
			} else {
				u = append(u, binary.BigEndian.Uint16(b[i:i+2]))
			}
		}
		return string(utf16.Decode(u))
	default:
		return string(b)
	}
}

// readVarint 读 SQLite 变长整数(最多 9 字节, 第 9 字节占 8 位)。
func readVarint(b []byte, off int) (uint64, int, bool) {
	var v uint64
	for i := 0; i < 9; i++ {
		if off+i >= len(b) {
			return 0, 0, false
		}
		c := b[off+i]
		if i == 8 {
			v = (v << 8) | uint64(c)
			return v, 9, true
		}
		v = (v << 7) | uint64(c&0x7F)
		if c < 0x80 {
			return v, i + 1, true
		}
	}
	return v, 9, true
}

// float64FromBits 避免 import math 的重复包装(保持本文件依赖最小)
