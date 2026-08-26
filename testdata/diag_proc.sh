#!/bin/bash
echo "=== 所有 raincough 进程 ==="
pgrep -a -f raincough
echo "=== 3900 端口归属 ==="
ss -tlnp 2>/dev/null | grep 3900
echo "=== 进程启动时间 ==="
ps -o pid,lstart,cmd -p $(ss -tlnp 2>/dev/null | grep 3900 | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1) 2>/dev/null