#!/bin/bash
echo "=== 残留 raincough 进程 ==="
pgrep -af 'raincough' | head -5 || echo "(无)"
echo "=== 残留插件子进程 ==="
pgrep -af 'server.py|server.js|raincough-port' | head -8 || echo "(无)"
echo "=== 谁握着 DB 文件 ==="
lsof ~/raincough-dev/data/data/rc.db 2>/dev/null | head -6 || echo "(无 lsof 或无文件)"
ls -la ~/raincough-dev/data/data/ 2>/dev/null | head -5
echo "=== 全杀后重启 ==="
for p in $(pgrep -f 'raincough'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'server.py|server.js'); do kill -9 $p 2>/dev/null; done
sleep 2
cd ~/raincough-dev
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 重启后 ==="
ss -tlnp 2>/dev/null | grep 3900 | head -1
tail -3 ~/raincough-dev/srv.log
curl -s -o /dev/null -w "index %{http_code}\n" --max-time 5 http://127.0.0.1:3900/