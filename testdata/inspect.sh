#!/bin/bash
# 现场: 插件目录/版本/残留
cd ~/raincough-dev
echo "=== 插件目录 ==="
ls plugins/ | wc -l
ls plugins/
echo "=== 二进制时间 ==="
ls -la raincough | awk '{print $6,$7,$8}'
echo "=== demo 残留? ==="
cat plugins/demo/plugin.json 2>/dev/null || echo "no demo"
echo "=== go.mod 版本 ==="
grep creack go.mod