#!/bin/bash
B=http://127.0.0.1:3900
echo "=== JMComic assets 可达性 ==="
for p in "JMComic" "jmcomic"; do
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$B/api/plugins/$p/assets/plugin.js")
  SZ=$(curl -s --max-time 5 "$B/api/plugins/$p/assets/plugin.js" | wc -c)
  echo "  /api/plugins/$p/assets/plugin.js -> $RC (${SZ}B)"
done
echo "=== JMComic 网关路由(小写 vs 原大小写) ==="
curl -s -o /dev/null -w "search(原大小写): %{http_code}\n" --max-time 6 "$B/api/plugins/JMComic/search?keyword=test"
curl -s -o /dev/null -w "search(小写): %{http_code}\n" --max-time 6 "$B/api/plugins/jmcomic/search?keyword=test"
echo "=== 插件列表中的 name ==="
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); [print(" ", p["name"], "|", p.get("label"), "| alive:", p["alive"]) for p in ps if "MComic" in p["name"] or "jmcomic" in p["name"].lower()]'
echo "=== 插件前端产物含 __rcPlugin 键名 ==="
curl -s --max-time 5 "$B/api/plugins/JMComic/assets/plugin.js" | grep -oE '__rcPlugin_[A-Za-z_]+' | head -2