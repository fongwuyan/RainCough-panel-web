#!/bin/bash
echo "=== 所有 python3 server.py 进程+目录 ==="
for pid in $(pgrep -f 'python3 server.py'); do
  echo "pid $pid cwd=$(readlink /proc/$pid/cwd 2>/dev/null)"
done
echo "=== JMComic 插件 manifest/routes(网关用) ==="
cat ~/raincough-dev/plugins/JMComic/plugin.json
echo "=== 网关在 /api/plugins 里 JMComic 的端口? ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c '
import json,sys
ps=json.load(sys.stdin)
for p in ps:
    if "MComic" in p["name"].lower() or "jmcomic" in p["name"].lower():
        print(json.dumps(p, ensure_ascii=False)[:400])
'