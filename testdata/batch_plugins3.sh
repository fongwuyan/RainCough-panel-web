#!/bin/bash
# 批量验证 3 个新插件
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 5
echo "=== 插件列表 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; print([(p["name"],p["alive"]) for p in json.load(sys.stdin)])'
echo "=== 1. laizhangsetu: config GET ==="
curl -s http://127.0.0.1:3900/api/plugins/laizhangsetu/config
echo
echo "=== 2. laizhangsetu: cooldown ==="
curl -s http://127.0.0.1:3900/api/plugins/laizhangsetu/cooldown
echo
echo "=== 3. docker: env(宿主机 docker?) ==="
curl -s http://127.0.0.1:3900/api/plugins/docker/env
echo
echo "=== 4. docker: containers ==="
curl -s http://127.0.0.1:3900/api/plugins/docker/containers | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:", d.get("ok"), "count:", len(d.get("containers",[])))'
echo "=== 5. touchgal: health ==="
curl -s http://127.0.0.1:3900/api/plugins/touchgal/__health
echo
echo "=== 6. 全部插件状态 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'