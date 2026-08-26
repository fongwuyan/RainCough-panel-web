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
echo "=== /api/sys/logs ==="
curl -s --max-time 6 "http://127.0.0.1:3900/api/sys/logs?lines=5" | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d.get("text",""); print("text len:", len(t)); print(t[:120])'
echo "=== /api/sys/processes ==="
curl -s --max-time 6 "http://127.0.0.1:3900/api/sys/processes?sort=cpu" | python3 -c 'import json,sys; d=json.load(sys.stdin); ps=d.get("processes",[]); print("procs:", len(ps)); [print("  ", p.get("pid"), p.get("name"), p.get("cpu")) for p in ps[:3]]'
echo "=== scheduler jobs(兼容字段) ==="
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/scheduler/jobs -H 'Content-Type: application/json' -d '{"name":"s1","cron":"0 4 * * *","action":"shell","params":{"cmd":"ls"}}' | python3 -c 'import json,sys; d=json.load(sys.stdin); print("trigger:", d.get("trigger"), "| minute:", d.get("minute"), "| paused:", d.get("paused"), "| enabled:", d.get("enabled"))'
echo "=== media roots(name字段) ==="
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/media/roots -H 'Content-Type: application/json' -d '{"roots":[{"name":"etc","label":"ETC","path":"/etc"}]}'
echo
curl -s --max-time 6 http://127.0.0.1:3900/api/media/roots
echo
echo "=== envpkg catalog(分组) ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/envpkg/catalog | python3 -c 'import json,sys; d=json.load(sys.stdin); cat=d.get("catalog",{}); print("types:", list(cat.keys())); print("node:", [(x["version"], x["installed"]) for x in cat.get("node",[])])'