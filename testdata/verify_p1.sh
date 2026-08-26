#!/bin/bash
cd ~/raincough-dev
echo "=== 重启面板 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 6 插件前端资产可达性 ==="
for pl in aigen laizhangsetu vpn docker mcserver JMComic; do
  JS=$(ls plugins/$pl/assets/plugin.js 2>/dev/null | head -1)
  SZ=$(stat -c%s "$JS" 2>/dev/null || echo 0)
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3900/api/plugins/$pl/assets/plugin.js")
  echo "  $pl: asset=${SZ}B http=$RC"
done
echo "=== 插件仍活 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'