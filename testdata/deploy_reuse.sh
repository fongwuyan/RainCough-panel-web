#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -8
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 首页 ==="
curl -s http://127.0.0.1:3900/ | grep -o '<title>[^<]*'