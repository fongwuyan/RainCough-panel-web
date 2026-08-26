#!/bin/bash
# envpkg 真实安装验证(修复 .tar.xz 后)
echo "=== 0. 确保环境干净 ==="
rm -rf /tmp/envs/* 2>/dev/null
curl -s -X POST http://127.0.0.1:3900/api/envpkg/install \
  -H "Content-Type: application/json" \
  -d '{"type":"node","version":"20.12.0"}'
echo
echo "=== 1. 取任务并轮询 ==="
TASK=$(curl -s http://127.0.0.1:3900/api/envpkg/tasks | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' 2>/dev/null)
# 上面拿不到, 改为从 install 响应拿
RESP=$(curl -s -X POST http://127.0.0.1:3900/api/envpkg/install \
  -H "Content-Type: application/json" \
  -d '{"type":"node","version":"20.12.0"}')
echo "install resp: $RESP"
TASK=$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["task"])')
for i in $(seq 1 40); do
  ST=$(curl -s http://127.0.0.1:3900/api/envpkg/tasks/$TASK)
  STATE=$(echo "$ST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  if [ "$STATE" = "done" ] || [ "$STATE" = "failed" ]; then
    echo "final state: $STATE"
    echo "$ST" | python3 -m json.tool
    break
  fi
  sleep 3
done

echo "=== 2. envs ==="
curl -s http://127.0.0.1:3900/api/envpkg/envs | python3 -m json.tool
echo "=== 3. run-in-env: node --version ==="
curl -s -X POST http://127.0.0.1:3900/api/envpkg/run \
  -H "Content-Type: application/json" \
  -d '{"name":"node-20.12.0","cmd":"node --version"}'