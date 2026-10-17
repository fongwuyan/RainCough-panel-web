package legacy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// readLog 读目标 KV 日志, 返回 key→value(原始 JSON)
func readLog(t *testing.T, dir, ns string) map[string]string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(dir, ns+".log"))
	if err != nil {
		t.Fatalf("读 %s.log 失败: %v", ns, err)
	}
	out := map[string]string{}
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var rec struct {
			K string          `json:"k"`
			V json.RawMessage `json:"v"`
			X bool            `json:"x"`
		}
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("日志行不是合法 JSON: %q", line)
		}
		if rec.X {
			delete(out, rec.K)
			continue
		}
		out[rec.K] = string(rec.V)
	}
	return out
}

// TestMigrate_endToEnd 端到端: 真实库 → KV, 内容与 SQLite 一致
func TestMigrate_endToEnd(t *testing.T) {
	dst := t.TempDir()
	rep, err := Migrate(MigrateOptions{Src: fixturePath("legacy_fixture.db"), DstDir: dst})
	if err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	expect := loadExpect(t)

	// core_terminal: 3 行(含 WAL 那份在 fixture 里已 checkpoint)
	term := readLog(t, dst, "core_terminal")
	if len(term) != 3 {
		t.Fatalf("core_terminal 应有 3 个键, 实得 %d: %v", len(term), term)
	}
	for _, kv := range expect["ns_core_terminal_kv"] {
		got, ok := term[kv[0]]
		if !ok {
			t.Fatalf("缺少键 %q", kv[0])
		}
		if got != kv[1] {
			t.Fatalf("%s 值不一致\n 得到 %q\n 期望 %q", kv[0], got, kv[1])
		}
	}
	// registry 应被跳过(运行时缓存), 不应生成 core_registry.log
	if _, err := os.Stat(filepath.Join(dst, "core_registry.log")); err == nil {
		t.Fatalf("core_registry 不应被迁移")
	}
	// core_tasks 应迁移
	tasks := readLog(t, dst, "core_tasks")
	if len(tasks) != 2 {
		t.Fatalf("core_tasks 应有 2 个键, 实得 %d", len(tasks))
	}
	// 报告里 core_registry 标记为 skipped 且有理由
	var found bool
	for _, tb := range rep.Tables {
		if tb.Namespace == "core_registry" {
			found = true
			if tb.Action != "skipped" || tb.Reason == "" {
				t.Fatalf("core_registry 应 skipped 且带理由, 实得 %+v", tb)
			}
			if tb.Rows != 600 {
				t.Fatalf("core_registry 应统计到 600 行, 实得 %d", tb.Rows)
			}
		}
	}
	if !found {
		t.Fatalf("报告里缺少 core_registry")
	}
	t.Logf("写入 %d 行, 共 %d 字节", rep.TotalWritten, rep.TotalWritten)
}

// TestMigrate_overflowVerbatim 300KB overflow 值必须原样搬过去(不截断、不改写)
func TestMigrate_overflowVerbatim(t *testing.T) {
	dst := t.TempDir()
	if _, err := Migrate(MigrateOptions{Src: fixturePath("legacy_fixture.db"), DstDir: dst}); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	// ★ uptime 是"被抛弃的旧插件", 它的 overflow 值不再迁移 —— 这里用 ForceNamespaces
	//   显式指定, 验证的是"读取器/写入器能否原样搬运 300KB 值", 与保留策略无关
	if _, err := Migrate(MigrateOptions{
		Src: fixturePath("legacy_fixture.db"), DstDir: dst,
		ForceNamespaces: []string{"uptime"},
	}); err != nil {
		t.Fatalf("Migrate(force uptime): %v", err)
	}
	up := readLog(t, dst, "uptime")
	v, ok := up["uptime:targets"]
	if !ok {
		t.Fatalf("缺少 uptime:targets: %v", up)
	}
	var probe struct {
		Blob string `json:"blob"`
		Tag  string `json:"tag"`
	}
	if err := json.Unmarshal([]byte(v), &probe); err != nil {
		t.Fatalf("迁移后的值不是合法 JSON: %v", err)
	}
	if len(probe.Blob) != 300000 || probe.Tag != "overflow-test" {
		t.Fatalf("值被截断或错位: blob=%d tag=%q", len(probe.Blob), probe.Tag)
	}
}

