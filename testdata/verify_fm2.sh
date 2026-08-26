#!/bin/bash
echo "=== 起服务 ==="
pgrep -f 'raincough -port' | head -1 || (cd ~/raincough-dev && nohup ./raincough -port 3900 > srv.log 2>&1 & sleep 6)
ss -tlnp 2>/dev/null | grep 3900 | head -1
echo "=== rename ==="
mkdir -p /tmp/fmtest2 && touch /tmp/fmtest2/a.txt
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/rename -H 'Content-Type: application/json' -d '{"path":"/tmp/fmtest2/a.txt","new_name":"b.txt"}'
echo
echo "=== delete arr ==="
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/delete -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2/b.txt"]}'
echo
echo "=== size ==="
touch /tmp/fmtest2/c.txt
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/size -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2"]}'
echo
echo "=== move ==="
mkdir -p /tmp/fmtest2/dest
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/move -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2/c.txt"],"dest":"/tmp/fmtest2/dest"}'
echo
echo "=== copy ==="
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/copy -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2/dest/c.txt"],"dest":"/tmp/fmtest2"}'
echo
ls /tmp/fmtest2/