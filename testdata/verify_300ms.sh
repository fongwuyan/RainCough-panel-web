#!/bin/bash
echo "=== perf/history 采样密度(300ms/点) ==="
curl -s --max-time 6 "http://127.0.0.1:3900/api/sysfunc/perf/history?hours=24" | python3 -c 'import json,sys; d=json.load(sys.stdin); pts=d.get("points",[]); print("points:", len(pts), "(60=满窗口18s)"); print("最新点:", pts[-1] if pts else "无"); print("net rx/tx:", d.get("net"))'
echo "=== 5s 后再看点数是否增长(说明 300ms 采样中) ==="
sleep 5
curl -s --max-time 6 "http://127.0.0.1:3900/api/sysfunc/perf/history?hours=24" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("5s后 points:", len(d.get("points",[])))'
echo "=== disks 缓存正常(300ms 节拍) ==="
curl -s --max-time 6 http://127.0.0.1:3900/api/disks | python3 -c 'import json,sys; d=json.load(sys.stdin); print("disks:", len(d.get("disks",[])))'