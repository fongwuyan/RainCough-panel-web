#!/bin/bash
echo "=== 原始响应 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/disks
echo
echo "=== disks 日志(有无解析错) ==="
grep -a "disks" ~/raincough-dev/srv.log | tail -3
echo "=== 服务状态 ==="
ss -tlnp 2>/dev/null | grep 3900 | head -1
tail -3 ~/raincough-dev/srv.log