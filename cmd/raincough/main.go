// RainCough Core — 主系统入口。
// 组装: 配置/数据层/插件运行时/核心 API/静态前端。
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"raincough/internal/config"
	"raincough/internal/core"
	"raincough/internal/host"
	"raincough/internal/shared"
)

type server struct {
	cfg  *config.Config
	sd   *shared.Shared
	host *host.PluginHost
}

func main() {
	port := flag.Int("port", 3000, "监听端口")
	flag.Parse()

	cfg := config.Load()
	if os.Getenv("RC_PORT") != "" {
		if p, err := strconv.Atoi(os.Getenv("RC_PORT")); err == nil && p > 0 {
			*port = p
		}
	}

	// 数据层(单条查询带超时, 防止 DB 卡死拖垮主进程)
	sd, err := shared.OpenWithTimeout(cfg.ResolveDSN(),
		time.Duration(cfg.DBQueryTimeout)*time.Second)
	if err != nil {
		log.Fatalf("数据层初始化失败: %v", err)
	}
	defer sd.Close()

	// 插件运行时
	ph := host.NewWithOptions(cfg.PluginsDir, cfg.ResolveDSN(), host.Options{
		MaxChildren:  cfg.PluginMaxChildren,
		ProxyTimeout: time.Duration(cfg.PluginProxyTimeout) * time.Second,
		RestartMax:   cfg.PluginRestartMax,
	})
	ph.SetSudoPW(cfg.SudoPW)
	for _, msg := range ph.Scan() {
		log.Println(msg)
	}
	stopWd := make(chan struct{})
	go ph.Watchdog(stopWd, 5*time.Second)

	// 任务队列 + 调度器(core_tasks / core_scheduler namespace)
	taskNS, err := sd.Namespace("core_tasks")
	if err != nil {
		log.Fatalf("任务 namespace 初始化失败: %v", err)
	}
	globalTasks = core.NewTaskStore(taskNS)
	globalTasks.LoadPersisted()
	taskCleanupStop := make(chan struct{})
	go func() {
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			select {
			case <-taskCleanupStop:
				return
			case <-t.C:
				globalTasks.Cleanup(7)
			}
		}
	}()

	schedNS, err := sd.Namespace("core_scheduler")
	if err != nil {
		log.Fatalf("调度器 namespace 初始化失败: %v", err)
	}
	globalSched = core.NewScheduler(schedNS, nil)
	globalSched.Start()

	// 终端管理器 + 闲置回收
	globalTerm = core.NewTermManager()
	go func() {
		t := time.NewTicker(5 * time.Minute)
		defer t.Stop()
		for {
			select {
			case <-taskCleanupStop:
				return
			case <-t.C:
				globalTerm.Cleanup(60)
			}
		}
	}()

	// 环境包管理器
	envNS, err := sd.Namespace("core_envpkg")
	if err != nil {
		log.Fatalf("环境包 namespace 初始化失败: %v", err)
	}
	envRoot := os.Getenv("RC_ENV_ROOT")
	if envRoot == "" {
		envRoot = "/opt/envs"
	}
	globalEnv = core.NewEnvManager(envRoot, envNS)

	// 插件市场(回调: 安装/卸载后触发 PluginHost 重扫)
	storeNS, err := sd.Namespace("core_store")
	if err != nil {
		log.Fatalf("插件市场 namespace 初始化失败: %v", err)
	}
	globalStore = core.NewStore(storeNS, cfg.PluginsDir, func() {
		for _, msg := range ph.Scan() {
			log.Println(msg)
		}
	})

	// 系统中心(服务/进程/日志/防火墙)
	globalSys = core.NewSysCenter(cfg.SudoPW)

	// 终端主机/常用命令存储
	initTermNS(sd)
	initMediaNS(sd)

	// 性能趋势采样(每 60s 一点, 供工作台 SysPerf)
	go perfSampler()

	s := &server{cfg: cfg, sd: sd, host: ph}
	mux := http.NewServeMux()
	s.routes(mux)

	httpServer := &http.Server{
		Addr:              fmt.Sprintf("0.0.0.0:%d", *port),
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	if cfg.HTTPReadTimeout > 0 {
		httpServer.ReadTimeout = time.Duration(cfg.HTTPReadTimeout) * time.Second
	}
	if cfg.HTTPWriteTimeout > 0 {
		// 0=不设(SSE 终端/大文件下载不能有写超时)
		httpServer.WriteTimeout = time.Duration(cfg.HTTPWriteTimeout) * time.Second
	}
	if cfg.HTTPIdleTimeout > 0 {
		httpServer.IdleTimeout = time.Duration(cfg.HTTPIdleTimeout) * time.Second
	}

	// 优雅退出
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sig
		close(stopWd)
		close(taskCleanupStop)
		globalSched.Stop()
		ph.Shutdown()
		sd.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		httpServer.Shutdown(ctx)
	}()

	log.Printf("RainCough Core v%s 已启动: http://0.0.0.0:%d", config.Version, *port)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

