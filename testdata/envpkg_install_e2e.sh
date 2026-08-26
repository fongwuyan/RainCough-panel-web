#!/bin/bash
# 真实安装 node 运行时 e2e(下载 tar.xz -> 解压 -> 登记 -> PATH 注入 -> run)
echo "=== 1. 安装 node-20.12.0 ==="
RESP=$(curl -s -X POST http://127.0.0.1:3900/api/envpkg/install \
  -H "Content-Type: application/json" \
  -d '{"type":"node","version":"20.12.0"}')
echo "$RESP"
TASK=$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["task"])')
echo "task=$TASK"

echo "=== 2. 轮询安装状态(最多 90s) ==="
for i in $(seq 1 30); do
  ST=$(curl -s http://127.0.0.1:3900/api/envpkg/tasks/$TASK)
  STATE=$(echo "$ST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  echo "  [$i] $STATE"
  if [ "$STATE" = "done" ] || [ "$STATE" = "failed" ]; then break; fi
  sleep 3
done
echo "$ST" | python3 -m json.tool

echo "=== 3. 查看已装环境 ==="
curl -s http://127.0.0.1:3900/api/envpkg/envs | python3 -m json.tool

echo "=== 4. run-in-env 测试(node --version) ==="
curl -s -X POST http://127.0.0.1:3900/api/envpkg/run \
  -H "Content-Type: application/json" \
  -d '{"name":"node-20.12.0","cmd":"node --version"}'
echo