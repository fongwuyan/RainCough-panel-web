#!/bin/bash
echo "=== Go 二进制引用的静态目录 ==="
strings ~/raincough-dev/raincough 2>/dev/null | grep -E 'public|dist' | sort -u | head -10
echo "=== raincough-dev/public 内容(Go 实际服务) ==="
ls -la ~/raincough-dev/public/ 2>/dev/null | head -8
echo "=== index.html 引用 ==="
cat ~/raincough-dev/public/index.html 2>/dev/null | grep -oE 'assets/index-[^"]+\.(js|css)'
echo "=== 时间线: C9m8AbQ6 是谁 ==="
grep -r "theme\|rc_theme\|触摸" ~/raincough-dev/public/index.html 2>/dev/null | head -2