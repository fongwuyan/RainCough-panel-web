package pluginrt

import (
	"net"
	"os/exec"
	"strconv"
	"strings"
	"testing"
	"time"
)

// 没有 environment 也没有 requirements: 空报告且就绪。
func TestReport_Empty(t *testing.T) {
	dir := writeManifest(t, `{"name":"demo","version":"2.0.0"}`)
	r := &EnvRunner{Dir: dir}
	rep := r.Report(nil)

	if !rep.Ready {
		t.Error("无环境要求时应 ready=true")
	}
	if rep.Pending != 0 {
		t.Errorf("pending 应为 0, 得到 %d", rep.Pending)
	}
	if rep.Plugin != "demo" || rep.Version != "2.0.0" {
		t.Errorf("插件名/版本应从清单带出, 得到 %q/%q", rep.Plugin, rep.Version)
	}
	if rep.Items == nil {
		t.Error("Items 不应为 nil(前端直接 v-for)")
	}
}

// 目录里没有 plugin.json 也不能崩, 用目录名兜底。
func TestReport_NoManifest(t *testing.T) {
	r := &EnvRunner{Dir: t.TempDir()}
	rep := r.Report(nil)
	if !rep.Ready {
		t.Error("读不到清单时应保守返回 ready=true, 而不是把插件判死")
	}
	if rep.Plugin == "" {
		t.Error("插件名不应为空")
	}
}

func skipIfNoShell(t *testing.T) {
	t.Helper()
	if shellPath() == "" {
		t.Skip("当前环境没有 POSIX sh")
	}
}

func TestRunShell_ExitCode(t *testing.T) {
	skipIfNoShell(t)
	dir := t.TempDir()

	okItem := (&EnvRunner{Dir: dir}).runShell(CheckDef{ID: "a", Run: "echo hello"})
	if okItem.Status != StatusOK {
		t.Errorf("退出码 0 应为 ok, 得到 %s (%s)", okItem.Status, okItem.Detail)
	}
	if okItem.Kind != "shell" {
		t.Errorf("kind 应为 shell, 得到 %q", okItem.Kind)
	}

	// 用 1 而不是 3: 3 现在有专门含义(状态可疑), 见 TestRunShell_exitcode_semantics
	badItem := (&EnvRunner{Dir: dir}).runShell(CheckDef{ID: "b", Run: "exit 1"})
	if badItem.Status != StatusMissing {
		t.Errorf("退出码 1 应为 missing, 得到 %s", badItem.Status)
	}
}

func TestRunShell_Expect(t *testing.T) {
	skipIfNoShell(t)
	dir := t.TempDir()

	hit := (&EnvRunner{Dir: dir}).runShell(CheckDef{ID: "a", Run: "echo 200", Expect: "^200$"})
	if hit.Status != StatusOK {
		t.Errorf("输出匹配应为 ok, 得到 %s", hit.Status)
	}

	miss := (&EnvRunner{Dir: dir}).runShell(CheckDef{ID: "b", Run: "echo 500", Expect: "^200$"})
	if miss.Status != StatusMissing {
		t.Errorf("输出不匹配应为 missing, 得到 %s", miss.Status)
	}

	// 作者正则写错不能算缺失 —— 否则用户会去修一个不存在的问题
	bad := (&EnvRunner{Dir: dir}).runShell(CheckDef{ID: "c", Run: "echo x", Expect: "(["})
	if bad.Status != StatusUnknown {
		t.Errorf("正则非法应为 unknown, 得到 %s", bad.Status)
	}
}

func TestRunShell_Timeout(t *testing.T) {
	skipIfNoShell(t)
	dir := t.TempDir()
	start := time.Now()
	it := (&EnvRunner{Dir: dir}).runShell(CheckDef{ID: "a", Run: "sleep 5", Timeout: 1})
	if it.Status != StatusUnknown {
		t.Errorf("超时应为 unknown(可能是机器慢, 不能判缺失), 得到 %s", it.Status)
	}
	// 断言上界要贴近实际: WaitDelay 500ms, 所以总耗时应 ≈1.5s。
	// 若回归成"等 IO 收尾"会跑满 5s, 3s 能把它抓住。
	if elapsed := time.Since(start); elapsed > 3*time.Second {
		t.Errorf("超时没生效(WaitDelay 可能丢了), 耗时 %v", elapsed)
	}
}

// stderr 要合进 detail, 否则作者把诊断打到 stderr 时 detail 是空的。
func TestRunShell_StderrCaptured(t *testing.T) {
	skipIfNoShell(t)
	it := (&EnvRunner{Dir: t.TempDir()}).runShell(
		CheckDef{ID: "a", Run: "echo boom >&2; exit 1"})
	if it.Status != StatusMissing {
		t.Fatalf("应 missing, 得到 %s", it.Status)
	}
	if it.Detail == "" {
		t.Error("stderr 未被捕获, detail 为空")
	}
}

