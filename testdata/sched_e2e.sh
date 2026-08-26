#!/bin/bash
# 调度器/任务队列 e2e 验证(在宿主机 Linux 上执行)
set -x
echo "=== 1. 建定时任务 ==="
curl -s -X POST http://127.0.0.1:3900/api/scheduler/jobs \
  -H 'Content-Type: application/json' \
  -d '{"name":"backup-test","cron":"0 3 * * *","action":"shell","params":{"cmd":"echo backup-ran; date"}}'
echo
echo "=== 2. 取 job id ==="
JOBID=$(curl -s http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; print(json.load(sys.stdin)["jobs"][0]["id"])')
echo "job=$JOBID"
echo "=== 3. 手动执行 ==="
curl -s -X POST http://127.0.0.1:3900/api/scheduler/jobs/$JOBID
echo
echo "=== 4. 执行结果(last_status/last_message) ==="
curl -s http://127.0.0.1:3900/api/scheduler/jobs/$JOBID | python3 -m json.tool
echo "=== 5. 任务队列 ==="
curl -s http://127.0.0.1:3900/api/tasks
echo
echo "=== 6. 非法 cron 拒绝测试 ==="
curl -s -X POST http://127.0.0.1:3900/api/scheduler/jobs \
  -H 'Content-Type: application/json' \
  -d '{"name":"bad","cron":"99 99 * * *"}'
echo