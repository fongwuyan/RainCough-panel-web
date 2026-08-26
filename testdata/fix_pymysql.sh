#!/bin/bash
echo "=== pip 状态 ==="
pip3 --version 2>&1
echo "=== 安装 pymysql(容忍 externally-managed) ==="
pip3 install --user --break-system-packages pymysql 2>&1 | tail -3
python3 -c "import pymysql; print('pymysql OK')" 2>&1
echo "=== 清理僵尸服务 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
echo "=== 确认清理 ==="
pgrep -f 'raincough -port' || echo CLEAN