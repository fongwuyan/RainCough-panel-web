#!/bin/bash
echo "=== 进程 ==="
pgrep -a -f 'raincough -port' | head -3 || echo NO_PROC
echo "=== 端口 ==="
ss -tlnp 2>/dev/null | grep 3900 || echo NO_LISTEN
echo "=== sysfunc 直测 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/sysfunc/service/list | head -c 200
echo
echo "=== 系统 api ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/system | head -c 120
echo
echo "=== srv.log 尾 ==="
tail -5 ~/raincough-dev/srv.log