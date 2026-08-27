#!/bin/bash
echo "=== srv.log 全量(找崩溃) ==="
cat ~/raincough-dev/srv.log | grep -a -iE 'panic|fatal|错误|error|exit|signal|kill' | tail -12
echo "=== 是否有 core/被 OOM ==="
dmesg 2>/dev/null | tail -5 | grep -iE 'oom|kill' || echo "(无 dmesg 或非oom)"
echo "=== 剩余进程 ==="
pgrep -af 'raincough|python3 server.py' | head -5
echo "=== 手动重启观察 ==="
cd ~/raincough-dev
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
pgrep -af 'raincough' | head -2
curl -s --max-time 6 http://127.0.0.1:3900/api/system -o /tmp/s.json -w "HTTP %{http_code}\n"
head -c 100 /tmp/s.json 2>/dev/null; echo
tail -4 ~/raincough-dev/srv.log