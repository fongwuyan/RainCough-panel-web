#!/bin/bash
curl -s --max-time 8 http://127.0.0.1:3900/api/disks | python3 -c '
import json,sys
d=json.load(sys.stdin)
def fs(b):
    for u in ["B","KB","MB","GB","TB"]:
        if b<1024 or u=="TB": return f"{b:.1f} {u}"
        b/=1024
for disk in d.get("disks",[]):
    print(disk.get("path"), "→", fs(disk.get("size",0)))
    for p in disk.get("partitions",[]):
        extra = f" used%:{p.get(\"percent\")}" if p.get("percent") is not None else ""
        print("   ", p.get("path"), p.get("fstype"), p.get("label") or "", p.get("mountpoint") or "未挂载", fs(p.get("size",0)), extra)
'