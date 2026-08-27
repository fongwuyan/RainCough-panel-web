#!/bin/bash
B=http://127.0.0.1:3900
echo "=== JMComic 子进程健康 ==="
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); [print(" ", p["name"], "alive:", p["alive"], "| pid:", p.get("pid"), "| err:", p.get("error")) for p in ps if "MComic" in p["name"].lower()]'
echo "=== JMComic 网关直接探活 ==="
curl -s -o /dev/null -w "__health: %{http_code}\n" --max-time 5 "$B/api/plugins/JMComic/__health"
curl -s --max-time 5 "$B/api/plugins/JMComic/__health" | head -c 150
echo
echo "=== 子进程列表 ==="
pgrep -af 'JMComic|jmcomic' | head -3 || echo "(无 JMComic 子进程!)"
echo "=== srv.log JMComic 相关 ==="
grep -a -i 'jmcomic' ~/raincough-dev/srv.log | tail -5