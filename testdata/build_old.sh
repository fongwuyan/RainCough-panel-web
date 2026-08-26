#!/bin/bash
# 构建复刻的旧前端
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 解压 ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 依赖核对 ==="
for d in vue vue-router @xterm/xterm @novnc/novnc skinview3d; do
  test -d web/node_modules/$d && echo "ok: $d" || echo "MISSING: $d"
done
echo "=== 构建 ==="
cd web
node node_modules/vite/bin/vite.js build 2>&1 | tail -12
cd ..
ls -la public/assets/ 2>/dev/null | head -5