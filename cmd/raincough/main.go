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

	// 数据层
	sd, err := shared.Open(cfg.ResolveDSN())
	if err != nil {
		log.Fatalf("数据层初始化失败: %v", err)
	}
	defer sd.Close()

	// 插件运行时
	ph := host.New(cfg.PluginsDir, cfg.ResolveDSN(), cfg.PluginMaxChildren)
	ph.SetSudoPW(cfg.SudoPW)
	for _, msg := range ph.Scan() {
		log.Println(msg)
	}
	stopWd := make(chan struct{})
	go ph.Watchdog(stopWd, 5*time.Second)

	s := &server{cfg: cfg, sd: sd, host: ph}
	mux := http.NewServeMux()
	s.routes(mux)

	httpServer := &http.Server{
		Addr:              fmt.Sprintf("0.0.0.0:%d", *port),
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// 优雅退出
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sig
		close(stopWd)
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
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"error": "不支持的删除目标"})
		return
	case http.MethodGet, http.MethodPost:
		// 资产文件: /api/plugins/<name>/assets/<file>
		if strings.HasPrefix(sub, "assets/") {
			s.servePluginAsset(w, r, name, strings.TrimPrefix(sub, "assets/"))
			return
		}
		// 网关代理
		child := s.host.Get(name)
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

// servePluginAsset 提供插件前端构建产物(远程组件挂载)。
func (s *server) servePluginAsset(w http.ResponseWriter, r *http.Request, name, file string) {
	child := s.host.Get(name)
	if child == nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"error": "插件未加载"})
		return
	}
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
