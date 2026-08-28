#!/bin/bash
cd ~/raincough-dev
echo "=== 构建 uptime + 已存在前端 ==="
node tools/build-plugin-frontend.js uptime 2>&1 | tail -3
echo "=== 产物可达 ==="
curl -s -o /dev/null -w "uptime assets: %{http_code}\n" --max-time 5 http://127.0.0.1:3900/api/plugins/uptime/assets/plugin.js