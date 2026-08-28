#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 新 bundle css 含 stat/parent-tabs 样式 ==="
CSS=$(curl -s --max-time 5 $B/ | grep -oE 'assets/index-[^"]+\.css' | head -1)
echo "css=$CSS"
curl -s --max-time 8 "$B/$CSS" -o /tmp/main.css
for cls in 'stat-grid' 'stat-card' 'parent-tabs' 'kv-row'; do
  C=$(grep -c "$cls" /tmp/main.css)
  echo "  $cls: $C"
done
echo "=== bundle 新名称 ==="
curl -s --max-time 5 $B/ | grep -oE 'assets/index-[^"]+\.(js|css)' | head -2
echo "=== alive ==="
curl -s --max-time 8 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'