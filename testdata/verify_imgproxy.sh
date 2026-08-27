#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 图片代理验证(阅读器核心) ==="
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))' 2>/dev/null)
PAGE=$(curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; a=json.load(sys.stdin).get("page_arr",[]); print(a[0] if a else "")' 2>/dev/null)
echo "cid=$CID page=$PAGE"
echo "--- 代理取图 ---"
curl -s --max-time 40 -D /tmp/h.txt -o /tmp/img_test.webp "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE"
grep -iE 'HTTP|Content-Type|Content-Length' /tmp/h.txt | head -4
echo "--- 文件类型 ---"
file /tmp/img_test.webp 2>/dev/null | head -1
head -c 4 /tmp/img_test.webp | xxd | head -1
echo "--- 大小 ---"
stat -c%s /tmp/img_test.webp 2>/dev/null
echo "--- 二次命中缓存(cache-control) ---"
curl -s -D - -o /dev/null --max-time 8 "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE" | grep -iE 'HTTP|Cache-Control' | head -2