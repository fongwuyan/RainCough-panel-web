#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
B=http://127.0.0.1:3900
echo "=== JMComic 旧契约全链路 ==="
echo "-- 搜索结果(白丝) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/search?keyword=%E7%99%BD%E4%B8%9D" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:",d.get("ok"),"items:",len(d.get("items",[])),"err:",d.get("error",""))' 2>&1 | head -3
echo "-- 专辑 album(旧契约 name/chapters) --"
curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); a=d.get("album",{}); print("name:",a.get("name"),"| chapters:",len(a.get("chapters",[])),"| err:",d.get("error",""))' 2>&1 | head -3
echo "-- 章节图片(取真实cid) --"
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; d=json.load(sys.stdin); ch=d.get("album",{}).get("chapters",[]); print(ch[0]["cid"] if ch else "")' 2>/dev/null)
echo "CID=$CID"
curl -s --max-time 20 "$B/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; d=json.load(sys.stdin); c=d.get("chapter",{}); print("cid:",c.get("cid"),"| images:",len(c.get("urls",[])),"| err:",d.get("error",""))' 2>&1 | head -3
echo "-- 插件 alive --"
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'