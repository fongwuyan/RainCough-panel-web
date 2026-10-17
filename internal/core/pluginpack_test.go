package core

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// ---- 测试辅助: 造插件包 ----

const validManifest = `{
  "name": "demo",
  "label": "演示插件",
  "version": "1.2.3",
  "description": "测试用",
  "author": "tester",
  "frontend": { "entry": "plugin.js", "pages": [] },
  "backend": { "lang": "go", "exec": ["./demo"] },
  "interfaces": []
}`

// makeZip 造 zip; files 的 key 是包内路径
func makeZip(t *testing.T, files map[string]string, modes map[string]os.FileMode) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "pack.zip")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	zw := zip.NewWriter(f)
	for name, content := range files {
		hdr := &zip.FileHeader{Name: name, Method: zip.Deflate}
		if m, ok := modes[name]; ok {
			hdr.SetMode(m)
		} else {
			hdr.SetMode(0o644)
		}
		w, err := zw.CreateHeader(hdr)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	f.Close()
	return p
}

// makeTarGz 造 tar.gz
func makeTarGz(t *testing.T, files map[string]string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "pack.tar.gz")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	for name, content := range files {
		hdr := &tar.Header{Name: name, Mode: 0o755, Size: int64(len(content))}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	tw.Close()
	gz.Close()
	f.Close()
	return p
}

// copyTo 把包拷到一个新路径(InstallFromPackage 会移走传入的文件)
func copyTo(t *testing.T, src, name string) string {
	t.Helper()
	dst := filepath.Join(t.TempDir(), name)
	if err := copyFile(src, dst); err != nil {
		t.Fatal(err)
	}
	return dst
}

// ---- 用例 ----

// TestInstallFromPackage_flatZip 扁平结构(zip 根目录就有 plugin.json)
func TestInstallFromPackage_flatZip(t *testing.T) {
	pluginsDir := t.TempDir()
	pack := makeZip(t, map[string]string{
		"plugin.json":  validManifest,
		"plugin.js":    "export default {}",
		"demo":         "#!/bin/sh\necho hi\n",
		"assets/a.css": "body{}",
	}, map[string]os.FileMode{"demo": 0o755})

	info, err := InstallFromPackage(copyTo(t, pack, "demo.zip"), "demo.zip", pluginsDir)
	if err != nil {
		t.Fatalf("InstallFromPackage: %v", err)
	}
	if info.Name != "demo" {
		t.Fatalf("name=%q want demo", info.Name)
	}
	if info.Version != "1.2.3" {
		t.Fatalf("version=%q", info.Version)
	}
	if info.Label != "演示插件" {
		t.Fatalf("label=%q", info.Label)
	}
	if info.Replaced {
		t.Fatalf("首次安装不应标记 replaced")
	}
	if info.Files != 4 {
		t.Fatalf("files=%d want 4", info.Files)
	}
	// 文件应落盘
	for _, rel := range []string{"plugin.json", "plugin.js", "demo", "assets/a.css"} {
		if _, err := os.Stat(filepath.Join(pluginsDir, "demo", rel)); err != nil {
			t.Fatalf("缺少 %s: %v", rel, err)
		}
	}
	// 后端二进制应有执行位(即使 zip 里没带)
	// ★ 只在非 Windows 断言: Windows 的 os.Chmod 只支持切换只读位, 没有 Unix 执行位概念,
	//   这里的断言在 Windows 上必然失败(不是代码问题, 是平台差异)。Linux 部署才是真实场景。
	if runtime.GOOS != "windows" {
		st, _ := os.Stat(filepath.Join(pluginsDir, "demo", "demo"))
		if st.Mode()&0o111 == 0 {
			t.Fatalf("后端二进制应补上执行位, 实得 %v", st.Mode())
		}
	}
	// 临时目录应被清掉
	ents, _ := os.ReadDir(pluginsDir)
	for _, e := range ents {
		if strings.HasPrefix(e.Name(), pluginPackTempPrefix) {
			t.Fatalf("临时目录未清理: %s", e.Name())
		}
	}
}

// TestInstallFromPackage_nestedTarGz 套一层目录的 tar.gz
func TestInstallFromPackage_nestedTarGz(t *testing.T) {
	pluginsDir := t.TempDir()
	pack := makeTarGz(t, map[string]string{
		"demo-1.2.3/plugin.json": validManifest,
		"demo-1.2.3/plugin.js":   "x",
		"demo-1.2.3/demo":        "bin",
	})

	info, err := InstallFromPackage(copyTo(t, pack, "demo.tar.gz"), "demo.tar.gz", pluginsDir)
	if err != nil {
		t.Fatalf("InstallFromPackage: %v", err)
	}
	if info.Name != "demo" {
		t.Fatalf("name=%q", info.Name)
	}
	if _, err := os.Stat(filepath.Join(pluginsDir, "demo", "plugin.json")); err != nil {
		t.Fatalf("应解到 demo/ 下(去掉外层目录), 实得: %v", err)
	}
	// 不应出现 demo-1.2.3 这种外层目录
	if _, err := os.Stat(filepath.Join(pluginsDir, "demo", "demo-1.2.3")); err == nil {
		t.Fatalf("不应保留外层目录")
	}
}

