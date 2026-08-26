#!/bin/bash
echo "=== MariaDB 连接配置 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW VARIABLES LIKE 'max_connections';" 2>/dev/null
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW STATUS LIKE 'Threads_connected';" 2>/dev/null
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW STATUS LIKE 'Max_used_connections';" 2>/dev/null
echo "=== 当前连接来源 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW PROCESSLIST;" 2>/dev/null | head -15