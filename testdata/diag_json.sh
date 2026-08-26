#!/bin/bash
echo "=== lsblk JSON 顶层字段名 ==="
lsblk -J -b -o NAME,PATH,TYPE,SIZE,FSTYPE,LABEL,MOUNTPOINT,ROTA,HOTPLUG 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print("blockdevices:", len(d.get("blockdevices",[]))); b=d["blockdevices"][0]; print("磁盘字段:", sorted(b.keys())); print("是否有 children:", "children" in b); print("hotplug 键:", "hotplug" in b, "| rota:", "rota" in b)'