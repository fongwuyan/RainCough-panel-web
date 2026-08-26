#!/bin/bash
# 重建前端并验证工作台
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -5
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 6
echo "=== 首页 ==="
curl -s http://127.0.0.1:3900/ | grep -o '<title>[^<]*'
echo "=== 工作台数据源 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("cpu%:", round(d["cpu_percent"],1), "cores:", len(d.get("cpu_per_core",[])), "ifaces:", len(d.get("net_interfaces",[])), "disks:", len(d.get("disks",[])))'
curl -s --max-time 8 http://127.0.0.1:3900/api/disks | python3 -c 'import json,sys; d=json.load(sys.stdin); print("disk devices:", [x["name"] for x in d.get("disks",[])])'
echo "=== 新 JS ==="
ls -la public/assets/index-*.js | tail -1 | awk '{print $5, $9}'