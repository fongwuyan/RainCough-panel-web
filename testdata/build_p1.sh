#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 构建 6 插件前端(生产环境 esbuild) ==="
node ~/raincough-dev/tools/build-plugin-frontend.js aigen laizhangsetu vpn docker mcserver JMComic 2>&1 | tail -10