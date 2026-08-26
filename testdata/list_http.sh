#!/bin/bash
echo "=== 所有监听端口(IPv4) + 进程名 ==="
ss -tlnp 2>/dev/null | grep -E '0.0.0.0:|:::|127.0.0.1:' | awk '{print $4}' | sort -u
echo
echo "=== 每个 WEB 端口响应标题 ==="
for port in 80 3000 3900 2280 8080 8081 5000 8000 5173; do
  T=$(curl -s --max-time 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:$port/ 2>/dev/null)
  [ "$T" = "200" ] || [ "$T" = "302" ] || [ "$T" = "301" ] || [ "$T" = "401" ] || continue
  TITLE=$(curl -s --max-time 3 http://127.0.0.1:$port/ 2>/dev/null | grep -oE '<title>[^<]*' | head -1)
  PID=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | head -1)
  echo "port $port: http=$T ${TITLE:-'(无title)'} $PID"
done