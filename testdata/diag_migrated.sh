#!/bin/bash
echo "=== 插件列表 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | head -c 200
echo
echo "=== 插件 alive 统计 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c '
import json,sys
try:
    ps=json.load(sys.stdin)
    print("total:", len(ps), "alive:", sum(1 for p in ps if p.get("alive")))
    for p in ps:
        if not p.get("alive"): print("  dead:", p["name"])
except Exception as e:
    print("parse err:", e)
'
echo "=== 子进程 python 端口(cwd) ==="
for pid in $(pgrep -f 'python3 server.py'); do
  echo "pid $pid $(readlink /proc/$pid/cwd 2>/dev/null | sed 's|.*/plugins/||')"
done
echo "=== 抽查 __health(新迁移插件) ==="
for n in compress dltool filehash imagetool kvm mcskin ocrqr texttool touchgal webspy uptime vpn aigen docker laizhangsetu mcserver; do
  R=$(curl -s --max-time 6 "http://127.0.0.1:3900/api/plugins/$n/__health?probe=1" | head -c 60)
  echo "  $n: $R"
done