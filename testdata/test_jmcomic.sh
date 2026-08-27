#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 1. 插件存活 ==="
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); [print(" ", p["name"], "alive:", p["alive"], "|", (p.get("error") or "")[:40]) for p in ps if "MComic" in p["name"].lower()]'
echo "=== 2. __health ==="
curl -s --max-time 6 "$B/api/plugins/JMComic/__health" | head -c 200
echo
echo "=== 3. library(本地库) ==="
curl -s --max-time 6 "$B/api/plugins/JMComic/library" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("library keys:", list(d.keys()) if isinstance(d,dict) else type(d)); print("内容:", str(d)[:150])' 2>&1
echo "=== 4. config ==="
curl -s --max-time 6 "$B/api/plugins/JMComic/config" | head -c 120
echo
echo "=== 5. search(需外网 api.jmcomic.io) ==="
curl -s --max-time 12 "$B/api/plugins/JMComic/search?keyword=test" | head -c 200
echo
echo "=== 6. meta(需外网) ==="
curl -s --max-time 10 "$B/api/plugins/JMComic/meta/1" | head -c 120
echo
echo "=== 7. 子进程日志(最近) ==="
grep -a -i 'jmcomic' ~/raincough-dev/srv.log | tail -3
echo "=== 8. 宿主到 jmcomic.io 连通性 ==="
curl -s -o /dev/null -w "api.jmcomic.io -> %{http_code} (%{time_total}s)\n" --max-time 8 "https://api.jmcomic.io/api/comics/search?keyword=test&page=1" 2>&1 | head -1