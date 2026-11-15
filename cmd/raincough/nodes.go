package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Node 是一台运行节点服务（RainAI Node）的主机。
// 密码/token 目前与节点配置同文件保存（0600）；后续可加 AES 加密。
type Node struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Host         string   `json:"host"`
	Port         int      `json:"port"`
	Group        string   `json:"group"`
	Publish      bool     `json:"publish"`
	Enabled      bool     `json:"enabled"`
	Capabilities []string `json:"capabilities"`
	Token        string   `json:"token,omitempty"`
	SSHUser      string   `json:"ssh_user,omitempty"`
	SSHPassword  string   `json:"ssh_password,omitempty"`
	MAC          string   `json:"mac,omitempty"`
	Version      string   `json:"version"`
	Status       string   `json:"status"`
	LastSeen     int64    `json:"last_seen"`
	GPU          string   `json:"gpu"`
	Message      string   `json:"message"`
}

type nodeFile struct {
	Nodes []Node `json:"nodes"`
}

var nodeMu sync.Mutex

func (s *server) nodesPath() string {
	return filepath.Join(s.cfg.DataDir, "nodes.json")
}

func (s *server) loadNodes() ([]Node, error) {
	nodeMu.Lock()
	defer nodeMu.Unlock()
	b, err := os.ReadFile(s.nodesPath())
	if err != nil {
		if os.IsNotExist(err) {
			return []Node{}, nil
		}
		return nil, err
	}
	var f nodeFile
	if err := json.Unmarshal(b, &f); err != nil {
		return nil, err
	}
	return f.Nodes, nil
}

func (s *server) saveNodes(nodes []Node) error {
	nodeMu.Lock()
	defer nodeMu.Unlock()
	b, err := json.MarshalIndent(nodeFile{Nodes: nodes}, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(s.cfg.DataDir, 0755); err != nil {
		return err
	}
	tmp := s.nodesPath() + ".tmp"
	if err := os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, s.nodesPath())
}

func sanitizeNode(n Node) Node {
	n.Token = ""
	if n.SSHPassword != "" {
		n.SSHPassword = "***"
	}
	return n
}

func newNodeID() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return "node_" + hex.EncodeToString(b)
}

