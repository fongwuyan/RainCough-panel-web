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
	"raincough/internal/pluginx"
	"raincough/internal/shared"
)

type server struct {
	cfg *config.Config
	sd  *shared.Shared
}

// globalPX 接口库 v4 运行时(插件自注册/接口总线/健康诊断)。
var globalPX *pluginx.PluginX

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

	// 接口库 v4: 注册中心/接口总线/健康诊断(插件自注册, 无端口)
	regNS, _ := sd.Namespace("core_registry")
	probeEvery := 10 * time.Second
	if v := os.Getenv("RC_PROBE_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			probeEvery = time.Duration(n) * time.Second
		}
	}
	globalPX = pluginx.New(pluginx.Options{
		PluginsDir: cfg.PluginsDir,
		UDSDir:     os.Getenv("RC_UDS_DIR"),
		Token:      os.Getenv("RC_REG_TOKEN"),
		ProbeEvery: probeEvery,
	}, regNS)
	if err := globalPX.Start(); err != nil {
		log.Fatalf("接口库启动失败: %v", err)
	}
	defer globalPX.Stop()

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

	// 插件市场(回调: 安装/卸载后触发接口库重新扫描端点)
	storeNS, err := sd.Namespace("core_store")
	if err != nil {
		log.Fatalf("插件市场 namespace 初始化失败: %v", err)
	}
	globalStore = core.NewStore(storeNS, cfg.PluginsDir, func() {
		globalPX.Reload()
	})

	// 系统中心(服务/进程/日志/防火墙)
	globalSys = core.NewSysCenter(cfg.SudoPW)

	// 终端主机/常用命令存储
	initTermNS(sd)
	initMediaNS(sd)

	// M4: 系统功能注册为接口库内置 Provider(接口总览 source=system)
	registerSystemProviders(globalPX)

	// 性能趋势采样(每 1s 一点, 保留 60 点, 供工作台 SysPerf)
	perf = core.NewPerfTracker(sysMon)
	go perf.Run()

	s := &server{cfg: cfg, sd: sd}
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
		close(taskCleanupStop)
		globalSched.Stop()
		globalPX.Stop()
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
	mux.HandleFunc("/api/fm/ops", s.handleFmOps)  // 列表只在无子路径时生效
	mux.HandleFunc("/api/fm/ops/", s.handleFmOps) // {id}/cancel/download
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

	// ---- 接口库 v4(自注册/接口总线/健康) ----
	mux.HandleFunc("/api/interfaces", globalPX.HandleIfacesCatalog)
	mux.HandleFunc("/api/interfaces/", globalPX.HandleIfacesRoutes)
	mux.HandleFunc("/api/services/health", globalPX.HandleServicesHealth)
	mux.HandleFunc("/api/services/health/log", globalPX.HandleServiceLog)

	// ---- 静态前端(public/) ----
	webDir := filepath.Join(s.cfg.BaseDir, "public")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveStatic(w, r, webDir)
	})
}

// ---- 插件路由(v4 接口库, 无 v3 网关) ----
func (s *server) handlePlugins(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]interface{}{"error": "仅支持 GET"})
		return
	}
	writeJSON(w, http.StatusOK, globalPX.ListPlugins())
}

func (s *server) handlePlugin(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/plugins/")
	rest = strings.Trim(rest, "/")
	if rest == "" {
		writeJSON(w, http.StatusOK, globalPX.ListPlugins())
		return
	}
	parts := strings.SplitN(rest, "/", 2)
	name := parts[0]
	sub := ""
	if len(parts) > 1 {
		sub = parts[1]
	}
	if !globalPX.HasPlugin(name) {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "插件未注册: " + name})
		return
	}

	switch {
	case r.Method == http.MethodDelete && sub == "":
		// 删除插件目录(外部进程由用户自行停用)
		dir := filepath.Join(s.cfg.PluginsDir, name)
		if err := os.RemoveAll(dir); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"message": "已移除插件目录: " + name})

	case sub == "invoke" && r.Method == http.MethodPost:
		globalPX.HandlePluginsInvoke(w, r)

	case r.Method == http.MethodGet && strings.HasPrefix(sub, "assets/"):
		globalPX.ServeAsset(w, r, name, strings.TrimPrefix(sub, "assets/"))

	case r.Method == http.MethodGet &&
		(strings.HasPrefix(sub, "cache/") || strings.HasPrefix(sub, "output/") || strings.HasPrefix(sub, "work/")):
		subdir := "cache"
		switch {
		case strings.HasPrefix(sub, "output/"):
			subdir = "output"
		case strings.HasPrefix(sub, "work/"):
			subdir = "work"
		}
		globalPX.ServePluginFile(w, r, name, subdir, strings.TrimPrefix(sub, subdir+"/"))

	default:
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "不支持的插件路径/方法: " + r.Method + " " + sub})
	}
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
	// index.html 必须无缓存(才能拿到最新 bundle 名); 其余静态也禁缓存避免旧前端
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	http.ServeFile(w, r, full)
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
