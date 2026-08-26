#!/bin/bash
echo "=== 服务 ==="
pgrep -a -f 'raincough -port' | head -3
ss -tlnp 2>/dev/null | grep 3900
echo "=== 1. 服务列表 ==="
curl -s --max-time 10 http://127.0.0.1:3900/api/sysfunc/service/list | python3 -c 'import json,sys; d=json.load(sys.stdin); s=d.get("services",[]); print("count:", len(s)); [print(" ", x["name"], x["active"]) for x in s[:5]]'
echo "=== 2. 进程 ==="
curl -s --max-time 10 http://127.0.0.1:3900/api/sysfunc/process/list | python3 -c 'import json,sys; d=json.load(sys.stdin); p=d.get("processes",[]); print("count:", len(p)); [print(" ", x["pid"], x["user"], x["cmd"][:40]) for x in p[:5]]'
echo "=== 3. 日志 ==="
curl -s --max-time 10 "http://127.0.0.1:3900/api/sysfunc/log?path=/var/log/syslog&lines=5" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("lines:", len(d.get("logs",[]))); [print(" ", l[:80]) for l in d.get("logs",[])[:3]]'
echo "=== 4. 防火墙 ==="
curl -s --max-time 10 http://127.0.0.1:3900/api/sysfunc/fw/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print("enabled:", d.get("enabled"))'
echo "=== 5. 插件 ==="
curl -s --max-time 10 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'