// handleNodePower POST /api/nodes/power {id, action: shutdown|reboot|poweron}
// 关机/重启走 SSH（sudo -S），开机走 Wake-on-LAN。
func (s *server) handleNodePower(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		ID     string `json:"id"`
		Action string `json:"action"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.ID == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "id required"})
		return
	}
	n, ok := s.nodeByID(b.ID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	switch b.Action {
	case "poweron":
		if strings.TrimSpace(n.MAC) == "" {
			writeJSON(w, 400, map[string]interface{}{"error": "节点未配置 MAC，无法 Wake-on-LAN"})
			return
		}
		if err := sendWOL(n.MAC); err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]interface{}{"ok": true, "message": "已发送 Wake-on-LAN 魔术包"})
		return
	case "shutdown", "reboot":
		if n.SSHUser == "" || n.SSHPassword == "" {
			writeJSON(w, 400, map[string]interface{}{"error": "节点缺少 SSH 用户/密码"})
			return
		}
		cmdText := "sudo -S shutdown -h now"
		if b.Action == "reboot" {
			cmdText = "sudo -S reboot"
		}
		ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, "sshpass", "-e", "ssh",
			"-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
			n.SSHUser+"@"+n.Host, cmdText)
		cmd.Env = append(os.Environ(), "SSHPASS="+n.SSHPassword)
		cmd.Stdin = strings.NewReader(n.SSHPassword + "\n")
		out, err := cmd.CombinedOutput()
		text := strings.TrimSpace(string(out))
		if err != nil {
			// reboot/shutdown 会主动断开 SSH，ssh 返回 255 并不代表命令失败。
			if strings.Contains(text, "closed by remote host") ||
				strings.Contains(text, "Connection to") ||
				strings.Contains(err.Error(), "exit status 255") {
				err = nil
			}
		}
		if err != nil {
			writeJSON(w, 200, map[string]interface{}{"ok": false, "error": err.Error(), "output": text})
			return
		}
		nodes, _ := s.loadNodes()
		for i := range nodes {
			if nodes[i].ID == n.ID {
				nodes[i].Status = "unknown"
				nodes[i].Message = b.Action + " 指令已发送"
				nodes[i].LastSeen = time.Now().Unix()
			}
		}
		_ = s.saveNodes(nodes)
		writeJSON(w, 200, map[string]interface{}{"ok": true, "output": text})
		return
	default:
		writeJSON(w, 400, map[string]interface{}{"error": "action 必须是 shutdown/reboot/poweron"})
	}
}

func sendWOL(mac string) error {
	raw := strings.NewReplacer(":", "", "-", "", ".", "", " ", "").Replace(strings.TrimSpace(mac))
	if len(raw) != 12 {
		return fmt.Errorf("MAC 格式错误: %s", mac)
	}
	b, err := hex.DecodeString(raw)
	if err != nil || len(b) != 6 {
		return fmt.Errorf("MAC 格式错误: %s", mac)
	}
	packet := make([]byte, 6+16*6)
	for i := 0; i < 6; i++ {
		packet[i] = 0xff
	}
	for i := 0; i < 16; i++ {
		copy(packet[6+i*6:], b)
	}
	for _, port := range []int{9, 7} {
		conn, err := net.DialUDP("udp4", nil, &net.UDPAddr{IP: net.IPv4bcast, Port: port})
		if err != nil {
			continue
		}
		_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		_, _ = conn.Write(packet)
		_ = conn.Close()
	}
	return nil
}

func (s *server) handleNodes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		nodes, err := s.loadNodes()
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		out := make([]Node, 0, len(nodes))
		for _, n := range nodes {
			out = append(out, sanitizeNode(n))
		}
		writeJSON(w, 200, map[string]interface{}{"nodes": out})
	case http.MethodPost:
		var n Node
		if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": "bad json"})
			return
		}
		n.Name = strings.TrimSpace(n.Name)
		n.Host = strings.TrimSpace(n.Host)
		if n.Name == "" || n.Host == "" {
			writeJSON(w, 400, map[string]interface{}{"error": "name/host 不能为空"})
			return
		}
		if n.Port <= 0 {
			n.Port = 8000
		}
		if n.Group == "" {
			n.Group = "internal"
		}
		if n.Capabilities == nil {
			n.Capabilities = []string{"image", "inference", "train"}
		}
		nodes, err := s.loadNodes()
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		found := false
		for i := range nodes {
			if nodes[i].ID == n.ID && n.ID != "" {
				// 空 token/password 表示不修改
				if n.Token == "" {
					n.Token = nodes[i].Token
				}
				if n.SSHPassword == "" {
					n.SSHPassword = nodes[i].SSHPassword
				}
				if n.MAC == "" {
					n.MAC = nodes[i].MAC
				}
				n.LastSeen = nodes[i].LastSeen
				n.Status = nodes[i].Status
				nodes[i] = n
				found = true
				break
			}
		}
		if !found {
			n.ID = newNodeID()
			n.Status = "unknown"
			nodes = append(nodes, n)
		}
		if err := s.saveNodes(nodes); err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]interface{}{"node": sanitizeNode(n)})
	default:
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
	}
}

// handleNodeSSHTest 通过 SSH 测试主机并返回系统/GPU/节点服务信息。
// 密码用 SSHPASS 环境变量传给 sshpass，不出现在进程参数里。
func (s *server) handleNodeSSHTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		User     string `json:"user"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.Host == "" || b.User == "" || b.Password == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "host/user/password required"})
		return
	}
	if b.Port <= 0 {
		b.Port = 22
	}
	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()
	remote := "bash -lc " + shellQuote("uname -a; echo ---; nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null; echo ---; python3 --version 2>&1; echo ---; systemctl is-active rainai-node 2>/dev/null || true")
	cmd := exec.CommandContext(ctx, "sshpass", "-e", "ssh",
		"-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
		"-p", fmt.Sprintf("%d", b.Port), b.User+"@"+b.Host, remote)
	cmd.Env = append(os.Environ(), "SSHPASS="+b.Password)
	out, err := cmd.CombinedOutput()
	text := strings.TrimSpace(string(out))
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"ok": false, "error": err.Error(), "output": text})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"ok": true, "output": text})
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

