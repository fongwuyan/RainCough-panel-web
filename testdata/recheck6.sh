#!/bin/bash
B=http://127.0.0.1:3900
echo "=== envpkg/run 状态 ==="
curl -s -o /tmp/r1 -w "%{http_code}\n" --max-time 8 -X POST $B/api/envpkg/run -H 'Content-Type: application/json' -d '{}'
cat /tmp/r1 | head -c 120; echo
echo "=== fm/rename 状态 ==="
curl -s -o /tmp/r2 -w "%{http_code}\n" --max-time 8 -X POST $B/api/fm/rename -H 'Content-Type: application/json' -d '{}'
cat /tmp/r2 | head -c 120; echo
echo "=== kvm 子进程 ==="
pgrep -af 'server.py' | grep -i kvm || echo "无 kvm 子进程"
ls ~/raincough-dev/plugins/kvm/.runtime.log 2>/dev/null && tail -5 ~/raincough-dev/plugins/kvm/.runtime.log
echo "=== 插件列表 kvm ==="
curl -s --max-time 6 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); [print(p["name"], "alive:", p.get("alive")) for p in ps if "kvm"==p["name"].lower()]'