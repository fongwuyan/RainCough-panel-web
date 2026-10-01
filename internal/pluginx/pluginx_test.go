package pluginx

import (
	"bufio"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// deadline 测试用读超时。
func deadline(sec int) time.Time { return time.Now().Add(time.Duration(sec) * time.Second) }

func writeExtPkg(t *testing.T, root, name, manifest string) string {
	t.Helper()
	dir := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "extension.json"), []byte(manifest), 0o644); err != nil {
		t.Fatalf("manifest: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "extension.js"), []byte("window.__rcExt__={}"), 0o644); err != nil {
		t.Fatalf("asset: %v", err)
	}
	return dir
}

func TestLoadExtBackend(t *testing.T) {
	root := t.TempDir()
	dir := writeExtPkg(t, root, "probe", `{
	  "name": "probe", "label": "探针", "version": "1.0.0",
	  "backend": {"lang": "python", "exec": ["python3", "server.py"], "capabilities": ["invoke"]},
	  "interfaces": [{"id": "probe.echo", "visibility": "all", "version": "1", "description": "回显"}]
	}`)
	m, err := LoadExtBackend(dir)
	if err != nil || m == nil {
		t.Fatalf("应解析出后端: %v %+v", err, m)
	}
	if m.Name != "probe" || len(m.Backend.Exec) != 2 || m.Backend.Exec[0] != "python3" {
		t.Fatalf("后端字段不对: %+v", m.Backend)
	}
	if len(m.Interfaces) != 1 || m.Interfaces[0].ID != "probe.echo" {
		t.Fatalf("接口声明不对: %+v", m.Interfaces)
	}

	// 纯前端扩展: 没有 backend.exec → 不接入接口库
	pure := writeExtPkg(t, root, "pure", `{"name":"pure","label":"纯前端","version":"1.0.0"}`)
	if m, err := LoadExtBackend(pure); err != nil || m != nil {
		t.Fatalf("纯前端扩展不该返回后端: %v %+v", err, m)
	}
}

// 扫描扩展目录: 只有声明了 backend 的扩展才有端点, 并写下 .rc.endpoint。
func TestScanExtDirCreatesEndpoint(t *testing.T) {
	extDir := t.TempDir()
	writeExtPkg(t, extDir, "probe", `{"name":"probe","version":"1.0.0","backend":{"exec":["python3","server.py"]}}`)
	writeExtPkg(t, extDir, "pure", `{"name":"pure","version":"1.0.0"}`)

	x := New(Options{ExtDir: extDir, UseTCP: true}, nil)
	x.Reload()

	if _, ok := x.endpoints["probe"]; !ok {
		t.Fatal("声明了 backend 的扩展应有端点")
	}
	if _, ok := x.endpoints["pure"]; ok {
		t.Fatal("纯前端扩展不该有端点")
	}
	ep, err := os.ReadFile(filepath.Join(extDir, "probe", ".rc.endpoint"))
	if err != nil || len(ep) == 0 {
		t.Fatalf("应写入 .rc.endpoint: %v", err)
	}
}

// Reload 之后新装的扩展必须真的能被连上(旧实现只建 listener、不起 accept 循环)。
func TestReloadAcceptsNewBackend(t *testing.T) {
	extDir := t.TempDir()
	x := New(Options{ExtDir: extDir, UseTCP: true}, nil)
	if err := x.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer x.Stop()

	// 运行期"安装"一个带后端的扩展
	writeExtPkg(t, extDir, "probe", `{"name":"probe","version":"1.0.0","backend":{"exec":["python3","server.py"]},"interfaces":[{"id":"probe.echo","visibility":"all"}]}`)
	x.Reload()

	ep := x.endpoints["probe"]
	if ep == "" {
		t.Fatal("Reload 后应有端点")
	}
	addr := ep[len("tcp:"):]
	c, err := net.Dial("tcp", addr)
	if err != nil {
		t.Fatalf("端点连不上(accept 循环没起?): %v", err)
	}
	defer c.Close()

	// 按协议注册一个接口, 必须收到 ok
	line, _ := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0", "id": 1, "method": "register",
		"params": map[string]interface{}{"name": "probe", "version": "1.0.0",
			"iface_ids": []string{"probe.echo"}, "protocol_version": 1},
	})
	if _, err := c.Write(append(line, '\n')); err != nil {
		t.Fatalf("写注册帧失败: %v", err)
	}
	_ = c.SetReadDeadline(deadline(3))
	resp, err := bufio.NewReader(c).ReadBytes('\n')
	if err != nil {
		t.Fatalf("读注册响应失败(注册没被处理?): %v", err)
	}
	var fr struct {
		Result map[string]interface{} `json:"result"`
		Error  *rpcError              `json:"error"`
	}
	if err := json.Unmarshal(resp, &fr); err != nil || fr.Error != nil || fr.Result["ok"] != true {
		t.Fatalf("注册应成功: %s err=%+v", string(resp), fr.Error)
	}
	// 接口应登记在册(带清单里的 visibility)
	it := x.ifaces["probe.echo"]
	if it == nil || !it.Online || it.Plugin != "probe" || it.Visibility != "all" {
		t.Fatalf("接口未登记: %+v", it)
	}
}

// 卸载时 Drop: 注册与接口都要摘掉, 且持久化里不留复活记录。
func TestDropRemovesRegistration(t *testing.T) {
	x := New(Options{UseTCP: true}, nil)
	x.plugins["probe"] = &Plugin{Name: "probe", Status: StatusOnline}
	x.ifaces["probe.echo"] = &Iface{ID: "probe.echo", Plugin: "probe", Online: true}
	x.Drop("probe")
	if x.plugins["probe"] != nil {
		t.Fatal("插件记录应被摘掉")
	}
	if x.ifaces["probe.echo"] != nil {
		t.Fatal("接口记录应被摘掉")
	}
}

// Drop 还要把端点关掉: 否则卸载后的扩展 socket 一直 listen(能被连上注册成幽灵插件)。
func TestDropClosesEndpoint(t *testing.T) {
	extDir := t.TempDir()
	writeExtPkg(t, extDir, "probe", `{"name":"probe","version":"1.0.0","backend":{"exec":["python3","server.py"]}}`)
	x := New(Options{ExtDir: extDir, UseTCP: true}, nil)
	if err := x.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer x.Stop()

	ep := x.endpoints["probe"]
	if ep == "" {
		t.Fatal("应有端点")
	}
	x.Drop("probe")
	if x.endpoints["probe"] != "" {
		t.Fatal("端点登记应被清掉")
	}
	if _, err := net.DialTimeout("tcp", ep[len("tcp:"):], 300*time.Millisecond); err == nil {
		t.Fatal("端点应已关闭, 不该还能连上")
	}
}
