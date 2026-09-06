// Package pluginx 插件接口库 v4: 无端口插件运行时。
//
// 模型: 插件 = 独立进程(外部管理) + UDS/TCP 传输 + 安装时注册的接口(Service Bus)。
// 主系统只负责: 接口注册/路由/权限/统计 + 健康诊断 + 前端产物托管。
package pluginx

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"raincough/internal/shared"
)

const (
	StatusRegistered = "registered"
	StatusOnline     = "online"
	StatusOffline    = "offline"
	StatusExpired    = "expired"
)

// PageDef 插件前端页面声明。
type PageDef struct {
	Path  string `json:"path"`
	Title string `json:"title"`
}

// InterfaceDef plugin.json v4 接口声明。
type InterfaceDef struct {
	ID          string                 `json:"id"`
	Input       map[string]interface{} `json:"input,omitempty"`
	Output      map[string]interface{} `json:"output,omitempty"`
	Visibility  string                 `json:"visibility,omitempty"`
	Version     string                 `json:"version,omitempty"`
	Description string                 `json:"description,omitempty"`
}

// ManifestV4 plugin.json v4。
type ManifestV4 struct {
	Name        string `json:"name"`
	Label       string `json:"label"`
	Version     string `json:"version"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Icon        string `json:"icon,omitempty"`
	Frontend    struct {
		Entry string    `json:"entry"`
		Vue   string    `json:"vue,omitempty"`
		Pages []PageDef `json:"pages"`
	} `json:"frontend"`
	Backend struct {
		Lang         string   `json:"lang,omitempty"`
		Exec         []string `json:"exec"`
		Capabilities []string `json:"capabilities,omitempty"`
	} `json:"backend"`
	Interfaces []InterfaceDef `json:"interfaces"`
}

// Plugin 注册表插件记录。
type Plugin struct {
	Name         string     `json:"name"`
	Label        string     `json:"label"`
	Version      string     `json:"version"`
	Kind         string     `json:"kind"` // plugin | system
	Manifest     ManifestV4 `json:"manifest"`
	Pages        []PageDef  `json:"pages"`
	Ifaces       []string   `json:"ifaces"`
	Capabilities []string   `json:"capabilities"`
	RegisteredAt int64      `json:"registered_at"`
	LastSeen     int64      `json:"last_seen"`
	Status       string     `json:"status"`
	LatencyMs    int64      `json:"latency_ms"`
	FailCount    int        `json:"fail_count"`
	HeartbeatSec int        `json:"heartbeat_sec"`
	Endpoint     string     `json:"endpoint,omitempty"`
	conn         *conn
}

// Iface 接口目录记录。
type Iface struct {
	ID          string                 `json:"id"`
	Plugin      string                 `json:"plugin"`
	Visibility  string                 `json:"visibility"`
	Version     string                 `json:"version"`
	Description string                 `json:"description,omitempty"`
	Input       map[string]interface{} `json:"input,omitempty"`
	Output      map[string]interface{} `json:"output,omitempty"`
	Online      bool                   `json:"online"`
	Calls       int64                  `json:"calls"`
	AvgMs       int64                  `json:"avg_ms"`
	P95Ms       int64                  `json:"p95_ms"`
	LastError   string                 `json:"last_error,omitempty"`
	durations   []int64                // 滚动窗口(最近 100 次耗时)
}

// Options PluginX 选项。
type Options struct {
	PluginsDir string // 插件目录(用于预建端点与读取 plugin.json v4)
	UDSDir     string // 生产 socket 根目录(默认 /run/raincough)
	Token      string // 注册口令(空=不校验)
	ProbeEvery time.Duration
	UseTCP     bool // Windows 开发降级: loopback TCP(默认按 GOOS 判定)
}

// PluginX 接口库运行时。
type PluginX struct {
	opts Options
	ns   *shared.Namespace // 持久化(可为 nil => 内存模式)

	mu        sync.Mutex
	plugins   map[string]*Plugin
	ifaces    map[string]*Iface
	listeners map[string]net.Listener
	endpoints map[string]string
	stopCh    chan struct{}
	seq       int64
}

// New 创建接口库运行时。
func New(opts Options, ns *shared.Namespace) *PluginX {
	if opts.UDSDir == "" {
		opts.UDSDir = "/run/raincough"
	}
	if opts.ProbeEvery <= 0 {
		opts.ProbeEvery = 10 * time.Second
	}
	if !opts.UseTCP {
		opts.UseTCP = runtime.GOOS == "windows"
	}
	return &PluginX{
		opts:      opts,
		ns:        ns,
		plugins:   map[string]*Plugin{},
		ifaces:    map[string]*Iface{},
		listeners: map[string]net.Listener{},
		endpoints: map[string]string{},
		stopCh:    make(chan struct{}),
	}
}

// ---- 端点与清单 ----

// LoadManifestV4 读取并校验插件目录下的 plugin.json v4。
func LoadManifestV4(dir string) (*ManifestV4, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "plugin.json"))
	if err != nil {
		return nil, err
	}
	raw = []byte(strings.TrimPrefix(string(raw), "\xef\xbb\xbf"))
	var m ManifestV4
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("plugin.json 解析失败: %w", err)
	}
	if m.Name == "" || m.Frontend.Entry == "" || len(m.Backend.Exec) == 0 {
		return nil, fmt.Errorf("plugin.json 非 v4(缺 name/frontend.entry/backend.exec)")
	}
	if m.Frontend.Pages == nil {
		m.Frontend.Pages = []PageDef{}
	}
	if m.Interfaces == nil {
		m.Interfaces = []InterfaceDef{}
	}
	return &m, nil
}

// Start 预建所有 v4 插件端点并启动 accept/探针循环。
func (x *PluginX) Start() error {
	x.loadPersisted()
	x.scanAndListen()
	for name, l := range x.listeners {
		go x.acceptLoop(name, l)
	}
	go x.probeLoop()
	log.Printf("[pluginx] 接口库已启动: transport=%s uds=%s plugins=%d",
		map[bool]string{true: "tcp(dev)", false: "unix"}[x.opts.UseTCP], x.opts.UDSDir, len(x.listeners))
	return nil
}

// scanAndListen 扫描插件目录, 为 v4 清单预建端点并写 .rc.endpoint。
func (x *PluginX) scanAndListen() {
	if x.opts.PluginsDir == "" {
		return
	}
	entries, err := os.ReadDir(x.opts.PluginsDir)
	if err != nil {
		log.Printf("[pluginx] 扫描插件目录失败: %v", err)
		return
	}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		dir := filepath.Join(x.opts.PluginsDir, e.Name())
		if _, err := LoadManifestV4(dir); err != nil {
			continue // 非 v4 清单(旧插件)跳过
		}
		ep, err := x.listenFor(e.Name())
		if err != nil {
			log.Printf("[pluginx] %s 端点建立失败: %v", e.Name(), err)
			continue
		}
		_ = os.WriteFile(filepath.Join(dir, ".rc.endpoint"), []byte(ep), 0o600)
		log.Printf("[pluginx] %s 端点: %s", e.Name(), ep)
	}
}

// listenFor 为插件名建立监听端点。
func (x *PluginX) listenFor(name string) (string, error) {
	x.mu.Lock()
	defer x.mu.Unlock()
	if ep, ok := x.endpoints[name]; ok {
		return ep, nil
	}
	var l net.Listener
	var ep string
	if x.opts.UseTCP {
		lNew, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return "", err
		}
		l = lNew
		ep = "tcp:" + l.Addr().String()
	} else {
		dir := filepath.Join(x.opts.UDSDir, "plugins")
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return "", err
		}
		sock := filepath.Join(dir, name+".sock")
		_ = os.Remove(sock)
		lNew, err := net.Listen("unix", sock)
		if err != nil {
			return "", err
		}
		l = lNew
		_ = os.Chmod(sock, 0o600)
		ep = "unix:" + sock
	}
	x.listeners[name] = l
	x.endpoints[name] = ep
	return ep, nil
}

// acceptLoop 接受插件连接(同名旧连接被替换)。
func (x *PluginX) acceptLoop(name string, l net.Listener) {
	for {
		c, err := l.Accept()
		if err != nil {
			select {
			case <-x.stopCh:
				return
			default:
				return
			}
		}
		conn := newConn(c, x, name)
		x.mu.Lock()
		if old := x.getConnLocked(name); old != nil {
			old.close()
		}
		x.setConnLocked(name, conn)
		x.mu.Unlock()
		go conn.readLoop()
	}
}

// Stop 关闭全部端点与连接。
func (x *PluginX) Stop() {
	close(x.stopCh)
	x.mu.Lock()
	defer x.mu.Unlock()
	for name, l := range x.listeners {
		_ = l.Close()
		delete(x.listeners, name)
	}
	for _, c := range x.conns() {
		c.close()
	}
	if !x.opts.UseTCP {
		_ = os.RemoveAll(filepath.Join(x.opts.UDSDir, "plugins"))
	}
}

// Reload 重新扫描(安装新插件后调用)。
func (x *PluginX) Reload() {
	x.scanAndListen()
	x.mu.Lock()
	names := make([]string, 0, len(x.listeners))
	for n := range x.listeners {
		names = append(names, n)
	}
	x.mu.Unlock()
	for _, n := range names {
		if x.listenerAlive(n) {
			continue
		}
		x.mu.Lock()
		l := x.listeners[n]
		x.mu.Unlock()
		if l != nil {
			go x.acceptLoop(n, l)
		}
	}
}

func (x *PluginX) listenerAlive(name string) bool {
	x.mu.Lock()
	defer x.mu.Unlock()
	_, ok := x.listeners[name]
	return ok
}

func (x *PluginX) conns() map[string]*conn {
	out := map[string]*conn{}
	for n, p := range x.plugins {
		if p.conn != nil {
			out[n] = p.conn
		}
	}
	return out
}

func (x *PluginX) getConnLocked(name string) *conn {
	if p := x.plugins[name]; p != nil {
		return p.conn
	}
	return nil
}

func (x *PluginX) setConnLocked(name string, c *conn) {
	p := x.plugins[name]
	if p == nil {
		p = &Plugin{Name: name, Label: name, Kind: "plugin"}
		x.plugins[name] = p
	}
	p.conn = c
	p.Status = StatusRegistered
	p.LastSeen = time.Now().Unix()
}

func (x *PluginX) nextID() int64 {
	x.seq++
	return x.seq
}
