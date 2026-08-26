#!/usr/bin/env python3
import json, urllib.request
d = json.load(urllib.request.urlopen("http://127.0.0.1:3900/api/disks", timeout=8))
def fs(b):
    for u in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024 or u == "TB":
            return "%.1f %s" % (b, u)
        b /= 1024
for disk in d.get("disks", []):
    print(disk.get("path"), "->", fs(disk.get("size", 0)))
    for p in disk.get("partitions", []):
        pc = p.get("percent")
        ext = (" used%%:%s" % pc) if pc is not None else ""
        print("   ", p.get("path"), p.get("fstype"), p.get("label") or "", p.get("mountpoint") or "未挂载", fs(p.get("size", 0)), ext)