// routes 注册全部路由。
func (s *server) routes(mux *http.ServeMux) {
	// ---- 核心 API ----
	mux.HandleFunc("/api/system", s.handleSystem)
	mux.HandleFunc("/api/system/", s.handleSystemSub)

	// ---- 文件管理 ----
	mux.HandleFunc("/api/fm/ops", s.handleFmOps)       // 列表只在无子路径时生效
	mux.HandleFunc("/api/fm/ops/", s.handleFmOps)      // {id}/cancel/download
	mux.HandleFunc("/api/fm/unzip", s.handleFmUnzip)
	mux.HandleFunc("/api/fm/", s.handleFm)

	// ---- 任务队列 + 调度器 ----
	mux.HandleFunc("/api/tasks", s.handleTasks)
	mux.HandleFunc("/api/tasks/", s.handleTaskDetail)
	mux.HandleFunc("/api/scheduler/jobs", s.handleSchedulerJobs)

	// ---- 终端 ----
	mux.HandleFunc("/api/terminal/open", s.handleTermOpen)
	mux.HandleFunc("/api/terminal/stream", s.handleTermStream)
	mux.HandleFunc("/api/terminal/input", s.handleTermInput)
	mux.HandleFunc("/api/terminal/resize", s.handleTermResize)
	mux.HandleFunc("/api/terminal/close", s.handleTermClose)
	mux.HandleFunc("/api/terminal/sessions", s.handleTermSessions)
	mux.HandleFunc("/api/terminal/hosts", s.handleTermHosts)
	mux.HandleFunc("/api/terminal/commands", s.handleTermCommands)

	// ---- 环境包 ----
	mux.HandleFunc("/api/envpkg/recipes", s.handleEnvRecipes)
	mux.HandleFunc("/api/envpkg/envs", s.handleEnvList)
	mux.HandleFunc("/api/envpkg/catalog", s.handleEnvCatalog)
	mux.HandleFunc("/api/envpkg/install", s.handleEnvInstall)
	mux.HandleFunc("/api/envpkg/tasks/", s.handleEnvTask)
	mux.HandleFunc("/api/envpkg/uninstall", s.handleEnvUninstall)
	mux.HandleFunc("/api/envpkg/run", s.handleEnvRun)

	// ---- 插件市场 ----
	mux.HandleFunc("/api/store/settings", s.handleStoreSettings)
	mux.HandleFunc("/api/store/ping", s.handleStorePing)
	mux.HandleFunc("/api/store/registry", s.handleStoreRegistry)
	mux.HandleFunc("/api/store/plugin/install", s.handleStorePluginInstall)
	mux.HandleFunc("/api/store/plugin/remove", s.handleStorePluginRemove)

	// ---- 系统中心(服务/进程/日志/防火墙) ----
	mux.HandleFunc("/api/sysfunc/", s.handleSysCenter)
	mux.HandleFunc("/api/sysfunc/hardware", s.sysfHardware)
	mux.HandleFunc("/api/sysfunc/updates/", s.sysfUpdates)
	mux.HandleFunc("/api/sysfunc/updates", s.sysfUpdates)
	mux.HandleFunc("/api/sysfunc/cron/", s.sysfCron)
	mux.HandleFunc("/api/sysfunc/cron", s.sysfCron)
	mux.HandleFunc("/api/sysfunc/disks/fs", s.sysfDisks)
	mux.HandleFunc("/api/sysfunc/snapshot/", s.sysfSnap)
	mux.HandleFunc("/api/sysfunc/users", s.sysfUsers)
	mux.HandleFunc("/api/sysfunc/ssh/keys", s.sysfSshKeys)
	mux.HandleFunc("/api/sysfunc/ssh/keys/save", s.sysfSshKeysSave)
	mux.HandleFunc("/api/sysfunc/clean/", s.sysfClean)
	mux.HandleFunc("/api/sysfunc/pwr/", s.sysfPwr)
	mux.HandleFunc("/api/sysfunc/kernels", s.sysfKernels)
	mux.HandleFunc("/api/sysfunc/kernels/remove", s.sysfKernels)
	mux.HandleFunc("/api/sysfunc/time/", s.sysfTime)
	mux.HandleFunc("/api/sysfunc/time", s.sysfTime)
	mux.HandleFunc("/api/sysfunc/health/", s.sysfHealth)
	mux.HandleFunc("/api/sysfunc/events/timeline", s.sysfEvents)
	mux.HandleFunc("/api/sysfunc/logrotate/", s.sysfLogrotate)
	mux.HandleFunc("/api/sysfunc/boot/history", s.sysfBootHistory)
	mux.HandleFunc("/api/sysfunc/perf/", s.sysfPerfNet)
	mux.HandleFunc("/api/sysfunc/net/status", s.sysfPerfNet)

	// ---- 旧前端兼容端点 ----
	mux.HandleFunc("/api/disks", s.handleDisks)
	mux.HandleFunc("/api/disks/unmount", s.handleDiskUnmount)
	mux.HandleFunc("/api/storage", s.handleStorage)
	mux.HandleFunc("/api/terminal/ws_token", s.handleWsToken)
	mux.HandleFunc("/api/terminal/hosts/set_sort", s.handleTermHostsSetSort)
	mux.HandleFunc("/api/sys/processes/kill", s.handleSysKill)
	mux.HandleFunc("/api/sys/logs", s.handleSysLogs)
	mux.HandleFunc("/api/sys/processes", s.handleSysProcesses)
	mux.HandleFunc("/api/tasks/purge", s.handleTasksPurge)
	mux.HandleFunc("/api/scheduler/actions", s.handleSchedulerActions)
	mux.HandleFunc("/api/scheduler/jobs/", s.handleSchedulerJob)
	mux.HandleFunc("/api/envpkg/start", s.handleEnvStartStop)
	mux.HandleFunc("/api/envpkg/stop", s.handleEnvStartStop)

	// ---- 媒体中心 ----
	mux.HandleFunc("/api/media/roots", s.handleMediaRoots)
	mux.HandleFunc("/api/media/stats", s.handleMediaStats)
	mux.HandleFunc("/api/media/list", s.handleMediaList)
	mux.HandleFunc("/api/media/thumb", s.handleMediaFile)
	mux.HandleFunc("/api/media/file", s.handleMediaFile)
	mux.HandleFunc("/api/media/tag", s.handleMediaTag)
	mux.HandleFunc("/api/media/tags", s.handleMediaTags)
	mux.HandleFunc("/api/media/dedup", s.handleMediaDedup)
	mux.HandleFunc("/api/media/tool/", s.handleMediaTool)

	// ---- 插件商店 ----
	mux.HandleFunc("/api/store/plugin/update", s.handleStorePluginUpdate)
	mux.HandleFunc("/api/store/project/", s.handleStoreProject)

	// ---- 插件 ----
	mux.HandleFunc("/api/plugins", s.handlePlugins) // 列表
	mux.HandleFunc("/api/plugins/", s.handlePlugin) // 网关+资产+删除

	// ---- 静态前端(public/) ----
	webDir := filepath.Join(s.cfg.BaseDir, "public")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveStatic(w, r, webDir)
	})
}

