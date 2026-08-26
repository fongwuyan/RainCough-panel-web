#!/bin/bash
# 验证全部插件拉起
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 6
echo "=== 启动日志 ==="
grep -E '已加载|上限|失败' srv.log
echo "=== 全部插件 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps)); [print(" ", p["name"], "alive=", p["alive"]) for p in ps]'