#!/bin/bash
cd ~/raincough-dev/web
echo "=== 安装缺失依赖 ==="
npm install --no-audit --no-fund skinview3d@^3.4.2 @novnc/novnc@^1.7.0 2>&1 | tail -3
for d in skinview3d @novnc/novnc @xterm/xterm; do
  test -d node_modules/$d && echo "ok: $d" || echo "MISSING: $d"
done
echo "=== 重新构建 ==="
node node_modules/vite/bin/vite.js build 2>&1 | tail -10