#!/bin/bash
# 用 Firefox CDP 抓页面 console 错误
mkdir -p /tmp/cdp
cd /tmp/cdp
# 启动 Firefox 远程调试
timeout 40 firefox --headless --remote-debugging-port=9222 --no-remote about:blank 2>/tmp/cdp/ff.log &
FFPID=$!
sleep 6
echo "=== 获取页面列表 ==="
curl -s http://127.0.0.1:9222/json/list 2>/dev/null | python3 -c 'import json,sys; pages=json.load(sys.stdin); print([p.get("url") for p in pages])' 2>/dev/null || echo "CDP 未就绪"
kill $FFPID 2>/dev/null
echo "=== ff.log ==="
head -5 /tmp/cdp/ff.log