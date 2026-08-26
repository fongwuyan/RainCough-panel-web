#!/bin/bash
# 部署终端重建
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -5
echo "go ok"
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -4
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 终端 API 验证 ==="
curl -s --max-time 5 -X POST http://127.0.0.1:3900/api/terminal/open -H 'Content-Type: application/json' -d '{"rows":24,"cols":100}' | head -c 60
echo
echo "=== hosts CRUD ==="
curl -s --max-time 5 -X POST http://127.0.0.1:3900/api/terminal/hosts -H 'Content-Type: application/json' -d '{"host":"192.168.2.1","port":"22","username":"root","password":"x","ps":"测试"}' | head -c 80
echo
curl -s --max-time 5 http://127.0.0.1:3900/api/terminal/hosts | head -c 120
echo
echo "=== commands CRUD ==="
curl -s --max-time 5 -X POST http://127.0.0.1:3900/api/terminal/commands -H 'Content-Type: application/json' -d '{"title":"df","shell":"df -h"}' | head -c 60
echo
curl -s --max-time 5 http://127.0.0.1:3900/api/terminal/commands | head -c 100
echo
echo "=== 前端资源 ==="
ls public/assets/index-*.js | tail -1 | awk '{print $5}'