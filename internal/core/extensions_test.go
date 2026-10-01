package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeExt 造一个扩展目录(含清单与可选产物)。
func writeExt(t *testing.T, root, name string, manifest map[string]interface{}, withAsset bool) string {
	t.Helper()
	dir := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	raw, _ := json.Marshal(manifest)
	if err := os.WriteFile(filepath.Join(dir, "extension.json"), raw, 0o644); err != nil {
		t.Fatalf("write manifest: %v", err)
	}
	if withAsset {
		if err := os.WriteFile(filepath.Join(dir, "assets", "extension.js"), []byte("window.__rcExt__={}"), 0o644); err != nil {
			t.Fatalf("write asset: %v", err)
		}
	}
	return dir
}

func TestExtValidName(t *testing.T) {
	bad := []string{"", " ", ".", "..", "a/b", `a\b`, "../x", strings.Repeat("n", 65)}
	for _, n := range bad {
		if validExtName(n) {
			t.Fatalf("validExtName(%q) 应为 false", n)
		}
	}
	for _, n := range []string{"media", "task-queue", "sys_center", "a.b"} {
		if !validExtName(n) {
			t.Fatalf("validExtName(%q) 应为 true", n)
		}
	}
}

func TestExtBuiltinGuard(t *testing.T) {
	if len(BuiltinPages) != 7 {
		t.Fatalf("内置功能应为 7 项, 实得 %d", len(BuiltinPages))
	}
	for _, b := range BuiltinPages {
		if !isBuiltinName(b.Name) {
			t.Fatalf("%s 应识别为内置", b.Name)
		}
	}
	if isBuiltinName("media") {
		t.Fatal("media 不应是内置功能")
	}
	es := NewExtStore(t.TempDir(), "", nil)
	// 内置功能不可当扩展安装/卸载
	if _, err := es.Install("fm", nil); err == nil {
		t.Fatal("安装内置功能应报错")
	}
	if err := es.Remove("ext"); err == nil {
		t.Fatal("卸载内置功能应报错")
	}
	if _, err := es.Install("../etc", nil); err == nil {
		t.Fatal("非法扩展名应报错")
	}
	if err := es.Remove("no-such-ext"); err == nil {
		t.Fatal("卸载未安装的扩展应报错")
	}
}

func TestExtInstalledAndLocalRegistry(t *testing.T) {
	instDir := t.TempDir()
	srcDir := t.TempDir()
	writeExt(t, instDir, "media", map[string]interface{}{
		"name": "media", "label": "媒体中心", "version": "1.0.0",
	}, true)
	writeExt(t, instDir, "broken", map[string]interface{}{"label": "无名字"}, true)
	// 无清单的目录应被忽略
	if err := os.MkdirAll(filepath.Join(instDir, "junk"), 0o755); err != nil {
		t.Fatal(err)
	}

	writeExt(t, srcDir, "media", map[string]interface{}{
		"name": "media", "label": "媒体中心", "version": "1.2.0", "description": "图片视频",
	}, true)
	writeExt(t, srcDir, "tasks", map[string]interface{}{
		"name": "tasks", "label": "任务队列", "version": "1.0.0",
	}, true)

	es := NewExtStore(instDir, srcDir, nil)

	inst := es.Installed()
	if len(inst) != 2 {
		t.Fatalf("已装扩展应为 2 条(含无名清单), 实得 %d", len(inst))
	}
	got, ok := es.InstalledByName("media")
	if !ok || !got.Installed || !got.HasAssets || got.InstalledV != "1.0.0" {
		t.Fatalf("media 安装态不对: %+v", got)
	}
	if got.Route != "/ext/media" {
		t.Fatalf("route 应为 /ext/media, 实得 %q", got.Route)
	}
	if _, ok := es.InstalledByName("junk"); ok {
		t.Fatal("无清单目录不应出现在已装列表")
	}

	// 本地源回退: 清单来自 srcDir, installed 标记来自已装目录
	list, source, err := es.Registry()
	if err != nil {
		t.Fatalf("本地回退应可用: %v", err)
	}
	if source != "local" {
		t.Fatalf("来源应为 local, 实得 %q", source)
	}
	if len(list) != 2 {
		t.Fatalf("本地源应为 2 条, 实得 %d", len(list))
	}
	var media, tasks *Extension
	for i := range list {
		switch list[i].Name {
		case "media":
			media = &list[i]
		case "tasks":
			tasks = &list[i]
		}
	}
	if media == nil || !media.Installed || media.InstalledV != "1.0.0" || media.Version != "1.2.0" {
		t.Fatalf("media 清单/安装态不对: %+v", media)
	}
	if tasks == nil || tasks.Installed {
		t.Fatalf("tasks 不应标记为已装: %+v", tasks)
	}
}

