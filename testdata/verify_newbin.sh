#!/bin/bash
cd ~/raincough-dev
echo "=== grep -a 搜二进制中文串 ==="
grep -ac 'minutes 必填' raincough.new 2>/dev/null
grep -ac 'action 必填' raincough.new 2>/dev/null
echo "=== 对比: 旧二进制(若备份) ==="
ls -la raincough raincough.new 2>/dev/null | awk '{print $5, $9}'
echo "=== 新二进制替换并重启(不涉及关机) ==="
mv -f raincough.new raincough
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'
echo "=== fm/rename 空参(应 400, 不用关机) ==="
curl -s --max-time 8 -X POST http://127.0.0.1:3900/api/fm/rename -H 'Content-Type: application/json' -d '{}' | head -c 80
echo
echo "=== kvm/images(应修复, 免sudo) ==="
curl -s --max-time 15 http://127.0.0.1:3900/api/plugins/kvm/images | head -c 150