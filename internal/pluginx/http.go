package pluginx

import (
	"encoding/json"
	"mime"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ---- 序列化 ----

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]interface{}{"error": msg})
}

// ---- 接口目录 ----

// HandleIfacesCatalog GET /api/interfaces?source=&visibility=&status=&q=&page=&page_size=
func (x *PluginX) HandleIfacesCatalog(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 500 {
		pageSize = 100
	}
	qsource := q.Get("source")
	qvis := q.Get("visibility")
	qstatus := q.Get("status")
	qq := strings.ToLower(q.Get("q"))

	x.mu.Lock()
	all := make([]*Iface, 0, len(x.ifaces))
	for _, it := range x.ifaces {
		all = append(all, it)
	}
	x.mu.Unlock()

	filtered := make([]map[string]interface{}, 0, len(all))
	for _, it := range all {
		pl := x.pluginOf(it.Plugin)
		kind := "plugin"
		src := it.Plugin
		if pl != nil && pl.Kind != "" {
			kind = pl.Kind
		}
		if pl != nil && pl.Kind == "plugin" && pl.conn == nil {
			// 保留展示(离线/注册态)
		}
		if qsource != "" && kind != qsource {
			continue
		}
		if qvis != "" && it.Visibility != qvis {
			continue
		}
		status := "offline"
		if it.Online {
			status = "online"
		}
		if qstatus != "" && status != qstatus {
			continue
		}
		if qq != "" && !strings.Contains(strings.ToLower(it.ID+src+it.Description), qq) {
			continue
		}
		rec := map[string]interface{}{
			"id":          it.ID,
			"plugin":      it.Plugin,
			"source":      kind,
			"visibility":  it.Visibility,
			"version":     it.Version,
			"description": it.Description,
			"input":       it.Input,
			"output":      it.Output,
			"online":      it.Online,
			"status":      status,
			"calls":       it.Calls,
			"avg_ms":      it.AvgMs,
			"p95_ms":      it.P95Ms,
			"last_error":  it.LastError,
		}
		filtered = append(filtered, rec)
	}
	sort.Slice(filtered, func(i, j int) bool {
		a, b := filtered[i], filtered[j]
		if a["plugin"] != b["plugin"] {
			return a["plugin"].(string) < b["plugin"].(string)
		}
		return a["id"].(string) < b["id"].(string)
	})
	total := len(filtered)
	start := (page - 1) * pageSize
	end := start + pageSize
	var items []map[string]interface{}
	if start < total {
		if end > total {
			end = total
		}
		items = filtered[start:end]
	} else {
		items = []map[string]interface{}{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total": total, "page": page, "page_size": pageSize, "items": items,
	})
}

// HandleIfacesSummary GET /api/interfaces/stats/summary
func (x *PluginX) HandleIfacesSummary(w http.ResponseWriter, r *http.Request) {
	x.mu.Lock()
	total := len(x.ifaces)
	online := 0
	pluginIfaces := 0
	systemIfaces := 0
	offline := 0
	plugins := map[string]bool{}
	for _, it := range x.ifaces {
		kind := "plugin"
		if p := x.plugins[it.Plugin]; p != nil && p.Kind == "system" {
			kind = "system"
		}
		if kind == "system" {
			systemIfaces++
		} else {
			pluginIfaces++
		}
		plugins[it.Plugin] = true
		if it.Online {
			online++
		} else {
			offline++
		}
	}
	x.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"interfaces": total,
		"online":     online,
		"offline":    offline,
		"system":     systemIfaces,
		"plugin":     pluginIfaces,
		"providers":  len(plugins),
		"checked_at": time.Now().Unix(),
	})
}

// HandleIfacesRoutes GET /api/interfaces/ ... 子路由(stats/summary | <id>/invoke | <id>)
func (x *PluginX) HandleIfacesRoutes(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/interfaces/")
	rest = strings.Trim(rest, "/")
	switch {
	case rest == "stats/summary":
		x.HandleIfacesSummary(w, r)
	case strings.HasSuffix(rest, "/invoke"):
		x.HandleIfaceInvoke(w, r)
	default:
		x.HandleIfaceDetail(w, r)
	}
}

