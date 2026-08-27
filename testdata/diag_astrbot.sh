#!/bin/bash
echo "=== :3000 AstrBot 页面 ==="
JS=$(curl -s --max-time 4 http://127.0.0.1:3000/ | grep -oE 'assets/[^"]+\.js' | head -1)
echo "JS ref: $JS"
curl -s --max-time 4 http://127.0.0.1:3000/$JS 2>/dev/null | grep -c '未加载'
curl -s --max-time 4 http://127.0.0.1:3000/ | grep -oE '<title>[^<]+'
echo "=== :3900 主 bundle 再确认(双保险) ==="
B3900=$(ls ~/raincough-dev/public/assets/index-*.js 2>/dev/null | head -1)
curl -s --max-time 5 "http://127.0.0.1:3900/${B3900#/home/f/raincough-dev/public/}" 2>/dev/null | grep -c '未加载' || true
echo "=== 用户可能访问的别端口 ==="
for port in 3900 3000 80; do
  T=$(curl -s --max-time 3 http://127.0.0.1:$port/ 2>/dev/null | grep -oE '<title>[^<]+' | head -1)
  echo "  :$port → $T"
done