// Ready 只由 required 项决定; 可选项失败不能阻断。
func TestReport_ReadyAndPending(t *testing.T) {
	skipIfNoShell(t)
	dir := writeManifest(t, `{"name":"demo","environment":{"check":[
	  {"id":"good","run":"true"},
	  {"id":"bad","run":"false"},
	  {"id":"opt","run":"false","required":false}
	]}}`)
	spec, err := LoadEnvSpec(dir)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	rep := (&EnvRunner{Dir: dir}).Report(spec)

	if len(rep.Items) != 3 {
		t.Fatalf("应有 3 项, 得到 %d", len(rep.Items))
	}
	if rep.Pending != 1 {
		t.Errorf("pending 只算必需且未就绪的项, 期望 1, 得到 %d", rep.Pending)
	}
	if rep.Ready {
		t.Error("存在必需项缺失时应 ready=false")
	}
	if rep.Level != EnvLevelCheck {
		t.Errorf("级别应为 check, 得到 %q", rep.Level)
	}
}

// 旧式 requirements: 只检查不安装, 且 Fix 必须是 manual(没有对应 apply 步骤)。
// degraded / unknown 不能把 ready 拉成 false。
//
// 场景: 面板以非 root 运行, 端口确实被占但 ss 看不到占用者 → 判 degraded。
// 这不是"环境坏了", 只是"没法确认"。算成未就绪会让非 root 部署永远红着,
// 反而掩盖真正缺的东西。
func TestReport_DegradedDoesNotBlock(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("无法监听: %v", err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port

	dir := writeManifest(t, `{"name":"demo","environment":{"check":[{"id":"p","type":"port","port":`+
		strconv.Itoa(port)+`,"bind":"127.0.0.1"}]}}`)
	spec, err := LoadEnvSpec(dir)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	r := &EnvRunner{Dir: dir, SelfPID: 0}
	rep := r.Report(spec)

	if len(rep.Items) != 1 {
		t.Fatalf("应有 1 项, 得到 %d", len(rep.Items))
	}
	st := rep.Items[0].Status
	if st == StatusOK {
		t.Fatal("端口被占且没有 owner 声明, 不该判 ok")
	}
	// 非 Linux 环境查不到 pid → degraded; Linux 非 root 也可能查到(自己起的),
	// 那时是 missing。两种情况 ready 的期望不同, 按实际状态断言。
	if st == StatusDegraded || st == StatusUnknown {
		if !rep.Ready || rep.Pending != 0 {
			t.Errorf("degraded/unknown 不应阻断: ready=%v pending=%d", rep.Ready, rep.Pending)
		}
	}
}

func TestReport_LegacyRequirements(t *testing.T) {
	if _, err := exec.LookPath("python3"); err != nil {
		t.Skip("本机没有 python3")
	}
	dir := writeManifest(t, `{"name":"demo","requirements":["definitely_not_a_module_xyz"]}`)
	rep := (&EnvRunner{Dir: dir}).Report(nil)

	if rep.Warn == "" {
		t.Error("旧式声明应给出 warn 说明只能检查")
	}
	if len(rep.Items) != 1 {
		t.Fatalf("应产生 1 条依赖检查, 得到 %d", len(rep.Items))
	}
	it := rep.Items[0]
	if it.Status != StatusMissing {
		t.Errorf("不存在的模块应 missing, 得到 %s", it.Status)
	}
	if it.Fix != FixManual {
		t.Errorf("旧式 requirements 的 fix 必须是 manual, 得到 %s", it.Fix)
	}
	if it.Hint == "" {
		t.Error("应给出可复制的安装命令")
	}
}

// TestRunShell_exitcode_semantics 退出码约定: 1=确定缺失, 2=无法确定, 3=状态可疑。
//
// 这条约定是为"读不到"准备的: 面板以非 root 运行时读不到 root 的私有文件,
// 如果一律当"缺失", 非 root 部署会永远显示"环境未就绪", 把真正缺的东西盖掉。
func TestRunShell_exitcode_semantics(t *testing.T) {
	cases := []struct {
		cmd    string
		want   string
		detail string
	}{
		{"exit 1", StatusMissing, ""},
		{"exit 2", StatusUnknown, "无法确定"},
		{"exit 3", StatusDegraded, "状态可疑"},
		{"exit 0", StatusOK, ""},
	}
	for _, c := range cases {
		r := &EnvRunner{Dir: t.TempDir()}
		it := r.runShell(CheckDef{ID: "x", Run: c.cmd})
		if it.Status != c.want {
			t.Errorf("命令 %q 状态 = %s, 期望 %s (detail=%s)", c.cmd, it.Status, c.want, it.Detail)
		}
		if c.detail != "" && !strings.Contains(it.Detail, c.detail) {
			t.Errorf("命令 %q 的 detail = %q, 应包含 %q", c.cmd, it.Detail, c.detail)
		}
	}
}

// TestRunShell_exitcode2_not_blocking exit 2 的项不该算进 pending。
func TestRunShell_exitcode2_not_blocking(t *testing.T) {
	r := &EnvRunner{Dir: t.TempDir()}
	spec := newSpec(EnvLevelCheck, []CheckDef{
		{ID: "unreadable", Run: "exit 2"},
	}, nil)
	rep := r.Report(spec)
	if !rep.Ready {
		t.Fatalf("无法确定的项不该让环境判为未就绪, pending=%d", rep.Pending)
	}
}
