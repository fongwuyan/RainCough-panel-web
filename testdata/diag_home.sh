#!/bin/bash
echo "=== ~/raincough-dev 目录 ==="
ls -la ~/raincough-dev/ 2>/dev/null | head -20
echo "=== ~ 下有什么 ==="
ls ~/ 2>/dev/null | head -20
echo "=== 面板进程还在? ==="
pgrep -af raincough | head -3
echo "=== 3900 还在? ==="
ss -tlnp 2>/dev/null | grep 3900 | head -2
echo "=== 插件目录可能被移到别处? ==="
find ~ -maxdepth 3 -name 'plugin.json' 2>/dev/null | head -5