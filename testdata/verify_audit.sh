#!/bin/bash
B=http://127.0.0.1:3900
echo "=== Logs/Processes 页面 API ==="
echo "-- /api/sys/logs --"
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --max-time 5 "$B/api/sys/logs"
curl -s --max-time 5 "$B/api/sys/logs" | head -c 100
echo
echo "-- /api/sys/processes --"
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --max-time 5 "$B/api/sys/processes"
curl -s --max-time 5 "$B/api/sys/processes" | head -c 100
echo
echo "=== api.js 里 Logs/Processes 调什么 ==="
grep -oE 'sysLogs: [^,]+|sysProcesses: [^,]+|sysKill: [^,]+' /tmp/nonexist 2>/dev/null || true
cd ~/raincough-dev/web 2>/dev/null && grep -oE 'sysLogs: [^,]+|sysProcesses: [^,]+|sysKill: [^,]+' src/api.js | head -4
echo "=== media roots 字段 ==="
curl -s --max-time 5 $B/api/media/roots
echo
echo "=== envpkg catalog ==="
curl -s --max-time 5 $B/api/envpkg/catalog | head -c 200
echo