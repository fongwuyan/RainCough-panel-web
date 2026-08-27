#!/bin/bash
cd ~/raincough-dev
JS=public/assets/index-qCUIw25T.js
echo "=== bundle 含 __rcPlugin/import 逻辑 ==="
grep -c '__rcPlugin' $JS
echo "=== PluginView 源码是否新版 ==="
grep -c 'tryLoad' web/src/components/PluginView.vue
grep -c 'hostFind' cmd/raincough/main.go
echo "=== JMComic assets(PluginView 将 import) ==="
curl -s -o /dev/null -w "JMComic assets: %{http_code}\n" --max-time 5 http://127.0.0.1:3900/api/plugins/JMComic/assets/plugin.js
echo "=== 手动测 import 行为: 模拟浏览器 fetch ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins/JMComic/assets/plugin.js | head -c 60