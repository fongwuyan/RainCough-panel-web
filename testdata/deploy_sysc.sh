#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -8 && echo "go ok"
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -4
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== sysfunc API 抽查 ==="
for ep in "hardware" "users" "clean/scan" "pwr/state" "time/status" "health/check" "events/timeline?limit=3" "boot/history" "ssh/keys?user=f" "disks/fs"; do
  R=$(curl -s --max-time 6 "http://127.0.0.1:3900/api/sysfunc/$ep" | head -c 80)
  echo "[$ep] $R"
done
echo "=== 系统中心页可访问 ==="
curl -s -o /dev/null -w "sysfunc route %{http_code}\n" "http://127.0.0.1:3900/api/sysfunc/service/list"
echo "=== 插件仍活 ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'