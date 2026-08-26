#!/bin/bash
B=http://127.0.0.1:3900
echo "===== 媒体中心 ====="
echo "-- roots --"
curl -s --max-time 6 $B/api/media/roots
echo
echo "-- stats --"
curl -s --max-time 6 $B/api/media/stats
echo
echo "-- list(root=/etc) --"
curl -s --max-time 6 "$B/api/media/list?root=%2Fetc&page=0" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("items:", len(d.get("items",[])), "total:", d.get("total"), "keys:", sorted(d.get("items",[{}])[0].keys()) if d.get("items") else "-")'
echo "-- tag --"
curl -s --max-time 6 -X POST $B/api/media/tag -H 'Content-Type: application/json' -d '{"paths":["/etc/hostname"]}'
echo
echo "-- dedup --"
curl -s --max-time 6 -X POST $B/api/media/dedup -H 'Content-Type: application/json' -d '{"root":"/etc"}'
echo
echo "===== 环境包 ====="
for ep in envs recipes catalog; do
  echo "-- $ep --"
  curl -s --max-time 6 $B/api/envpkg/$ep | head -c 120
  echo
done
echo "===== 任务队列 ====="
curl -s --max-time 6 "$B/api/tasks" | head -c 200
echo
echo "===== 设置(插件设置 schema) ====="
curl -s --max-time 6 "$B/api/plugins/uptime/settings" | head -c 120
echo
echo "===== 终端(commands/hosts 已有) ====="
curl -s --max-time 6 $B/api/terminal/commands
echo