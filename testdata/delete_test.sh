#!/bin/bash
# 验证 DELETE 网关代理修复
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 4
echo "=== 1. 先加一个临时目标 ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/uptime/targets \
  -H "Content-Type: application/json" -d '{"name":"temp","url":"http://127.0.0.1:9"}'
echo
echo "=== 2. DELETE temp (经网关) ==="
curl -s -X DELETE http://127.0.0.1:3900/api/plugins/uptime/targets/temp
echo
echo "=== 3. targets 现状 ==="
curl -s http://127.0.0.1:3900/api/plugins/uptime/targets | python3 -c 'import json,sys; print(list(json.load(sys.stdin)["targets"].keys()))'
echo "=== 4. baidu 仍在, 健康 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; print([(p["name"],p["alive"]) for p in json.load(sys.stdin)])'