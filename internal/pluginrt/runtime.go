// Package pluginrt 插件运行时适配: 让 v6 能运行 py / php / java / go / node 插件。
//
// 背景: v6 最初只考虑"插件是静态 Go 二进制", 于是 backend.exec 直接 exec.Command(args[0])。
// 但真实插件生态是 Python 为主(旧 17 个插件全是 Python), 且用户明确要求支持
// py / php / go / java。这些语言都需要先找到解释器, 而解释器的**名字在不同发行版不一样**:
//
//	Debian 12 / Ubuntu 24.04+  只有 python3, 没有 python   ← 旧 JMComic 的 exec 写 "python" 必崩
//	老 CentOS / 部分镜像       只有 python(python2) 或两者都有
//	Alpine                     只有 python3
//	Windows                    通常 python.exe / py.exe
//
// 所以本包负责三件事:
//  1. 语言探测: 从 backend.lang, 或从 exec[0] 反推
//  2. 解释器解析: 命令名 → 实际可执行文件路径(带别名回退链), 找不到给出可读错误
//  3. 环境准备: 各语言的必要环境变量(如 Python 的 PYTHONUNBUFFERED)
//
// 设计原则: **绝不静默降级**。如果声明 lang=python 但系统没有 python3, 启动就失败并
// 打印"请安装 python3"或"把 exec 改成 xxx", 而不是留一个找不到原因的黑盒崩溃。
// (旧 JMComic 在 3910 上正是这种黑盒: 插件启动即崩, 日志只有 exit=-1, 查不出原因。)
package pluginrt

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Lang 插件后端语言
type Lang string

const (
	LangGo     Lang = "go"     // 静态编译二进制, 无解释器
	LangPython Lang = "python" // python / python3
	LangPHP    Lang = "php"
	LangJava   Lang = "java"
	LangNode   Lang = "node"
	LangBash   Lang = "bash"   // shell 脚本(方便测试与简单工具)
	LangBinary Lang = "binary" // 其它可直接执行的二进制(Rust/C++/…)
)

// Supported 所有支持的语言(给前端/文档展示)
func Supported() []Lang {
	return []Lang{LangGo, LangBinary, LangPython, LangPHP, LangJava, LangNode, LangBash}
}

// Normalize 归一化语言名(兼容 python2/python3/py、nodejs、golang 等写法)
func Normalize(s string) Lang {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "go", "golang", "binary", "static":
		if strings.EqualFold(strings.TrimSpace(s), "binary") {
			return LangBinary
		}
		return LangGo
	case "python", "python2", "python3", "py", "python3.x":
		return LangPython
	case "php", "php8", "php7":
		return LangPHP
	case "java", "jar", "kotlin":
		return LangJava
	case "node", "nodejs", "js", "javascript":
		return LangNode
	case "bash", "sh", "shell", "script":
		return LangBash
	default:
		return Lang(strings.ToLower(strings.TrimSpace(s)))
	}
}

// Spec 解析后的执行规格
type Spec struct {
	// Argv 最终要执行的参数列表(Argv[0] 已是可执行文件绝对路径)
	Argv []string
	// Lang 判定出的语言
	Lang Lang
	// Interpreter 解释器绝对路径(LangGo/LangBinary 时等于 Argv[0])
	Interpreter string
	// Env 该语言需要的额外环境变量("K=V")
	Env []string
	// Notes 解析过程中的提示(例如"python 不存在, 已回退到 python3")
	Notes []string
}

