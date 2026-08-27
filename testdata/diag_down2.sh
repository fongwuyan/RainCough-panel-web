#!/bin/bash
echo "=== 服务状态 ==="
ss -tlnp 2>/dev/null | grep 3900 || echo NO_LISTEN
pgrep -af 'raincough -port' | head -2
echo "=== srv.log 尾部 ==="
tail -8 ~/raincough-dev/srv.log
echo "=== index ==="
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://127.0.0.1:3900/