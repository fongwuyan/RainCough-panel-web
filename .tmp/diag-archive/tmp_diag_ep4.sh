#!/bin/bash
echo "=== 清 JMComic 旧缓存(album_cache 含旧 cid 数据) ==="
rm -f ~/raincough-dev/plugins/JMComic/album_cache.json
ls ~/raincough-dev/plugins/JMComic/
echo "=== 重取 album(应新 cid=1460695) ==="
curl -s --max-time 25 http://127.0.0.1:3900/api/plugins/jmcomic/album/1460674 | python3 -c 'import json,sys; chs=json.load(sys.stdin).get("chapters",[]); [print(i, c.get("cid"), c.get("name")) for i,c in enumerate(chs[:3])]'
echo "=== chapter 该 cid + scramble ==="
CID=$(curl -s --max-time 25 http://127.0.0.1:3900/api/plugins/jmcomic/album/1460674 | python3 -c 'import json,sys; chs=json.load(sys.stdin).get("chapters",[]); print(chs[1]["cid"] if len(chs)>1 else (chs[0]["cid"] if chs else ""))' 2>/dev/null)
echo "cid=$CID"
curl -s --max-time 30 "http://127.0.0.1:3900/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("scramble:", d.get("scramble_id"), "pages:", len(d.get("page_arr",[])), "id:", d.get("id"))'