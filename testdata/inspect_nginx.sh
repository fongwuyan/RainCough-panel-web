#!/bin/bash
echo "=== nginx 站点配置 ==="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null
echo "--- 默认站点 ---"
cat /etc/nginx/sites-enabled/default 2>/dev/null | grep -E 'root|server_name|listen|location' | head -20
echo "=== 其他站点 ==="
for f in /etc/nginx/sites-enabled/*; do
  [ -f "$f" ] || continue
  echo "--- $f ---"
  grep -E 'root|server_name|listen' "$f" | head -6
done
echo "=== 梦幻次元 web 根目录 ==="
ls -la /var/www/html 2>/dev/null | head -8
cat /var/www/html/index.html 2>/dev/null | grep -oE '<title>[^<]+' | head -2
echo "=== 2280 socat 详情 ==="
pgrep -a -f socat