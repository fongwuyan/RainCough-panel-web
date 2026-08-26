#!/bin/bash
# 自动触发验证
echo "=== 任务队列现状 ==="
curl -s http://127.0.0.1:3900/api/tasks
echo
echo "=== 建每分任务 ==="
curl -s -X POST http://127.0.0.1:3900/api/scheduler/jobs \
  -H 'Content-Type: application/json' \
  -d '{"name":"everymin-trigger","cron":"* * * * *","action":"shell","params":{"cmd":"echo tick-$(date +%H:%M)"}}'
echo
echo "=== 等待 70s 让 cron 触发 ==="
sleep 70
echo "=== 检查自动触发结果 ==="
JOBID=$(curl -s http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; print([j["id"] for j in json.load(sys.stdin)["jobs"] if "everymin" in j["id"]][0])')
echo "job=$JOBID"
curl -s http://127.0.0.1:3900/api/scheduler/jobs/$JOBID | python3 -m json.tool