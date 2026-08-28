#!/bin/bash
PW='1'
cd ~/raincough-dev
echo "=== 0. 无挂起关机 ==="
ls /run/systemd/shutdown/scheduled 2>/dev/null && echo "!!有" || echo "无 ✓"
echo "=== 1. 解压最新源码 ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
grep -c 'minutes 必填' cmd/raincough/syscenter_ext.go
echo "=== 2. GOTMPDIR 构建 ==="
export PATH=$HOME/go-tool/go/bin:$PATH
export GOTMPDIR=$HOME/gotmp && mkdir -p $HOME/gotmp
go build -o raincough.new ./cmd/raincough 2>&1 | head -4
ls -la raincough.new | awk '{print $5}'
echo "=== 3. 验证新二进制含修复 ==="
strings raincough.new 2>/dev/null | grep -c 'minutes 必填'
echo "=== 4. 替换+重启(不涉及关机) ==="
mv raincough.new raincough
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'