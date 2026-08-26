#!/bin/bash
# 全量 17 插件验证(含 JMComic 大小写修复)
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 8
echo "=== 全量插件 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c '
import json,sys
ps = json.load(sys.stdin)
print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))
dead = [p["name"] for p in ps if not p["alive"]]
print("dead:", dead or "none")
print("names:", sorted(p["name"] for p in ps))
'
echo "=== JMComic: library ==="
curl -s http://127.0.0.1:3900/api/plugins/JMComic/library | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:", d.get("ok"), "total:", d.get("total"))'