#!/bin/bash
B=http://127.0.0.1:3900
echo "=== JMComic 全契约终验 ==="
echo "-- search(id/name/page_count) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/search?keyword=%E7%99%BD%E4%B8%9D&mode=keyword" | python3 -c 'import json,sys; d=json.load(sys.stdin); it=d.get("items",[{}]); print("  id:",it[0].get("id"),"name:",str(it[0].get("name"))[:20],"page_count:",d.get("page_count"))'
echo "-- meta(author/tags 平铺) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/meta/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  author:",d.get("author"),"tags:",len(d.get("tags",[])))'
echo "-- album(id/likes/views/description/chapters) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); a=d.get("album",{}); print("  id:",a.get("id"),"name:",a.get("name"),"likes:",a.get("likes"),"views:",a.get("views"),"chapters:",len(a.get("chapters",[])))'
echo "-- chapter(page_arr 顶层) --"
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))')
curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  page_arr:",len(d.get("page_arr",[])),"pages")'
echo "-- download(completed/状态) --"
for aid in 1460674 999999; do
  curl -s --max-time 8 "$B/api/plugins/jmcomic/download/$aid" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  aid", sys.argv[1], "status:", d.get("status"))' $aid
done
echo "-- library(cached/total/page_count) --"
curl -s --max-time 8 "$B/api/plugins/jmcomic/library?page=1&page_size=45" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  items:",len(d.get("items",[])),"total:",d.get("total"),"page_count:",d.get("page_count"))'
echo "-- batch 状态机 --"
curl -s --max-time 8 "$B/api/plugins/jmcomic/download/batch" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  running:",d.get("running"),"status:",d.get("status"),"found:",d.get("found"))'
echo "-- config --"
curl -s --max-time 8 "$B/api/plugins/jmcomic/config" | head -c 80
echo
echo "-- 错误契约 --"
curl -s -o /dev/null -w "  album/bad: %{http_code}\n" --max-time 8 "$B/api/plugins/jmcomic/album/xxx"
echo "-- info --"
curl -s --max-time 8 "$B/api/plugins/jmcomic/info" | head -c 100
echo
echo "-- 插件 alive --"
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("  alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'