// RainCough Core — 主系统入口。
// 组装: 配置/数据层/插件运行时/核心 API/静态前端。
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"raincough"
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

	// 数据层(纯标准库文件 KV, 无外部数据库)
	sd, err := shared.Open(cfg.ResolveDSN())
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

	// 任务队列(core_tasks namespace)
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

	// 插件市场(回调: 安装/卸载后触发接口库重新扫描端点)
	storeNS, err := sd.Namespace("core_store")
	if err != nil {
		log.Fatalf("插件市场 namespace 初始化失败: %v", err)
	}
	globalStore = core.NewStore(storeNS, cfg.PluginsDir, func() {
		globalPX.Reload()
	})

	// 终端主机/常用命令存储
	initTermNS(sd)

	// 系统功能注册为接口库内置 Provider(接口总览 source=system)
	registerSystemProviders(globalPX)

	// 工作台常驻历史: 每秒采样追加 data/workspace-history.ndjson
	globalWSH = core.NewWSHistory(filepath.Join(cfg.DataDir, "workspace-history.ndjson"))
	globalWSH.Start(sysMon)

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
		if globalWSH != nil {
			globalWSH.Stop()
		}
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
// 保留范围: 工作台 / 文件管理 / 终端 / 插件 / 设置 / 面板更新(常驻浮窗)。
func (s *server) routes(mux *http.ServeMux) {
	// ---- 工作台 ----
	mux.HandleFunc("/api/system", s.handleSystem)
	mux.HandleFunc("/api/system/", s.handleSystemSub)
	mux.HandleFunc("/api/workspace/history", s.handleWSHistory)
	mux.HandleFunc("/api/disks", s.handleDisks)
	mux.HandleFunc("/api/disks/unmount", s.handleDiskUnmount)
	mux.HandleFunc("/api/net/status", s.handleNetStatus)

	// ---- 文件管理 ----
	mux.HandleFunc("/api/fm/ops", s.handleFmOps)  // 列表只在无子路径时生效
	mux.HandleFunc("/api/fm/ops/", s.handleFmOps) // {id}/cancel/download
	mux.HandleFunc("/api/fm/unzip", s.handleFmUnzip)
	mux.HandleFunc("/api/fm/", s.handleFm)

	// ---- 任务队列(插件安装/文件批量操作共用) ----
	mux.HandleFunc("/api/tasks", s.handleTasks)
	mux.HandleFunc("/api/tasks/", s.handleTaskDetail)
	mux.HandleFunc("/api/tasks/purge", s.handleTasksPurge)

	// ---- 终端 ----
	mux.HandleFunc("/api/terminal/open", s.handleTermOpen)
	mux.HandleFunc("/api/terminal/stream", s.handleTermStream)
	mux.HandleFunc("/api/terminal/input", s.handleTermInput)
	mux.HandleFunc("/api/terminal/resize", s.handleTermResize)
	mux.HandleFunc("/api/terminal/close", s.handleTermClose)
	mux.HandleFunc("/api/terminal/hosts", s.handleTermHosts)
	mux.HandleFunc("/api/terminal/hosts/set_sort", s.handleTermHostsSetSort)
	mux.HandleFunc("/api/terminal/commands", s.handleTermCommands)
	mux.HandleFunc("/api/terminal/ws_token", s.handleWsToken)

	// ---- 插件市场 ----
	mux.HandleFunc("/api/store/settings", s.handleStoreSettings)
	mux.HandleFunc("/api/store/ping", s.handleStorePing)
	mux.HandleFunc("/api/store/registry", s.handleStoreRegistry)
	mux.HandleFunc("/api/store/changelog", s.handleStoreChangelog)
	mux.HandleFunc("/api/store/plugin/install", s.handleStorePluginInstall)
	mux.HandleFunc("/api/store/plugin/update", s.handleStorePluginUpdate)
	mux.HandleFunc("/api/store/plugin/remove", s.handleStorePluginRemove)

	// ---- 面板版本与更新(常驻浮窗) ----
	mux.HandleFunc("/api/panel/version", s.handlePanelVersion)
	mux.HandleFunc("/api/panel/install-command", s.handlePanelInstallCommand)
	mux.HandleFunc("/api/panel/update/check", s.handlePanelUpdateCheck)
	mux.HandleFunc("/api/panel/update/state", s.handlePanelUpdateState)
	mux.HandleFunc("/api/panel/update/apply", s.handlePanelUpdateApply)
	mux.HandleFunc("/api/panel/update/restart", s.handlePanelUpdateRestart)
	mux.HandleFunc("/api/panel/update/log", s.handlePanelUpdateLog)
	mux.HandleFunc("/api/panel/update/rollback", s.handlePanelUpdateRollback)

	// ---- 插件 ----
	mux.HandleFunc("/api/plugins", s.handlePlugins) // 列表
	mux.HandleFunc("/api/plugins/", s.handlePlugin) // 网关+资产+删除

	// ---- 接口库 v4(自注册/接口总线/健康) ----
	mux.HandleFunc("/api/interfaces", globalPX.HandleIfacesCatalog)
	mux.HandleFunc("/api/interfaces/", globalPX.HandleIfacesRoutes)
	mux.HandleFunc("/api/services/health", globalPX.HandleServicesHealth)
	mux.HandleFunc("/api/services/health/log", globalPX.HandleServiceLog)
	mux.HandleFunc("/api/services/list", s.handleServicesList)
	mux.HandleFunc("/api/services/action", s.handleServicesAction)

	// ---- 静态前端(public/) ----
	webDir := filepath.Join(s.cfg.BaseDir, "public")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveStatic(w, r, webDir)
	})
}

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
	case r.Method == http.MethodGet && sub == "":
		// 单插件信息(GenericPlugin 回退卡片用)
		for _, p := range globalPX.ListPlugins() {
			if p["name"] == name {
				writeJSON(w, http.StatusOK, p)
				return
			}
		}
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "插件信息不可用: " + name})

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
// 优先用二进制内嵌的 public/(单文件分发); 内嵌缺失时回退磁盘目录(开发期)。
var webFS fs.FS

func init() {
	if sub, err := fs.Sub(raincough.WebFS, "public"); err == nil {
		if _, err := fs.Stat(sub, "index.html"); err == nil {
			webFS = sub
		}
	}
}

func serveStatic(w http.ResponseWriter, r *http.Request, webDir string) {
	p := r.URL.Path
	// API 未知路径返回 JSON 404, 不落入 SPA fallback(否则缺路由伪装成 200 HTML)
	if strings.HasPrefix(p, "/api/") {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "not found: " + p})
		return
	}
	if p == "/" {
		p = "/index.html"
	}
	// index.html 与静态资源都禁缓存(否则升级后仍拿旧 bundle)
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	if webFS != nil {
		name := strings.TrimPrefix(path.Clean(p), "/")
		if _, err := fs.Stat(webFS, name); err != nil {
			name = "index.html" // SPA fallback
		}
		b, err := fs.ReadFile(webFS, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if ct := mime.TypeByExtension(path.Ext(name)); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		_, _ = w.Write(b)
		return
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
