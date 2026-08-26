package shared

import (
	"path/filepath"
	"testing"
)

// 测试用临时 sqlite 库。
func testDSN(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	return "sqlite:///" + filepath.Join(dir, "test.db")
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

	// 写入/读取
	if err := ns.Set("greeting", map[string]interface{}{"hi": "你好"}); err != nil {
		t.Fatalf("set: %v", err)
	}
	v, ok, err := ns.Get("greeting")
	if err != nil || !ok {
		t.Fatalf("get: ok=%v err=%v", ok, err)
	}
	obj := v.(map[string]interface{})
	if obj["hi"] != "你好" {
		t.Fatalf("roundtrip 失败: %v", v)
	}

	// 不存在
	if _, ok, _ := ns.Get("missing"); ok {
		t.Fatal("missing 键不应存在")
	}

	// 列表
	_ = ns.Set("a1", 1)
	_ = ns.Set("a2", 2)
	lst, err := ns.List("a", 10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(lst) != 2 {
		t.Fatalf("list 应返回 2 项, 得到 %d", len(lst))
	}

	// 删除
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

func TestExecScopeGuard(t *testing.T) {
	sd, _ := Open(testDSN(t))
	defer sd.Close()

	ns, _ := sd.Namespace("demo")
	// 越权表: 访问其他 namespace 的表应被拒绝
	_, _, err := ns.Exec("SELECT * FROM ns_other_kv")
	if err == nil {
		t.Fatal("越权表访问未被拒绝")
	}

	// 合法: 本 namespace 表(先建表)
	_, _, err = ns.Exec("CREATE TABLE IF NOT EXISTS ns_demo_items (id INTEGER PRIMARY KEY, name TEXT)")
	if err != nil {
		t.Fatalf("建表失败: %v", err)
	}
	_, n, err := ns.Exec("INSERT INTO ns_demo_items (name) VALUES (?)", "x")
	if err != nil || n != 1 {
		t.Fatalf("insert: n=%d err=%v", n, err)
	}
	rows, _, err := ns.Exec("SELECT * FROM ns_demo_items")
	if err != nil || len(rows) != 1 {
		t.Fatalf("select: rows=%d err=%v", len(rows), err)
	}
}

func TestInvalidNamespace(t *testing.T) {
	sd, _ := Open(testDSN(t))
	defer sd.Close()
	if _, err := sd.Namespace("Bad Name!"); err == nil {
		t.Fatal("非法 namespace 未被拒绝")
	}
}