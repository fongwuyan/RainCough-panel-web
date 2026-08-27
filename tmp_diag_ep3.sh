#!/bin/bash
echo "=== 服务器 JMComic server.py 的 cid 行 ==="
grep -n 'cid = str(ep' ~/raincough-dev/plugins/JMComic/server.py | head -4
echo "=== 服务器 server.py 是否含 do_DELETE(最新) ==="
grep -c 'do_DELETE' ~/raincough-dev/plugins/JMComic/server.py
echo "=== 本地 server.py 对照 ==="
grep -n 'cid = str(ep' /dev/null 2>/dev/null
grep -n 'cid = str(ep\[' E:/jiaob/RainCough-Core/plugins/JMComic/server.py 2>/dev/null | head -4
echo "=== 模拟器拿到的 album chapters[1] ==="
curl -s --max-time 20 http://127.0.0.1:3900/api/plugins/jmcomic/album/1460674 | python3 -c 'import json,sys; chs=json.load(sys.stdin).get("chapters",[]); [print(i, c.get("cid"), c.get("name")) for i,c in enumerate(chs[:3])]'