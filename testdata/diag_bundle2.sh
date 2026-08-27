#!/bin/bash
cd ~/raincough-dev
JS=$(ls public/assets/index-*.js | head -1)
echo "bundle: $JS"
echo "--- __rcPlugin 引用 ---"
grep -c '__rcPlugin' $JS
echo "--- assets/plugin.js 路径 ---"
grep -o 'assets/plugin.js' $JS | head -2
echo "--- 插件尾部 ---"
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins/JMComic/assets/plugin.js | tail -c 150