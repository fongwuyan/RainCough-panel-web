#!/bin/bash
# 彻底清理所有相关进程, 干净重启
echo "=== 清理 ==="
pkill -9 -f 'raincough' 2>/dev/null
pkill -9 -f 'server.py' 2>/dev/null
pkill -9 -f 'python3 server' 2>/dev/null
sleep 2
echo "残留 raincough: $(pgrep -f raincough | wc -l)"
echo "残留 server.py: $(pgrep -f server.py | wc -l)"
echo "=== 干净启动 ==="
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
rm -f srv.log
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 12
echo "=== 日志 ==="
cat srv.log
echo "=== 端口 ==="
ss -tlnp 2>/dev/null | grep 3900 || echo "no listener"
echo "=== 插件 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins 2>&1 | head -c 200