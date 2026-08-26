#!/bin/bash
cd ~/raincough-dev
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
echo "=== 前台启动 6s 抓输出 ==="
timeout 6 ./raincough -port 3900 2>&1 | head -20
echo "exit: $?"