// Resolve 把 backend{lang, exec} 解析成可执行的 Spec。
//
// pluginDir 用于把相对路径的脚本/二进制转成绝对路径(子进程 cwd 虽是 pluginDir,
// 但显式绝对路径能避免 cwd 未生效时的诡异问题)。
func Resolve(lang string, execArr []string, pluginDir string) (*Spec, error) {
	if len(execArr) == 0 {
		return nil, errors.New("backend.exec 为空")
	}
	raw := make([]string, 0, len(execArr))
	for _, s := range execArr {
		raw = append(raw, strings.TrimSpace(s))
	}
	if raw[0] == "" {
		return nil, errors.New("backend.exec[0] 为空")
	}

	l := Normalize(lang)
	// lang 未声明时从 exec[0] 反推(脚本扩展名或解释器名)
	declared := strings.TrimSpace(lang) != ""
	if !declared {
		if infer := inferLangFromExec(raw[0]); infer != "" {
			l = infer
		}
	}

	head := raw[0]
	spec := &Spec{Lang: l}

	// 判定 exec[0] 属于两种情况中的哪一种 —— 这一步极易搞错, 实测踩过:
	//   A) 脚本/二进制文件      "./run.sh"  "server.py"  "/opt/x/bin/plugin"
	//   B) 解释器本身(含绝对路径) "/bin/sh"  "/usr/bin/python3"  "php"
	//
	// ★ 关键: 绝对路径不能一律当成脚本。`/bin/sh` 是解释器, 若当成脚本就会拼出
	//   `bash /bin/sh ./run.sh` —— bash 会把 /bin/sh(一个 ELF) 当脚本读, 直接 exit=126。
	//   (echopi 插件正是 exec=["/bin/sh","./run.sh"], 实测因此启动即崩。)
	// 所以先看 basename 是否是已知解释器名, 是则走 B, 否则再按路径判断走 A。
	if !isKnownInterpreter(head) && (isFilePath(head) || fileExists(filepath.Join(pluginDir, head))) {
		p := head
		if !filepath.IsAbs(p) {
			p = filepath.Join(pluginDir, p)
		}
		switch l {
		case LangPython:
			// 直接跑 .py: 需要一个解释器
			interp, note, err := findInterpreter(LangPython)
			if err != nil {
				return nil, err
			}
			spec.Notes = appendNote(spec.Notes, note)
			spec.Interpreter = interp
			spec.Argv = append([]string{interp, p}, raw[1:]...)
		case LangPHP, LangNode, LangBash:
			interp, note, err := findInterpreter(l)
			if err != nil {
				return nil, err
			}
			spec.Notes = appendNote(spec.Notes, note)
			spec.Interpreter = interp
			spec.Argv = append([]string{interp, p}, raw[1:]...)
		case LangJava:
			// 直接给 .jar: 需要 java -jar
			interp, note, err := findInterpreter(LangJava)
			if err != nil {
				return nil, err
			}
			spec.Notes = appendNote(spec.Notes, note)
			spec.Interpreter = interp
			if strings.HasSuffix(strings.ToLower(p), ".jar") {
				spec.Argv = append([]string{interp, "-jar", p}, raw[1:]...)
			} else {
				spec.Argv = append([]string{interp, p}, raw[1:]...)
			}
		default:
			// Go / 其它二进制: 直接执行, 并确保有执行位
			spec.Interpreter = p
			spec.Argv = append([]string{p}, raw[1:]...)
			_ = ensureExecutable(p)
		}
		spec.Env = envFor(spec.Lang)
		return spec, nil
	}

	// 情况 B: exec[0] 是命令名(解释器)
	bin, note, err := resolveCommand(head, l)
	if err != nil {
		return nil, err
	}
	spec.Notes = appendNote(spec.Notes, note)
	spec.Interpreter = bin

	// 若 lang 未声明, 用解析到的解释器反推
	if !declared {
		if il := inferLangFromCommand(head); il != "" {
			spec.Lang = il
			l = il
		}
	}

	// 脚本参数里的相对路径转绝对(解释器需要能定位脚本)
	argv := []string{bin}
	for i, a := range raw[1:] {
		if i == 0 && !filepath.IsAbs(a) && !strings.HasPrefix(a, "-") {
			cand := filepath.Join(pluginDir, a)
			if fileExists(cand) {
				argv = append(argv, cand)
				continue
			}
		}
		argv = append(argv, a)
	}
	spec.Argv = argv
	spec.Env = envFor(spec.Lang)
	return spec, nil
}

// ---- 内部 ----

// isKnownInterpreter 判断 exec[0] 是否为已知解释器(含绝对路径形式)。
//
// 必须覆盖 "/bin/sh" 这类绝对路径 —— 否则会被误判成"脚本文件"。
func isKnownInterpreter(s string) bool {
	base := strings.ToLower(filepath.Base(s))
	switch base {
	case "sh", "bash", "dash", "zsh", "ash",
		"python", "python2", "python3",
		"php", "java", "javaw", "node", "nodejs", "ruby", "perl":
		return true
	}
	if strings.HasPrefix(base, "python3.") || strings.HasPrefix(base, "php7") || strings.HasPrefix(base, "php8") {
		return true
	}
	return false
}

