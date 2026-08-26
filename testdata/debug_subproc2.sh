#!/bin/bash
# 单插件完整行为(MySQL env) - 关注子进程是否监听
cd /home/f/raincough-dev/plugins/webspy
export RAINCOUGH_PORT=34599
export RAINCOUGH_NS=webspy
export RAINCOUGH_DB_DSN='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
export RAINCOUGH_PLUGIN_DIR=/home/f/raincough-dev/plugins/webspy
python3 server.py > /tmp/wp.log 2>&1 &
WP=$!
sleep 3
echo "=== 进程存活? ==="
kill -0 $WP 2>&1 && echo "ALIVE" || echo "DEAD"
echo "=== 端口监听? ==="
ss -tlnp 2>/dev/null | grep 34599 || echo "not listening"
echo "=== 子进程日志 ==="
cat /tmp/wp.log
echo "=== 直连 health ==="
curl -s --max-time 3 http://127.0.0.1:34599/__health || echo "curl fail"
kill $WP 2>/dev/null