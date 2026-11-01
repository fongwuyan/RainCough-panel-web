// Package config 统一配置: 全部从环境变量 RC_* 读取, 提供默认值。
package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	AppName = "RainCough"
	// Version 面板版本。发布时与 git tag(去掉 v 前缀)保持一致。
	// 当前为 beta: 1.0.0-beta(git tag 为 v1.0.0-beta) —— 前导零与预发布后缀按风悟言要求保留,
	// 版本比较走语义化比较(见 web/src/components/plugins/usePluginHub.js 的 cmpVer),
	// 前导零不影响比较; install.sh 的版本正则也已放宽以接受这种形态。
	Version = "1.0.0-beta.2"
)

// Config 持有主系统全部运行配置。
type Config struct {
	// 数据层
	DBDSN string // mysql://user:pass@host:port/db 或 sqlite:///path

	// 路径
	BaseDir    string // 仓库根目录
	DataDir    string // 小文件目录(secret 等)
	PluginsDir string // 插件安装目录

	// 插件运行时
	PluginRestartMax int // 单插件连续崩溃最大重启次数

	// HTTP 服务
	HTTPReadTimeout  int // 读请求超时秒(0=不设)
	HTTPWriteTimeout int // 写响应超时秒(0=不设, SSE/大下载需不设)
	HTTPIdleTimeout  int // 空闲连接超时秒
}

// 2026-11-01 内置功能审计删除的死配置(设了也不生效, 只会误导运维):
//
//	DBPoolSize / DBQueryTimeout   —— v3 的 DB 连接池, 现走 shared 的 sqlite KV
//	PluginHostPort / PluginStartTimeout / PluginMaxChildren /
//	PluginKeepalive / PluginProxyTimeout
//	                              —— v3 插件模型(网关代理 + 子进程池)的参数;
//	                                 v4 由 internal/supervisor 管进程, 用 supervisor.Options
//	SudoPW                        —— 从 RC_SUDO_PW / TOUCHGAL_SUDO_PW 读一个 sudo 密码,
//	                                 全仓从未使用。一个"看起来存着 root 密码"的死字段
//	                                 比没有这个字段更危险, 已删除。
//
// 保留 PluginRestartMax: supervisor 真的读它。

// Load 从环境变量读取配置(未设置则使用默认值)。
func Load() *Config {
	base := mustAbs(".")
	return &Config{
		DBDSN:            env("RC_DB", "sqlite:///rc.db"), // 相对 DataDir => <data>/rc.db(避免 data/data 双嵌套)
		BaseDir:          base,
		DataDir:          env("RC_DATA_DIR", filepath.Join(base, "data")),
		PluginsDir:       env("RC_PLUGINS_DIR", filepath.Join(base, "plugins")),
		PluginRestartMax: envInt("RC_PLUGIN_RESTART_MAX", 5),
		HTTPReadTimeout:  envInt("RC_HTTP_READ_TIMEOUT", 60),
		HTTPWriteTimeout: envInt("RC_HTTP_WRITE_TIMEOUT", 0),
		HTTPIdleTimeout:  envInt("RC_HTTP_IDLE_TIMEOUT", 120),
	}
}

// ResolveDSN 将相对 sqlite 路径解析为绝对路径(相对 DataDir)。
func (c *Config) ResolveDSN() string {
	const prefix = "sqlite:///"
	dsn := c.DBDSN
	if strings.HasPrefix(dsn, prefix) {
		p := dsn[len(prefix):]
		if !filepath.IsAbs(p) {
			p = filepath.Join(c.DataDir, p)
		}
		if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
			// 目录创建失败时原样返回, 连接阶段会报错
			return dsn
		}
		return prefix + p
	}
	return dsn
}

func mustAbs(p string) string {
	a, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return a
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
