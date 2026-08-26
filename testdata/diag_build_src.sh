#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 当前解压后 web/src 是否复用版(特色: components/ 95个文件) ==="
ls web/src/components/ 2>/dev/null | wc -l
ls web/src/api.js 2>/dev/null && echo "有 api.js (复用版特征)"
ls web/src/core/Home.vue 2>/dev/null && echo "有 core/Home.vue (简化版特征!)"
echo "=== 当前 public 现状 ==="
ls -la public/assets/ 2>/dev/null | head -4
echo "=== 重新构建(验证产物) ==="
cd web
node node_modules/vite/bin/vite.js build 2>&1 | tail -3
cd ..
echo "=== 构建后 public 内容 ==="
ls -la public/assets/ | head -5
echo "=== index.html 引用 ==="
cat public/index.html | grep -oE 'assets/index-[^"]+\.(js|css)'