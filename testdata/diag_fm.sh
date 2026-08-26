#!/bin/bash
echo "=== srv 日志 FM ==="
grep -i "fm" ~/raincough-dev/srv.log | tail -3
echo "=== /etc 列表原始 ==="
curl -s --max-time 8 "http://127.0.0.1:3900/api/fm/list?path=/etc" | head -c 300
echo
echo "=== / 列表 ==="
curl -s --max-time 8 "http://127.0.0.1:3900/api/fm/list?path=/" | head -c 200