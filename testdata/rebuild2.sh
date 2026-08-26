#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 当前二进制时间 ==="
ls -la raincough | awk '{print $6,$7,$8}'
echo "=== 重新 build(显式看错误) ==="
go build -o raincough ./cmd/raincough 2>&1
echo "build rc=$?"
ls -la raincough | awk '{print $6,$7,$8}'
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 6
echo "=== sysfunc 路由测试 ==="
curl -s --max-time 8 -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3900/api/sysfunc/service/list
curl -s --max-time 8 http://127.0.0.1:3900/api/sysfunc/service/list | head -c 200