#!/bin/bash
B=http://127.0.0.1:3900
echo "=== JMComic 全链路(旧面板契约) ==="
echo "-- 1. 搜索 --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/search?keyword=%E7%99%BD%E4%B8%9D" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:",d.get("ok"),"items:",len(d.get("items",[])),"| 样例:",d.get("items",[{}])[0].get("title") if d.get("items") else "-")'
echo "-- 2. 专辑(旧契约 chapters) --"
AB=$(curl -s --max-time 25 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); a=d.get("album",{}); print(a.get("name"), "| chapters:", len(a.get("chapters",[])), "| err:", d.get("error",""))' 2>/dev/null)
echo "$AB"
echo "-- 3. 章节图(real cid) --"
CH=$(curl -s --max-time 25 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); cs=d.get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))' 2>/dev/null)
echo "  cid=$CH"
curl -s --max-time 30 "$B/api/plugins/jmcomic/chapter/1460674/$CH" | python3 -c 'import json,sys; d=json.load(sys.stdin); c=d.get("chapter",{}); print("  images:",len(c.get("urls",[])),"| sample:",(c.get("urls",[""])[0])[:70], "| err:", d.get("error",""))'
echo "-- 4. 插件 alive --"
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("  alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'