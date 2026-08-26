#!/bin/bash
# 直接验证运行中的服务(MySQL DSN)
echo "=== /api/system ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/system | head -c 300
echo
echo "=== /api/plugins ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | head -c 300
echo
echo "=== MySQL 表 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW TABLES;" 2>&1 | head -20