// handleNodeInstall 通过 SSH 部署/升级节点服务：
// scp 节点包到目标机 → 解压到 releases/<ts> → 切 current → 写/更新 systemd → 重启 → 健康检查。
func (s *server) handleNodeInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.ID == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "id required"})
		return
	}
	n, ok := s.nodeByID(b.ID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	if n.SSHUser == "" || n.SSHPassword == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "缺少 SSH 用户/密码"})
		return
	}
	bundle := "/opt/raincough/node-service.tar.gz"
	if _, err := os.Stat(bundle); err != nil {
		writeJSON(w, 500, map[string]interface{}{"error": "节点包不存在: " + err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 180*time.Second)
	defer cancel()
	sshEnv := append(os.Environ(), "SSHPASS="+n.SSHPassword)
	port := fmt.Sprintf("%d", n.Port)
	if port == "0" {
		port = "8000"
	}
	// 1) 上传节点包
	scp := exec.CommandContext(ctx, "sshpass", "-e", "scp",
		"-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
		"-P", "22", bundle, n.SSHUser+"@"+n.Host+":/tmp/node-service.tar.gz")
	scp.Env = sshEnv
	upOut, upErr := scp.CombinedOutput()
	if upErr != nil {
		writeJSON(w, 200, map[string]interface{}{"ok": false, "step": "upload",
			"error": upErr.Error(), "output": string(upOut)})
		return
	}
	// 2) 远端部署
	rel := fmt.Sprintf("releases/%d", time.Now().Unix())
	script := fmt.Sprintf(`set -e
BASE=/home/%[1]s/aiapp-node
REL=$BASE/%[2]s
mkdir -p "$REL"
tar xzf /tmp/node-service.tar.gz -C "$REL"
ln -sfn "$REL" "$BASE/current"
[ -e "$BASE/venv" ] || ln -s /home/%[1]s/aiapp/.venv "$BASE/venv"
mkdir -p "$BASE/shared/data"
TOKEN="$BASE/shared/data/node_token"
[ -s "$TOKEN" ] || (head -c 32 /dev/urandom | base64 | tr -d '\n' > "$TOKEN"; chmod 600 "$TOKEN")
cat > /tmp/rainai-node.service <<UNIT
[Unit]
Description=RainAI Node (headless API)
After=network.target
[Service]
User=%[1]s
WorkingDirectory=$BASE/current
Environment=RAINAI_NODE_TOKEN_FILE=$BASE/shared/data/node_token
Environment=RAINAI_V1_COMPAT=0
ExecStart=$BASE/venv/bin/python -m uvicorn app.node_main:app --host 0.0.0.0 --port %[3]s
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
echo %[4]s | sudo -S cp /tmp/rainai-node.service /etc/systemd/system/rainai-node.service
echo %[4]s | sudo -S systemctl daemon-reload
echo %[4]s | sudo -S systemctl enable rainai-node
echo %[4]s | sudo -S systemctl restart rainai-node
sleep 5
curl -s -H "Authorization: Bearer $(cat "$TOKEN")" http://127.0.0.1:%[3]s/node/v1/health
`, n.SSHUser, rel, port, n.SSHPassword)
	sh := exec.CommandContext(ctx, "sshpass", "-e", "ssh",
		"-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
		n.SSHUser+"@"+n.Host, "bash -s")
	sh.Env = sshEnv
	sh.Stdin = strings.NewReader(script)
	out, err := sh.CombinedOutput()
	text := strings.TrimSpace(string(out))
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"ok": false, "step": "deploy",
			"error": err.Error(), "output": text})
		return
	}
	// 更新节点状态
	health, _ := nodeGet(n, "/node/v1/health", 10*time.Second)
	nodes, _ := s.loadNodes()
	for i := range nodes {
		if nodes[i].ID == n.ID {
			nodes[i].Status = "online"
			nodes[i].LastSeen = time.Now().Unix()
			if v, ok := health["version"].(string); ok {
				nodes[i].Version = v
			}
			break
		}
	}
	_ = s.saveNodes(nodes)
	writeJSON(w, 200, map[string]interface{}{"ok": true, "output": text, "health": health})
}

// handleNodePreflight 只读预检：OS/Python/venv/torch/CUDA/GPU/磁盘/内存/服务状态。
func (s *server) handleNodePreflight(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.ID == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "id required"})
		return
	}
	n, ok := s.nodeByID(b.ID)
	if !ok {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	if n.SSHUser == "" || n.SSHPassword == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "缺少 SSH 用户/密码"})
		return
	}
	script := fmt.Sprintf(`echo "== OS =="; (. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME") || uname -a
echo "== Python =="; python3 --version 2>&1
echo "== GPU =="; nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>&1
echo "== venv =="
for d in /home/%[1]s/aiapp/.venv /home/%[1]s/aiapp-node/venv; do
  if [ -x "$d/bin/python" ]; then
    echo "$d"
    "$d/bin/python" -c "import torch; print('torch', torch.__version__, 'cuda', torch.version.cuda, 'cuda_available', torch.cuda.is_available())" 2>&1 | head -2
  else
    echo "$d (缺失)"
  fi
done
echo "== Disk/Home =="; df -h /home 2>/dev/null | tail -1
echo "== Memory =="; free -h | head -2
echo "== Service =="; systemctl is-active rainai-node 2>/dev/null || true
`, n.SSHUser)
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "sshpass", "-e", "ssh",
		"-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
		n.SSHUser+"@"+n.Host, "bash -s")
	cmd.Env = append(os.Environ(), "SSHPASS="+n.SSHPassword)
	cmd.Stdin = strings.NewReader(script)
	out, err := cmd.CombinedOutput()
	text := strings.TrimSpace(string(out))
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"ok": false, "error": err.Error(), "output": text})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"ok": true, "output": text})
}

