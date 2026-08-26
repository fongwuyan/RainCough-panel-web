#!/bin/bash
# uptime v2 插件 e2e: 网关 -> 子进程 -> SharedData
B=http://127.0.0.1:3900/api/plugins/uptime
echo "=== 1. 列表(健康) ==="
curl -s $B/targets | python3 -m json.tool
echo "=== 2. 添加监控目标(baidu + 一个假地址) ==="
curl -s -X POST $B/targets -H "Content-Type: application/json" \
  -d '{"name":"baidu","url":"https://www.baidu.com","interval":10,"timeout":5}'
echo
curl -s -X POST $B/targets -H "Content-Type: application/json" \
  -d '{"name":"dead","url":"http://127.0.0.1:9","interval":10,"timeout":3}'
echo
echo "=== 3. 等待 15s 让探活线程执行 ==="
sleep 15
echo "=== 4. 查看状态(应含 last_status/avail) ==="
curl -s $B/targets | python3 -m json.tool
echo "=== 5. 历史 ==="
curl -s $B/history/baidu | python3 -c 'import json,sys; d=json.load(sys.stdin); print("history len:", len(d.get("history",[])))'
echo "=== 6. 删除目标 ==="
curl -s -X DELETE $B/targets/dead
echo
echo "=== 7. 插件列表(网关) ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; print([(p["name"], p["alive"]) for p in json.load(sys.stdin)])'