// TestMigrate_doesNotOverwrite 目标已有同名键时必须保留新数据(不覆盖)
func TestMigrate_doesNotOverwrite(t *testing.T) {
	dst := t.TempDir()
	// 预置一条"新面板刚写过"的记录
	pre := `{"k":"hosts","v":[{"name":"new-panel"}],"t":1899999999}` + "\n"
	if err := os.WriteFile(filepath.Join(dst, "core_terminal.log"), []byte(pre), 0o640); err != nil {
		t.Fatal(err)
	}

	rep, err := Migrate(MigrateOptions{Src: fixturePath("legacy_fixture.db"), DstDir: dst})
	if err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	got := readLog(t, dst, "core_terminal")
	if !strings.Contains(got["hosts"], "new-panel") {
		t.Fatalf("已存在的键被覆盖了: %q", got["hosts"])
	}
	// 其余键应补齐(commands / wal_only_key)
	if len(got) != 3 {
		t.Fatalf("应补齐到 3 个键, 实得 %d: %v", len(got), got)
	}
	// 报告要统计跳过数
	var skipped int
	for _, tb := range rep.Tables {
		if tb.Namespace == "core_terminal" {
			skipped = tb.SkippedExisting
		}
	}
	if skipped != 1 {
		t.Fatalf("SkippedExisting 应为 1, 实得 %d", skipped)
	}
}

// TestMigrate_forceOverwrite Force 时覆盖
func TestMigrate_forceOverwrite(t *testing.T) {
	dst := t.TempDir()
	pre := `{"k":"hosts","v":["old"],"t":1}` + "\n"
	if err := os.WriteFile(filepath.Join(dst, "core_terminal.log"), []byte(pre), 0o640); err != nil {
		t.Fatal(err)
	}
	if _, err := Migrate(MigrateOptions{Src: fixturePath("legacy_fixture.db"), DstDir: dst, Force: true}); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	got := readLog(t, dst, "core_terminal")
	if strings.Contains(got["hosts"], `"old"`) {
		t.Fatalf("Force 应覆盖旧值, 实得 %q", got["hosts"])
	}
}

// TestMigrate_dryRun 干跑不落盘
func TestMigrate_dryRun(t *testing.T) {
	dst := t.TempDir()
	rep, err := Migrate(MigrateOptions{Src: fixturePath("legacy_fixture.db"), DstDir: dst, DryRun: true})
	if err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	if rep.TotalWritten == 0 {
		t.Fatalf("干跑也应报告将要写入的行数")
	}
	ents, _ := os.ReadDir(dst)
	for _, e := range ents {
		t.Fatalf("干跑不应写任何文件, 却出现了 %s", e.Name())
	}
	if HasMigrated(dst) {
		t.Fatalf("干跑不应写迁移标记")
	}
}

// TestMigrate_idempotent 重复迁移不应产生重复行
func TestMigrate_idempotent(t *testing.T) {
	dst := t.TempDir()
	src := fixturePath("legacy_fixture.db")
	if _, err := Migrate(MigrateOptions{Src: src, DstDir: dst}); err != nil {
		t.Fatalf("第一次: %v", err)
	}
	first := len(readLog(t, dst, "core_tasks"))

	rep, err := Migrate(MigrateOptions{Src: src, DstDir: dst})
	if err != nil {
		t.Fatalf("第二次: %v", err)
	}
	second := len(readLog(t, dst, "core_tasks"))
	if first != second {
		t.Fatalf("重复迁移后键数变化: %d → %d", first, second)
	}
	if rep.TotalWritten != 0 {
		t.Fatalf("第二次不应再写入, 实得 %d", rep.TotalWritten)
	}
	if !HasMigrated(dst) {
		t.Fatalf("应写迁移标记")
	}
}

