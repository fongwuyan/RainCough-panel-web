#!/bin/bash
cd ~/raincough-dev
echo "=== 1. kvm server.py 更新确认 ==="
grep -c 'vol-list.*default.*details' plugins/kvm/server.py
echo "=== 2. 杀掉旧 kvm 子进程 ==="
for pid in $(pgrep -f 'python3 server.py'); do
  c=$(readlink /proc/$pid/cwd 2>/dev/null)
  if [ "$c" = "/home/f/raincough-dev/plugins/kvm" ]; then
    kill -9 $pid 2>/dev/null; echo "killed kvm pid=$pid"
  fi
done
echo "=== 3. 触发主系统重扫(正常重启面板=安全, 不涉及关机) ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "=== 4. kvm/images ==="
curl -s --max-time 15 http://127.0.0.1:3900/api/plugins/kvm/images | head -c 200
echo
echo "=== 5. alive ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'