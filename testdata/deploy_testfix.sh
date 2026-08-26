#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -5 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== registry(本地兜底) ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/store/registry | python3 -c 'import json,sys; d=json.load(sys.stdin); ps=d.get("plugins",[]); print("仓库插件:", len(ps)); [print(" -", p.get("name"), "|", p.get("label"), "| 已装:", p.get("installed")) for p in ps[:6]]' 2>&1 | head -10
echo "=== 全功能复测 ==="
bash /tmp/full_test.sh 2>&1 | tail -8