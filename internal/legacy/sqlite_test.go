package legacy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 这些测试用真实 SQLite 产出的文件做对拍:
//   testdata/legacy_fixture.db        正常库(已 checkpoint, 含 interior 页 + overflow 值)
//   testdata/wal_only.db (+ -wal)     主库只有 1 页, 全部数据只在 WAL 里
//   testdata/legacy_fixture.expect.json  用 Python sqlite3 读出的期望值(golden)
//
// 为什么用真实库而不是手搓二进制: 手搓只能验证"我按规范写的解析器能读我自己写的文件",
// 验证不了 SQLite 实际产出的页布局(interior 分裂点、overflow 阈值、varint 边界)。
// 这两个 fixture 由 SQLite 3.53 生成。

func fixturePath(name string) string {
	return filepath.Join("testdata", name)
}

// loadExpect 读 golden 期望值
func loadExpect(t *testing.T) map[string][][2]string {
	t.Helper()
	raw, err := os.ReadFile(fixturePath("legacy_fixture.expect.json"))
	if err != nil {
		t.Fatalf("读期望值失败: %v", err)
	}
	var m map[string][][]string
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("解析期望值失败: %v", err)
	}
	out := map[string][][2]string{}
	for table, rows := range m {
		for _, r := range rows {
			if len(r) < 2 {
				continue
			}
			out[table] = append(out[table], [2]string{r[0], r[1]})
		}
	}
	return out
}

// readTable 用本包的读取器读一张表, 返回 key→value 映射
func readTable(t *testing.T, db *DB, table string) map[string]string {
	t.Helper()
	tables, err := db.Tables()
	if err != nil {
		t.Fatalf("Tables: %v", err)
	}
	root, ok := tables[table]
	if !ok {
		t.Fatalf("表 %s 不存在(找到: %v)", table, keysOf(tables))
	}
	rows, err := db.TableRows(root)
	if err != nil {
		t.Fatalf("TableRows(%s): %v", table, err)
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		if len(r.Cols) < 2 {
			t.Fatalf("表 %s 的行列数不足: %d", table, len(r.Cols))
		}
		out[r.Cols[0].AsString()] = r.Cols[1].AsString()
	}
	return out
}

func keysOf(m map[string]uint32) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// compareWithExpect 逐表逐键比对
func compareWithExpect(t *testing.T, db *DB, expect map[string][][2]string) {
	t.Helper()
	total := 0
	for table, want := range expect {
		got := readTable(t, db, table)
		if len(got) != len(want) {
			t.Errorf("%s: 行数 %d, 期望 %d", table, len(got), len(want))
		}
		for _, kv := range want {
			k, wantV := kv[0], kv[1]
			gotV, ok := got[k]
			if !ok {
				t.Errorf("%s: 缺少键 %q", table, k)
				continue
			}
			if gotV != wantV {
				g := gotV
				w := wantV
				if len(g) > 120 {
					g = g[:120] + "…"
				}
				if len(w) > 120 {
					w = w[:120] + "…"
				}
				t.Errorf("%s[%s]: 值不一致\n  得到: %q\n  期望: %q", table, k, g, w)
			}
			total++
		}
	}
	t.Logf("对拍通过: %d 个键值", total)
}

// TestRead_MatchesSQLite 正常库(已 checkpoint)应逐字节读出一致内容
func TestRead_MatchesSQLite(t *testing.T) {
	db, err := OpenDB(fixturePath("legacy_fixture.db"))
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	defer db.Close()

	if db.PageSize() != 4096 {
		t.Fatalf("pageSize=%d want 4096", db.PageSize())
	}
	if db.Encoding() != 1 {
		t.Fatalf("encoding=%d want 1(UTF-8)", db.Encoding())
	}
	compareWithExpect(t, db, loadExpect(t))
}

// TestRead_WALOnly 数据只在 WAL 里时, 也必须读出来(旧面板正是 WAL 模式)
func TestRead_WALOnly(t *testing.T) {
	db, err := OpenDB(fixturePath("wal_only.db"))
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	defer db.Close()

	// 主库只有 1 页(仅文件头 + sqlite_master), 不读 WAL 会一张业务表都找不到
	if w := db.WALWarning(); w != nil {
		t.Logf("WAL 提示: %v", w)
	}
	got := readTable(t, db, "ns_core_terminal_kv")
	if len(got) != 3 {
		t.Fatalf("terminal 应有 3 行(2 行主库 + 1 行仅 WAL), 实得 %d: %v", len(got), got)
	}
	want, ok := got["wal_only_key"]
	if !ok {
		t.Fatalf("未读到只存在于 WAL 的键 wal_only_key")
	}
	if !strings.Contains(want, "only_in_wal") {
		t.Fatalf("WAL 键的值不对: %q", want)
	}
	compareWithExpect(t, db, loadExpect(t))
}

