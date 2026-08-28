#!/bin/bash
B=http://127.0.0.1:3900
echo "=== /api/sys/plugins-health ==="
curl -s --max-time 8 $B/api/sys/plugins-health | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("total:", d.get("total"), "alive:", d.get("alive"), "healthy:", d.get("healthy"))
for it in d.get("items",[])[:5]:
    print(" ", it.get("name"), "alive=",it.get("alive"), "health=",it.get("health_http"), "asset=",it.get("asset_ok"), "err=",it.get("error",""))
print("  ... 共", len(d.get("items",[])), "项")
'
echo "=== /api/sys/plugins-health/log?name=jmcomic ==="
curl -s --max-time 8 "$B/api/sys/plugins-health/log?name=jmcomic&lines=5" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("exists:",d.get("exists"),"tail:", (d.get("text") or "")[:120])'
echo "=== /plughealth 路由可达(SPA) ==="
curl -s -o /dev/null -w "panel: %{http_code}\n" --max-time 5 $B/