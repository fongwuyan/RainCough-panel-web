#!/bin/bash
echo "=== assets 头部 200 字节(确认 IIFE 无 export) ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins/webspy/assets/plugin.js | head -c 200
echo
echo "=== 是否含 export 语句(浏览器 import 需要, 但 IIFE 不应有) ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins/webspy/assets/plugin.js | grep -cE '^export |export \{' || echo "0(无 export = IIFE)"
echo "=== 尾部 120 字节(register(window) 调用) ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins/webspy/assets/plugin.js | tail -c 120
echo
echo "=== 对比: 已成功工作的 vpn assets 结构 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins/vpn/assets/plugin.js | head -c 100