#!/bin/bash
# 完整部署: 解压 + 编译 + 前端重建 + 启动 + 验证
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 解压 ==="
tar -xf src.tar && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 || { echo BUILD_FAIL; exit 1; }
echo "build ok"
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -3
cd ..
echo "=== 启动 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 验证 ==="
echo "-- 首页 --"
curl -s http://127.0.0.1:3900/ | grep -o '<title>[^<]*'
echo "-- 系统 --"
curl -s --max-time 8 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("host:", d["hostname"], "ifaces:", len(d.get("net_interfaces",[])))'
echo "-- disks --"
curl -s --max-time 8 http://127.0.0.1:3900/api/disks | python3 -c 'import json,sys; d=json.load(sys.stdin); print("disks:", [x["name"] for x in d.get("disks",[])][:5])'
echo "-- 插件 --"
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'
echo "-- 前端资源 --"
curl -s -o /dev/null -w "js %{http_code} " http://127.0.0.1:3900/assets/index-C4NkyTqU.js
curl -s -o /dev/null -w "css %{http_code}\n" http://127.0.0.1:3900/assets/index-H_hYRZzE.css