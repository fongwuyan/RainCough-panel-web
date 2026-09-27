package main

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// apiMonitor 请求观测器 — 接口监控页(/api/sysfunc/api-monitor/*)的真实数据源。
// 记录全部 /api/* 请求: 计数(总量/4xx/5xx/按状态/按方法/按路径) + 最近 300 条流水。
type apiMonitor struct {
	mu       sync.Mutex
	total    int
	e4       int
	e5       int
	byPath   map[string]int
	byStatus map[string]int
	methods  map[string]int
	calls    []map[string]interface{} // 追加式, 读时倒序返回(最新在前)
}

const apiMonRing = 300

var apiMon = &apiMonitor{
	byPath:   map[string]int{},
	byStatus: map[string]int{},
	methods:  map[string]int{},
}

// serve 包装根 Handler 记录 /api/* 请求(静态资源与监控自身不记账)。
func (m *apiMonitor) serve(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if !strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/api/sysfunc/api-monitor/") {
			next.ServeHTTP(w, r)
			return
		}
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, code: 200}
		next.ServeHTTP(rw, r)

		m.mu.Lock()
		defer m.mu.Unlock()
		m.total++
		switch {
		case rw.code >= 500:
			m.e5++
		case rw.code >= 400:
			m.e4++
		}
		m.byPath[p]++
		m.byStatus[strconv.Itoa(rw.code)]++
		m.methods[r.Method]++
		m.calls = append(m.calls, map[string]interface{}{
			"ts":     time.Now().Format("15:04:05"),
			"method": r.Method,
			"path":   p,
			"code":   rw.code,
			"ms":     int(time.Since(start) / time.Millisecond),
			"ip":     clientIP(r),
		})
		if len(m.calls) > apiMonRing {
			m.calls = m.calls[len(m.calls)-apiMonRing:]
		}
	})
}

// stats 统计快照(接口监控页四块统计砖 + 方法分布)。
func (m *apiMonitor) stats() map[string]interface{} {
	m.mu.Lock()
	defer m.mu.Unlock()
	return map[string]interface{}{
		"routes_total": len(m.byPath),
		"calls_total":  m.total,
		"calls_4xx":    m.e4,
		"calls_5xx":    m.e5,
		"methods":      copyIntMap(m.methods),
		"by_path":      copyIntMap(m.byPath),
		"by_status":    copyIntMap(m.byStatus),
		"total":        m.total,
	}
}

// recent 最近流水(最新在前)。
func (m *apiMonitor) recent() []map[string]interface{} {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]map[string]interface{}, 0, len(m.calls))
	for i := len(m.calls) - 1; i >= 0; i-- {
		out = append(out, m.calls[i])
	}
	return out
}

// clear 清空计数与流水。
func (m *apiMonitor) clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.total, m.e4, m.e5 = 0, 0, 0
	m.byPath = map[string]int{}
	m.byStatus = map[string]int{}
	m.methods = map[string]int{}
	m.calls = nil
}

func copyIntMap(src map[string]int) map[string]int {
	dst := make(map[string]int, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

// statusWriter 透传状态码(实现 Flush/Unwrap 保证 SSE/大文件不受影响)。
type statusWriter struct {
	http.ResponseWriter
	code int
}

func (w *statusWriter) WriteHeader(c int) {
	w.code = c
	w.ResponseWriter.WriteHeader(c)
}

func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// clientIP 取客户端 IP(优先 X-Forwarded-For)。
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i > 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
