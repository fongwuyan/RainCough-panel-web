#!/bin/bash
# 检查宿主机 MariaDB 状态
echo "=== mariadb 进程 ==="
systemctl is-active mariadb 2>/dev/null || service mariadb status 2>&1 | head -2
echo "=== 端口监听 ==="
ss -tlnp 2>/dev/null | grep 3306
echo "=== 无密码 root 能否登录 ==="
mysql -uroot -e "SELECT VERSION();" 2>&1 | head -3
echo "=== 现有数据库 ==="
mysql -uroot -e "SHOW DATABASES;" 2>&1 | head -10
echo "=== 用户列表 ==="
mysql -uroot -e "SELECT user, host FROM mysql.user;" 2>&1 | head -10