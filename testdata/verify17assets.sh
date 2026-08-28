#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 17 插件独立前端资产全景 ==="
for n in jmcomic aigen compress dltool docker filehash imagetool kvm laizhangsetu mcserver mcskin ocrqr texttool touchgal uptime vpn webspy; do
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$B/api/plugins/$n/assets/plugin.js")
  SZ=$(curl -s --max-time 5 "$B/api/plugins/$n/assets/plugin.js" 2>/dev/null | wc -c)
  printf "  %-14s asset=%s (%sB)\n" $n $RC $SZ
done
echo "=== 新前端含注册标记 ==="
for n in compress texttool webspy; do
  C=$(curl -s --max-time 5 "$B/api/plugins/$n/assets/plugin.js" | grep -c "__rcPlugin_$n")
  echo "  $n: __rcPlugin_$n x$C"
done
echo "=== alive ==="
curl -s --max-time 8 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'