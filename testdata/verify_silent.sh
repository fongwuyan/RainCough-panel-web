#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 新 bundle 含条件回退逻辑 ==="
JS=$(curl -s $B/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
echo "bundle=$JS"
curl -s --max-time 6 "$B/$JS" | grep -c '加载插件前端失败'
echo "=== assets 可达性(有独立前端的) ==="
for n in aigen docker laizhangsetu mcserver uptime vpn; do
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$B/api/plugins/$n/assets/plugin.js")
  echo "  $n: $RC"
done
echo "=== 无独立前端的(404 预期, 前端静默回退) ==="
for n in compress dltool filehash imagetool ocrqr texttool touchgal; do
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$B/api/plugins/$n/assets/plugin.js")
  echo "  $n: $RC"
done