// HandleIfaceDetail GET /api/interfaces/<id>
func (x *PluginX) HandleIfaceDetail(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/interfaces/")
	id = strings.Trim(id, "/")
	x.mu.Lock()
	it := x.ifaces[id]
	var pl *Plugin
	if it != nil {
		pl = x.plugins[it.Plugin]
	}
	x.mu.Unlock()
	if it == nil {
		writeErr(w, http.StatusNotFound, "接口不存在: "+id)
		return
	}
	kind := "plugin"
	if pl != nil && pl.Kind == "system" {
		kind = "system"
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":          it.ID,
		"plugin":      it.Plugin,
		"source":      kind,
		"visibility":  it.Visibility,
		"version":     it.Version,
		"description": it.Description,
		"input":       it.Input,
		"output":      it.Output,
		"online":      it.Online,
		"calls":       it.Calls,
		"avg_ms":      it.AvgMs,
		"p95_ms":      it.P95Ms,
		"last_error":  it.LastError,
		"provider":    x.pluginView(pl),
	})
}

// HandleIfaceInvoke POST /api/interfaces/<id>/invoke
func (x *PluginX) HandleIfaceInvoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/interfaces/"), "/invoke")
	id = strings.Trim(id, "/")
	var b struct {
		Params    interface{} `json:"params"`
		TimeoutMs int64       `json:"timeout_ms,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, http.StatusBadRequest, "bad json")
		return
	}
	timeout := time.Duration(b.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	result, err := x.invokeFrom("ui", id, b.Params, timeout)
	if err != nil {
		var re *RPCError
		if asRPCError(err, &re) {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"ok": false, "rpc_error": map[string]interface{}{
					"code": re.Code, "message": re.Message,
				},
			})
			return
		}
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "result": result})
}

// HandlePluginsInvoke POST /api/plugins/<name>/invoke {iface, params, timeout_ms}
func (x *PluginX) HandlePluginsInvoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	name := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/plugins/"), "/invoke")
	name = strings.Trim(name, "/")
	var b struct {
		Iface     string      `json:"iface"`
		Params    interface{} `json:"params"`
		TimeoutMs int64       `json:"timeout_ms,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeErr(w, http.StatusBadRequest, "bad json")
		return
	}
	if b.Iface == "" {
		writeErr(w, http.StatusBadRequest, "iface 必填")
		return
	}
	x.mu.Lock()
	it := x.ifaces[b.Iface]
	x.mu.Unlock()
	if it == nil || it.Plugin != name {
		writeErr(w, http.StatusNotFound, "接口不属于该插件: "+b.Iface)
		return
	}
	timeout := time.Duration(b.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	result, err := x.invokeFrom("ui", b.Iface, b.Params, timeout)
	if err != nil {
		var re *RPCError
		if asRPCError(err, &re) {
			writeJSON(w, http.StatusOK, map[string]interface{}{"ok": false, "rpc_error": map[string]interface{}{"code": re.Code, "message": re.Message}})
			return
		}
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "result": result})
}

// HandleServicesHealth GET /api/services/health — 服务健康中心(注册表驱动)。
func (x *PluginX) HandleServicesHealth(w http.ResponseWriter, r *http.Request) {
	x.mu.Lock()
	names := make([]string, 0, len(x.plugins))
	for n := range x.plugins {
		names = append(names, n)
	}
	sort.Strings(names)
	providers := make([]map[string]interface{}, 0, len(names))
	onlineCount := 0
	ifaceCount := 0
	for _, n := range names {
		p := x.plugins[n]
		ifaces := []string{}
		for id, it := range x.ifaces {
			if it.Plugin == n {
				ifaces = append(ifaces, id)
			}
		}
		sort.Strings(ifaces)
		ifaceCount += len(ifaces)
		online := p.Status == StatusOnline // 系统 Provider 常驻 online; 插件按状态
		if online {
			onlineCount++
		}
		providers = append(providers, map[string]interface{}{
			"name":       p.Name,
			"label":      p.Label,
			"version":    p.Version,
			"kind":       p.Kind,
			"status":     p.Status,
			"online":     online,
			"latency_ms": p.LatencyMs,
			"fail_count": p.FailCount,
			"last_seen":  p.LastSeen,
			"ifaces":     ifaces,
			"endpoint":   p.Endpoint,
			"registered": p.RegisteredAt,
		})
	}
	x.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total": len(providers), "online": onlineCount, "offline": len(providers) - onlineCount,
		"interfaces": ifaceCount, "providers": providers, "checked_at": time.Now().Unix(),
	})
}

