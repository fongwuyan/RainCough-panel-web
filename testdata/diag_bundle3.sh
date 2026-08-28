#!/bin/bash
B=http://127.0.0.1:3900
JS=$(curl -s --max-time 5 $B/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
echo "bundle=$JS"
curl -s --max-time 15 "$B/$JS" -o /tmp/main2.js
echo "plugin-mount 次数:"
grep -c 'plugin-mount' /tmp/main2.js
echo "assets/plugin.js(动态加载):"
grep -c 'assets/plugin.js' /tmp/main2.js
echo "__rcPlugin(注册读取):"
grep -c '__rcPlugin_' /tmp/main2.js
echo "空 ref 声明 P(\"\")(minify ref):"
grep -oE '[a-z]=\w\(""\);?\.value' /tmp/main2.js | head -3 || echo "(未匹配)"
echo "mount(挂载调用):"
grep -oE '\.mount\([^)]+' /tmp/main2.js | head -3