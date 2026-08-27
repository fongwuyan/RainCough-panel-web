#!/bin/bash
echo "=== 检查 JMComic photo_cache.json(可能旧条目污染) ==="
python3 -c "
import json
try:
    c = json.load(open('/home/f/raincough-dev/plugins/JMComic/photo_cache.json'))
    for k, v in list(c.items())[:3]:
        print(k, '-> keys:', list(v.keys()), '| scramble:', v.get('scramble_id'))
except Exception as e:
    print('err', e)
"
echo "=== 该章节直连子进程 chapter 看 scramble ==="
CID=$(curl -s --max-time 20 http://127.0.0.1:3900/api/plugins/jmcomic/album/1460674 | python3 -c 'import json,sys; chs=json.load(sys.stdin).get("chapters",[]); print(chs[1]["cid"] if len(chs)>1 else (chs[0]["cid"] if chs else ""))' 2>/dev/null)
echo "cid=$CID"
PORT=$(ss -tlnp 2>/dev/null | grep -i python | grep -oE '127.0.0.1:[0-9]+' | head -1 | cut -d: -f2)
echo "直接对子进程(猜端口 38477 等):"
for P in 38477 $(pgrep -f 'plugins/JMComic' >/dev/null && echo 0); do :; done
# 用网关即可
curl -s --max-time 30 "http://127.0.0.1:3900/api/plugins/jmcomic/chapter/1460674/$CID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("scramble:", d.get("scramble_id"), "| pages:", len(d.get("page_arr",[])))'