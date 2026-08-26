#!/bin/bash
# 补装缺失依赖(从旧面板拷贝本地包避免网络卡死), 重建
SRC=/opt/touchgal/web/node_modules
DST=~/raincough-dev/web/node_modules
echo "=== 复制依赖 ==="
cp -a $SRC/skinview3d $DST/ 2>/dev/null && echo "ok skinview3d"
cp -a $SRC/three $DST/ 2>/dev/null && echo "ok three"
cp -a $SRC/fflate $DST/ 2>/dev/null && echo "ok fflate"
cp -a $SRC/echarts $DST/ 2>/dev/null && echo "ok echarts"
cp -a $SRC/@novnc $DST/ 2>/dev/null && echo "ok @novnc"
cp -a $SRC/skinview-utils $DST/ 2>/dev/null && echo "ok skinview-utils"
cp -a $SRC/meshoptimizer $DST/ 2>/dev/null && echo "ok meshoptimizer"
echo "=== 校验 ==="
for d in skinview3d @novnc/novnc @xterm/xterm three; do
  test -d $DST/$d && echo "ok: $d" || echo "MISSING: $d"
done
echo "=== 构建 ==="
cd ~/raincough-dev/web
node node_modules/vite/bin/vite.js build 2>&1 | tail -8