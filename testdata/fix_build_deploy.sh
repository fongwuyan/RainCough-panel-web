#!/bin/bash
PW='1'
echo "=== 0. 确认当前无挂起关机(绝不执行关机类操作) ==="
ls /run/systemd/shutdown/scheduled 2>/dev/null && echo "!! 有挂起关机" || echo "无挂起关机 ✓"
echo "=== 1. 修复 /tmp 权限(go 需要) ==="
echo "$PW" | sudo -S chmod 1777 /tmp 2>&1 | tail -1
ls -ld /tmp
echo "=== 2. 用 GOTMPDIR 构建 ==="
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export GOTMPDIR=$HOME/gotmp && mkdir -p $HOME/gotmp
go build -o raincough ./cmd/raincough 2>&1 | head -4
ls -la raincough | awk '{print $5, $9}'
echo "=== 3. 验证二进制含安全修复(空参 400) ==="
strings raincough 2>/dev/null | grep -c 'minutes 必填' || echo "0(未含修复)"
echo "=== 4. 部署(重启面板, 不涉及关机) ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'