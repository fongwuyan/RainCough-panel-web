#!/bin/bash
# 彻底重启并立即诊断
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
rm -f srv.log
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 10
echo "=== 进程 ==="
pgrep -a -f 'raincough -port' || echo NO_PROC
echo "=== 日志全文 ==="
cat srv.log
echo "=== 手动 curl ==="
curl -sv --max-time 5 http://127.0.0.1:3900/api/plugins 2>&1 | tail -8
echo "=== 3000 是否被旧面板占 ==="
ss -tlnp 2>/dev/null | grep -E ':3900|:3000' || echo "no listener"