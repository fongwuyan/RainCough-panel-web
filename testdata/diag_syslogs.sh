#!/bin/bash
echo "=== /api/sys/logs 原始 ==="
curl -s -i --max-time 6 "http://127.0.0.1:3900/api/sys/logs?lines=5" 2>&1 | head -12
echo "=== srv.log panic? ==="
grep -a 'panic\|sys/logs\|sysLogs' ~/raincough-dev/srv.log 2>/dev/null | tail -4
echo "=== 进程存在? ==="
ss -tlnp 2>/dev/null | grep 3900 | head -1