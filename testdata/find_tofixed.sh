#!/bin/bash
B=http://127.0.0.1:3900
echo "=== /api/system 字段类型(找非数字) ==="
curl -s --max-time 6 $B/api/system | python3 -c '
import json,sys
d=json.load(sys.stdin)
for k,v in d.items():
    t=type(v).__name__
    if t in ("str","NoneType") and k not in ("hostname","platform","arch","cpu_model","go_version","python_version"):
        print(f"  [str] {k} = {v!r}")
    if t=="str" and k in ("cpu_percent","memory_percent","disk_percent","swap_percent"):
        print(f"  !! %字段是字符串: {k} = {v!r}")
'
echo "=== diskAgg 源: disk_used/disk_total/disk_percent ==="
curl -s --max-time 6 $B/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  disk_used:", repr(d.get("disk_used")), "disk_total:", repr(d.get("disk_total")), "disk_percent:", repr(d.get("disk_percent")))'
echo "=== perf/status rate 类型 ==="
curl -s --max-time 6 $B/api/sysfunc/perf/history?hours=24 | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  net:", d.get("net"))'
curl -s --max-time 6 $B/api/sysfunc/net/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  rate:", d.get("rate"), "| nics[0].rate:", (d.get("nics") or [{}])[0].get("rate"))'