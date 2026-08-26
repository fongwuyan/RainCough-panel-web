#!/bin/bash
echo "=== 等 65s 后性能趋势 ==="
sleep 65
curl -s --max-time 8 "http://127.0.0.1:3900/api/sysfunc/perf/history?hours=24" | python3 -c 'import json,sys; d=json.load(sys.stdin); pts=d.get("points",[]); print("points:", len(pts), "| 最新点:", pts[-1] if pts else "无", "| net:", d.get("net"))'
echo "=== net/status 全文 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/sysfunc/net/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print("nics:", [(n["name"], n["up"], n["ip"]) for n in d.get("nics",[])]); print("tcp:", d.get("tcp_conns"), "dns:", d.get("dns"), "rate:", d.get("rate"))'