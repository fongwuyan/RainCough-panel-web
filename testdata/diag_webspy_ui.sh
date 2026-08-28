#!/bin/bash
B=http://127.0.0.1:3900
echo "=== webspy assets Content-Type(动态import需要JS MIME) ==="
curl -s -D - -o /dev/null --max-time 5 "$B/api/plugins/webspy/assets/plugin.js" | grep -iE 'HTTP|Content-Type|Content-Length'
echo "=== 线上主 bundle ==="
JS=$(curl -s --max-time 5 $B/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
echo "bundle=$JS"
echo "=== 主 bundle 是否含 PluginView 新逻辑(静默回退标记) ==="
curl -s --max-time 8 "$B/$JS" | grep -c '回退: 有内置组件\|加载插件前端失败'
echo "=== PluginView 源码(宿主)是否最新 ==="
grep -c '回退: 有内置组件' ~/raincough-dev/web/src/components/PluginView.vue 2>/dev/null || echo "0"
echo "=== 主 bundle 是否含 webspy MAP 或动态加载路径 ==="
curl -s --max-time 8 "$B/$JS" | grep -oE '/api/plugins/\+[a-z.]*assets|assets/plugin\.js' | head -3