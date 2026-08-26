package core

import (
	"archive/tar"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// mkTestTarball 构造一个含 bin/hello 的小 tar.gz。
func mkTestTarball(t *testing.T, path string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)

	// bin/hello 文件
	content := []byte("#!/bin/sh\necho hello-from-env\n")
	_ = tw.WriteHeader(&tar.Header{
		Name: "node-v22/bin/node", Mode: 0o755, Size: int64(len(content)),
	})
	tw.Write(content)
	// 顶层目录其他文件
	other := []byte("README")
	_ = tw.WriteHeader(&tar.Header{Name: "node-v22/README", Mode: 0o644, Size: int64(len(other))})
	tw.Write(other)

	tw.Close()
	gz.Close()
}

func TestExtractTarGz(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "pkg.tar.gz")
	mkTestTarball(t, src)

	dest := filepath.Join(dir, "extracted")
	if err := extractTarGz(src, dest); err != nil {
		t.Fatalf("extract: %v", err)
	}
	b, err := os.ReadFile(filepath.Join(dest, "node-v22/bin/node"))
	if err != nil {
		t.Fatalf("解压缺失 node 文件: %v", err)
	}
	if string(b) != "#!/bin/sh\necho hello-from-env\n" {
		t.Fatalf("内容不符: %q", string(b))
	}
}

func TestDiscoverBinDir(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "node-v22/bin"), 0o755)
	os.MkdirAll(filepath.Join(dir, "node-v22/lib"), 0o755)

	got := discoverBinDir(dir)
	want := filepath.Join(dir, "node-v22/bin")
	if got != want {
		t.Fatalf("discoverBinDir=%q 期望 %q", got, want)
	}
}

func TestEnvManagerInstallFlow(t *testing.T) {
	ns := newMockNS()
	root := t.TempDir()
	m := NewEnvManager(root, ns)

	// 模拟下载器: 直接生成 tar.gz
	downloader := func(url, dest string) error {
		mkTestTarball(t, dest)
		return nil
	}

	id, err := m.Install("node", "22.0.0", downloader)
	if err != nil {
		t.Fatalf("install: %v", err)
	}

	// 等异步完成
	for i := 0; i < 100; i++ {
		task, ok := m.TaskStatus(id)
		if ok && task.Status == "done" {
			break
		}
		sleepMs(50)
	}
	task, ok := m.TaskStatus(id)
	if !ok {
		t.Fatal("task 不存在")
	}
	if task.Status != "done" {
		t.Fatalf("任务未完成: %s %s", task.Status, task.Error)
	}

	// 运行时已登记
	rt, ok := m.Get("node-22.0.0")
	if !ok {
		t.Fatal("运行时未登记")
	}
	if rt.BinPath == "" {
		t.Fatal("BinPath 为空")
	}

	// EnvRunPrefix 提供 PATH
	env, ok := m.EnvRunPrefix("node-22.0.0")
	if !ok || env["PATH"] == "" {
		t.Fatalf("EnvRunPrefix 失败: %v", env)
	}
}

func TestEnvManagerUninstall(t *testing.T) {
	ns := newMockNS()
	root := t.TempDir()
	m := NewEnvManager(root, ns)

	// 手动登记一个
	m.mu.Lock()
	m.envs["python-3.11"] = &EnvRuntime{
		Name: "python-3.11", Type: "python", Version: "3.11",
		Path: filepath.Join(root, "python-3.11"),
	}
	m.mu.Unlock()

	if err := m.Uninstall("python-3.11"); err != nil {
		t.Fatalf("uninstall: %v", err)
	}
	if _, ok := m.Get("python-3.11"); ok {
		t.Fatal("卸载后应不存在")
	}
	if err := m.Uninstall("not-exist"); err == nil {
		t.Fatal("卸载不存在时应报错")
	}
}

func sleepMs(n int) {
	time.Sleep(time.Duration(n) * time.Millisecond)
}