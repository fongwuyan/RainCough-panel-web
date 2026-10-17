package pluginx

// 声明式 REST 桥 —— 把插件接口暴露成普通 HTTP 路由
//
// 为什么需要(2026-10-17):
// 面板内部用 JSON-RPC(/api/plugins/<name>/invoke)调插件, 这对前端很方便,
// 但**移动端 App 用的是普通 REST**。配套的 JMReader(Android)期望的是:
//
//	GET  /api/plugins/jmcomic/search?keyword=x&page=1&mode=keyword
//	GET  /api/plugins/jmcomic/album/{aid}
//	GET  /api/plugins/jmcomic/chapter/{aid}/{cid}
//	GET  /api/plugins/jmcomic/library          DELETE .../library/{aid}
//	POST /api/plugins/jmcomic/download/{aid}   GET 同一路径取状态
//	POST /api/plugins/jmcomic/download/batch   GET 取状态
//	POST /api/plugins/jmcomic/download/batch/stop
//	GET  /api/plugins/jmcomic/cover/{aid}      GET .../image/{aid}/{cid}/{file}
//
// 让 App 去适配 JSON-RPC 不现实(要改 App、要发版), 所以在面板侧做一层桥。
//
// 设计要点:
//   · **声明式**: 路由写在插件自己的 plugin.json 里, 面板只做通用分发。
//     否则面板要为每个插件硬编码一套路由, 插件一多就没法维护。
//   · 只在清单里声明过的路由才可达(白名单), 没有通配转发。
//   · 图片类接口返回二进制(不是 JSON 里的 URL): App 要的是字节。
//     RPC 返回的是面板 URL, 这里解析回磁盘文件直接流出。
//   · 路径参数优先级: 字面段多的路由优先, 保证 /download/batch 不会被
//     /download/{aid} 抢走(否则 batch 会被当成 aid="batch")。

import (
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// RESTRoute 一条 REST 路由声明
//   - Method   GET / POST / DELETE …
//   - Path     相对路径, 支持 {var} 占位, 如 "/album/{aid}"
//   - Iface    要调用的接口 id
//   - Args     参数映射:
//     {name}      → 路径参数
//     ?name       → 查询参数
//     body        → 整个 JSON 请求体
//     body.field  → 请求体的某个字段
//   - File     结果里的哪个字段是"面板文件 URL"; 声明后本路由返回文件字节
//     而不是 JSON(图片接口用)
type RESTRoute struct {
	Method string            `json:"method"`
	Path   string            `json:"path"`
	Iface  string            `json:"iface"`
	Args   map[string]string `json:"args,omitempty"`
	File   string            `json:"file,omitempty"`
}

// segments 预拆分的路径模板(带字面量数量, 用于优先级排序)
type routeSegs struct {
	parts []string
	// literal 字面段数量, 越多越"具体"
	literal int
}

// restRoutes 返回某插件已声明且已编译的路由
func (x *PluginX) restRoutesFor(name string) []RESTRoute {
	x.mu.Lock()
	defer x.mu.Unlock()
	m := x.restRoutes[name]
	return m
}

// RESTRouteFor 供鉴权层判断"这个路径是否属于某个声明为 public 的 REST 路由"。
// 返回 (插件名, 是否公开)。
func (x *PluginX) RESTPublicMatch(r *http.Request) bool {
	// /api/plugins/<name>/<rest...>
	rest := strings.TrimPrefix(r.URL.Path, "/api/plugins/")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) < 2 {
		return false
	}
	rawName := parts[0]
	sub := "/" + strings.Trim(parts[1], "/")

	name := x.resolveName(rawName)
	if name == "" {
		return false
	}
	route, _, ok := x.matchREST(name, r.Method, sub)
	if !ok {
		return false
	}
	_ = route
	x.mu.Lock()
	pub := x.restPublic[name]
	x.mu.Unlock()
	return pub
}

// ResolveName 把任意大小写的插件名解析成真实目录名(找不到返回空串)。
// 移动端 App 里写的是小写 jmcomic, 而插件目录是 JMComic。
func (x *PluginX) ResolveName(raw string) string { return x.resolveName(raw) }

// resolveName 插件名大小写不敏感解析(App 里写 jmcomic, 目录叫 JMComic)
func (x *PluginX) resolveName(raw string) string {
	if raw == "" {
		return ""
	}
	x.mu.Lock()
	defer x.mu.Unlock()
	if _, ok := x.plugins[raw]; ok {
		return raw
	}
	if x.restRoutes[raw] != nil {
		return raw
	}
	lower := strings.ToLower(raw)
	for n := range x.restRoutes {
		if strings.ToLower(n) == lower {
			return n
		}
	}
	for n := range x.plugins {
		if strings.ToLower(n) == lower {
			return n
		}
	}
	return ""
}

