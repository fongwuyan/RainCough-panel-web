#!/bin/bash
# 批量验证 3 个 v2 插件
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 5
echo "=== 插件列表 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; print([(p["name"],p["alive"]) for p in json.load(sys.stdin)])'
echo "=== 1. webspy: RSS 添加 + 抓取 ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/webspy/rss/feeds \
  -H "Content-Type: application/json" -d '{"name":"cnbeta","url":"https://www.cnbeta.com.tw/backend.php"}' | python3 -m json.tool
sleep 2
echo "=== 2. filehash: /etc/hosts 哈希 ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/filehash/hash \
  -H "Content-Type: application/json" -d '{"path":"/etc/hosts"}' | python3 -m json.tool
echo "=== 3. filehash: 目录统计 ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/filehash/diranalyze/stats \
  -H "Content-Type: application/json" -d '{"path":"/etc/apt"}' | python3 -m json.tool
echo "=== 4. compress: 检查 ==="
curl -s http://127.0.0.1:3900/api/plugins/compress/decompress/check | python3 -m json.tool