#!/bin/bash
# store API 验证
cd ~/raincough-dev
pkill -f "raincough -port" 2>/dev/null
sleep 1
export PATH=$HOME/go-tool/go/bin:$PATH
go build -o raincough ./cmd/raincough
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 3
echo "=== settings(默认仓库) ==="
curl -s http://127.0.0.1:3900/api/store/settings | python3 -m json.tool
echo "=== 无 token 时 ping ==="
curl -s -X POST http://127.0.0.1:3900/api/store/ping | python3 -m json.tool
echo "=== 无 token registry(应失败或限流) ==="
curl -s http://127.0.0.1:3900/api/store/registry | head -c 200
echo
echo "=== registry 若可达(公开仓库可无 token) ==="
curl -s http://127.0.0.1:3900/api/store/registry | python3 -c 'import json,sys; d=json.load(sys.stdin); print("plugins:", len(d.get("plugins",[])))' 2>/dev/null || echo "registry 需 token"