func TestExtAssetPathTraversal(t *testing.T) {
	instDir := t.TempDir()
	writeExt(t, instDir, "media", map[string]interface{}{"name": "media", "version": "1.0.0"}, true)
	// 扩展目录外放一个敏感文件, 确认取不到
	secret := filepath.Join(instDir, "secret.txt")
	if err := os.WriteFile(secret, []byte("top-secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	es := NewExtStore(instDir, "", nil)

	bad := []string{"", "/", "../secret.txt", "assets/../../secret.txt", "..%2fsecret.txt\x00"}
	for _, rel := range bad {
		if p, ok := es.AssetPath("media", rel); ok {
			t.Fatalf("AssetPath(%q) 不应成功, 得到 %s", rel, p)
		}
	}
	// 目录本身不是文件
	if _, ok := es.AssetPath("media", "assets"); ok {
		t.Fatal("目录不应作为产物返回")
	}
	// 正常产物
	p, ok := es.AssetPath("media", "assets/extension.js")
	if !ok {
		t.Fatal("assets/extension.js 应可取到")
	}
	if b, err := os.ReadFile(p); err != nil || len(b) == 0 {
		t.Fatalf("读产物失败: %v", err)
	}
	// 清单也能取(GET /api/ext/<name> 由 handler 处理, 这里只测文件解析)
	if _, ok := es.AssetPath("media", "extension.json"); !ok {
		t.Fatal("extension.json 应可取到")
	}
	// 非法扩展名
	if _, ok := es.AssetPath("../media", "assets/extension.js"); ok {
		t.Fatal("非法扩展名不应成功")
	}
}

func TestExtParseRegistry(t *testing.T) {
	list, err := parseExtRegistry([]byte(`{"extensions":[{"name":"media","label":"媒体中心","version":"1.0.0"}]}`))
	if err != nil || len(list) != 1 || list[0].Name != "media" {
		t.Fatalf("对象式清单解析失败: %v %+v", err, list)
	}
	list, err = parseExtRegistry([]byte(`[{"name":"tasks","version":"2.0.0"}]`))
	if err != nil || len(list) != 1 || list[0].Name != "tasks" {
		t.Fatalf("数组式清单解析失败: %v %+v", err, list)
	}
	// 空清单是合法结果(仓库里暂时没有扩展包): 要显示"没有可安装的扩展", 不能报格式错误
	for _, raw := range []string{`{"extensions":[]}`, `[]`} {
		list, err = parseExtRegistry([]byte(raw))
		if err != nil || list == nil || len(list) != 0 {
			t.Fatalf("空清单解析失败(%s): %v %+v", raw, err, list)
		}
	}
	if _, err := parseExtRegistry([]byte(`not json`)); err == nil {
		t.Fatal("非法内容应报错")
	}
}

func TestExtRemoveExisting(t *testing.T) {
	instDir := t.TempDir()
	dir := writeExt(t, instDir, "media", map[string]interface{}{"name": "media", "version": "1.0.0"}, true)
	es := NewExtStore(instDir, "", nil)
	if err := es.Remove("media"); err != nil {
		t.Fatalf("卸载失败: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("卸载后目录应被删除")
	}
	if len(es.Installed()) != 0 {
		t.Fatal("卸载后已装列表应为空")
	}
}

// 安装中断留下的 <name>.tmp 带清单, 旧实现会把它当"已装扩展"列出来(还会和真扩展重名)。
func TestExtInstalledSkipsTemps(t *testing.T) {
	instDir := t.TempDir()
	writeExt(t, instDir, "media", map[string]interface{}{"name": "media", "version": "1.0.0"}, true)
	writeExt(t, instDir, "media"+tmpSuffix, map[string]interface{}{"name": "media", "version": "9.9.9"}, true)
	writeExt(t, instDir, ".hidden", map[string]interface{}{"name": "hidden", "version": "1.0.0"}, true)
	es := NewExtStore(instDir, "", nil)
	list := es.Installed()
	if len(list) != 1 || list[0].Name != "media" || list[0].Version != "1.0.0" {
		t.Fatalf("应只列出真扩展 media/1.0.0, 实际: %+v", list)
	}
}

// 启动时清理 .tmp 残留(启动时不可能有正在进行的安装)。
func TestExtSweepTemps(t *testing.T) {
	instDir := t.TempDir()
	writeExt(t, instDir, "media", map[string]interface{}{"name": "media", "version": "1.0.0"}, true)
	tmp := writeExt(t, instDir, "tasks"+tmpSuffix, map[string]interface{}{"name": "tasks", "version": "1.0.0"}, true)
	es := NewExtStore(instDir, "", nil) // 构造即清扫
	if n, _ := es.SweepTemps(); n != 0 {
		t.Fatalf("构造时已清扫, 再清扫应为 0, 实际 %d", n)
	}
	if _, err := os.Stat(tmp); !os.IsNotExist(err) {
		t.Fatal(".tmp 残留应被删除")
	}
	if len(es.Installed()) != 1 {
		t.Fatal("真扩展不能被误删")
	}
}

// 目录名与清单 name 错位的历史安装: 必须仍能打开(AssetPath)与卸载(Remove)。
// 旧实现 Remove 删 <dir>/<name> 落空却回 success, 扩展永远卸不掉。
func TestExtManifestDirMismatch(t *testing.T) {
	instDir := t.TempDir()
	dir := writeExt(t, instDir, "wrongdir", map[string]interface{}{"name": "media", "version": "1.0.0"}, true)
	es := NewExtStore(instDir, "", nil)

	if full, ok := es.AssetPath("media", "assets/extension.js"); !ok || !strings.HasPrefix(full, dir) {
		t.Fatalf("错位安装应仍能定位产物, got ok=%v path=%s", ok, full)
	}
	if err := es.Remove("media"); err != nil {
		t.Fatalf("错位安装应能卸载: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("卸载应删掉实际目录 wrongdir")
	}
	if len(es.Installed()) != 0 {
		t.Fatal("卸载后已装列表应为空")
	}
}

// 清单 name 与包名不一致必须在安装校验阶段拦下(否则装完既打不开也卸不掉)。
func TestExtVerifyInstalledNameMismatch(t *testing.T) {
	instDir := t.TempDir()
	es := NewExtStore(instDir, "", nil)
	dir := writeExt(t, instDir, "media", map[string]interface{}{"name": "other", "version": "1.0.0"}, true)
	if err := es.verifyInstalled("media", dir); err == nil {
		t.Fatal("name 不一致应报错")
	}
	dir2 := writeExt(t, instDir, "tasks", map[string]interface{}{"name": "tasks", "version": "1.0.0"}, false)
	if err := es.verifyInstalled("tasks", dir2); err == nil {
		t.Fatal("产物缺失应报错")
	}
	dir3 := writeExt(t, instDir, "scheduler", map[string]interface{}{"name": "scheduler", "version": "1.0.0"}, true)
	if err := es.verifyInstalled("scheduler", dir3); err != nil {
		t.Fatalf("正常扩展不应报错: %v", err)
	}
}

// 路径穿越回归: 改过 AssetPath 的目录解析后, 解析结果必须始终落在该扩展目录内。
// (实现是 filepath.Clean("/"+rel) 先锚定根 —— ".." 会被折到扩展目录根, 不会逃出去)
func TestExtAssetPathStaysInsideExtDir(t *testing.T) {
	instDir := t.TempDir()
	dir := writeExt(t, instDir, "media", map[string]interface{}{"name": "media", "version": "1.0.0"}, true)
	es := NewExtStore(instDir, "", nil)
	for _, rel := range []string{"../extension.json", "../../etc/passwd", "assets/../../etc/passwd", "../media/assets/extension.js", "", "/"} {
		full, ok := es.AssetPath("media", rel)
		if !ok {
			continue
		}
		if full != dir && !strings.HasPrefix(full, dir+string(os.PathSeparator)) {
			t.Fatalf("路径 %q 逃出了扩展目录: %s", rel, full)
		}
	}
	if _, ok := es.AssetPath("media", "../../etc/passwd"); ok {
		t.Fatal("扩展目录外的文件不应可读")
	}
	if full, ok := es.AssetPath("media", "assets/extension.js"); !ok || filepath.Dir(filepath.Dir(full)) != dir {
		t.Fatalf("正常产物应可读: ok=%v %s", ok, full)
	}
}
