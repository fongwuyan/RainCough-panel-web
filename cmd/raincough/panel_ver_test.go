package main

import "testing"

// TestVerLess 版本比较 —— 重点覆盖 beta/前导零, 这是面板进入 1.0.0-beta 后
// 最容易出错的地方: 只比数字段会把 1.0.0-beta 与 1.0.0 判成相等,
// 于是「beta → 正式版」这个最典型的升级路径永远检测不到更新。
func TestVerLess(t *testing.T) {
	cases := []struct {
		a, b string
		want bool // a < b ?
		why  string
	}{
		// 基本
		{"1.0.0", "1.0.1", true, "补丁号"},
		{"1.0.1", "1.0.0", false, "反向"},
		{"1.2.0", "1.10.0", true, "数值比较不是字典序"},
		{"1.0.0", "1.0.0", false, "相等"},
		// 预发布: 核心场景
		{"1.0.0-beta", "1.0.0", true, "★ beta < 正式版(必须能检测到升级)"},
		{"1.0.0", "1.0.0-beta", false, "正式版不小于 beta"},
		{"1.0.0-beta", "1.0.0-beta", false, "同预发布相等"},
		{"1.0.0-alpha", "1.0.0-beta", true, "alpha < beta"},
		{"1.0.0-beta", "1.0.0-rc", true, "beta < rc"},
		{"1.0.0-rc", "1.0.0-rc.1", true, "rc < rc.1"},
		{"1.0.0-beta", "1.0.1-beta", true, "预发布之间仍先比数字"},
		{"1.0.0-beta", "1.1.0-beta", true, "同上"},
		// 前导零与 v 前缀
		{"v1.0.0", "1.0.1", true, "v 前缀不影响"},
		{"01.0.0", "1.0.1", true, "前导零不影响"},
		{"1.00.1", "1.0.2", true, "前导零 + 补丁号"},
		{"1.00.1", "1.0.1", false, "前导零等价"},
		// 段数不齐
		{"1.2", "1.2.0", false, "两段与三段等值"},
		{"1.2", "1.2.1", true, "缺省段按 0"},
		// build metadata
		{"1.0.0+build1", "1.0.1", true, "build metadata 忽略"},
		{"1.0.0+build1", "1.0.0+build2", false, "build metadata 不影响相等"},
	}
	for _, c := range cases {
		if got := verLess(c.a, c.b); got != c.want {
			t.Errorf("verLess(%q, %q) = %v, want %v  [%s]", c.a, c.b, got, c.want, c.why)
		}
	}
}

// TestPanelTagRe 只认面板 Release tag, 必须接受 beta 后缀与前导零
func TestPanelTagRe(t *testing.T) {
	yes := []string{"v1.0.0", "v1.0.0-beta", "1.0.0-beta", "v01.0.0", "V1.0.0", "v1.0.0-rc.1", "v1.2.3-beta.2"}
	for _, s := range yes {
		if !panelTagRe.MatchString(s) {
			t.Errorf("%q 应被接受为面板 tag", s)
		}
	}
	no := []string{"env-offline-0.1.0", "v1.0", "v1", "latest", "", "v1.0.0-", "vmobile-1.0.0"}
	for _, s := range no {
		if panelTagRe.MatchString(s) {
			t.Errorf("%q 不应被当作面板 tag", s)
		}
	}
}
