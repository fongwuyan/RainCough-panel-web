#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 部署最新(前端重建含 mountEl修复) ==="
cd ~/raincough-dev
tar -xf src.tar 2>/dev/null && rm -f src.tar
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -1
cd ..
JS=$(ls public/assets/index-*.js | head -1 | xargs basename)
echo "bundle: $JS"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "=== 验证: bundle 含 mountEl ref 修复 ==="
curl -s --max-time 8 "http://127.0.0.1:3900/$JS" | grep -oE 'mountEl\.value|ref\(null\)' | sort | uniq -c | head -3
echo "=== assets 全部可达 ==="
for n in aigen docker laizhangsetu mcserver uptime vpn compress dltool filehash imagetool ocrqr texttool webspy jmcomic kvm mcskin touchgal; do
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$B/api/plugins/$n/assets/plugin.js")
  printf "%s " "$n:$RC"
done
echo
echo "=== alive ==="
curl -s --max-time 8 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'