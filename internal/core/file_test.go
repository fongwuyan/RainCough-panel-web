package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestListDirSorting(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("b"), 0o644)
	os.MkdirAll(filepath.Join(dir, "adir"), 0o755)
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("a"), 0o644)

	entries, err := ListDir(dir)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("期望 3 项, 得到 %d", len(entries))
	}
	// 目录优先
	if !entries[0].IsDir || entries[0].Name != "adir" {
		t.Fatalf("目录应排最前: %v", entries[0])
	}
	// 再按名称
	if entries[1].Name != "a.txt" || entries[2].Name != "b.txt" {
		t.Fatalf("排序错误: %v %v", entries[1].Name, entries[2].Name)
	}
}

func TestSaveReadText(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "test.txt")

	if err := SaveFileText(p, []byte("你好 RainCough"), SaveLimitMax); err != nil {
		t.Fatalf("save: %v", err)
	}
	content, tooBig, err := ReadFileText(p, ReadLimitMax)
	if err != nil || tooBig {
		t.Fatalf("read: err=%v tooBig=%v", err, tooBig)
	}
	if content != "你好 RainCough" {
		t.Fatalf("roundtrip 失败: %q", content)
	}

	// 超限保护
	if err := SaveFileText(p, make([]byte, SaveLimitMax+1), SaveLimitMax); err == nil {
		t.Fatal("超限写入应被拒绝")
	}
	if _, tooBig, _ := ReadFileText(p, 10); !tooBig {
		t.Fatal("超限读取应标记 tooBig")
	}
}

func TestMkdirRenameDelete(t *testing.T) {
	dir := t.TempDir()
	sub := filepath.Join(dir, "a/b/c")
	if err := Mkdir(sub); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if _, err := os.Stat(sub); err != nil {
		t.Fatalf("mkdir 未生效: %v", err)
	}

	oldP := filepath.Join(sub, "old.txt")
	os.WriteFile(oldP, []byte("x"), 0o644)
	newP := filepath.Join(sub, "new.txt")
	if err := Rename(oldP, newP); err != nil {
		t.Fatalf("rename: %v", err)
	}
	if _, err := os.Stat(oldP); !os.IsNotExist(err) {
		t.Fatal("rename 后旧文件应不存在")
	}

	if err := Delete(dir); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("delete 未生效")
	}
}

func TestCopyFileDir(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "src")
	os.MkdirAll(filepath.Join(src, "nested"), 0o755)
	os.WriteFile(filepath.Join(src, "a.txt"), []byte("hello"), 0o644)
	os.WriteFile(filepath.Join(src, "nested", "b.txt"), []byte("world"), 0o644)

	dst := filepath.Join(dir, "dst")
	if err := Copy(src, dst); err != nil {
		t.Fatalf("copy dir: %v", err)
	}
	b, _ := os.ReadFile(filepath.Join(dst, "nested", "b.txt"))
	if string(b) != "world" {
		t.Fatalf("嵌套复制失败: %q", string(b))
	}
}

func TestSafeJoinGuard(t *testing.T) {
	base := "/opt/touchgal/data"
	for _, bad := range []string{"../etc/passwd", "/etc/passwd", "a/../../b", "..\\win"} {
		if _, err := SafeJoin(base, bad); err == nil {
			t.Fatalf("路径穿越未被拦截: %q", bad)
		}
	}
	p, err := SafeJoin(base, "plugins/x.json")
	if err != nil || !strings.HasPrefix(p, base) {
		t.Fatalf("合法路径失败: %v %v", p, err)
	}
}

func TestDirSizeAndHash(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hello"), 0o644)
	os.MkdirAll(filepath.Join(dir, "sub"), 0o755)
	os.WriteFile(filepath.Join(dir, "sub", "b.txt"), []byte("world"), 0o644)

	sz, err := DirSize(dir)
	if err != nil || sz != 10 {
		t.Fatalf("DirSize: %d err=%v", sz, err)
	}
	h, err := FileHash(filepath.Join(dir, "a.txt"))
	if err != nil || h != "5d41402abc4b2a76b9719d911017c592" {
		t.Fatalf("MD5 错误: %s err=%v", h, err)
	}
}

func TestPreviewType(t *testing.T) {
	cases := map[string]string{
		"a.jpg": "image", "b.PNG": "image", "c.mp4": "video",
		"d.mp3": "audio", "e.pdf": "pdf", "f.txt": "text", "g": "text",
	}
	for name, want := range cases {
		if got := PreviewType(name); got != want {
			t.Fatalf("PreviewType(%q)=%q 期望 %q", name, got, want)
		}
	}
}
