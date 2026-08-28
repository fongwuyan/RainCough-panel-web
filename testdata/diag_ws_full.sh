#!/bin/bash
B=http://127.0.0.1:3900
echo "=== webspy assets 头部 260 字节 ==="
curl -s --max-time 8 "$B/api/plugins/webspy/assets/plugin.js" | head -c 260
echo
echo "=== 尾部 200 字节 ==="
curl -s --max-time 8 "$B/api/plugins/webspy/assets/plugin.js" | tail -c 200
echo
echo "=== 首位字符 ==="
curl -s --max-time 8 "$B/api/plugins/webspy/assets/plugin.js" | head -c 1 | xxd | head -1
echo "=== 含 export 语句? ==="
curl -s --max-time 8 "$B/api/plugins/webspy/assets/plugin.js" | grep -cE '^export |\bexport\b' || echo 0