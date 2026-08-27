#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 完整复用后端全链路验证 ==="
echo "-- health/search --"
curl -s --max-time 5 $B/api/plugins/jmcomic/__health
echo
curl -s --max-time 20 "$B/api/plugins/jmcomic/search?keyword=%E7%99%BD%E4%B8%9D" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("search items:",len(d.get("items",[])),"page_count:",d.get("page_count"))'
echo "-- album(缓存6h+顶层) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("album:",d.get("name"),"chapters:",len(d.get("chapters",[])),"authors:",d.get("authors"))'
echo "-- chapter(scramble_id) --"
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("chapters",[]); print(cs[0]["cid"] if cs else "")')
echo "cid=$CID"
curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("chapter: id",d.get("id"),"pages",len(d.get("page_arr",[])),"scramble",str(d.get("scramble_id"))[:6])'
echo "-- image(下载+decode) --"
PAGE=$(curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; a=json.load(sys.stdin).get("page_arr",[]); print(a[0] if a else "")')
curl -s --max-time 50 -D /tmp/hi.txt -o /tmp/img_d.webp "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE"
grep -iE 'HTTP|Content-Type' /tmp/hi.txt | head -2
file /tmp/img_d.webp 2>/dev/null | head -1
stat -c%s /tmp/img_d.webp 2>/dev/null
echo "-- cover --"
curl -s --max-time 50 -D /tmp/hc.txt -o /tmp/cv.webp "$B/api/plugins/jmcomic/cover/1460674"
grep -iE 'HTTP|Content-Type' /tmp/hc.txt | head -2
file /tmp/cv.webp 2>/dev/null | head -1
echo "-- library --"
curl -s --max-time 10 "$B/api/plugins/jmcomic/library" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("library items:",len(d.get("items",[])),"total:",d.get("total"))'
echo "-- config --"
curl -s --max-time 10 "$B/api/plugins/jmcomic/config" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("cfg paths:",d.get("storage_paths"))'
echo "-- 插件 --"
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:",sum(1 for p in ps if p["alive"]),"/",len(ps))'