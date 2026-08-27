#!/bin/bash
echo "=== 宿主二进制含 handleTermInput? ==="
strings ~/raincough-dev/raincough 2>/dev/null | grep -c 'handleTermInput' || echo 0
echo "=== 直接 curl /api/terminal/input ==="
curl -s -D - -o /tmp/ti.txt --max-time 6 -X POST http://127.0.0.1:3900/api/terminal/input -H 'Content-Type: application/json' -d '{"session":"x","data":""}' | grep -iE 'HTTP|Content-Type'
cat /tmp/ti.txt | head -c 100
echo
echo "=== 主系统版本 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/system | head -c 100