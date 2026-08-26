#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 审计修复回归 ==="
echo "-- service/list units 契约 --"
curl -s --max-time 6 http://127.0.0.1:3900/api/sysfunc/service/list | python3 -c 'import json,sys; d=json.load(sys.stdin); print("services:", len(d.get("services",[])), "units:", len(d.get("units",[])))'
echo "-- service/action unit --"
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/sysfunc/service/action -H 'Content-Type: application/json' -d '{"unit":"cron.service","act":"status"}' | head -c 60
echo
echo "-- fw/all 与 api-monitor --"
curl -s --max-time 6 http://127.0.0.1:3900/api/sysfunc/fw/all | head -c 60
echo
curl -s --max-time 6 http://127.0.0.1:3900/api/sysfunc/api-monitor/stats | head -c 60
echo
echo "-- disks/unmount device 键 --"
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/disks/unmount -H 'Content-Type: application/json' -d '{"device":"/dev/nonexist"}' | head -c 60
echo
echo "-- store github_token 键 --"
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/store/settings -H 'Content-Type: application/json' -d '{"github_token":"","plugin_repo":{"owner":"x","repo":"y","branch":"main"}}' | head -c 80
echo
echo "-- 插件仍活 --"
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'