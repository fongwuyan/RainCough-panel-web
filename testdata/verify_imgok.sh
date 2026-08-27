#!/bin/bash
B=http://127.0.0.1:3900
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[0]["cid"] if cs else "")' 2>/dev/null)
echo "cid=$CID"
PAGE=$(curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; a=json.load(sys.stdin).get("page_arr",[]); print(a[0] if a else "")' 2>/dev/null)
echo "page=$PAGE"
echo "--- 面板取图 ---"
time curl -s --max-time 40 -D /tmp/h3.txt -o /tmp/img_ok.webp "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE"
grep -iE 'HTTP|Content-Type' /tmp/h3.txt | head -2
file /tmp/img_ok.webp 2>/dev/null | head -1
stat -c%s /tmp/img_ok.webp 2>/dev/null
echo "--- 缓存命中 ---"
curl -s -o /dev/null -w "2nd: %{http_code} %{time_total}s\n" --max-time 8 "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE"