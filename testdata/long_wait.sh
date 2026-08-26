#!/bin/bash
# 超长等待验证(30s): MySQL 下插件启动可能慢
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
rm -f srv.log
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 30
echo "=== 日志(30s后) ==="
cat srv.log
echo "=== 插件 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))' 2>&1
echo "=== 端口 ==="
ss -tlnp 2>/dev/null | grep 3900