// compileREST 把清单里的路由编译进内存(scan 时调用)
func (x *PluginX) compileREST(name string, m *ManifestV4) {
	if m == nil {
		return
	}
	routes := make([]RESTRoute, 0, len(m.Backend.REST))
	for _, r := range m.Backend.REST {
		if r.Iface == "" || r.Path == "" {
			continue
		}
		r.Method = strings.ToUpper(strings.TrimSpace(r.Method))
		if r.Method == "" {
			r.Method = http.MethodGet
		}
		if !strings.HasPrefix(r.Path, "/") {
			r.Path = "/" + r.Path
		}
		routes = append(routes, r)
	}
	// 字面段多的排前面: /download/batch(2) 优先于 /download/{aid}(1 字面+1 变量)
	sort.SliceStable(routes, func(i, j int) bool {
		return countLiteral(routes[i].Path) > countLiteral(routes[j].Path)
	})
	x.mu.Lock()
	x.restRoutes[name] = routes
	x.restPublic[name] = m.Backend.RESTPublic
	x.mu.Unlock()
	if len(routes) > 0 {
		log.Printf("[pluginx] %s 声明了 %d 条 REST 路由(public=%v)", name, len(routes), m.Backend.RESTPublic)
	}
}

// dropREST 插件卸载时清掉
func (x *PluginX) dropREST(name string) {
	x.mu.Lock()
	delete(x.restRoutes, name)
	delete(x.restPublic, name)
	x.mu.Unlock()
}

func countLiteral(p string) int {
	n := 0
	for _, s := range strings.Split(strings.Trim(p, "/"), "/") {
		if s != "" && !strings.HasPrefix(s, "{") {
			n++
		}
	}
	return n
}

// matchREST 按方法+子路径匹配路由, 返回路由与路径参数
func (x *PluginX) matchREST(name, method, sub string) (*RESTRoute, map[string]string, bool) {
	routes := x.restRoutesFor(name)
	want := strings.Split(strings.Trim(sub, "/"), "/")
	for i := range routes {
		r := &routes[i]
		// 同一声明可能允许多方法(用 "GET,POST" 写法)
		if !methodAllowed(r.Method, method) {
			continue
		}
		tmpl := strings.Split(strings.Trim(r.Path, "/"), "/")
		if len(tmpl) != len(want) {
			continue
		}
		params := map[string]string{}
		ok := true
		for k, seg := range tmpl {
			if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
				key := strings.Trim(seg, "{}")
				if want[k] == "" {
					ok = false
					break
				}
				params[key] = want[k]
				continue
			}
			if seg != want[k] {
				ok = false
				break
			}
		}
		if ok {
			return r, params, true
		}
	}
	return nil, nil, false
}

func methodAllowed(declared, actual string) bool {
	if declared == "" || declared == "*" {
		return true
	}
	for _, m := range strings.Split(declared, ",") {
		if strings.EqualFold(strings.TrimSpace(m), actual) {
			return true
		}
	}
	return false
}

// HandlePluginREST 通用 REST 分发: /api/plugins/<name>/<声明过的路径>
// 返回 true 表示已处理(调用方不要继续走其它分支)。
func (x *PluginX) HandlePluginREST(w http.ResponseWriter, r *http.Request) bool {
	rest := strings.TrimPrefix(r.URL.Path, "/api/plugins/")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) < 2 {
		return false
	}
	name := x.resolveName(parts[0])
	if name == "" {
		return false
	}
	sub := "/" + strings.Trim(parts[1], "/")
	route, pathParams, ok := x.matchREST(name, r.Method, sub)
	if !ok {
		return false // 不是声明过的 REST 路由 → 交给其它分支(assets/cache/invoke…)
	}

	// 组参数
	params := map[string]interface{}{}
	var body map[string]interface{}
	needBody := false
	for _, src := range route.Args {
		if src == "body" || strings.HasPrefix(src, "body.") {
			needBody = true
			break
		}
	}
	if needBody && r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}
	q := r.URL.Query()
	for key, src := range route.Args {
		switch {
		case src == "":
			continue
		case src == "body":
			params[key] = body
		case strings.HasPrefix(src, "body."):
			field := strings.TrimPrefix(src, "body.")
			if body != nil {
				if v, ok := body[field]; ok {
					params[key] = v
				}
			}
		case strings.HasPrefix(src, "?"):
			qk := strings.TrimPrefix(src, "?")
			if v := q.Get(qk); v != "" {
				params[key] = coerce(v)
			}
		case strings.HasPrefix(src, "{") && strings.HasSuffix(src, "}"):
			pk := strings.Trim(src, "{}")
			if v, ok := pathParams[pk]; ok {
				params[key] = coerce(v)
			}
		default:
			// 直接写常量
			params[key] = coerce(src)
		}
	}
	// 路径里出现但 Args 没映射到的参数, 也一并带上(省得每条都写)
	for k, v := range pathParams {
		if _, exists := params[k]; !exists {
			params[k] = coerce(v)
		}
	}

	result, err := x.invokeFrom("app", route.Iface, params, 60*time.Second)
	if err != nil {
		var re *RPCError
		if asRPCError(err, &re) {
			writeErrJSON(w, http.StatusOK, re.Message)
			return true
		}
		writeErrJSON(w, http.StatusBadGateway, err.Error())
		return true
	}

	// 文件型路由: 结果里的 url 字段 → 直接流出字节(App 要图片, 不是 JSON)
	if route.File != "" {
		urlStr := pickString(result, route.File)
		if urlStr == "" {
			writeErrJSON(w, http.StatusNotFound, "文件不可用")
			return true
		}
		x.serveFromPanelURL(w, r, name, urlStr)
		return true
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(result)
	return true
}

