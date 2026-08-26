#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
echo "=== 解压(可能较慢) ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -8 && echo "go ok"
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -3
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 原缺失端点验证 ==="
check() { R=$(curl -s --max-time 6 "$1" | head -c 70); echo "[$1] $R"; }
check "http://127.0.0.1:3900/api/media/roots"
check "http://127.0.0.1:3900/api/media/stats"
check "http://127.0.0.1:3900/api/media/list?root=/etc"
check "http://127.0.0.1:3900/api/store/project/status"
check "http://127.0.0.1:3900/api/store/project/check"
check "http://127.0.0.1:3900/api/terminal/hosts/set_sort"
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/disks/unmount -H 'Content-Type: application/json' -d '{"part":"/tmp/nonexist"}' | head -c 70
echo
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/envpkg/start -H 'Content-Type: application/json' -d '{"name":"node-18"}' | head -c 70
echo
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/store/plugin/update -H 'Content-Type: application/json' -d '{"name":"uptime"}' | head -c 80
echo
echo "=== 插件仍活 ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'