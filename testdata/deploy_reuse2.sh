#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 解压 ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 依赖核对 ==="
cd web
for d in vue vue-router @xterm/xterm @novnc/novnc skinview3d three; do
  test -d node_modules/$d && echo "ok: $d" || echo "MISS: $d"
done
echo "=== 构建 ==="
node node_modules/vite/bin/vite.js build 2>&1 | tail -4
cd ..
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 验证 ==="
curl -s http://127.0.0.1:3900/ | grep -oE '<title>[^<]+'
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", sum(1 for p in ps if p["alive"]), "/", len(ps))'
echo "=== store settings(修复验证) ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/store/settings | head -c 90