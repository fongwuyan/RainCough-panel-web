#!/bin/bash
echo "=== 触发 /api/disks ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/disks
echo
sleep 1
echo "=== srv.log 中 disks 日志 ==="
grep -a 'disks\|lsblk' ~/raincough-dev/srv.log | tail -5
echo "=== srv.log 尾部 ==="
tail -6 ~/raincough-dev/srv.log