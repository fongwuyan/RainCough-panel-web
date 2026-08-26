#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -3
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 首页 title(诊断标记) ==="
curl -s http://127.0.0.1:3900/ | grep -oE '<title>[^<]+'
echo "=== 用 Firefox 无头渲染首页并读 title ==="
timeout 25 firefox --headless --screenshot=/tmp/shots/diag2.png --window-size=1400,900 "http://127.0.0.1:3900/#/" 2>/dev/null
echo "截图大小: $(ls -la /tmp/shots/diag2.png 2>/dev/null | awk '{print $5}')"
echo "=== 插件/服务状态 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", sum(1 for p in ps if p["alive"]), "/", len(ps))'