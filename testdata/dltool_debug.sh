#!/bin/bash
# 排查 dltool 子进程崩溃
cd ~/raincough-dev/plugins/dltool
echo "=== python 语法检查 ==="
python3 -c "import ast; ast.parse(open('server.py').read()); print('SYNTAX OK')"
echo "=== 手动启动子进程(RAINCOUGH_PORT=34567) ==="
RAINCOUGH_PORT=34567 python3 server.py > /tmp/dltool.log 2>&1 &
WPID=$!
sleep 2
echo "=== 健康检查 ==="
curl -s http://127.0.0.1:34567/__health; echo
echo "=== 直连 split ==="
curl -s -X POST http://127.0.0.1:34567/networktools/split \
  -H "Content-Type: application/json" -d '{"path":"/etc/hosts","parts":2}'; echo
echo "=== 子进程日志 ==="
cat /tmp/dltool.log
kill $WPID 2>/dev/null