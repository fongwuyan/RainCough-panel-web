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
echo "=== 网络状态(nics/tcp/dns/rate) ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/sysfunc/net/status | python3 -m json.tool 2>/dev/null | head -20
echo "=== 性能趋势(points) ==="
curl -s --max-time 8 "http://127.0.0.1:3900/api/sysfunc/perf/history?hours=24" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("points:", len(d.get("points",[])), "net:", d.get("net"))'
echo "=== 磁盘(真实分区) ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/disks | python3 -c '
import json,sys
d=json.load(sys.stdin)
for disk in d.get("disks",[]):
    print(disk.get("path"), disk.get("size"), "分区:", len(disk.get("partitions",[])))
    for p in disk.get("partitions",[]):
        if p.get("mountpoint"):
            print("   ", p.get("path"), p.get("fstype"), p.get("label"), p.get("mountpoint"), "used%:", p.get("percent"))
' 2>&1 | head -12