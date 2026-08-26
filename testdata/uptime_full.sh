#!/bin/bash
# 重启服务并验证 uptime 全链路
cd ~/raincough-dev
# 杀掉所有 raincough
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 4
echo "=== 服务日志 ==="
tail -3 srv.log
echo "=== 1. 添加目标(经网关, 验证 Content-Length 修复) ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/uptime/targets \
  -H "Content-Type: application/json" -d '{"name":"baidu","url":"https://www.baidu.com","interval":10,"timeout":5}'
echo
curl -s -X POST http://127.0.0.1:3900/api/plugins/uptime/targets \
  -H "Content-Type: application/json" -d '{"name":"dead","url":"http://127.0.0.1:9","interval":10,"timeout":3}'
echo
echo "=== 2. 等待 15s 探活 ==="
sleep 15
echo "=== 3. 状态(含 avail/last_status) ==="
curl -s http://127.0.0.1:3900/api/plugins/uptime/targets | python3 -m json.tool
echo "=== 4. 历史 ==="
curl -s http://127.0.0.1:3900/api/plugins/uptime/history/baidu | python3 -c 'import json,sys; d=json.load(sys.stdin); print("hist:", len(d.get("history",[])), "last:", d.get("history",[{}])[-1])'
echo "=== 5. 删除 ==="
curl -s -X DELETE http://127.0.0.1:3900/api/plugins/uptime/targets/dead
echo
echo "=== 6. 插件健康 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; print([(p["name"],p["alive"]) for p in json.load(sys.stdin)])'