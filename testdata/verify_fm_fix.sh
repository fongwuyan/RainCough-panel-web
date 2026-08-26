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
echo "=== 文件管理契约验证 ==="
echo "-- rename(path+new_name 前端契约) --"
mkdir -p /tmp/fmtest2 && touch /tmp/fmtest2/a.txt
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/rename -H 'Content-Type: application/json' -d '{"path":"/tmp/fmtest2/a.txt","new_name":"b.txt"}'
echo
echo "-- delete(paths 数组) --"
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/delete -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2/b.txt"]}'
echo
ls /tmp/fmtest2/ 2>/dev/null | wc -l
echo "-- size --"
touch /tmp/fmtest2/c.txt
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/size -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2"]}'
echo
echo "-- move --"
mkdir -p /tmp/fmtest2/dest
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/move -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2/c.txt"],"dest":"/tmp/fmtest2/dest"}'
echo
ls /tmp/fmtest2/dest/ 2>/dev/null
echo "-- copy --"
curl -s --max-time 6 -X POST http://127.0.0.1:3900/api/fm/copy -H 'Content-Type: application/json' -d '{"paths":["/tmp/fmtest2/dest/c.txt"],"dest":"/tmp/fmtest2"}'
echo
ls /tmp/fmtest2/ 2>/dev/null