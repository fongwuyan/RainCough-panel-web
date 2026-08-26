#!/bin/bash
# 检查 uptime 数据层连接问题
echo "=== 1. 各 raincough 进程的 DSN ==="
for p in $(pgrep -f raincough); do
  echo "pid=$p"
  tr '\0' '\n' < /proc/$p/environ 2>/dev/null | grep -E 'RAINCOUGH_DB|RC_DATA' || echo "  (env read fail)"
done
echo "=== 2. 库文件位置 ==="
find ~/raincough-dev -name 'rc.db' 2>/dev/null
echo "=== 3. 主库表清单 ==="
python3 - <<'EOF'
import sqlite3, glob
for db in glob.glob('/home/f/raincough-dev/**/rc.db', recursive=True):
    print("DB:", db)
    try:
        c = sqlite3.connect(db)
        tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        print("  tables:", tables)
        c.close()
    except Exception as e:
        print("  err:", e)
EOF
echo "=== 4. uptime 子进程运行时日志 ==="
cat ~/raincough-dev/plugins/uptime/.runtime.log 2>/dev/null | tail -5