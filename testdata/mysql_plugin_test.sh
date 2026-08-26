#!/bin/bash
echo "=== 插件全量 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'
echo "=== MySQL 表 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW TABLES;" 2>/dev/null
echo "=== 测试插件写 MySQL(uptime 加目标) ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/uptime/targets \
  -H "Content-Type: application/json" -d '{"name":"mysql-test","url":"https://www.baidu.com"}' | python3 -c 'import json,sys; d=json.load(sys.stdin); print("uptime add:", d.get("name"), d.get("url"))'
sleep 14
curl -s http://127.0.0.1:3900/api/plugins/uptime/targets | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d["targets"].get("mysql-test",{}); print("uptime status:", t.get("last_status"), "avail:", t.get("avail"), "ms:", t.get("last_ms"))'
echo "=== MySQL uptime 数据 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SELECT key, substr(value,1,80) FROM ns_uptime_kv;" 2>/dev/null