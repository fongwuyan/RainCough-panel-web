package pluginrt

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// slash 把路径转成正斜杠。
//
// ★ 必须转: Windows 上 filepath.Join 给出的是 C://a//b, 而命令跑在 sh 里 ——
//
//	反斜杠会被当转义符吃掉(C://a//b → C:ab), 文件落到别处,
//	测试会"因为错误的理由通过"(touch 和 test -f 犯的是同一个错, 互相抵消)。
func slash(p string) string { return filepath.ToSlash(p) }

// newSpec 造一个已归一化的清单(测试直接用结构体, 跳过文件解析)。
func newSpec(level string, checks []CheckDef, applies []ApplyDef) *EnvironmentSpec {
	s := &EnvironmentSpec{Level: level, Check: checks, Apply: applies}
	if err := s.normalize(); err != nil {
		panic(err)
	}
	return s
}

// TestApply_requires_confirm 未确认一律拒绝 —— 后端硬门槛。
func TestApply_requires_confirm(t *testing.T) {
	dir := t.TempDir()
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply, nil, []ApplyDef{
		{ID: "x", Run: "touch /tmp/rc-apply-should-not-exist"},
	})
	if _, err := r.Apply(spec, nil, false); err == nil {
		t.Fatal("未确认时不应执行")
	}
	if _, err := os.Stat("/tmp/rc-apply-should-not-exist"); err == nil {
		t.Fatal("未确认竟然执行了命令")
	}
}

// TestApply_level_check_is_readonly level=check 的清单不允许执行。
//
// 这是"清单非法不影响安装"的另一面: 声明只读的插件, 面板绝不替它改系统。
func TestApply_level_check_is_readonly(t *testing.T) {
	dir := t.TempDir()
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelCheck, nil, []ApplyDef{{ID: "x", Run: "true"}})
	_, err := r.Apply(spec, nil, true)
	if err == nil {
		t.Fatal("level=check 时应拒绝执行")
	}
	if !strings.Contains(err.Error(), "只读") {
		t.Fatalf("错误信息应说明是只读级别, 实得: %v", err)
	}
}

// TestApply_unknown_step_rejected 未知步骤 id 报错, 不静默忽略。
func TestApply_unknown_step_rejected(t *testing.T) {
	dir := t.TempDir()
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply, nil, []ApplyDef{{ID: "known", Run: "true"}})
	if _, err := r.Apply(spec, []string{"unknown"}, true); err == nil {
		t.Fatal("未知步骤 id 应报错")
	}
}

// TestApply_executes_in_order 步骤按声明顺序执行, 结果逐条返回。
func TestApply_executes_in_order(t *testing.T) {
	dir := t.TempDir()
	out := slash(filepath.Join(dir, "order.txt"))
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply, nil, []ApplyDef{
		{ID: "one", Run: "echo one >> " + out},
		{ID: "two", Run: "echo two >> " + out},
	})
	res, err := r.Apply(spec, nil, true)
	if err != nil {
		t.Fatalf("执行出错: %v", err)
	}
	if len(res.Steps) != 2 {
		t.Fatalf("应有 2 步, 实得 %d", len(res.Steps))
	}
	for i, st := range res.Steps {
		if st.Status != StepOK {
			t.Fatalf("步骤 %d 状态 = %s, 期望 ok (%s)", i, st.Status, st.Detail)
		}
	}
	b, _ := os.ReadFile(out)
	got := strings.Fields(string(b))
	if len(got) != 2 || got[0] != "one" || got[1] != "two" {
		t.Fatalf("执行顺序不对: %v", got)
	}
	if !res.OK {
		t.Fatal("全部成功时 OK 应为 true")
	}
}

// TestApply_failure_stops_following 失败即停: 后续步骤不执行。
func TestApply_failure_stops_following(t *testing.T) {
	dir := t.TempDir()
	marker := slash(filepath.Join(dir, "second-ran"))
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply, nil, []ApplyDef{
		{ID: "bad", Run: "exit 3"},
		{ID: "second", Run: "touch " + marker},
	})
	res, err := r.Apply(spec, nil, true)
	if err != nil {
		t.Fatalf("步骤失败不应返回 error: %v", err)
	}
	if res.OK {
		t.Fatal("有步骤失败时 OK 应为 false")
	}
	if res.Steps[0].Status != StepFailed {
		t.Fatalf("第一步状态 = %s, 期望 failed", res.Steps[0].Status)
	}
	if res.Steps[1].Status != StepSkipped {
		t.Fatalf("第二步状态 = %s, 期望 skipped", res.Steps[1].Status)
	}
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("失败后后续步骤仍被执行了")
	}
}

