#!/bin/bash
ID=$(curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; d=json.load(sys.stdin); j=d.get("jobs",[]); print(j[0]["id"] if j else "")')
echo "ID=$ID"
echo "-- run --"
curl -s --max-time 6 -X POST "http://127.0.0.1:3900/api/scheduler/jobs/$ID/run"
echo
echo "-- pause --"
curl -s --max-time 6 -X POST "http://127.0.0.1:3900/api/scheduler/jobs/$ID/pause"
echo
curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; d=json.load(sys.stdin); j=d.get("jobs",[]); print("pause后 enabled:", j[0].get("enabled") if j else "-")'
echo "-- resume --"
curl -s --max-time 6 -X POST "http://127.0.0.1:3900/api/scheduler/jobs/$ID/resume"
echo
curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; d=json.load(sys.stdin); j=d.get("jobs",[]); print("resume后 enabled:", j[0].get("enabled") if j else "-")'
echo "-- delete --"
curl -s --max-time 6 -X DELETE "http://127.0.0.1:3900/api/scheduler/jobs/$ID"
echo
curl -s --max-time 6 http://127.0.0.1:3900/api/scheduler/jobs | python3 -c 'import json,sys; d=json.load(sys.stdin); print("删除后 jobs:", len(d.get("jobs",[])))'