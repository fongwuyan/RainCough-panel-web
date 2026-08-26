#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 6
echo "=== 触发 disks ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/disks
echo
sleep 1
echo "=== disks 日志 ==="
grep -a "disks" ~/raincough-dev/srv.log | tail -5