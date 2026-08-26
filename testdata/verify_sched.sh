#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 6
echo "=== scheduler 全链路 ==="
echo "-- 创建 --"
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/scheduler/jobs -H 'Content-Type: application/json' -d '{"name":"测试任务","cron":"0 3 * * *","action":"shell","params":{"cmd":"echo hi"}}'
echo
echo "-- 列表 --"
curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; d=json.load(sys.stdin); jobs=d.get("jobs",[]); print("jobs:", len(jobs)); [print("  id:", j.get("id"), j.get("name"), "enabled:", j.get("enabled")) for j in jobs]'
ID=$(curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; d=json.load(sys.stdin); j=d.get("jobs",[]); print(j[0]["id"] if j else "")')
echo "-- run($ID) --"
curl -s --max-time 6 -X POST "http://127.0.0.1:3900/api/scheduler/jobs/$ID/run"
echo
echo "-- pause($ID) --"
curl -s --max-time 6 -X POST "http://127.0.0.1:3900/api/scheduler/jobs/$ID/pause"
echo
echo "-- resume($ID) --"
curl -s --max-time 6 -X POST "http://127.0.0.1:3900/api/scheduler/jobs/$ID/resume"
echo
echo "-- delete($ID) --"
curl -s --max-time 6 -X DELETE "http://127.0.0.1:3900/api/scheduler/jobs/$ID"
echo
echo "-- 动作 --"
curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/actions | head -c 120