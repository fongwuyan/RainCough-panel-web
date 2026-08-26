#!/bin/bash
echo "=== pymysql ==="
python3 -c "import pymysql; print('pymysql OK', pymysql.__version__)" 2>&1 | head -3
echo "=== raincough 进程 ==="
ps aux | grep '[r]aincough' | awk '{print $2, $11, $12, $13}' | head -5
echo "=== 端口 ==="
ss -tlnp 2>/dev/null | grep -E '3900|3901' || echo "no listener"
echo "=== srv.log ==="
cat ~/raincough-dev/srv.log 2>/dev/null | tail -5
echo "=== 各目录 ==="
ls -la ~/raincough-dev/srv*.log 2>/dev/null