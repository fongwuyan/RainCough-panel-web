#!/bin/bash
# 查 uptime 数据表内容
python3 - <<'EOF'
import sqlite3
db = '/home/f/raincough-dev/data/data/rc.db'
c = sqlite3.connect(db)
rows = c.execute("SELECT key, substr(value,1,300) FROM ns_uptime_kv").fetchall()
print("rows:", len(rows))
for k, v in rows:
    print("key:", k)
    print("value:", v)
c.close()
EOF
echo "=== uptime 子进程活着? ==="
pgrep -a -f uptime 2>/dev/null || echo "no uptime proc"
ss -tlnp 2>/dev/null | grep 34075 || echo "port 34075 not listening"