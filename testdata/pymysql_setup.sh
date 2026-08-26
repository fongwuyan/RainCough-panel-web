#!/bin/bash
# 宿主装 pymysql(插件子进程连 MySQL 需要), 重启验证全部插件
echo "=== 安装 pymysql(用户级) ==="
pip3 install --user --quiet pymysql 2>&1 | tail -2
python3 -c "import pymysql; print('pymysql OK', pymysql.__version__)" 2>&1
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 8
echo "=== 插件全量 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"])); print("dead:", [p["name"] for p in ps if not p["alive"]] or "none")'