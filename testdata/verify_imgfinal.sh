#!/bin/bash
B=http://127.0.0.1:3900
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))' 2>/dev/null)
PAGE=$(curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; a=json.load(sys.stdin).get("page_arr",[]); print(a[0] if a else "")' 2>/dev/null)
echo "cid=$CID page=$PAGE"
echo "--- 首次取图(库下载+解码, 可能 10-30s) ---"
time curl -s --max-time 90 -D /tmp/h2.txt -o /tmp/img2.webp "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE"
grep -iE 'HTTP|Content-Type|Content-Length' /tmp/h2.txt | head -3
echo "--- 文件类型 ---"
file /tmp/img2.webp 2>/dev/null | head -1
echo "--- 大小 ---"
stat -c%s /tmp/img2.webp 2>/dev/null
echo "--- 二次缓存命中(应秒回) ---"
time curl -s -o /dev/null --max-time 8 -w "HTTP %{http_code}\n" "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE" 2>&1 | tail -2