func (s *server) handleNodeDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.ID == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "id required"})
		return
	}
	nodes, err := s.loadNodes()
	if err != nil {
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	out := nodes[:0]
	for _, n := range nodes {
		if n.ID != b.ID {
			out = append(out, n)
		}
	}
	if err := s.saveNodes(out); err != nil {
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]interface{}{"ok": true})
}

func nodeURL(n Node, path string) string {
	return fmt.Sprintf("http://%s:%d%s", n.Host, n.Port, path)
}

func nodeGet(n Node, path string, timeout time.Duration) (map[string]interface{}, error) {
	req, err := http.NewRequest("GET", nodeURL(n, path), nil)
	if err != nil {
		return nil, err
	}
	if n.Token != "" {
		req.Header.Set("Authorization", "Bearer "+n.Token)
	}
	cl := &http.Client{Timeout: timeout}
	resp, err := cl.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("HTTP %d: %v", resp.StatusCode, err)
	}
	if resp.StatusCode >= 400 {
		return out, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return out, nil
}

// handleNodeTest 测试 /node/v1/health 并更新节点状态
func (s *server) handleNodeTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, 405, map[string]interface{}{"error": "method not allowed"})
		return
	}
	var b struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || b.ID == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "id required"})
		return
	}
	nodes, err := s.loadNodes()
	if err != nil {
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	idx := -1
	for i := range nodes {
		if nodes[i].ID == b.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	n := nodes[idx]
	health, err := nodeGet(n, "/node/v1/health", 8*time.Second)
	now := time.Now().Unix()
	if err != nil {
		n.Status = "offline"
		n.Message = err.Error()
	} else {
		n.Status = "online"
		n.Message = ""
		n.LastSeen = now
		if v, ok := health["version"].(string); ok {
			n.Version = v
		}
		// 顺便拉 info/status（失败不影响在线判定）
		if info, e := nodeGet(n, "/node/v1/info", 10*time.Second); e == nil {
			if gpu, ok := info["gpu"].(map[string]interface{}); ok {
				if name, ok := gpu["gpu"].(string); ok {
					n.GPU = name
				}
			}
		}
		if st, e := nodeGet(n, "/node/v1/status", 20*time.Second); e == nil {
			if inner, ok := st["status"].(map[string]interface{}); ok {
				if g, ok := inner["gpu"].(string); ok && g != "" {
					n.GPU = g
				}
			}
		}
	}
	nodes[idx] = n
	_ = s.saveNodes(nodes)
	writeJSON(w, 200, map[string]interface{}{"node": sanitizeNode(n), "health": health})
}

// handleNodeStatus 代理节点 status + models，供详情页用
func (s *server) handleNodeStatus(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		writeJSON(w, 400, map[string]interface{}{"error": "id required"})
		return
	}
	nodes, err := s.loadNodes()
	if err != nil {
		writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	var n Node
	found := false
	for _, x := range nodes {
		if x.ID == id {
			n, found = x, true
			break
		}
	}
	if !found {
		writeJSON(w, 404, map[string]interface{}{"error": "node not found"})
		return
	}
	status, e1 := nodeGet(n, "/node/v1/status", 20*time.Second)
	models, e2 := nodeGet(n, "/node/v1/models", 20*time.Second)
	info, e3 := nodeGet(n, "/node/v1/info", 10*time.Second)
	errs := []string{}
	if e1 != nil {
		errs = append(errs, "status: "+e1.Error())
	}
	if e2 != nil {
		errs = append(errs, "models: "+e2.Error())
	}
	if e3 != nil {
		errs = append(errs, "info: "+e3.Error())
	}
	writeJSON(w, 200, map[string]interface{}{
		"status": status, "models": models, "info": info,
		"errors": errs,
	})
}
