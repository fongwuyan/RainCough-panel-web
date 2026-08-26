#!/bin/bash
# 部署全新前端: 解压 -> Go build -> 前端 build -> 启动 -> 验证
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 解压 ==="
tar -xf src.tar && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -5 && echo "go ok"
echo "=== 前端 build(轻量依赖只剩 vue/router) ==="
cd web
node node_modules/vite/bin/vite.js build 2>&1 | tail -6
cd ..
echo "=== 启动 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 验证 ==="
curl -s http://127.0.0.1:3900/ | grep -o '<title>[^<]*'
curl -s --max-time 8 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("host:", d["hostname"], "mem%:", round(d["memory_percent"],1))'
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'
curl -s --max-time 8 http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; d=json.load(sys.stdin); print("scheduler jobs:", len(d.get("jobs",[])))'
curl -s --max-time 8 http://127.0.0.1:3900/api/envpkg/envs | python3 -c 'import json,sys; d=json.load(sys.stdin); print("envs:", len(d.get("envs",[])))'
echo "--- 前端资源 ---"
ls -la public/assets/ | tail -3