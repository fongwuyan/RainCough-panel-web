#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -6 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== fm ops 验证 ==="
echo "-- 启动 archive 任务 --"
R=$(curl -s --max-time 5 -X POST http://127.0.0.1:3900/api/fm/ops -H 'Content-Type: application/json' -d '{"op":"archive","paths":["/etc/hostname","/etc/hosts"],"format":"zip","name":"test"}')
echo "$R"
ID=$(echo "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')
sleep 1
echo "-- 任务列表 --"
curl -s --max-time 5 http://127.0.0.1:3900/api/fm/ops | python3 -c 'import json,sys; ts=json.load(sys.stdin).get("tasks",[]); print([(t["id"],t["op"],t["status"],t["progress"]) for t in ts])'
echo "-- 单任务 --"
curl -s --max-time 5 http://127.0.0.1:3900/api/fm/ops/$ID | python3 -c 'import json,sys; t=json.load(sys.stdin).get("task",{}); print("status:",t.get("status"),"result:",t.get("result_url"))'
echo "-- 产物下载 --"
curl -s -o /dev/null -w "download %{http_code} %{size_download}B\n" "http://127.0.0.1:3900/api/fm/ops/$ID/download"
echo "-- 删除任务 --"
curl -s --max-time 5 -X DELETE http://127.0.0.1:3900/api/fm/ops/$ID | head -c 40
echo
echo "-- zip 解压 --"
mkdir -p /tmp/fmtest && cp "$HOME/raincough-dev/raincough" /dev/null 2>/dev/null || true
cd /tmp && rm -rf fmtest && mkdir fmtest && cd fmtest && echo hello > a.txt && zip -q t.zip a.txt
curl -s --max-time 5 -X POST http://127.0.0.1:3900/api/fm/unzip -H 'Content-Type: application/json' -d '{"path":"/tmp/fmtest/t.zip"}' | head -c 60
echo
ls -la /tmp/fmtest/ 2>/dev/null | grep a.txt && echo "unzip OK"