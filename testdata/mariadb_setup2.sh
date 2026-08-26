#!/bin/bash
# 用 sudo 密码创建数据库和用户(密码从 RC_SUDO_PW 读取, 默认尝试 1)
PW="${RC_SUDO_PW:-1}"
echo "1" | sudo -S mysql -e "SELECT VERSION();" 2>&1 | head -3

sudo -S <<< "$PW" mysql <<'EOF'
CREATE DATABASE IF NOT EXISTS raincough CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'raincough'@'localhost' IDENTIFIED BY 'raincough-local-dev';
CREATE USER IF NOT EXISTS 'raincough'@'127.0.0.1' IDENTIFIED BY 'raincough-local-dev';
GRANT ALL PRIVILEGES ON raincough.* TO 'raincough'@'localhost';
GRANT ALL PRIVILEGES ON raincough.* TO 'raincough'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF
echo "create rc=$?"

echo "=== 验证 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SELECT DATABASE(), CURRENT_USER();" 2>&1