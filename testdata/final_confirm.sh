#!/bin/bash
# 最终确认: 服务/端口/前端页面
echo "=== 端口 ==="
ss -tlnp 2>/dev/null | grep 3900
echo "=== 插件 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'
echo "=== 磁盘(工作台数据) ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("disks:", len(d.get("disks",[])), "ifaces:", len(d.get("net_interfaces",[])))'
echo "=== 前端 index ==="
curl -s http://127.0.0.1:3900/ | grep -o '<title>[^<]*'