// TestRead_InteriorPages 600 行会把表撑成多层 b-tree, 必须全读到(不能只读首页)
func TestRead_InteriorPages(t *testing.T) {
	db, err := OpenDB(fixturePath("legacy_fixture.db"))
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	defer db.Close()

	got := readTable(t, db, "ns_core_registry_kv")
	if len(got) != 600 {
		t.Fatalf("registry 应有 600 行, 实得 %d", len(got))
	}
	// 抽查首尾, 确认不是"读了但读串了"
	for _, k := range []string{"iface:test.iface0", "iface:test.iface599"} {
		if _, ok := got[k]; !ok {
			t.Fatalf("缺少 %q", k)
		}
	}
}

// TestRead_OverflowPayload 300KB 的单值必须跨 overflow 页完整读出
func TestRead_OverflowPayload(t *testing.T) {
	db, err := OpenDB(fixturePath("legacy_fixture.db"))
	if err != nil {
		t.Fatalf("OpenDB: %v", err)
	}
	defer db.Close()

	got := readTable(t, db, "ns_uptime_kv")
	v, ok := got["uptime:targets"]
	if !ok {
		t.Fatalf("缺少 uptime:targets")
	}
	if len(v) < 300000 {
		t.Fatalf("overflow 值长度 %d, 期望 >300000(说明溢出页没读全)", len(v))
	}
	// 必须仍是合法 JSON(拼页时最容易在边界处错位)
	// 注意: 不要用字符串 contains 断言 JSON —— 生成端(json.dumps)在冒号后有空格, 会误判
	var probe struct {
		Blob string `json:"blob"`
		Tag  string `json:"tag"`
	}
	if err := json.Unmarshal([]byte(v), &probe); err != nil {
		t.Fatalf("拼出的 overflow 值不是合法 JSON: %v(尾部 %q)", err, tail(v, 80))
	}
	if len(probe.Blob) != 300000 || probe.Tag != "overflow-test" {
		t.Fatalf("overflow 内容错位: blob=%d tag=%q", len(probe.Blob), probe.Tag)
	}
}

func tail(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// TestOpenDB_rejectsNonSQLite 非 SQLite 文件应明确报错(而不是读出垃圾)
func TestOpenDB_rejectsNonSQLite(t *testing.T) {
	p := filepath.Join(t.TempDir(), "not.db")
	if err := os.WriteFile(p, []byte("this is definitely not a sqlite database file at all"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenDB(p); err == nil {
		t.Fatalf("应报错")
	}
}

// TestOpenDB_missing 文件不存在
func TestOpenDB_missing(t *testing.T) {
	if _, err := OpenDB(filepath.Join(t.TempDir(), "nope.db")); err == nil {
		t.Fatalf("应报错")
	}
}

// TestReadVarint varint 边界: 1 字节 / 2 字节 / 9 字节满位
func TestReadVarint(t *testing.T) {
	cases := []struct {
		in   []byte
		want uint64
		n    int
	}{
		{[]byte{0x00}, 0, 1},
		{[]byte{0x7f}, 127, 1},
		{[]byte{0x81, 0x00}, 128, 2},
		{[]byte{0x82, 0x21}, 289, 2},
		{[]byte{0xFF, 0x7F}, 16383, 2},
		{[]byte{0x81, 0x80, 0x00}, 16384, 3},
		// 9 字节: 前 8 字节各 7 位, 第 9 字节 8 位
		{[]byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}, 0xFFFFFFFFFFFFFFFF, 9},
	}
	for _, c := range cases {
		got, n, ok := readVarint(c.in, 0)
		if !ok || got != c.want || n != c.n {
			t.Errorf("readVarint(%v) = (%d,%d,%v), want (%d,%d,true)", c.in, got, n, ok, c.want, c.n)
		}
	}
	// 越界应返回 false 而不是 panic
	if _, _, ok := readVarint([]byte{0x81}, 0); ok {
		t.Errorf("截断的 varint 应返回 !ok")
	}
}

// TestValue_kinds 各类型列值转换
func TestValue_kinds(t *testing.T) {
	if (Value{Kind: 'n'}).AsString() != "" {
		t.Errorf("NULL 应为空串")
	}
	if got := (Value{Kind: 'i', Int: -42}).AsString(); got != "-42" {
		t.Errorf("整数转字符串 = %q", got)
	}
	if got := (Value{Kind: 't', Text: "中文"}).AsString(); got != "中文" {
		t.Errorf("文本 = %q", got)
	}
	if n, ok := (Value{Kind: 'i', Int: 7}).AsInt(); !ok || n != 7 {
		t.Errorf("AsInt 整数失败: %d %v", n, ok)
	}
	if _, ok := (Value{Kind: 't', Text: "x"}).AsInt(); ok {
		t.Errorf("文本不应转成整数")
	}
}
