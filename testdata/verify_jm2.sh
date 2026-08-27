#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 插件页所需资产/路由 ==="
curl -s -o /dev/null -w "JMComic assets: %{http_code}\n" --max-time 5 "$B/api/plugins/JMComic/assets/plugin.js"
curl -s -o /dev/null -w "JMComic __health: %{http_code}\n" --max-time 5 "$B/api/plugins/JMComic/__health"
curl -s -o /dev/null -w "小写 assets(应404, 验证大小写): %{http_code}\n" --max-time 5 "$B/api/plugins/jmcomic/assets/plugin.js"
echo "=== 主 bundle 加载器就绪 ==="
JS=$(ls ~/raincough-dev/public/assets/index-*.js | head -1)
grep -c '__rcPlugin' $JS
grep -c 'assets/plugin.js' $JS
echo "=== 插件 17 全通 ==="
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'