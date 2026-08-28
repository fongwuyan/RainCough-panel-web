#!/bin/bash
B=http://127.0.0.1:3900
JS=$(curl -s --max-time 5 $B/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
echo "bundle=$JS"
curl -s --max-time 15 "$B/$JS" -o /tmp/main2.js
echo "=== 找 PluginView 的 ref 声明 + mount 调用 ==="
grep -oE '=P\(""\)|P\(""\)|["'"']mountEl["'"']|plugin-mount' /tmp/main2.js | head -5
echo "--- 搜 mount 调用(reg.mount) ---"
grep -oE '\.[a-zA-Z_$]+\([a-zA-Z_$]+,?\{plugin' /tmp/main2.js | head -3
echo "--- 搜 __rcPlugin 读取 + .mount ---"
grep -oE '__rcPlugin_[a-zA-Z_$=&.\[\]]{0,30}' /tmp/main2.js | head -3
echo "--- ref 模板绑定(找 funct reref) ---"
grep -oE 'mountEl[a-zA-Z_$:.=]{0,30}' /tmp/main2.js | head -5