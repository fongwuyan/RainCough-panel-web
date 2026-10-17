package pluginrt

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// ---- 语言归一化 ----

func TestNormalize(t *testing.T) {
	cases := map[string]Lang{
		"":           LangGo,
		"go":         LangGo,
		"golang":     LangGo,
		"binary":     LangBinary,
		"python":     LangPython,
		"python3":    LangPython,
		"py":         LangPython,
		"PHP":        LangPHP,
		"php8":       LangPHP,
		"java":       LangJava,
		"jar":        LangJava,
		"nodejs":     LangNode,
		"javascript": LangNode,
		"bash":       LangBash,
		"sh":         LangBash,
	}
	for in, want := range cases {
		if got := Normalize(in); got != want {
			t.Errorf("Normalize(%q) = %q, want %q", in, got, want)
		}
	}
}

// ---- 语言推断 ----

func TestInferLang(t *testing.T) {
	// 从脚本扩展名
	for _, c := range []struct {
		in   string
		want Lang
	}{
		{"server.py", LangPython},
		{"server_v4.py", LangPython},
		{"index.php", LangPHP},
		{"app.jar", LangJava},
		{"index.js", LangNode},
		{"run.sh", LangBash},
	} {
		if got := inferLangFromExec(c.in); got != c.want {
			t.Errorf("inferLangFromExec(%q) = %q, want %q", c.in, got, c.want)
		}
	}
	// 从解释器名
	for _, c := range []struct {
		in   string
		want Lang
	}{
		{"python", LangPython},
		{"python3.11", LangPython},
		{"php", LangPHP},
		{"java", LangJava},
		{"node", LangNode},
		{"bash", LangBash},
	} {
		if got := inferLangFromCommand(c.in); got != c.want {
			t.Errorf("inferLangFromCommand(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// ---- Resolve: 各种 exec 写法 ----

// TestResolve_goBinary Go 插件(exec[0] 是文件名)应转成绝对路径并补执行位
func TestResolve_goBinary(t *testing.T) {
	dir := t.TempDir()
	bin := filepath.Join(dir, "myplugin")
	if err := os.WriteFile(bin, []byte("#!/bin/sh\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	spec, err := Resolve("go", []string{"myplugin"}, dir)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if spec.Lang != LangGo {
		t.Fatalf("lang=%q want go", spec.Lang)
	}
	if spec.Argv[0] != bin {
		t.Fatalf("Argv[0]=%q want %q", spec.Argv[0], bin)
	}
	if runtime.GOOS != "windows" {
		st, _ := os.Stat(bin)
		if st.Mode()&0o111 == 0 {
			t.Fatalf("应补执行位, 实得 %v", st.Mode())
		}
	}
}

// TestResolve_pythonScriptExec 旧 JMComic 写法: exec: ["python", "server_v4.py"]
// ★ 这是本包存在的首要原因: Debian 12 只有 python3, "python" 会 fork 失败。
// 这里断言解析后的 Argv[0] 是**真实存在的解释器路径**(而非字面 "python")。
func TestResolve_pythonScriptExec(t *testing.T) {
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("本机没有 python3, 跳过")
	}
	dir := t.TempDir()
	script := filepath.Join(dir, "server_v4.py")
	if err := os.WriteFile(script, []byte("print('hi')\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	spec, err := Resolve("python", []string{"python", "server_v4.py"}, dir)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if spec.Lang != LangPython {
		t.Fatalf("lang=%q want python", spec.Lang)
	}
	// Argv[0] 必须是绝对路径且真实存在
	if !filepath.IsAbs(spec.Argv[0]) {
		t.Fatalf("Argv[0] 应为绝对路径, 实得 %q", spec.Argv[0])
	}
	if _, err := os.Stat(spec.Argv[0]); err != nil {
		t.Fatalf("Argv[0] 不存在: %v", err)
	}
	// 脚本应被转成绝对路径
	if spec.Argv[1] != script {
		t.Fatalf("脚本路径应绝对化: %q want %q", spec.Argv[1], script)
	}
	// Python 必须有这两个环境变量(否则日志卡缓冲、目录堆 pycache)
	var hasUnbuf, hasNoPyc bool
	for _, e := range spec.Env {
		if e == "PYTHONUNBUFFERED=1" {
			hasUnbuf = true
		}
		if e == "PYTHONDONTWRITEBYTECODE=1" {
			hasNoPyc = true
		}
	}
	if !hasUnbuf || !hasNoPyc {
		t.Fatalf("Python 环境变量不全: %v", spec.Env)
	}
}

// TestResolve_directPythonScript exec 直接写 .py(不指定解释器)
func TestResolve_directPythonScript(t *testing.T) {
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("本机没有 python3")
	}
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "srv.py"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	// lang 留空, 靠 .py 后缀推断
	spec, err := Resolve("", []string{"./srv.py"}, dir)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if spec.Lang != LangPython {
		t.Fatalf("应由 .py 推断为 python, 实得 %q", spec.Lang)
	}
	if len(spec.Argv) < 2 || !strings.HasSuffix(spec.Argv[1], "srv.py") {
		t.Fatalf("argv 不对: %v", spec.Argv)
	}
}

// TestResolve_javaJar exec 直接给 .jar 应自动补 java -jar
func TestResolve_javaJar(t *testing.T) {
	if _, err := exec.LookPath("java"); err != nil {
		t.Skip("本机没有 java")
	}
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "app.jar"), []byte("PK"), 0o644); err != nil {
		t.Fatal(err)
	}
	spec, err := Resolve("", []string{"app.jar"}, dir)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if spec.Lang != LangJava {
		t.Fatalf("lang=%q want java", spec.Lang)
	}
	// 应为 java -jar <abs>
	if len(spec.Argv) < 3 || spec.Argv[1] != "-jar" {
		t.Fatalf("应补 -jar, argv=%v", spec.Argv)
	}
	if !strings.HasSuffix(spec.Argv[2], "app.jar") || !filepath.IsAbs(spec.Argv[2]) {
		t.Fatalf("jar 路径应绝对化: %v", spec.Argv)
	}
}

// TestResolve_phpScript
func TestResolve_phpScript(t *testing.T) {
	if _, err := exec.LookPath("php"); err != nil {
		t.Skip("本机没有 php")
	}
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "srv.php"), []byte("<?php\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	spec, err := Resolve("php", []string{"php", "srv.php"}, dir)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if spec.Lang != LangPHP {
		t.Fatalf("lang=%q", spec.Lang)
	}
	if len(spec.Argv) < 2 {
		t.Fatalf("argv=%v", spec.Argv)
	}
}

// TestResolve_unknownLangMissingInterpreter 缺解释器必须给出可读错误(而不是静默失败)
func TestResolve_unknownLangMissingInterpreter(t *testing.T) {
	// 用一个绝不存在的解释器名与语言
	_, err := Resolve("cobol", []string{"definitely-not-a-real-interpreter-xyz", "x.cob"}, t.TempDir())
	if err == nil {
		t.Fatalf("应报错")
	}
	if !strings.Contains(err.Error(), "找不到命令") {
		t.Fatalf("错误信息应说明找不到命令, 实得: %v", err)
	}
}

// TestInterpreterMissingError_hasHint 缺解释器的错误必须带安装建议
func TestInterpreterMissingError_hasHint(t *testing.T) {
	e := &InterpreterMissingError{Lang: LangPython, Tried: []string{"python3", "python"}}
	msg := e.Error()
	if !strings.Contains(msg, "python3") {
		t.Fatalf("应提到 python3: %s", msg)
	}
	if !strings.Contains(msg, "apt install") {
		t.Fatalf("应给出安装建议: %s", msg)
	}
}

// TestCheckPythonModules 依赖自检
func TestCheckPythonModules(t *testing.T) {
	py, err := exec.LookPath("python3")
	if err != nil {
		t.Skip("本机没有 python3")
	}
	// 标准库模块一定在
	miss, err := CheckPythonModules(py, []string{"json", "os"})
	if err != nil {
		t.Fatalf("检查失败: %v", err)
	}
	if len(miss) != 0 {
		t.Fatalf("标准库不应缺失, 实得: %v", miss)
	}
	// 绝不存在的模块
	miss, err = CheckPythonModules(py, []string{"definitely_not_a_module_xyz123"})
	if err != nil {
		t.Fatalf("检查失败: %v", err)
	}
	if len(miss) != 1 || miss[0] != "definitely_not_a_module_xyz123" {
		t.Fatalf("应报缺失, 实得: %v", miss)
	}
	// 带版本约束的写法应能正确取模块名
	miss, err = CheckPythonModules(py, []string{"json>=1.0"})
	if err != nil {
		t.Fatalf("检查失败: %v", err)
	}
	if len(miss) != 0 {
		t.Fatalf("json>=1.0 应视为存在, 实得缺失: %v", miss)
	}
}

// TestResolve_interpreterWithAbsolutePath exec[0] 是【绝对路径的解释器】时不能被当脚本。
// ★ 回归测试: echopi 插件 exec=["/bin/sh","./run.sh"], 早期实现把 /bin/sh 当脚本文件,
// 拼出 `bash /bin/sh ./run.sh`, bash 会把 ELF 当脚本读 → exit=126 启动失败。
func TestResolve_interpreterWithAbsolutePath(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "run.sh"), []byte("#!/bin/sh\necho hi\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	spec, err := Resolve("sh", []string{"/bin/sh", "./run.sh"}, dir)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if spec.Lang != LangBash {
		t.Fatalf("lang=%q want bash", spec.Lang)
	}
	// 关键断言: 不允许出现两个解释器(即 /bin/sh 不能被保留成 argv 里的"脚本")
	if len(spec.Argv) != 2 {
		t.Fatalf("argv 应为 [解释器, 脚本] 两个元素, 实得 %v", spec.Argv)
	}
	if !strings.HasSuffix(spec.Argv[1], "run.sh") {
		t.Fatalf("argv[1] 应是 run.sh, 实得 %v", spec.Argv)
	}
	if isKnownInterpreter(spec.Argv[1]) {
		t.Fatalf("argv[1] 不应是解释器: %v", spec.Argv)
	}
}

