#!/bin/bash
B=http://127.0.0.1:3900
echo "=== source=system: jmcomic 痕迹 ==="
curl -s --max-time 10 "$B/api/sys/plugins-health/log?name=JMComic&source=system&lines=0" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("total_lines:",d.get("total_lines"),"size:",d.get("size"))
print("--- 前 6 行 ---")
for l in (d.get("text") or "").split("\n")[:6]: print(" ",l[:100])
print("--- 后 3 行 ---")
for l in (d.get("text") or "").split("\n")[-3:]: print(" ",l[:100])
'
echo "=== source=system: vpn 痕迹(含 已加载) ==="
curl -s --max-time 10 "$B/api/sys/plugins-health/log?name=vpn&source=system" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("total:",d.get("total_lines"))
print((d.get("text") or "")[:200])
'
echo "=== source=runtime: aigen 进程日志(对照) ==="
curl -s --max-time 8 "$B/api/sys/plugins-health/log?name=aigen&source=runtime&lines=5" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("exists:",d.get("exists"),"total:",d.get("total_lines")); print((d.get("text") or "")[:120])'