func isFilePath(s string) bool {
	if s == "" {
		return false
	}
	if filepath.IsAbs(s) {
		return true
	}
	return strings.HasPrefix(s, "./") || strings.HasPrefix(s, "../") ||
		strings.ContainsAny(s, `/\`)
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// ensureExecutable 给二进制补执行位(Linux/macOS 才有意义)
func ensureExecutable(p string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	st, err := os.Stat(p)
	if err != nil {
		return err
	}
	if st.Mode()&0o111 != 0 {
		return nil
	}
	return os.Chmod(p, st.Mode()|0o111)
}

// interpreterCandidates 各语言的命令名候选链(按优先级)。
//
// 顺序依据真实发行版差异:
//   - python: 优先 python3(现代默认), 再 python(旧系统/venv), 再具体小版本
//   - node:   node 优先, nodejs 是 Debian 老包名
//   - java:   java 优先, 再 JAVA_HOME/bin/java
var interpreterCandidates = map[Lang][]string{
	LangPython: {"python3", "python", "python3.13", "python3.12", "python3.11", "python3.10", "python2"},
	LangPHP:    {"php", "php8.3", "php8.2", "php8.1", "php7.4"},
	LangJava:   {"java"},
	LangNode:   {"node", "nodejs"},
	LangBash:   {"bash", "sh"},
}

// findInterpreter 按候选链找解释器
func findInterpreter(l Lang) (path string, note string, err error) {
	cands, ok := interpreterCandidates[l]
	if !ok {
		return "", "", fmt.Errorf("语言 %q 没有预设的解释器候选", l)
	}
	var tried []string
	for i, c := range cands {
		if p, e := exec.LookPath(c); e == nil {
			if i > 0 {
				note = fmt.Sprintf("%s 不可用, 已回退到 %s", cands[0], c)
			}
			return p, note, nil
		}
		tried = append(tried, c)
	}
	// Java 额外试 JAVA_HOME
	if l == LangJava {
		if jh := os.Getenv("JAVA_HOME"); jh != "" {
			p := filepath.Join(jh, "bin", "java")
			if fileExists(p) {
				return p, "使用 JAVA_HOME 里的 java", nil
			}
		}
	}
	return "", "", &InterpreterMissingError{Lang: l, Tried: tried}
}

// InterpreterMissingError 缺解释器(单独类型, 便于调用方给出安装建议)
type InterpreterMissingError struct {
	Lang  Lang
	Tried []string
}

func (e *InterpreterMissingError) Error() string {
	return fmt.Sprintf("插件后端语言为 %s, 但系统找不到解释器(已尝试: %s)。%s",
		e.Lang, strings.Join(e.Tried, ", "), installHint(e.Lang))
}

// installHint 各语言的安装建议(直接写进错误信息, 用户不用再查文档)
func installHint(l Lang) string {
	switch l {
	case LangPython:
		return "请安装: Debian/Ubuntu → apt install python3; Alpine → apk add python3; " +
			"或在 plugin.json 的 backend.exec 里改成已有的解释器名"
	case LangPHP:
		return "请安装: apt install php-cli(或 apk add php)"
	case LangJava:
		return "请安装 JRE(apt install default-jre)或设置 JAVA_HOME"
	case LangNode:
		return "请安装: apt install nodejs"
	case LangBash:
		return "系统缺少 /bin/sh 或 bash(极罕见)"
	}
	return ""
}

// resolveCommand 解析命令名(解释器别名回退)
func resolveCommand(name string, l Lang) (string, string, error) {
	// 先按原名直接找
	if p, err := exec.LookPath(name); err == nil {
		return p, "", nil
	}
	// 按语言候选链回退
	if l != "" {
		if p, note, err := findInterpreter(l); err == nil {
			if note == "" {
				note = fmt.Sprintf("%s 不在 PATH, 已改用 %s", name, filepath.Base(p))
			}
			return p, note, nil
		}
	}
	// 不知道语言, 试常见别名
	for _, alt := range guessAliases(name) {
		if p, err := exec.LookPath(alt); err == nil {
			return p, fmt.Sprintf("%s 不在 PATH, 已回退到 %s", name, alt), nil
		}
	}
	return "", "", fmt.Errorf("找不到命令 %q(插件 backend.exec[0])。请确认已安装, 或在 backend.exec 里写绝对路径", name)
}

// guessAliases 命令名 → 常见别名
func guessAliases(name string) []string {
	switch strings.ToLower(name) {
	case "python":
		return []string{"python3", "python3.12", "python3.11", "python3.10"}
	case "python3":
		return []string{"python"}
	case "node":
		return []string{"nodejs"}
	case "nodejs":
		return []string{"node"}
	}
	return nil
}

// inferLangFromExec 从 exec[0] 反推语言
func inferLangFromExec(s string) Lang {
	base := strings.ToLower(filepath.Base(s))
	switch {
	case strings.HasSuffix(base, ".py"):
		return LangPython
	case strings.HasSuffix(base, ".php"):
		return LangPHP
	case strings.HasSuffix(base, ".jar"):
		return LangJava
	case strings.HasSuffix(base, ".js"), strings.HasSuffix(base, ".mjs"):
		return LangNode
	case strings.HasSuffix(base, ".sh"):
		return LangBash
	}
	return inferLangFromCommand(base)
}

// inferLangFromCommand 从解释器命令名反推语言
func inferLangFromCommand(s string) Lang {
	base := strings.ToLower(filepath.Base(s))
	switch {
	case strings.HasPrefix(base, "python"):
		return LangPython
	case strings.HasPrefix(base, "php"):
		return LangPHP
	case base == "java", base == "javaw":
		return LangJava
	case strings.HasPrefix(base, "node"):
		return LangNode
	case base == "bash", base == "sh", base == "dash", base == "zsh":
		return LangBash
	}
	return ""
}

// envFor 各语言需要的额外环境变量
//
// PYTHONUNBUFFERED=1 很关键: 不加的话 Python 的 stdout 是块缓冲, 插件日志会卡在缓冲区,
// 崩溃时日志一片空白(排查起来极其痛苦)。
// PYTHONDONTWRITEBYTECODE=1: 避免插件目录里堆 __pycache__(旧 JMComic 目录里就有)。
func envFor(l Lang) []string {
	switch l {
	case LangPython:
		return []string{"PYTHONUNBUFFERED=1", "PYTHONDONTWRITEBYTECODE=1"}
	case LangPHP:
		return []string{"PHP_CLI_SERVER_WORKERS=1"}
	}
	return nil
}

func appendNote(notes []string, n string) []string {
	if n == "" {
		return notes
	}
	return append(notes, n)
}

// ---- 依赖自检 ----

// CheckPythonModules 检查 Python 插件声明的依赖是否可导入。
//
// 为什么需要: Python 插件缺包时会立刻抛 ImportError 退出, supervisor 只会看到
// "崩溃 exit=1", 日志里一行 traceback 也未必有(取决于缓冲)。启动前主动检查,
// 能直接告诉用户"缺 jmcomic, 请 pip install jmcomic"。
//
// 返回 (缺失的模块列表, 错误)。超时 8 秒, 避免拖慢启动。
func CheckPythonModules(pythonBin string, modules []string) ([]string, error) {
	if len(modules) == 0 {
		return nil, nil
	}
	// 只取模块名(去掉版本约束: "jmcomic>=2.7" → "jmcomic")
	names := make([]string, 0, len(modules))
	for _, m := range modules {
		n := strings.TrimSpace(m)
		for _, sep := range []string{">=", "<=", "==", "!=", ">", "<", "~=", "["} {
			if i := strings.Index(n, sep); i > 0 {
				n = n[:i]
				break
			}
		}
		n = strings.TrimSpace(n)
		if n != "" {
			names = append(names, n)
		}
	}
	if len(names) == 0 {
		return nil, nil
	}

	// 一次进程跑完所有 import, 缺失的模块名打到 stdout
	code := "import importlib,sys\nmiss=[]\nfor m in sys.argv[1:]:\n try: importlib.import_module(m)\n except Exception: miss.append(m)\nprint(','.join(miss))"
	args := append([]string{"-c", code}, names...)
	cmd := exec.Command(pythonBin, args...)
	cmd.Env = append(os.Environ(), envFor(LangPython)...)

	type result struct {
		out []byte
		err error
	}
	ch := make(chan result, 1)
	go func() {
		out, err := cmd.Output()
		ch <- result{out, err}
	}()
	select {
	case r := <-ch:
		if r.err != nil {
			return nil, fmt.Errorf("依赖检查失败: %w", r.err)
		}
		s := strings.TrimSpace(string(r.out))
		if s == "" {
			return nil, nil
		}
		return strings.Split(s, ","), nil
	case <-time.After(8 * time.Second):
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return nil, errors.New("依赖检查超时(8s)")
	}
}

// cache 解释器探测结果, 避免每次 spawn 都走一遍 PATH 查找
var (
	mu      sync.Mutex
	pathHit = map[string]string{}
)

// LookPathCached 带缓存的 exec.LookPath(PATH 在进程生命周期内基本不变)
func LookPathCached(name string) (string, error) {
	mu.Lock()
	if p, ok := pathHit[name]; ok {
		mu.Unlock()
		return p, nil
	}
	mu.Unlock()
	p, err := exec.LookPath(name)
	if err != nil {
		return "", err
	}
	mu.Lock()
	pathHit[name] = p
	mu.Unlock()
	return p, nil
}
