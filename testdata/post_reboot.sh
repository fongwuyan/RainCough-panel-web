#!/bin/bash
echo "=== 宿主重启后状态 ==="
echo "-- 面板进程 --"
pgrep -af 'raincough -port' | head -2 || echo "无面板"
echo "-- 3900 --"
ss -tlnp 2>/dev/null | grep 3900 | head -1 || echo "未监听"
echo "-- plugins 目录 --"
ls ~/raincough-dev/plugins/ 2>/dev/null | tr '\n' ' ' ; echo
echo "-- 面板响应 --"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 6 http://127.0.0.1:3900/ || echo "curl失败"
echo "-- 插件 alive --"
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins 2>/dev/null | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:",len(ps),"alive:",sum(1 for p in ps if p.get("alive")))' 2>/dev/null || echo "插件API未响应"