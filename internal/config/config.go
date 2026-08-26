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
	Version = "1.0.0"
)

// Config 持有主系统全部运行配置。
type Config struct {
	// 数据层
	DBDSN          string // mysql://user:pass@host:port/db 或 sqlite:///path
	DBPoolSize     int
	DBQueryTimeout int // 单条 SQL 查询超时秒

	// 路径
	BaseDir    string // 仓库根目录
	DataDir    string // 小文件目录(secret 等)
	PluginsDir string // 插件安装目录

	// 插件运行时
	PluginHostPort     int // 0=自动
	PluginStartTimeout int // 就绪等待秒
	PluginMaxChildren  int // 并行子进程上限
	PluginKeepalive    int // 空闲回收秒
	PluginProxyTimeout int // 网关代理到插件子进程超时秒
	PluginRestartMax   int // 单插件连续崩溃最大重启次数

	// HTTP 服务
	HTTPReadTimeout  int // 读请求超时秒(0=不设)
	HTTPWriteTimeout int // 写响应超时秒(0=不设, SSE/大下载需不设)
	HTTPIdleTimeout  int // 空闲连接超时秒

	// sudo(局域网注入兼容)
	SudoPW string
}

// Load 从环境变量读取配置(未设置则使用默认值)。
func Load() *Config {
	base := mustAbs(".")
	return &Config{
		DBDSN:              env("RC_DB", "sqlite:///data/rc.db"),
		DBPoolSize:         envInt("RC_DB_POOL_SIZE", 5),
		DBQueryTimeout:     envInt("RC_DB_QUERY_TIMEOUT", 10),
		BaseDir:            base,
		DataDir:            env("RC_DATA_DIR", filepath.Join(base, "data")),
		PluginsDir:         env("RC_PLUGINS_DIR", filepath.Join(base, "plugins")),
		PluginHostPort:     envInt("RC_PLUGIN_HOST_PORT", 0),
		PluginStartTimeout: envInt("RC_PLUGIN_TIMEOUT", 30),
		PluginMaxChildren:  envInt("RC_PLUGIN_MAX", 24),
		PluginKeepalive:    envInt("RC_PLUGIN_KEEPALIVE", 3600),
		PluginProxyTimeout: envInt("RC_PLUGIN_PROXY_TIMEOUT", 15),
		PluginRestartMax:   envInt("RC_PLUGIN_RESTART_MAX", 5),
		HTTPReadTimeout:    envInt("RC_HTTP_READ_TIMEOUT", 60),
		HTTPWriteTimeout:   envInt("RC_HTTP_WRITE_TIMEOUT", 0),
		HTTPIdleTimeout:    envInt("RC_HTTP_IDLE_TIMEOUT", 120),
		SudoPW:             env("RC_SUDO_PW", os.Getenv("TOUCHGAL_SUDO_PW")),
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
