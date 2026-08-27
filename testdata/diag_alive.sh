#!/bin/bash
echo "=== 面板进程 ==="
pgrep -af 'raincough' | head -3
ss -tlnp 2>/dev/null | grep 3900 | head -2
echo "=== 直接 curl ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/system -o /tmp/sys.json -w "HTTP %{http_code}\n"
cat /tmp/sys.json | head -c 120
echo
echo "=== srv.log 尾 ==="
tail -5 ~/raincough-dev/srv.log