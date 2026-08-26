#!/bin/bash
echo "=== 服务状态 ==="
ss -tlnp 2>/dev/null | grep 3900 || echo NO
echo "=== 创建任务 ==="
curl -s -i --max-time 6 -X POST http://127.0.0.1:3900/api/scheduler/jobs -H 'Content-Type: application/json' -d '{"name":"t1","cron":"0 3 * * *","action":"shell","params":{"cmd":"echo hi"}}' 2>&1 | head -8
echo "=== 列表 ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/jobs
echo
echo "=== pty 检测 ==="
tr '\0' '\n' < /proc/$(pgrep -f 'raincough -port' | head -1)/environ 2>/dev/null | grep -c PATH >/dev/null && echo "proc alive"