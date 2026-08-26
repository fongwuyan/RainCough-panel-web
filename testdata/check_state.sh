#!/bin/bash
echo "=== pymysql ==="
python3 -c "import pymysql; print('pymysql OK', pymysql.__version__)" 2>&1
echo "=== 服务状态 ==="
pgrep -a -f 'raincough -port'
echo "=== API ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"])); print("dead:", [p["name"] for p in ps if not p["alive"]] or "none")' 2>&1