#!/bin/bash
# 清理宿主机所有 raincough/插件进程
pkill -9 -f raincough 2>/dev/null
pkill -9 -f server.py 2>/dev/null
sleep 1
echo "raincough: $(pgrep -f raincough | wc -l)  server.py: $(pgrep -f server.py | wc -l)"
echo "3000 旧面板还活着: $(ss -tlnp 2>/dev/null | grep :3000 | wc -l)"
echo CLEAN