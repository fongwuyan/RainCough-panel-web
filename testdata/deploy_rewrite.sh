#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -5 && echo "go ok"
echo "=== 前端 build(轻量 vue/router) ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -4
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 验证 ==="
curl -s http://127.0.0.1:3900/ | grep -oE '<title>[^<]+'
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", sum(1 for p in ps if p["alive"]), "/", len(ps))'
curl -s --max-time 5 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("sys ok:", d.get("hostname"))'
ls public/assets/index-*.js | tail -1 | awk '{print "JS:", $9, $5}'