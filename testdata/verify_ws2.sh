#!/bin/bash
echo "=== 工作台数据源 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("cpu%:", round(d["cpu_percent"],1), "cores:", len(d.get("cpu_per_core",[])), "ifaces:", len(d.get("net_interfaces",[])), "disks:", len(d.get("disks",[])), "load:", d.get("load_avg"))'
curl -s --max-time 8 http://127.0.0.1:3900/api/disks | python3 -c 'import json,sys; d=json.load(sys.stdin); print("disk devices:", [x["name"] for x in d.get("disks",[])])'
echo "=== 插件 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'
echo "=== 新前端资源 ==="
for f in index-Dxj018sY.js index-C1UJ0mzP.css; do curl -s -o /dev/null -w "$f %{http_code}\n" http://127.0.0.1:3900/assets/$f; done