#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "=== 16+1 插件全健康 ==="
for n in jmcomic aigen compress dltool docker filehash imagetool kvm laizhangsetu mcserver mcskin ocrqr texttool touchgal uptime vpn webspy; do
  R=$(curl -s --max-time 6 "http://127.0.0.1:3900/api/plugins/$n/__health?p=1" | head -c 50)
  printf "  %-14s %s\n" $n "$R"
done
echo "=== 带 query 的 GET(网关 RawQuery) ==="
curl -s --max-time 15 "http://127.0.0.1:3900/api/plugins/uptime/targets?q=1" | head -c 60
echo
curl -s --max-time 8 "http://127.0.0.1:3900/api/plugins/touchgal/search?keyword=test" | head -c 60
echo
echo "=== 插件 alive ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:",len(ps),"alive:",sum(1 for p in ps if p.get("alive")))'