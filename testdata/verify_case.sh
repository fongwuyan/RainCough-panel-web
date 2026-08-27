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
B=http://127.0.0.1:3900
echo "=== 大小写容错验证 ==="
echo "-- 小写 jmcomic/library(旧前端 JmLibrary 用) --"
curl -s -o /dev/null -w "  /api/plugins/jmcomic/library -> %{http_code}\n" --max-time 6 "$B/api/plugins/jmcomic/library"
echo "-- 原大写 JMComic/library --"
curl -s -o /dev/null -w "  /api/plugins/JMComic/library -> %{http_code}\n" --max-time 6 "$B/api/plugins/JMComic/library"
echo "-- 小写 assets(旧组件可能引用) --"
curl -s -o /dev/null -w "  /api/plugins/jmcomic/assets/plugin.js -> %{http_code}\n" --max-time 6 "$B/api/plugins/jmcomic/assets/plugin.js"
echo "-- 大写 assets --"
curl -s -o /dev/null -w "  /api/plugins/JMComic/assets/plugin.js -> %{http_code}\n" --max-time 6 "$B/api/plugins/JMComic/assets/plugin.js"
echo "=== 插件全部 alive ==="
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'