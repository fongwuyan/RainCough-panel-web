#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 线上 bundle 中动态 import 插件前端的确切代码 ==="
JS=$(curl -s --max-time 5 $B/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
echo "bundle=$JS"
curl -s --max-time 15 "$B/$JS" -o /tmp/main.js
echo "--- 找 import(/api/plugins/ 片段 ---"
grep -oE 'import\([^)]*plugins[^)]*\)' /tmp/main.js | head -3
echo "--- __rcPlugin 读取 ---"
grep -oE '__rcPlugin_[A-Za-z_]{0,20}' /tmp/main.js | head -3
echo "--- 挂载容器 ref 名 ---"
grep -oE 'mountEl[a-zA-Z]*' /tmp/main.js | head -3
echo "--- MAP 键(webspy? generic?) ---"
grep -oE 'generic[A-Za-z]*' /tmp/main.js | head -2
echo "=== 插件页路由参数解析(hash 路由) ==="
grep -oE 'plugin/\$\{[^}]*\}|/plugin/\$\{[^}]*\}' /tmp/main.js | head -2
grep -oE '"plugin"[^}]{0,40}' /tmp/main.js | head -3