// pickString 从 RPC 结果里取一个字符串字段
func pickString(v interface{}, key string) string {
	m, ok := v.(map[string]interface{})
	if !ok {
		return ""
	}
	s, _ := m[key].(string)
	return s
}

// serveFromPanelURL 把 "/api/plugins/<Name>/<sub>/<file>" 解析到磁盘并流出。
//
// 为什么不在 REST 层重定向: 重定向目标仍带 /api/ 前缀, 会被鉴权中间件拦成 401
// (App 没有 session)。所以这里直接读盘写字节。
func (x *PluginX) serveFromPanelURL(w http.ResponseWriter, r *http.Request, name, panelURL string) {
	prefix := "/api/plugins/" + name + "/"
	idx := strings.Index(strings.ToLower(panelURL), strings.ToLower(prefix))
	var rel string
	if idx >= 0 {
		rel = panelURL[idx+len(prefix):]
	} else {
		// 兼容 /api/plugins/jmcomic/cache/... 这类大小写不同的写法
		low := strings.ToLower(panelURL)
		i := strings.Index(low, "/api/plugins/")
		if i < 0 {
			writeErrJSON(w, http.StatusBadRequest, "非法文件地址")
			return
		}
		rest := panelURL[i+len("/api/plugins/"):]
		slash := strings.Index(rest, "/")
		if slash < 0 {
			writeErrJSON(w, http.StatusBadRequest, "非法文件地址")
			return
		}
		rel = rest[slash+1:]
	}
	rel = strings.TrimPrefix(rel, "/")
	segs := strings.SplitN(rel, "/", 2)
	if len(segs) < 2 {
		writeErrJSON(w, http.StatusBadRequest, "非法文件地址")
		return
	}
	subdir, file := segs[0], segs[1]
	switch subdir {
	case "cache", "output", "work":
	default:
		writeErrJSON(w, http.StatusForbidden, "只能取 cache/output/work 下的文件")
		return
	}
	clean := filepath.Clean(file)
	if strings.Contains(clean, "..") {
		writeErrJSON(w, http.StatusForbidden, "非法路径")
		return
	}
	full := filepath.Join(x.opts.PluginsDir, name, subdir, clean)
	if st, err := os.Stat(full); err != nil || st.IsDir() {
		writeErrJSON(w, http.StatusNotFound, "文件不存在")
		return
	}
	if ct := mime.TypeByExtension(strings.ToLower(filepath.Ext(clean))); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, r, full)
}

// coerce 把 URL 里的字符串转成合适的类型(数字转数字, 其余保持字符串)
//
// 必要性: App 传 page=1 是字符串, 但插件侧 int(params['page']) 也能吃;
// 不过 album 的 aid 必须保持字符串(前导零/超长 ID 会丢精度), 所以只转纯数字且长度合理。
func coerce(s string) interface{} {
	if s == "" {
		return s
	}
	if len(s) <= 9 && isAllDigits(s) {
		if n, err := strconv.Atoi(s); err == nil {
			return n
		}
	}
	return s
}

func isAllDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return s != ""
}

func writeErrJSON(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": msg})
}

// RESTSummary 供 /api/plugins 暴露"这个插件支持哪些 REST 路由"(调试用)
func (x *PluginX) RESTSummary(name string) []map[string]string {
	routes := x.restRoutesFor(name)
	out := make([]map[string]string, 0, len(routes))
	for _, r := range routes {
		out = append(out, map[string]string{
			"method": r.Method, "path": "/api/plugins/" + name + r.Path, "iface": r.Iface,
		})
	}
	return out
}

var _ = fmt.Sprintf
