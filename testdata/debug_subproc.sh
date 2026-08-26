#!/bin/bash
# 单独跑一个插件子进程(MySQL 环境)看是否卡
cd ~/raincough-dev
export RAINCOUGH_PORT=34599
export RAINCOUGH_NS=webspy
export RAINCOUGH_DB_DSN='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
export RAINCOUGH_PLUGIN_DIR=/home/f/raincough-dev/plugins/webspy
echo "=== timeout 5s 跑 webspy 子进程 ==="
timeout 5 python3 server.py 2>&1 | head -10
echo "rc=$?"
echo "=== 直接看能否 import ==="
cd plugins/webspy
python3 -c "import ast; ast.parse(open('server.py').read()); print('syntax OK')"