#!/bin/bash
# MySQL DSN 全量验证
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
./raincough -port 3900 > srv.log 2>&1 &
SRV_PID=$!
sleep 8
echo "=== 服务日志 ==="
grep -E '已加载|失败|上限' srv.log | head -20
echo "=== 插件全量 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"])); print("dead:", [p["name"] for p in ps if not p["alive"]] or "none")'
echo "=== uptime MySQL 写入 ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/uptime/targets \
  -H "Content-Type: application/json" -d '{"name":"mysql2","url":"https://www.baidu.com"}' > /dev/null
sleep 12
curl -s http://127.0.0.1:3900/api/plugins/uptime/targets | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d["targets"].get("mysql2",{}); print("uptime:", t.get("last_status"), t.get("avail"), t.get("last_ms"))'
echo "=== MySQL 表 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW TABLES;" 2>/dev/null