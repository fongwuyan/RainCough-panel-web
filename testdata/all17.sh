#!/bin/bash
# 全量 17 插件验证
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 8
echo "=== 启动日志(加载/失败) ==="
grep -E '已加载|失败|上限' srv.log
echo "=== 全量插件状态 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c '
import json,sys
ps = json.load(sys.stdin)
print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))
missing = [p["name"] for p in ps if not p["alive"]]
print("dead:", missing or "none")
'
echo "=== mcserver: health ==="
curl -s http://127.0.0.1:3900/api/plugins/mcserver/__health
echo
echo "=== JMComic: library(空) ==="
curl -s http://127.0.0.1:3900/api/plugins/JMComic/library | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:", d.get("ok"), "total:", d.get("total"))'