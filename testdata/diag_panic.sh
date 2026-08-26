#!/bin/bash
echo "=== srv.log 全文尾部 40 行(找 panic) ==="
tail -40 ~/raincough-dev/srv.log
echo
echo "=== /api/disks HTTP 状态码 ==="
curl -s -o /dev/null -w "%{http_code} %{size_download}B\n" --max-time 8 http://127.0.0.1:3900/api/disks
echo "=== 进程存活 ==="
pgrep -a -f 'raincough -port' | head -2
echo "=== 其他 API 正常? ==="
curl -s -o /dev/null -w "system %{http_code}\n" --max-time 5 http://127.0.0.1:3900/api/system