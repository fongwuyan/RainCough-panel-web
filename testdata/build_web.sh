#!/bin/bash
# 宿主构建完整前端: 复用旧面板 node_modules + vite build
set -e
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH

echo "=== 1. 解压源码 ==="
tar -xf src.tar && rm -f src.tar

echo "=== 2. 准备 node_modules(复用旧面板) ==="
if [ ! -d web/node_modules ]; then
  cp -a /opt/touchgal/web/node_modules web/ 2>/dev/null || echo "no /opt/touchgal copy"
fi
ls web/node_modules/vite/package.json 2>/dev/null && echo "vite ok"

echo "=== 3. 构建 ==="
cd web
node node_modules/vite/bin/vite.js build 2>&1 | tail -8
cd ..
ls -la public/ | head -6