#!/bin/bash
curl -s --max-time 6 http://127.0.0.1:3900/api/system | python3 -c '
import json,sys
d=json.load(sys.stdin)
need=["hostname","platform","arch","cpu_model","cpu_count","cpu_percent","cpu_per_core","memory_available","memory_used","memory_total","memory_percent","swap_total","swap_used","swap_percent","uptime","boot_time","python_version","go_version","load_avg","process_count","thread_count","net_recv","net_sent","net_up_rate","net_down_rate","net_interfaces","disks"]
print("=== 字段缺失/空 ===")
for k in need:
    if k not in d: print("  MISSING:", k)
    elif d[k] in (None,"",[],0): print("  EMPTY:", k)
print("=== 现有关键字段 ===")
for k in ["hostname","platform","arch","cpu_model","cpu_count","cpu_percent","memory_available","uptime","boot_time","python_version","process_count","thread_count","load_avg"]:
    print(f"  {k}: {d.get(k)}")
ni=d.get("net_interfaces") or []
print("  net_interfaces[0]:", (ni[0] if ni else "无"))
print("=== /api/system/ 前缀端点 ===")
import urllib.request
for ep in ["sys","perf","net","disk","system"]:
    try:
        r=urllib.request.urlopen(f"http://127.0.0.1:3900/api/system/{ep}", timeout=4)
        print(f"  /api/system/{ep}: {r.status}")
    except Exception as e:
        print(f"  /api/system/{ep}: {e}")
'