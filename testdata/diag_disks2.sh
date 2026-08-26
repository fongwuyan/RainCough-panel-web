#!/bin/bash
echo "=== /api/disks 完整响应 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/disks
echo
echo "=== 服务最近日志 ==="
tail -5 ~/raincough-dev/srv.log
echo "=== Run 直接测(脚本模仿) ==="
cd /tmp
capture() { out=$(lsblk -J -b -o NAME,PATH,TYPE,SIZE,FSTYPE,LABEL,MOUNTPOINT,ROTA,HOTPLUG 2>&1); echo "rc=$? out_len=${#out}"; echo "${out:0:60}"; }
capture