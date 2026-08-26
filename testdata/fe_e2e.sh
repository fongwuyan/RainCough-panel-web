#!/bin/bash
# 端到端: plugin assets 可用 + 网关 + 前端字段
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='sqlite:///data/rc.db'   # 回 sqlite 避免 MySQL 连接问题
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
go build -o raincough ./cmd/raincough 2>&1 | head -3
rm -f srv.log
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 1. 插件注册(uptime 含 assets?) ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c '
import json,sys
ps = json.load(sys.stdin)
print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))
u = next((p for p in ps if p["name"]=="uptime"), None)
print("uptime:", json.dumps(u, ensure_ascii=False) if u else "MISSING")
'
echo "=== 2. uptime assets 可拉取 ==="
curl -s -o /dev/null -w 'plugin.js HTTP %{http_code}, %{size_download} bytes\n' \
  http://127.0.0.1:3900/api/plugins/uptime/assets/plugin.js
echo "=== 3. uptime 网关(后端) ==="
curl -s http://127.0.0.1:3900/api/plugins/uptime/targets | head -c 120
echo
echo "=== 4. 首屏 === "
curl -s http://127.0.0.1:3900/ | head -c 120