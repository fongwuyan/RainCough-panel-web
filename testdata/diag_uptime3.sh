#!/bin/bash
# 经网关详细 POST 测试
echo "=== POST baidu(verbose) ==="
curl -sv -X POST http://127.0.0.1:3900/api/plugins/uptime/targets \
  -H "Content-Type: application/json" \
  -d '{"name":"baidu","url":"https://www.baidu.com","interval":10,"timeout":5}' 2>&1 | tail -15
echo
echo "=== 直连子进程 34075 ==="
curl -sv -X POST http://127.0.0.1:34075/targets \
  -H "Content-Type: application/json" \
  -d '{"name":"direct","url":"https://www.baidu.com"}' 2>&1 | tail -10
echo
echo "=== 直连 GET targets ==="
curl -s http://127.0.0.1:34075/targets