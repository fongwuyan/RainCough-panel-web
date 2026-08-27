#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 对齐验证(旧前端字段) ==="
echo "-- search: items[].id/name + page_count --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/search?keyword=%E7%99%BD%E4%B8%9D" | python3 -c 'import json,sys; d=json.load(sys.stdin); it=d.get("items",[{}]); print("  id:",it[0].get("id"),"| name:",str(it[0].get("name"))[:25],"| page_count:",d.get("page_count"))'
echo "-- meta: 平铺 author/tags --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/meta/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  id:",d.get("id"),"| author:",str(d.get("author"))[:20],"| tags:",len(d.get("tags",[])))'
echo "-- album: name/id/chapters --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); a=d.get("album",{}); print("  name:",a.get("name"),"| id:",a.get("id"),"| chapters:",len(a.get("chapters",[])),"| ch0:",a.get("chapters",[{}])[0] if a.get("chapters") else "-")'
echo "-- chapter: 顶层 page_arr --"
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))')
echo "  cid=$CID"
curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  page_arr:",len(d.get("page_arr",[])),"| 首:",(d.get("page_arr",["-"])[0]),"| ok:",d.get("ok"),"| err:",d.get("error",""))'