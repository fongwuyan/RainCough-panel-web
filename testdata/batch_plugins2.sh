#!/bin/bash
# 批量验证 3 个新插件
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
echo "=== 1. texttool: regex ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/texttool/text/regex \
  -H "Content-Type: application/json" -d '{"pattern":"\\d+","text":"abc 123 def 456","flags":""}' | python3 -m json.tool
echo "=== 2. texttool: stats ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/texttool/text/stats \
  -H "Content-Type: application/json" -d '{"text":"hello world\\none two three"}' | python3 -m json.tool
echo "=== 3. dltool: docconvert check ==="
curl -s http://127.0.0.1:3900/api/plugins/dltool/docconvert/check | python3 -m json.tool
echo "=== 4. dltool: split /etc/hosts ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/dltool/networktools/split \
  -H "Content-Type: application/json" -d '{"path":"/etc/hosts","parts":2}' | python3 -m json.tool
echo "=== 5. imagetool: health(pillow?) ==="
curl -s http://127.0.0.1:3900/api/plugins/imagetool/__health | python3 -m json.tool 2>/dev/null || curl -s http://127.0.0.1:3900/api/plugins/imagetool/__health