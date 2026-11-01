//go:build !unix

package pluginrt

// IsRoot 非 unix 平台恒为 false。
//
// 面板只部署在 Linux; 这个分支存在的意义是让开发机(Windows)能跑单元测试,
// 而不是支持在 Windows 上部署面板。
func IsRoot() bool { return false }
