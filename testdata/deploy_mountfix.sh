#!/bin/bash
cd ~/raincough-dev
echo "=== 解压+重建前端(含 mountEl ref 修复) ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -1
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "=== firefox dump webspy(验证深渲染) ==="
timeout 40 firefox --headless --dump-dom "http://127.0.0.1:3900/#/plugin/webspy" > /tmp/ws2.html 2>/dev/null
echo "DOM 大小: $(stat -c%s /tmp/ws2.html 2>/dev/null)"
grep -oE '搜索|RSS|正文提取|链接检查|section-title' /tmp/ws2.html | sort | uniq -c | head -8
echo "=== alive ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'