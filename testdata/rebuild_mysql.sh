#!/bin/bash
# 重新 build 后 MySQL 全量验证
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== rebuild ==="
go build -o raincough ./cmd/raincough 2>&1 | head -5
ls -la raincough | awk '{print $5, $6, $7, $8}'
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
rm -f srv.log
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 10
echo "=== 日志 ==="
cat srv.log | head -25
echo "=== 插件 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"])); print("dead:", [p["name"] for p in ps if not p["alive"]] or "none")' 2>&1
echo "=== MySQL 表 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW TABLES;" 2>/dev/null