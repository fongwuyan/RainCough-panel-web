#!/bin/bash
echo "=== assets 响应头(浏览器动态 import 需要 JS MIME) ==="
curl -s -D - -o /dev/null --max-time 5 http://127.0.0.1:3900/api/plugins/JMComic/assets/plugin.js | head -8
echo "=== assets 内容开头(确认是 JS 模块 → IIFE) ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins/JMComic/assets/plugin.js | head -c 80
echo
echo "=== 网关 servePluginAsset 的 Content-Type ==="
grep -n 'Content-Type\|plugin.js\|\.js' /home/f/raincough-dev/cmd/raincough/main.go | grep -i 'asset\|js\|type' | head -5