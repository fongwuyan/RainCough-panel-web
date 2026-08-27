#!/bin/bash
echo "=== 1. DNS 解析测试(多个域名) ==="
for d in api.jmcomic.io jmcomic.io google.com github.com baidu.com; do
  echo -n "  $d: "
  getent hosts $d >/dev/null 2>&1 && echo "解析OK" || echo "解析失败"
done
echo "=== 2. 实际 DNS 查询 ==="
nslookup api.jmcomic.io 2>&1 | head -6
echo "=== 3. resolv.conf ==="
cat /etc/resolv.conf
echo "=== 4. 外网连通性(可访问域名) ==="
curl -s -o /dev/null -w "  baidu: %{http_code} (%{time_total}s)\n" --max-time 6 https://www.baidu.com
curl -s -o /dev/null -w "  github: %{http_code} (%{time_total}s)\n" --max-time 6 https://github.com
echo "=== 5. jmcomic.io 直连 IP 测试(绕过DNS) ==="
for ip in 104.18.0.0 172.67.0.0; do
  curl -s -o /dev/null -w "  $ip: %{http_code}\n" --max-time 5 --resolve api.jmcomic.io:443:$ip https://api.jmcomic.io/ 2>&1 | head -1
done