#!/bin/bash
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
cd ~/raincough-dev
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 状态 ==="
curl -s http://127.0.0.1:3900/ | grep -o '<title>[^<]*'
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", sum(1 for p in ps if p["alive"]), "/", len(ps))'
echo "=== 终端会话 ==="
curl -s --max-time 5 -X POST http://127.0.0.1:3900/api/terminal/open -H 'Content-Type: application/json' -d '{"rows":24,"cols":100}' | head -c 40