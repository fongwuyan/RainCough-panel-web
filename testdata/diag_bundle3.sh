#!/bin/bash
cd ~/raincough-dev
echo "=== 主 bundle 动态加载串 ==="
JS=$(ls public/assets/index-*.js | head -1)
echo "bundle=$JS"
for pat in "assets/plugin.js" "__rcPlugin" "/api/plugins/"; do
  C=$(grep -c "$pat" $JS 2>/dev/null)
  echo "  '$pat': $C 次"
done
echo "=== 搜索拼接路径片段 ==="
grep -oE 'api/plugins.0,0.assets' $JS | head -1 || echo "(未找到拼接)"