// TestIsKnownInterpreter
func TestIsKnownInterpreter(t *testing.T) {
	yes := []string{"/bin/sh", "/bin/bash", "/usr/bin/python3", "/usr/local/bin/python", "php", "java", "/usr/bin/node", "python3.11", "php8.2"}
	for _, s := range yes {
		if !isKnownInterpreter(s) {
			t.Errorf("%q 应识别为解释器", s)
		}
	}
	no := []string{"./run.sh", "server.py", "app.jar", "mybin", "/opt/plugin/bin/self"}
	for _, s := range no {
		if isKnownInterpreter(s) {
			t.Errorf("%q 不应识别为解释器", s)
		}
	}
}

// TestProbe_coversAllSupported 探测结果必须覆盖 Supported() 里每一种语言。
// ★ 这条测试守的是"前后端语言判断不会脱节" ——
// 曾出现前端硬编码 `lang!=='go' 即不兼容`, 而后端早已支持 py/php/java/node,
// 导致 JMComic 明明能跑却被标"不兼容 v6"。现在前端读 Probe() 的结果,
// 所以 Supported() 里的语言必须一条不漏地出现在 Probe().Languages 里。
func TestProbe_coversAllSupported(t *testing.T) {
	info := Probe()
	got := map[string]bool{}
	for _, l := range info.Languages {
		got[l] = true
	}
	for _, l := range Supported() {
		if !got[string(l)] {
			t.Fatalf("Probe().Languages 缺少 %q(前端会误判不受支持); 实得 %v", l, info.Languages)
		}
	}
	// 归一化别名也要覆盖, 否则插件写 "python3"/"nodejs"/"sh" 时前端会误判
	for _, alias := range []string{"python3", "nodejs", "sh"} {
		if !got[alias] {
			t.Fatalf("Probe().Languages 缺少别名 %q; 实得 %v", alias, info.Languages)
		}
	}
	// Details 条数与 Supported() 对齐
	if len(info.Details) != len(Supported()) {
		t.Fatalf("Details 有 %d 条, Supported() 有 %d 个", len(info.Details), len(Supported()))
	}
}

