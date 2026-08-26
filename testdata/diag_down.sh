#!/bin/bash
echo "=== 端口 ==="
ss -tlnp 2>/dev/null | grep 3900 || echo NO_LISTEN
echo "=== srv.log 尾部 ==="
tail -12 ~/raincough-dev/srv.log
echo "=== /api/system ==="
curl -s -o /dev/null -w "system %{http_code}\n" --max-time 5 http://127.0.0.1:3900/api/system