// TestInstallFromPackage_nameFromManifestNotFilename
// 安装目录必须取 plugin.json 的 name, 而不是压缩包文件名
// (旧版系统扩展踩过: 包名与清单 name 不一致 → 错位安装, 既打不开也卸不掉)
func TestInstallFromPackage_nameFromManifestNotFilename(t *testing.T) {
	pluginsDir := t.TempDir()
	pack := makeZip(t, map[string]string{
		"plugin.json": validManifest,
		"plugin.js":   "x",
		"demo":        "bin",
	}, nil)

	// 文件名故意叫别的
	info, err := InstallFromPackage(copyTo(t, pack, "totally-different-name.zip"),
		"totally-different-name.zip", pluginsDir)
	if err != nil {
		t.Fatalf("InstallFromPackage: %v", err)
	}
	if info.Name != "demo" {
		t.Fatalf("安装目录应取清单 name=demo, 实得 %q", info.Name)
	}
	if _, err := os.Stat(filepath.Join(pluginsDir, "demo")); err != nil {
		t.Fatalf("应在 demo/ 下: %v", err)
	}
	if _, err := os.Stat(filepath.Join(pluginsDir, "totally-different-name")); err == nil {
		t.Fatalf("不应按文件名建目录")
	}
}

// TestInstallFromPackage_overwrite 覆盖安装(更新)应标记 replaced 且旧文件被替换
func TestInstallFromPackage_overwrite(t *testing.T) {
	pluginsDir := t.TempDir()

	// 先装 v1
	p1 := makeZip(t, map[string]string{
		"plugin.json":  strings.Replace(validManifest, "1.2.3", "1.0.0", 1),
		"plugin.js":    "v1",
		"demo":         "bin-v1",
		"only-in-v1.txt": "old",
	}, nil)
	if _, err := InstallFromPackage(copyTo(t, p1, "d.zip"), "d.zip", pluginsDir); err != nil {
		t.Fatalf("首次安装: %v", err)
	}

	// 再装 v2(少了 only-in-v1.txt, 多了 only-in-v2.txt)
	p2 := makeZip(t, map[string]string{
		"plugin.json":    validManifest, // 1.2.3
		"plugin.js":      "v2",
		"demo":           "bin-v2",
		"only-in-v2.txt": "new",
	}, nil)
	info, err := InstallFromPackage(copyTo(t, p2, "d.zip"), "d.zip", pluginsDir)
	if err != nil {
		t.Fatalf("覆盖安装: %v", err)
	}
	if !info.Replaced {
		t.Fatalf("应标记 replaced=true")
	}
	if info.Version != "1.2.3" {
		t.Fatalf("version 应为新版本 1.2.3, 实得 %q", info.Version)
	}
	// 新文件在
	if _, err := os.Stat(filepath.Join(pluginsDir, "demo", "only-in-v2.txt")); err != nil {
		t.Fatalf("新版本文件缺失: %v", err)
	}
	// 旧文件不应残留(整目录替换, 不是合并)
	if _, err := os.Stat(filepath.Join(pluginsDir, "demo", "only-in-v1.txt")); err == nil {
		t.Fatalf("旧版本独有文件应被清掉(整目录替换)")
	}
	// 内容应更新
	b, _ := os.ReadFile(filepath.Join(pluginsDir, "demo", "plugin.js"))
	if string(b) != "v2" {
		t.Fatalf("plugin.js 内容应更新为 v2, 实得 %q", string(b))
	}
	// 备份目录应被清理(不无限膨胀)
	bakDir := filepath.Join(pluginsDir, pluginPackBackupDir)
	if ents, err := os.ReadDir(bakDir); err == nil {
		for _, e := range ents {
			if strings.HasPrefix(e.Name(), "demo-") {
				t.Fatalf("成功替换后应清理备份, 仍存在: %s", e.Name())
			}
		}
	}
}

// TestInstallFromPackage_noManifest 没有 plugin.json 应报错且不留垃圾
func TestInstallFromPackage_noManifest(t *testing.T) {
	pluginsDir := t.TempDir()
	pack := makeZip(t, map[string]string{"readme.md": "no manifest here"}, nil)

	_, err := InstallFromPackage(copyTo(t, pack, "bad.zip"), "bad.zip", pluginsDir)
	if err == nil {
		t.Fatalf("没有 plugin.json 应报错")
	}
	if !strings.Contains(err.Error(), "plugin.json") {
		t.Fatalf("错误信息应提到 plugin.json, 实得: %v", err)
	}
	assertNoLeftovers(t, pluginsDir)
}

