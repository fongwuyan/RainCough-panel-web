#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -10
echo "go ok ($(ls -la raincough | awk '{print $5}') bytes)"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 6
echo "=== sysfunc 扩展 API 抽查 ==="
for ep in "hardware" "users" "clean/scan" "pwr/state" "time/status" "health/check" "events/timeline?limit=3" "boot/history" "perf/history?hours=1" "net/status" "ssh/keys?user=f" "disks/fs"; do
  R=$(curl -s --max-time 6 "http://127.0.0.1:3900/api/sysfunc/$ep" | head -c 90)
  echo "[$ep] ${R:0:80}"
done
echo "=== 插件仍活 ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'