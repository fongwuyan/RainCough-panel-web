package host

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// ProxyRequest 将面板请求转发到插件子进程, 响应原样透传。
// 对齐旧 bridge.py 契约: GET/POST/DELETE, 请求体透传, 响应文本+状态码原样返回。
func ProxyRequest(child *Child, w http.ResponseWriter, r *http.Request, subpath string) {
	if child == nil || !child.Alive() {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{
			"error": "插件子进程未就绪: " + childState(child),
		})
		return
	}
	// 目标: http://127.0.0.1:<port>/<subpath>
	u := url.URL{Scheme: "http", Host: fmt.Sprintf("127.0.0.1:%d", child.port),
		Path: "/" + strings.TrimLeft(subpath, "/")}
	target := u.String()

	var body io.Reader
	if r.Method != "GET" && r.Body != nil {
		body = r.Body
	}
	req, err := http.NewRequest(r.Method, target, body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": "构造转发请求失败: " + err.Error()})
		return
	}
	// 透传关键头(避免 all-header 复制带来 host 污染)
	if ct := r.Header.Get("Content-Type"); ct != "" {
		req.Header.Set("Content-Type", ct)
	}

	client := &http.Client{Timeout: child.proxyTimeout}
	resp, err := client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]interface{}{"error": "插件桥接失败: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	// 原样转写状态码与响应体
	for k, vs := range resp.Header {
		if strings.EqualFold(k, "Content-Length") {
			continue
		}
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func childState(child *Child) string {
	if child == nil {
		return "unknown"
	}
	child.mu.Lock()
	defer child.mu.Unlock()
	if child.startErr != "" {
		return child.startErr
	}
	if child.proc == nil || child.proc.ProcessState != nil {
		return "已退出"
	}
	return "unknown"
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	fmt.Fprint(w, mustJSON(v))
}

func mustJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return `{"error":"json encode failed"}`
	}
	return string(b)
}
