#!/bin/bash
echo "=== 宿主前端源码搜未加载 ==="
grep -rn '未加载' ~/raincough-dev/web/src/ 2>/dev/null | head -8
echo "=== 宿主公共目录发布版搜 ==="
JS=$(ls ~/raincough-dev/public/assets/index-*.js 2>/dev/null | head -1)
echo "bundle=$JS"
grep -oE '.{0,30}未加载.{0,30}' $JS 2>/dev/null | head -3
echo "=== API 插件状态 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); [print(" ", p["name"], "alive:", p["alive"], "|", (p.get("error") or "")[:50]) for p in ps if "mcomic" in p["name"].lower()]'
echo "=== srv.log ==="
grep -a -iE 'jmcomic' ~/raincough-dev/srv.log | tail -6