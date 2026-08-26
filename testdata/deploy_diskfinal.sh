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
echo "=== /api/disks ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/disks | python3 -c '
import json,sys
d=json.load(sys.stdin)
def fs(b):
    for u in ["B","KB","MB","GB","TB"]:
        if b<1024 or u=="TB": return "%.1f %s"%(b,u)
        b/=1024
for x in d.get("disks",[]):
    print(x.get("path"), "->", fs(x.get("size",0)))
    for p in x.get("partitions",[]):
        pc = "used%%:%s" % p.get("percent") if p.get("percent") is not None else ""
        print("   ", p.get("path"), p.get("fstype"), p.get("mountpoint") or "未挂载", fs(p.get("size",0)), pc)
'
echo "=== 日志 ==="
grep -a "disks" ~/raincough-dev/srv.log | tail -2