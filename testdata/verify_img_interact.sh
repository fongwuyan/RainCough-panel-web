#!/bin/bash
B=http://127.0.0.1:3900
echo "=== image 端点真实响应(302→CDN?) ==="
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))' 2>/dev/null)
echo "cid=$CID"
PA=$(curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; a=json.load(sys.stdin).get("page_arr",[]); print(a[0] if a else "")' 2>/dev/null)
echo "page_arr[0]=$PA"
echo "--- image 302 测试 ---"
curl -s -D - -o /dev/null --max-time 10 "$B/api/plugins/jmcomic/image/1460674/$CID/$PA" | head -8
echo "--- CDN 目标可达? ---"
LOC=$(curl -s -D - -o /dev/null --max-time 10 "$B/api/plugins/jmcomic/image/1460674/$CID/$PA" | grep -i '^location' | tr -d '\r' | cut -d' ' -f2)
echo "Location: $LOC"
if [ -n "$LOC" ]; then curl -s -o /dev/null -w "CDN 图: %{http_code} %{size_download}B %{time_total}s\n" --max-time 10 "$LOC" | head -1; fi