// ---- 插件路由 ----
func (s *server) handlePlugins(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
		return
	}
	writeJSON(w, http.StatusOK, s.host.List())
}

func (s *server) handlePlugin(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/plugins/")
	rest = strings.Trim(rest, "/")
	if rest == "" {
		writeJSON(w, http.StatusOK, s.host.List())
		return
	}
	parts := strings.SplitN(rest, "/", 2)
	name := parts[0]
	sub := ""
	if len(parts) > 1 {
		sub = parts[1]
	}

	switch r.Method {
	case http.MethodDelete:
		if sub == "" {
			if err := s.host.Remove(name); err != nil {
				writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": err.Error()})
				return
			}
			dir := filepath.Join(s.cfg.PluginsDir, name)
			if err := os.RemoveAll(dir); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{"message": "已移除插件: " + name})
			return
		}
		// DELETE 带 subpath: 代理给插件子进程(插件自有 DELETE 路由)
		child := s.hostFind(name)
		if child == nil {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "插件未加载: " + name})
			return
		}
		host.ProxyRequest(child, w, r, sub)
		return
	case http.MethodGet, http.MethodPost:
		// 资产文件: /api/plugins/<name>/assets/<file>
		if strings.HasPrefix(sub, "assets/") {
			s.servePluginAsset(w, r, name, strings.TrimPrefix(sub, "assets/"))
			return
		}
		// 网关代理
		child := s.hostFind(name)
		if child == nil {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "插件未加载: " + name})
			return
		}
		host.ProxyRequest(child, w, r, sub)
		return
	default:
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "不支持的请求方法"})
	}
}

// hostFind 按插件名查找(大小写不敏感, 兼容旧前端用小写路径访问大写插件如 JMComic)。
func (s *server) hostFind(name string) *host.Child {
	return s.host.Find(name)
}

// servePluginAsset 提供插件前端构建产物(远程组件挂载)。
func (s *server) servePluginAsset(w http.ResponseWriter, r *http.Request, name, file string) {
	child := s.hostFind(name)
	if child == nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "插件未加载"})
		return
	}
	// 用真实插件目录(大小写不敏感找到的 child 名)
	name = child.Name()
	// 安全: 仅允许 assets/ 下的文件, 拒绝路径穿越
	clean := filepath.Clean(file)
	if strings.Contains(clean, "..") || strings.HasPrefix(clean, "../") {
		writeJSON(w, http.StatusForbidden, map[string]interface{}{"error": "非法路径"})
		return
	}
	dir := filepath.Join(s.cfg.PluginsDir, name, "assets")
	http.ServeFile(w, r, filepath.Join(dir, clean))
}

// ---- 静态前端 ----
func serveStatic(w http.ResponseWriter, r *http.Request, webDir string) {
	p := r.URL.Path
	if p == "/" {
		p = "/index.html"
	}
	full := filepath.Join(webDir, filepath.Clean(p))
	// 防穿越
	if !strings.HasPrefix(full, webDir) {
		http.NotFound(w, r)
		return
	}
	if _, err := os.Stat(full); err != nil {
		// SPA fallback
		full = filepath.Join(webDir, "index.html")
	}
	http.ServeFile(w, r, full)
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