// TestApply_skips_when_check_ok 关联的检查项已 ok 时跳过(幂等)。
func TestApply_skips_when_check_ok(t *testing.T) {
	dir := t.TempDir()
	marker := slash(filepath.Join(dir, "should-not-exist"))
	r := &EnvRunner{Dir: dir}
	// check 项 "dep" 用一个必然成功的命令 → 状态 ok
	spec := newSpec(EnvLevelApply,
		[]CheckDef{{ID: "dep", Run: "true"}},
		[]ApplyDef{{ID: "install-dep", Run: "touch " + marker, Check: "dep"}},
	)
	res, err := r.Apply(spec, nil, true)
	if err != nil {
		t.Fatalf("执行出错: %v", err)
	}
	if res.Steps[0].Status != StepSkipped {
		t.Fatalf("状态 = %s, 期望 skipped(检查已通过)", res.Steps[0].Status)
	}
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("检查已通过却仍执行了命令")
	}
}

// TestApply_runs_when_check_missing 关联的检查项缺失时必须真的执行。
func TestApply_runs_when_check_missing(t *testing.T) {
	dir := t.TempDir()
	marker := slash(filepath.Join(dir, "ran"))
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply,
		[]CheckDef{{ID: "dep", Run: "exit 1"}},
		[]ApplyDef{{ID: "install-dep", Run: "touch " + marker, Check: "dep"}},
	)
	res, err := r.Apply(spec, nil, true)
	if err != nil {
		t.Fatalf("执行出错: %v", err)
	}
	if res.Steps[0].Status != StepOK {
		t.Fatalf("状态 = %s, 期望 ok", res.Steps[0].Status)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("检查未通过却没有执行修复命令")
	}
}

// TestApply_root_step_denied_when_not_root 非 root 面板上 root 步骤被拒绝。
//
// 关键: 不是"用 sudo 试试", 是干脆不执行 —— 面板不该替用户提权。
func TestApply_root_step_denied_when_not_root(t *testing.T) {
	dir := t.TempDir()
	marker := slash(filepath.Join(dir, "should-not-exist"))
	r := &EnvRunner{Dir: dir, Root: false}
	spec := newSpec(EnvLevelApply, nil, []ApplyDef{
		{ID: "unit", Run: "touch " + marker, Needs: "root"},
	})
	res, err := r.Apply(spec, nil, true)
	if err != nil {
		t.Fatalf("执行出错: %v", err)
	}
	if res.Steps[0].Status != StepDenied {
		t.Fatalf("状态 = %s, 期望 denied", res.Steps[0].Status)
	}
	if res.Denied != 1 {
		t.Fatalf("denied 计数 = %d, 期望 1", res.Denied)
	}
	if res.OK {
		t.Fatal("有步骤被拒时 OK 应为 false(不能报成功)")
	}
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("非 root 下仍执行了 root 步骤")
	}
}

// TestApply_root_step_runs_when_root root 面板上 root 步骤正常执行。
func TestApply_root_step_runs_when_root(t *testing.T) {
	dir := t.TempDir()
	marker := slash(filepath.Join(dir, "ran"))
	r := &EnvRunner{Dir: dir, Root: true}
	spec := newSpec(EnvLevelApply, nil, []ApplyDef{
		{ID: "unit", Run: "touch " + marker, Needs: "root"},
	})
	res, err := r.Apply(spec, nil, true)
	if err != nil {
		t.Fatalf("执行出错: %v", err)
	}
	if res.Steps[0].Status != StepOK {
		t.Fatalf("状态 = %s, 期望 ok(%s)", res.Steps[0].Status, res.Steps[0].Detail)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("root 步骤没有执行")
	}
}

// TestApply_selective_steps 只执行请求的步骤。
func TestApply_selective_steps(t *testing.T) {
	dir := t.TempDir()
	marker := slash(filepath.Join(dir, "b-ran"))
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply, nil, []ApplyDef{
		{ID: "a", Run: "true"},
		{ID: "b", Run: "touch " + marker},
	})
	res, err := r.Apply(spec, []string{"b"}, true)
	if err != nil {
		t.Fatalf("执行出错: %v", err)
	}
	if len(res.Steps) != 1 || res.Steps[0].ID != "b" {
		t.Fatalf("应只执行 b, 实得 %+v", res.Steps)
	}
}

// TestApply_returns_fresh_report 执行完重新检查, 前端一次刷新到位。
func TestApply_returns_fresh_report(t *testing.T) {
	dir := t.TempDir()
	marker := slash(filepath.Join(dir, "dep"))
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply,
		[]CheckDef{{ID: "dep", Run: "test -f " + marker}},
		[]ApplyDef{{ID: "install-dep", Run: "touch " + marker, Check: "dep"}},
	)
	res, err := r.Apply(spec, nil, true)
	if err != nil {
		t.Fatalf("执行出错: %v", err)
	}
	if res.Report == nil {
		t.Fatal("应返回重新检查的报告")
	}
	if !res.Report.Ready {
		t.Fatalf("修复后应就绪, 实得 pending=%d", res.Report.Pending)
	}
}

// TestApply_no_apply_steps 清单没声明 apply 时报错。
func TestApply_no_apply_steps(t *testing.T) {
	dir := t.TempDir()
	r := &EnvRunner{Dir: dir}
	spec := newSpec(EnvLevelApply, nil, nil)
	if _, err := r.Apply(spec, nil, true); err == nil {
		t.Fatal("没有 apply 步骤时应报错")
	}
}