// TestInstallFromPackage_multipleManifests 多个 plugin.json 应拒绝
func TestInstallFromPackage_multipleManifests(t *testing.T) {
	pluginsDir := t.TempDir()
	pack := makeZip(t, map[string]string{
		"a/plugin.json": validManifest,
		"b/plugin.json": strings.Replace(validManifest, `"demo"`, `"demo2"`, 1),
	}, nil)

	_, err := InstallFromPackage(copyTo(t, pack, "multi.zip"), "multi.zip", pluginsDir)
	if err == nil {
		t.Fatalf("多个 plugin.json 应报错")
	}
	if !strings.Contains(err.Error(), "只能装一个") {
		t.Fatalf("错误信息应说明一个包只能装一个插件, 实得: %v", err)
	}
	assertNoLeftovers(t, pluginsDir)
}

// TestInstallFromPackage_invalidManifest 非 v4 清单应拒绝
func TestInstallFromPackage_invalidManifest(t *testing.T) {
	cases := map[string]string{
		"缺 name":       `{"frontend":{"entry":"a.js"},"backend":{"exec":["x"]}}`,
		"缺 entry":      `{"name":"demo","frontend":{},"backend":{"exec":["x"]}}`,
		"缺 exec":       `{"name":"demo","frontend":{"entry":"a.js"},"backend":{}}`,
		"不是 JSON":      `not json at all`,
		"空文件":         ``,
	}
	for label, manifest := range cases {
		t.Run(label, func(t *testing.T) {
			pluginsDir := t.TempDir()
			pack := makeZip(t, map[string]string{"plugin.json": manifest}, nil)
			if _, err := InstallFromPackage(copyTo(t, pack, "x.zip"), "x.zip", pluginsDir); err == nil {
				t.Fatalf("清单 %s 应被拒绝", label)
			}
			assertNoLeftovers(t, pluginsDir)
		})
	}
}

// TestInstallFromPackage_evilName 清单 name 带路径穿越应拒绝(防删库级事故)
func TestInstallFromPackage_evilName(t *testing.T) {
	for _, evil := range []string{"../escape", "a/b", `a\b`, "..", ".", ""} {
		pluginsDir := t.TempDir()
		m := strings.Replace(validManifest, `"name": "demo"`, `"name": "`+evil+`"`, 1)
		pack := makeZip(t, map[string]string{"plugin.json": m}, nil)
		_, err := InstallFromPackage(copyTo(t, pack, "evil.zip"), "evil.zip", pluginsDir)
		if err == nil {
			t.Fatalf("name=%q 应被拒绝", evil)
		}
		assertNoLeftovers(t, pluginsDir)
	}
}

// TestInstallFromPackage_rejectsUnsupportedFormat 不支持的格式
func TestInstallFromPackage_rejectsUnsupportedFormat(t *testing.T) {
	pluginsDir := t.TempDir()
	p := filepath.Join(t.TempDir(), "x.rar")
	if err := os.WriteFile(p, []byte("Rar!"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := InstallFromPackage(p, "x.rar", pluginsDir); err == nil {
		t.Fatalf("rar 应被拒绝(零依赖只支持 zip/tar/tar.gz)")
	}
	assertNoLeftovers(t, pluginsDir)
}

// TestCleanupStaleInstalling 清理安装崩溃残留
func TestCleanupStaleInstalling(t *testing.T) {
	pluginsDir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(pluginsDir, pluginPackTempPrefix+"123"), 0o755)
	_ = os.MkdirAll(filepath.Join(pluginsDir, "real-plugin"), 0o755)

	n := CleanupStaleInstalling(pluginsDir)
	if n != 1 {
		t.Fatalf("应清理 1 个残留, 实得 %d", n)
	}
	if _, err := os.Stat(filepath.Join(pluginsDir, "real-plugin")); err != nil {
		t.Fatalf("不应动正常插件目录: %v", err)
	}
}

// TestPackExt 扩展名归一化
func TestPackExt(t *testing.T) {
	cases := map[string]string{
		"a.zip":     ".zip",
		"a.tar.gz":  ".tar.gz",
		"a.tgz":     ".tgz",
		"a.tar":     ".tar",
		"A.ZIP":     ".rar", // 大小写: 调用方应已 ToLower; 这里验证非匹配走 filepath.Ext
		"a.rar":     ".rar",
	}
	for in, want := range cases {
		got := packExt(strings.ToLower(in))
		if in == "A.ZIP" {
			// strings.ToLower 后是 a.zip, 应得 .zip
			if got != ".zip" {
				t.Fatalf("packExt(%q)=%q want .zip", in, got)
			}
			continue
		}
		if got != want {
			t.Fatalf("packExt(%q)=%q want %q", in, got, want)
		}
	}
}

// assertNoLeftovers 断言插件目录里没有临时目录/半个插件
func assertNoLeftovers(t *testing.T, pluginsDir string) {
	t.Helper()
	ents, err := os.ReadDir(pluginsDir)
	if err != nil {
		return
	}
	for _, e := range ents {
		if strings.HasPrefix(e.Name(), pluginPackTempPrefix) {
			t.Fatalf("失败后不应残留临时目录: %s", e.Name())
		}
	}
}