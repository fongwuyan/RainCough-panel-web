#!/bin/bash
echo "=== 宿主机当前 index.html 引用 ==="
cat ~/raincough-dev/web/public/index.html 2>/dev/null | grep -oE 'assets/index-[^"]+\.(js|css)' | head -3
echo "=== public 修改时间与文件 ==="
ls -la ~/raincough-dev/web/public/assets/ 2>/dev/null | head -6
echo "=== 服务实际运行的目录 ==="
readlink -f ~/raincough-dev/raincough 2>/dev/null
ls -la ~/raincough-dev/public/assets/ 2>/dev/null | head -6
echo "=== srv.log 启动路径 ==="
grep -i 'public\|静态\|前端' ~/raincough-dev/srv.log 2>/dev/null | tail -3