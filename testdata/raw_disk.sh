#!/bin/bash
echo "=== curl 原始(带字节数) ==="
R=$(curl -s --max-time 8 http://127.0.0.1:3900/api/disks)
echo "len=${#R}"
echo "$R" | head -c 300
echo
echo "=== 状态码 ==="
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 http://127.0.0.1:3900/api/disks