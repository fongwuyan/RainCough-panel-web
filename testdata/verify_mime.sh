#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== assets Content-Type(修复验证) ==="
curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:3900/api/plugins/JMComic/assets/plugin.js | grep -iE 'Content-Type|HTTP'
echo "=== 主 assets 也应正确(对照) ==="
curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:3900/assets/index-qCUIw25T.js | grep -iE 'Content-Type' | head -1
echo "=== 插件趋势 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'