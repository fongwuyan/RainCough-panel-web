#!/bin/bash
cd ~/raincough-dev
echo "=== 部署(安全, 不涉及关机) ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "alive:"
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print(" ", sum(1 for p in ps if p.get("alive")), "/", len(ps))'
echo "mcserver logs(空实例):"
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins/mcserver/logs | head -c 80
echo
echo "mcserver cores(带缓存):"
time curl -s --max-time 30 http://127.0.0.1:3900/api/plugins/mcserver/cores | head -c 100
echo
echo "kvm images(池不存在→明确错误):"
curl -s --max-time 12 http://127.0.0.1:3900/api/plugins/kvm/images | head -c 120