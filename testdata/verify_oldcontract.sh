#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 旧契约全量验证(顶层直读) ==="
echo "-- album(顶层 id/name/chapters/authors/page_count) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  id:",d.get("id"),"| name:",d.get("name"),"| chapters:",len(d.get("chapters",[])),"| authors:",d.get("authors"),"| page_count:",d.get("page_count"),"| err:",d.get("error",""))'
echo "-- chapter(顶层 id/page_arr/total/scramble_id) --"
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))')
echo "  cid=$CID"
curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  id:",d.get("id"),"| page_arr:",len(d.get("page_arr",[])),"| total:",d.get("total"),"| scramble:",str(d.get("scramble_id"))[:8],"| err:",d.get("error",""))'
echo "-- meta(平铺) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/meta/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  author:",d.get("author"),"| tags:",len(d.get("tags",[])))'
echo "-- cover(真实图片?) --"
curl -s --max-time 40 -D /tmp/hc.txt -o /tmp/cover_test "$B/api/plugins/jmcomic/cover/1460674"
grep -iE 'HTTP|Content-Type' /tmp/hc.txt | head -2
file /tmp/cover_test 2>/dev/null | head -1
stat -c%s /tmp/cover_test 2>/dev/null
echo "-- image 仍通 --"
curl -s -o /dev/null -w "  image: %{http_code}\n" --max-time 40 "$B/api/plugins/jmcomic/image/1460674/$CID/$(curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; a=json.load(sys.stdin).get("page_arr",[]); print(a[0] if a else "")' )"