// TestIsLangSupported 与前端使用的判断保持一致
func TestIsLangSupported(t *testing.T) {
	yes := []string{"", "go", "golang", "binary", "python", "python3", "py",
		"php", "java", "jar", "node", "nodejs", "bash", "sh"}
	for _, l := range yes {
		if !IsLangSupported(l) {
			t.Errorf("%q 应受支持", l)
		}
	}
	no := []string{"cobol", "rust", "csharp", "brainfuck"}
	for _, l := range no {
		if IsLangSupported(l) {
			t.Errorf("%q 不应受支持", l)
		}
	}
}

// TestProbe_missingHasHint 缺解释器时必须带安装建议(前端 tooltip 用)
func TestProbe_missingHasHint(t *testing.T) {
	info := Probe()
	for _, d := range info.Details {
		if d.Supported && d.NeedsInterpreter && !d.Available {
			if d.Hint == "" {
				t.Fatalf("%s 不可用但没给 hint", d.Lang)
			}
			if d.Interpreter != "" {
				t.Fatalf("%s 不可用却报告了解释器 %q", d.Lang, d.Interpreter)
			}
		}
		if d.Available && d.NeedsInterpreter && d.Interpreter == "" {
			t.Fatalf("%s 可用却没给解释器路径", d.Lang)
		}
	}
}
