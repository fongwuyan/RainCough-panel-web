#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 精确检查 ===="
echo "-- system hostname --"
curl -s --max-time 6 $B/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("hostname:", d.get("hostname"), "| boot:", d.get("boot_time"), "| ifaces:", len(d.get("net_interfaces",[])))'
echo "-- storage --"
curl -s --max-time 6 $B/api/storage
echo
echo "-- registry 原始 --"
curl -s --max-time 15 $B/api/store/registry | head -c 200
echo
echo "-- sudo 配置(进程环境) --"
tr '\0' '\n' < /proc/$(pgrep -f 'raincough -port' | head -1)/environ 2>/dev/null | grep -iE 'SUDO|RC_' | sed 's/PW=.*/PW=<hidden>/' | head -8
echo "-- 宿主 f 用户 sudo 免密? --"
sudo -n -l 2>&1 | head -3 || echo "(需要密码或未配置)"