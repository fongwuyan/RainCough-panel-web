package host

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 构造一个临时插件目录: plugin.json + hello server(inline python 或 node)。
// 用 Go 内部 httptest 不可行(子进程独立), 这里起一个极小的 python http.server 变体。
func mkPlugin(t *testing.T, dir, name string) {
	t.Helper()
	os.MkdirAll(dir, 0o755)
	manifest := fmt.Sprintf(`{
	  "name": "%s", "label": "测试插件", "version": "1.0.0", "lang": "python",
	  "entry": ["python", "-c", "hello_server.py"],
	  "timeout": 10
	}`, name)
	if err := os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(manifest), 0o644); err != nil {
		t.Fatal(err)
	}
	// 简化: 用 python3 起一个 HTTP 服务, 从环境变量读端口
	py := `import os, http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = ('hello:'+os.environ.get('RAINCOUGH_NS','')) .encode()
        self.send_response(200); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(b'{"msg":"' + body + b'"}')
    def log_message(self, *a): pass
p = int(os.environ['RAINCOUGH_PORT'])
http.server.HTTPServer(('127.0.0.1', p), H).serve_forever()
`
	// entry 用 python 直接跑脚本串(-c 单行受限, 改用 py 文件)
	pyFile := filepath.Join(dir, "hello_server.py")
	if err := os.WriteFile(pyFile, []byte(py), 0o644); err != nil {
		t.Fatal(err)
	}
	manifest = fmt.Sprintf(`{
	  "name": "%s", "label": "测试插件", "version": "1.0.0", "lang": "python",
	  "entry": ["python", "hello_server.py"],
	  "timeout": 15
	}`, name)
	if err := os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(manifest), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestChildStartAndProxy(t *testing.T) {
	base := t.TempDir()
	dir := filepath.Join(base, "hello")
	mkPlugin(t, dir, "hello")

	m, err := LoadManifest(dir)
	if err != nil {
		t.Fatalf("load manifest: %v", err)
	}
	child := &Child{name: m.Name, dir: dir, manifest: m}
	if err := child.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer func() {
		child.Kill()
		if child.proc != nil && child.proc.Process != nil {
			_, _ = child.proc.Process.Wait() // 等待真正退出, 避免临时目录清理竞态
		}
	}()
	if !child.Alive() {
		t.Fatal("子进程未存活")
	}

	// 经网关代理访问
	req := httptest.NewRequest("GET", "http://x/api/plugins/hello/ping", nil)
	rec := httptest.NewRecorder()
	ProxyRequest(child, rec, req, "ping")
	if rec.Code != 200 {
		t.Fatalf("proxy 状态码: %d body=%s", rec.Code, rec.Body.String())
	}
	var out map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("响应非 JSON: %v body=%s", err, rec.Body.String())
	}
	if !strings.Contains(fmt.Sprint(out["msg"]), "hello") {
		t.Fatalf("响应异常: %v", out)
	}
}

func TestLoadManifestInvalid(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"name":"BAD NAME!","entry":[]}`), 0o644)
	if _, err := LoadManifest(dir); err == nil {
		t.Fatal("非法 manifest 未被拒绝")
	}
}
