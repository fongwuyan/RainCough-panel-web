#!/bin/bash
cd ~/raincough-dev
echo "=== 宿主 webspy assets 文件实体(本地查看) ==="
head -c 120 plugins/webspy/assets/plugin.js | od -c | head -3
echo "=== 文件大小/时间 ==="
ls -la plugins/webspy/assets/plugin.js
echo "=== 重新构建 webspy(单独) ==="
node tools/build-plugin-frontend.js webspy 2>&1 | tail -3
echo "=== 重建后头部 ==="
head -c 80 plugins/webspy/assets/plugin.js
echo
echo "=== 重建后是否有 export ==="
grep -cE '^export |\bexport\b' plugins/webspy/assets/plugin.js || echo 0