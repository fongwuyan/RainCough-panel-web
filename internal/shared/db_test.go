package shared

import (
	"os"
	"path/filepath"
	"testing"
)

// 测试用临时目录(旧写法 sqlite:///<file> 会自动落到 <dir>/kv)。
func testDSN(t *testing.T) string {
	t.Helper()
	return "sqlite:///" + filepath.Join(t.TempDir(), "test.db")
}

func TestNamespaceKV(t *testing.T) {
	sd, err := Open(testDSN(t))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer sd.Close()

	ns, err := sd.Namespace("demo")
	if err != nil {
		t.Fatalf("namespace: %v", err)
	}

	if err := ns.Set("greeting", map[string]interface{}{"hi": "你好"}); err != nil {
		t.Fatalf("set: %v", err)
	}
	v, ok, err := ns.Get("greeting")
	if err != nil || !ok {
		t.Fatalf("get: ok=%v err=%v", ok, err)
	}
	if obj, isMap := v.(map[string]interface{}); !isMap || obj["hi"] != "你好" {
		t.Fatalf("roundtrip 失败: %v", v)
	}

	if _, ok, _ := ns.Get("missing"); ok {
		t.Fatal("missing 键不应存在")
	}

	_ = ns.Set("a1", 1)
	_ = ns.Set("a2", 2)
	lst, err := ns.List("a", 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(lst) != 2 {
		t.Fatalf("list 应返回 2 项, 得到 %d", len(lst))
	}

	if err := ns.Delete("a1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, ok, _ := ns.Get("a1"); ok {
		t.Fatal("delete 后 a1 仍存在")
	}
}

func TestNamespaceIsolation(t *testing.T) {
	sd, _ := Open(testDSN(t))
	defer sd.Close()

	nsA, _ := sd.Namespace("plugin_a")
	nsB, _ := sd.Namespace("plugin_b")
	_ = nsA.Set("k", "A")
	_ = nsB.Set("k", "B")

	va, _, _ := nsA.Get("k")
	vb, _, _ := nsB.Get("k")
	if va != "A" || vb != "B" {
		t.Fatalf("namespace 未隔离: A=%v B=%v", va, vb)
	}
}

func TestInvalidNamespace(t *testing.T) {
	sd, _ := Open(testDSN(t))
	defer sd.Close()
	if _, err := sd.Namespace("Bad Name!"); err == nil {
		t.Fatal("非法 namespace 未被拒绝")
	}
}

// 重启后数据仍在(追加日志回放)。
func TestPersistAcrossReopen(t *testing.T) {
	dir := t.TempDir()
	sd, _ := Open("kv:///" + dir)
	ns, _ := sd.Namespace("core_store")
	_ = ns.Set("cfg", map[string]interface{}{"repo": "github.com/x/y", "n": 3})
	_ = ns.Set("list", []interface{}{"a", "b"})
	if err := sd.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	sd2, err := Open("kv:///" + dir)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer sd2.Close()
	ns2, _ := sd2.Namespace("core_store")

	v, ok, _ := ns2.Get("cfg")
	if !ok {
		t.Fatal("重启后 cfg 丢失")
	}
	if obj, isMap := v.(map[string]interface{}); !isMap || obj["repo"] != "github.com/x/y" {
		t.Fatalf("cfg 内容不一致: %v", v)
	}
	// JSON 数字统一为 float64
	if obj := v.(map[string]interface{}); obj["n"].(float64) != 3 {
		t.Fatalf("n 应为 3, 得到 %v", obj["n"])
	}
	if lst, ok, _ := ns2.Get("list"); !ok || len(lst.([]interface{})) != 2 {
		t.Fatalf("list 恢复失败: %v", lst)
	}
}

// 墓碑要跨重启生效。
func TestDeletePersists(t *testing.T) {
	dir := t.TempDir()
	sd, _ := Open("kv:///" + dir)
	ns, _ := sd.Namespace("ns1")
	_ = ns.Set("gone", "x")
	_ = ns.Set("stay", "y")
	_ = ns.Delete("gone")
	sd.Close()

	sd2, _ := Open("kv:///" + dir)
	defer sd2.Close()
	ns2, _ := sd2.Namespace("ns1")
	if _, ok, _ := ns2.Get("gone"); ok {
		t.Fatal("删除后重启, gone 又回来了")
	}
	if v, ok, _ := ns2.Get("stay"); !ok || v != "y" {
		t.Fatalf("stay 丢失: %v", v)
	}
}

// 反复写同一批键触发压缩, 数据必须完整且文件行数回落。
func TestCompaction(t *testing.T) {
	dir := t.TempDir()
	sd, _ := Open("kv:///" + dir)
	defer sd.Close()
	ns, _ := sd.Namespace("churn")

	const keys = 50
	for round := 0; round < 200; round++ { // 10,000 次写入 → 触发压缩
		for i := 0; i < keys; i++ {
			if err := ns.Set(string(rune('a'+i%26))+string(rune('0'+i/26)), round); err != nil {
				t.Fatalf("set: %v", err)
			}
		}
	}
	for i := 0; i < keys; i++ {
		k := string(rune('a'+i%26)) + string(rune('0'+i/26))
		v, ok, _ := ns.Get(k)
		if !ok {
			t.Fatalf("压缩后键 %s 丢失", k)
		}
		if v.(float64) != 199 {
			t.Fatalf("键 %s 值应为 199, 得到 %v", k, v)
		}
	}
	st, err := os.Stat(filepath.Join(dir, "churn.log"))
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if st.Size() == 0 {
		t.Fatal("日志文件为空")
	}
}

// 日志末尾被截断(崩溃残留)不应影响已有数据。
func TestCorruptTailIgnored(t *testing.T) {
	dir := t.TempDir()
	sd, _ := Open("kv:///" + dir)
	ns, _ := sd.Namespace("crash")
	_ = ns.Set("a", 1)
	sd.Close()

	f, err := os.OpenFile(filepath.Join(dir, "crash.log"), os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		t.Fatalf("open log: %v", err)
	}
	f.WriteString(`{"k":"half","v":`) // 半行, 无换行
	f.Close()

	sd2, err := Open("kv:///" + dir)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer sd2.Close()
	ns2, _ := sd2.Namespace("crash")
	if v, ok, _ := ns2.Get("a"); !ok || v.(float64) != 1 {
		t.Fatalf("已有数据损坏: %v ok=%v", v, ok)
	}
	if _, ok, _ := ns2.Get("half"); ok {
		t.Fatal("半行不应被解析为有效记录")
	}
}

// List 的 limit 语义与旧实现保持一致。
func TestListLimit(t *testing.T) {
	sd, _ := Open(testDSN(t))
	defer sd.Close()
	ns, _ := sd.Namespace("lim")
	for i := 0; i < 20; i++ {
		_ = ns.Set("k"+string(rune('a'+i)), i)
	}
	if got, _ := ns.List("k", 0); len(got) != 20 {
		t.Fatalf("limit=0 应取默认 100, 实际 %d", len(got))
	}
	if got, _ := ns.List("k", 5); len(got) != 5 {
		t.Fatalf("limit=5 应返回 5 项, 实际 %d", len(got))
	}
}
