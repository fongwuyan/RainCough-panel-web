#!/bin/bash
cd ~/raincough-dev
echo "=== 完全重启主系统(重载全部插件) ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 10
echo "=== 现在 JMComic 子进程? ==="
ps aux | grep 'server.py' | grep -v grep | awk '{print $2}' | while read pid; do echo "pid $pid cwd=$(readlink /proc/$pid/cwd 2>/dev/null)"; done
echo "=== 插件列表(jmcomic alive? + 端口?) ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c '
import json,sys
ps=json.load(sys.stdin)
print("total:", len(ps), "alive:", sum(1 for p in ps if p.get("alive")))
for p in ps:
    if "MComic" in p["name"].lower(): print("JMComic:", p.get("alive"), p)
'
echo "=== 现在 JMComic search 通? ==="
curl -s --max-time 25 "http://127.0.0.1:3900/api/plugins/jmcomic/search?keyword=test&page=1&mode=keyword" | head -c 120
echo
echo "=== srv.log 尾 ==="
tail -8 ~/raincough-dev/srv.log