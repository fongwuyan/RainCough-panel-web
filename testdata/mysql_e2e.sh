#!/bin/bash
# 数据层切 MariaDB 验证: 主系统 + 插件都连 MySQL
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
# 用 MySQL DSN 启动
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
go build -o raincough ./cmd/raincough 2>&1 | head -3
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 7

echo "=== 服务日志 ==="
grep -E '已加载|失败|错误|数据层' srv.log | head -10
echo "=== 系统监控(数据层 OK?) ==="
curl -s http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("host:", d.get("hostname"), "cpu:", d.get("cpu_count"))'
echo "=== 插件列表 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'
echo "=== MySQL 中的表 ==="
mysql -uraincough -praincough-local-dev -h127.0.0.1 raincough -e "SHOW TABLES;" 2>&1 | head -20