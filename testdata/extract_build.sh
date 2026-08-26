#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 解压最新 src.tar ==="
tar -xf src.tar && rm -f src.tar
ls -la cmd/raincough/syscenter.go 2>&1
echo "=== build ==="
go build -o raincough ./cmd/raincough 2>&1
echo "build rc=$?"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 6
echo "=== sysfunc ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/sysfunc/service/list | head -c 200