#!/bin/bash
echo "=== 尝试 firefox headless dump 插件页 ==="
B=http://127.0.0.1:3900
# 主页面 hash 路由
timeout 25 firefox --headless --screenshot /tmp/ws_page.png "$B/#/plugin/webspy" 2>&1 | head -5
echo "截图:"
ls -la /tmp/ws_page.png 2>/dev/null
echo "=== 备选: 直接看 SPA 加载后 DOM via jsdom? ==="
node -e "console.log('node', process.version)"