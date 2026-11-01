package pluginrt

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeManifest(t *testing.T, body string) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(body), 0o644); err != nil {
		t.Fatalf("写 plugin.json 失败: %v", err)
	}
	return dir
}

// 没有 environment 块是最常见的情况, 必须安静返回 nil。
func TestLoadEnvSpec_Absent(t *testing.T) {
	dir := writeManifest(t, `{"name":"demo","version":"1.0.0","requirements":[]}`)
	spec, err := LoadEnvSpec(dir)
	if err != nil {
		t.Fatalf("没有 environment 不该报错: %v", err)
	}
	if spec != nil {
		t.Fatalf("没有 environment 应返回 nil, 得到 %+v", spec)
	}
}

// Windows 编辑器常加 BOM, 直接解析会 invalid character 'ï'。
func TestLoadEnvSpec_BOM(t *testing.T) {
	dir := writeManifest(t, "\xef\xbb\xbf"+`{"name":"demo","environment":{"check":[{"id":"a","run":"true"}]}}`)
	spec, err := LoadEnvSpec(dir)
	if err != nil {
		t.Fatalf("带 BOM 应能解析: %v", err)
	}
	if spec == nil || len(spec.Check) != 1 {
		t.Fatalf("解析结果不对: %+v", spec)
	}
}

// 默认值归一化: level / bind / required / timeout。
func TestLoadEnvSpec_Defaults(t *testing.T) {
	dir := writeManifest(t, `{
	  "name":"demo",
	  "environment":{
	    "check":[{"id":"p","type":"port","port":6710}],
	    "apply":[{"id":"p","run":"echo hi"}]
	  }
	}`)
	spec, err := LoadEnvSpec(dir)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if spec.Level != EnvLevelCheck {
		t.Errorf("level 默认应为 check, 得到 %q", spec.Level)
	}
	if spec.Check[0].Bind != "127.0.0.1" {
		t.Errorf("bind 默认应为 127.0.0.1, 得到 %q", spec.Check[0].Bind)
	}
	if !spec.Check[0].IsRequired() {
		t.Error("required 未声明时应默认 true")
	}
	if got := spec.Check[0].EffectiveTimeout(); got != 30 {
		t.Errorf("检查项默认超时应为 30, 得到 %d", got)
	}
	if got := spec.Apply[0].Needs; got != "auto" {
		t.Errorf("needs 未声明时应默认 auto, 得到 %q", got)
	}
	if got := spec.Apply[0].EffectiveTimeout(); got != 120 {
		t.Errorf("步骤默认超时应为 120, 得到 %d", got)
	}
}

// level=apply 但没写 apply 步骤 —— 自动降级, 不能让前端出现一个空的可执行级别。
func TestEnvSpec_LevelApplyWithoutStepsFallsBack(t *testing.T) {
	dir := writeManifest(t, `{"name":"d","environment":{"level":"apply","check":[{"id":"a","run":"true"}]}}`)
	spec, err := LoadEnvSpec(dir)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if got := spec.EffectiveLevel(); got != EnvLevelCheck {
		t.Errorf("没有 apply 步骤时应降级为 check, 得到 %q", got)
	}
}

func TestLoadEnvSpec_Rejects(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{
			name: "id 重复",
			body: `{"environment":{"check":[{"id":"a","run":"true"},{"id":"a","run":"true"}]}}`,
			want: "id 重复",
		},
		{
			name: "shell 缺 run",
			body: `{"environment":{"check":[{"id":"a"}]}}`,
			want: "缺少 run",
		},
		{
			name: "端口越界",
			body: `{"environment":{"check":[{"id":"p","type":"port","port":80}]}}`,
			want: "端口非法",
		},
		{
			name: "未知 type",
			body: `{"environment":{"check":[{"id":"h","type":"http","run":"x"}]}}`,
			want: "type 不支持",
		},
		{
			name: "port 类型却写了 run",
			body: `{"environment":{"check":[{"id":"p","type":"port","port":6710,"run":"ss"}]}}`,
			want: "不应同时写 run",
		},
		{
			name: "apply 缺 run",
			body: `{"environment":{"apply":[{"id":"a"}]}}`,
			want: "缺少 run",
		},
		{
			name: "needs 非法",
			body: `{"environment":{"apply":[{"id":"a","run":"x","needs":"root2"}]}}`,
			want: "needs 非法",
		},
		{
			name: "owner.plugin 非法",
			body: `{"environment":{"check":[{"id":"p","type":"port","port":6710,"owner":{"plugin":"other"}}]}}`,
			want: "只支持",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := writeManifest(t, c.body)
			_, err := LoadEnvSpec(dir)
			if err == nil {
				t.Fatalf("应报错, 但通过了")
			}
			if !strings.Contains(err.Error(), c.want) {
				t.Fatalf("错误信息应包含 %q, 实际: %v", c.want, err)
			}
		})
	}
}

// Fix 只能来自真实存在的 apply 步骤 —— 否则前端会渲染出点了没反应的按钮。
func TestFixFor(t *testing.T) {
	spec := &EnvironmentSpec{
		Apply: []ApplyDef{
			{ID: "auto1", Run: "x"},
			{ID: "root1", Run: "x", Needs: "root"},
			{ID: "linked", Run: "x", Check: "c2"},
		},
	}
	cases := []struct {
		check CheckDef
		want  string
	}{
		{CheckDef{ID: "auto1"}, FixAuto},
		{CheckDef{ID: "root1"}, FixRoot},
		{CheckDef{ID: "c2"}, FixAuto},                                   // 通过 check 字段关联
		{CheckDef{ID: "nope"}, FixNone},                                 // 无步骤无链接
		{CheckDef{ID: "nope", Guide: "https://example.com"}, FixManual}, // 有链接
	}
	for _, c := range cases {
		if got := spec.fixFor(c.check); got != c.want {
			t.Errorf("check %s: 期望 fix=%s, 得到 %s", c.check.ID, c.want, got)
		}
	}

	// spec 为 nil 时不能 panic
	var nilSpec *EnvironmentSpec
	if got := nilSpec.fixFor(CheckDef{ID: "x"}); got != FixNone {
		t.Errorf("nil spec 应返回 none, 得到 %s", got)
	}
}
