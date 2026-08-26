#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -5 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== POST start ==="
R=$(curl -s --max-time 8 -X POST http://127.0.0.1:3900/api/fm/ops -H 'Content-Type: application/json' -d '{"op":"archive","paths":["/etc/hostname","/etc/hosts"],"format":"zip","name":"test"}')
echo "$R"
ID=$(echo "$R" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
sleep 1
echo "=== list ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/fm/ops | python3 -c 'import json,sys; ts=json.load(sys.stdin).get("tasks",[]); print([(t["id"],t["op"],t["status"],t["progress"]) for t in ts])'
echo "=== get ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/fm/ops/$ID | python3 -c 'import json,sys; t=json.load(sys.stdin).get("task",{}); print("status:",t.get("status"),"result:",t.get("result_url"),"dest:",t.get("dest"))'
echo "=== download ==="
curl -s -o /dev/null -w "download %{http_code} %{size_download}B\n" "http://127.0.0.1:3900/api/fm/ops/$ID/download"
echo "=== delete ==="
curl -s --max-time 5 -X DELETE http://127.0.0.1:3900/api/fm/ops/$ID | head -c 40
echo
echo "=== unzip ==="
rm -rf /tmp/fmtest && mkdir /tmp/fmtest && echo hello > /tmp/fmtest/a.txt
python3 -c "import zipfile; z=zipfile.ZipFile('/tmp/fmtest/t.zip','w'); z.write('/tmp/fmtest/a.txt','a.txt'); z.close()"
curl -s --max-time 8 -X POST http://127.0.0.1:3900/api/fm/unzip -H 'Content-Type: application/json' -d '{"path":"/tmp/fmtest/t.zip"}' | head -c 60
echo
ls /tmp/fmtest/ | grep a.txt && echo "unzip OK"
echo "=== list / 修复验证 ==="
curl -s --max-time 5 "http://127.0.0.1:3900/api/fm/list?path=/" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("root items:", len(d.get("items",[])))'