#!/bin/bash
cd ~/raincough-dev
echo "=== 前端重建 ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -1
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "=== 验证 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'
JS=$(ls public/assets/index-*.js | head -1 | xargs basename)
echo "bundle: $JS"
grep -c '加载插件前端失败' "public/assets/$JS" 2>/dev/null || echo "0 (错误文案已按条件展示)"