#!/bin/bash
echo "=== lsblk -J -b 原始输出 ==="
lsblk -J -b -o NAME,PATH,TYPE,SIZE,FSTYPE,LABEL,MOUNTPOINT,ROTA,HOTPLUG 2>&1 | head -30
echo "=== 面板进程里 sudo 调用看看(服务日志) ==="
grep -iE 'lsblk|disks' ~/raincough-dev/srv.log 2>/dev/null | tail -3
echo "=== 直接测面板 Run 分支(无 sudo) vs sudo ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/disks | head -c 200