// TestMigrate_skipsRemovedFeatures 已移除功能/被抛弃插件对应的命名空间应跳过并说明理由
func TestMigrate_skipsRemovedFeatures(t *testing.T) {
	for ns, wantReason := range coreSkip {
		reason, skip := skipReason(ns)
		if !skip {
			t.Fatalf("%s 应跳过", ns)
		}
		if reason != wantReason {
			t.Fatalf("%s 理由 = %q, 期望 %q", ns, reason, wantReason)
		}
	}
	// ★ 用户决定: 旧面板 17 个插件只保留 JMComic, 其余插件命名空间必须跳过
	dropped := []string{
		"uptime", "webspy", "vpn", "touchgal", "laizhangsetu",
		"mcserver", "docker", "jmcomic_old_compat_should_drop",
	}
	for _, ns := range dropped {
		reason, skip := skipReason(ns)
		if !skip {
			t.Fatalf("被抛弃的插件 %s 应跳过迁移", ns)
		}
		if reason != pluginDropReason {
			t.Fatalf("%s 理由 = %q, 期望统一文案", ns, reason)
		}
	}
	// 唯一保留的插件必须迁移
	if _, skip := skipReason("jmcomic"); skip {
		t.Fatalf("jmcomic 是唯一保留的旧插件, 不应跳过")
	}
	// core 白名单必须迁移
	for ns := range coreKeep {
		if _, skip := skipReason(ns); skip {
			t.Fatalf("%s 在白名单里, 不应跳过", ns)
		}
	}
	// 未知 core_ 默认跳过(白名单策略, 防止将来新增的 core_xxx 被误搬)
	if _, skip := skipReason("core_brandnew"); !skip {
		t.Fatalf("未知 core 命名空间应默认跳过")
	}
}

// TestNSFromTable 表名解析
func TestNSFromTable(t *testing.T) {
	ok := map[string]string{
		"ns_core_terminal_kv": "core_terminal",
		"ns_jmcomic_kv":       "jmcomic",
		"NS_UPTIME_KV":        "uptime",
	}
	for in, want := range ok {
		got, good := nsFromTable(in)
		if !good || got != want {
			t.Fatalf("nsFromTable(%q) = (%q,%v), want (%q,true)", in, got, good, want)
		}
	}
	for _, bad := range []string{"ns__kv", "kv", "ns_x", "ns_bad-name_kv", "other_table"} {
		if _, good := nsFromTable(bad); good {
			t.Fatalf("nsFromTable(%q) 应拒绝", bad)
		}
	}
}

// TestMigrate_walOnlySource 源库数据只在 WAL 里也要完整迁移
func TestMigrate_walOnlySource(t *testing.T) {
	dst := t.TempDir()
	if _, err := Migrate(MigrateOptions{Src: fixturePath("wal_only.db"), DstDir: dst}); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	term := readLog(t, dst, "core_terminal")
	if _, ok := term["wal_only_key"]; !ok {
		t.Fatalf("只存在于 WAL 的键没被迁移: %v", term)
	}
	reg := readLog(t, dst, "core_tasks")
	if len(reg) != 2 {
		t.Fatalf("core_tasks 应迁 2 条, 实得 %d", len(reg))
	}
}

// TestMigrate_invalidJSONStoredAsString 非 JSON 的 value 应存成 JSON 字符串(不丢内容)
func TestMigrate_invalidJSONStoredAsString(t *testing.T) {
	// 用 legacy_fixture 里现成的数据造不出来, 这里直接测 writeNamespaceLog
	dst := t.TempDir()
	rows := []Row{
		{RowID: 1, Cols: []Value{
			{Kind: 't', Text: "plain"},
			{Kind: 't', Text: "not json at all"},
			{Kind: 'i', Int: 123},
		}},
	}
	written, _, invalid, _, err := writeNamespaceLog(rows, dst, "demo", false, false)
	if err != nil {
		t.Fatalf("writeNamespaceLog: %v", err)
	}
	if written != 1 || invalid != 1 {
		t.Fatalf("written=%d invalid=%d, want 1/1", written, invalid)
	}
	got := readLog(t, dst, "demo")
	if got["plain"] != `"not json at all"` {
		t.Fatalf("非 JSON 值应存成 JSON 字符串, 实得 %q", got["plain"])
	}
}
