#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export GOTMPDIR=$HOME/gotmp && mkdir -p $HOME/gotmp
echo "=== 解压+构建 ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3 && echo "go ok"
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "=== 验证: assets no-cache + 可达 ==="
for n in compress dltool filehash imagetool ocrqr texttool webspy; do
  H=$(curl -s -D - -o /dev/null --max-time 5 "http://127.0.0.1:3900/api/plugins/$n/assets/plugin.js" | grep -i 'cache-control' | head -1 | tr -d '\r')
  RC=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:3900/api/plugins/$n/assets/plugin.js")
  printf "  %-12s RC=%s %s\n" $n $RC "$H"
done
echo "=== 插件 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'