#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 找有 runtime.log 的插件 ==="
ls ~/raincough-dev/plugins/*/.runtime.log 2>/dev/null | head -5
echo "=== 完整日志(all) ==="
N=$(ls ~/raincough-dev/plugins/*/.runtime.log 2>/dev/null | head -1 | sed 's|.*/plugins/||; s|/.*||')
echo "sample=$N"
curl -s --max-time 10 "$B/api/sys/plugins-health/log?name=$N&lines=0" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("exists:",d.get("exists"),"total_lines:",d.get("total_lines"),"size:",d.get("size"))
t=d.get("text","")
print("text chars:", len(t))
print("开头:", t[:80].replace(chr(10)," | "))
print("结尾:", t[-80:].replace(chr(10)," | "))
'
echo "=== grep 过滤 ==="
curl -s --max-time 10 "$B/api/sys/plugins-health/log?name=$N&lines=0&grep=ready" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("grep=ready 匹配行数:", d.get("text","").count(chr(10))+1 if d.get("text") else 0)'
echo "=== 尾部200 ==="
curl -s --max-time 8 "$B/api/sys/plugins-health/log?name=$N&lines=200" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("lines=200: text_lines:", d.get("text","").count(chr(10))+1 if d.get("text") else 0)'