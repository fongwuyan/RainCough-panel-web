#!/bin/bash
B=http://127.0.0.1:3900
echo "=== sudo 类精确检查 ==="
echo "-- updates/list --"
curl -s --max-time 10 "$B/api/sysfunc/updates/list" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("updates:", d.get("updates"), "| err:", d.get("error"))'
echo "-- snapshot/cap --"
curl -s --max-time 10 "$B/api/sysfunc/snapshot/cap" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("volumes:", d.get("volumes"), "| err:", d.get("error"))'
echo "-- kernels --"
curl -s --max-time 10 "$B/api/sysfunc/kernels" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("kernels:", len(d.get("kernels") or []), "| err:", d.get("error"))'
echo "-- fw --"
curl -s --max-time 10 "$B/api/sysfunc/fw/status" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("enabled:", d.get("enabled"), "| err:", d.get("error"))'
echo "=== 手动 sudo 验证 ==="
sudo -n apt list --upgradable -q 2>&1 | head -1
sudo -n lvs --noheadings -o lv_name 2>&1 | head -1
sudo -n dpkg --list linux-image-* 2>&1 | head -1
sudo -n ufw status 2>&1 | head -1