#!/bin/bash
# 为 RainCough 创建数据库和专用用户
# 需要 sudo 访问 mariadb root
echo "=== 尝试 sudo mysql ==="
sudo mysql -e "SELECT VERSION();" 2>&1 | head -3

echo "=== 创建数据库 raincough + 用户 ==="
sudo mysql <<'EOF'
CREATE DATABASE IF NOT EXISTS raincough CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'raincough'@'localhost' IDENTIFIED BY 'raincough-local-dev';
CREATE USER IF NOT EXISTS 'raincough'@'127.0.0.1' IDENTIFIED BY 'raincough-local-dev';
GRANT ALL PRIVILEGES ON raincough.* TO 'raincough'@'localhost';
GRANT ALL PRIVILEGES ON raincough.* TO 'raincough'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF
echo "sudo mysql rc=$?"

echo "=== 验证专用用户连接 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW TABLES;" 2>&1 | head -5
echo "=== 权限确认 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SELECT DATABASE();" 2>&1