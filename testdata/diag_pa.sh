#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 取章节完整响应(urls 与 page_arr) ==="
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))' 2>/dev/null)
curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("page_arr[:3]:", d.get("page_arr",[])[:3])
print("urls[:2]:", d.get("urls",[])[:2] or d.get("direct_urls",[])[:2])
print("keys:", list(d.keys()))
'