// HealthSummary 服务健康汇总(供系统接口 system.health.services 复用)。
func (x *PluginX) HealthSummary() map[string]interface{} {
	x.mu.Lock()
	total := len(x.plugins)
	ifaceCount := len(x.ifaces)
	online := 0
	for _, p := range x.plugins {
		if p.Status == StatusOnline {
			online++
		}
	}
	x.mu.Unlock()
	return map[string]interface{}{
		"total": total, "online": online, "offline": total - online,
		"interfaces": ifaceCount, "providers": total, "checked_at": time.Now().Unix(),
	}
}

// HandleServiceLog GET /api/services/health/log?name=&lines=&grep= — v4 插件诊断日志。
func (x *PluginX) HandleServiceLog(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	lines := 200
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			lines = n
		}
	}
	grep := r.URL.Query().Get("grep")
	x.mu.Lock()
	p := x.plugins[name]
	x.mu.Unlock()
	if p == nil || p.conn == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"exists": false, "text": "", "total_lines": 0, "size": 0, "file": name + "/.runtime.log",
		})
		return
	}
	resp, err := p.conn.request("log.tail", map[string]interface{}{"lines": lines, "grep": grep}, 5*time.Second)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": err.Error()})
		return
	}
	var out struct {
		Text       string `json:"text"`
		TotalLines int    `json:"total_lines"`
		Size       int64  `json:"size"`
	}
	_ = json.Unmarshal(resp, &out)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"exists": true, "text": out.Text, "total_lines": out.TotalLines, "size": out.Size,
		"file": name + "/.runtime.log",
	})
}

// ListPlugins v4 插件注册表条目(供 /api/plugins 合并, 保持侧栏/工作台可见)。
func (x *PluginX) ListPlugins() []map[string]interface{} {
	x.mu.Lock()
	defer x.mu.Unlock()
	out := []map[string]interface{}{}
	for _, p := range x.plugins {
		if p.Kind != "plugin" {
			continue
		}
		out = append(out, map[string]interface{}{
			"name":        p.Name,
			"label":       p.Label,
			"version":     p.Version,
			"description": p.Manifest.Description,
			"lang":        p.Manifest.Backend.Lang,
			"v4":          true,
			"alive":       p.Status == StatusOnline,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i]["name"].(string) < out[j]["name"].(string) })
	return out
}

// ---- 内部视图 ----

// HasPlugin v4 插件是否存在(注册表或 v4 清单目录)。
func (x *PluginX) HasPlugin(name string) bool {
	x.mu.Lock()
	_, ok := x.plugins[name]
	x.mu.Unlock()
	if ok {
		return true
	}
	_, err := x.loadManifestFor(name)
	return err == nil
}

// ServeAsset 提供插件前端产物(存于插件目录 assets/, 无缓存, 防穿越)。
func (x *PluginX) ServeAsset(w http.ResponseWriter, r *http.Request, name, file string) {
	x.ServePluginFile(w, r, name, "assets", file)
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
}

// ServePluginFile 提供插件目录内指定子目录的文件(如 cache/ 图片), 防穿越。
func (x *PluginX) ServePluginFile(w http.ResponseWriter, r *http.Request, name, subdir, file string) {
	if x.opts.PluginsDir == "" {
		http.NotFound(w, r)
		return
	}
	clean := filepath.Clean(file)
	if strings.Contains(clean, "..") || strings.HasPrefix(clean, "../") {
		http.Error(w, "非法路径", http.StatusForbidden)
		return
	}
	base := filepath.Join(x.opts.PluginsDir, name, subdir)
	if ct := mime.TypeByExtension(strings.ToLower(filepath.Ext(clean))); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	if w.Header().Get("Cache-Control") == "" {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	}
	http.ServeFile(w, r, filepath.Join(base, clean))
}

func (x *PluginX) pluginOf(name string) *Plugin {
	x.mu.Lock()
	defer x.mu.Unlock()
	return x.plugins[name]
}

func (x *PluginX) pluginView(p *Plugin) map[string]interface{} {
	if p == nil {
		return nil
	}
	return map[string]interface{}{
		"name": p.Name, "label": p.Label, "version": p.Version,
		"kind": p.Kind, "status": p.Status, "latency_ms": p.LatencyMs,
		"last_seen": p.LastSeen, "pages": p.Pages, "endpoint": p.Endpoint,
	}
}

func asRPCError(err error, target **RPCError) bool {
	if re, ok := err.(*RPCError); ok {
		*target = re
		return true
	}
	return false
}
