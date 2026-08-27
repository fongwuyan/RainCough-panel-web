#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 确认宿主已装 jmcomic 库 ==="
python3 -c "import jmcomic; print('jmcomic', jmcomic.__version__)" 2>&1 | head -1
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
B=http://127.0.0.1:3900
echo "=== JMComic 搜索(官方库) ==="
curl -s --max-time 20 "$B/api/plugins/JMComic/search?keyword=%E7%99%BD%E4%B8%9D" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:", d.get("ok"), "| items:", len(d.get("items",[])), "| err:", d.get("error","")); [print("  -", it["title"][:30], "aid:", it["aid"]) for it in d.get("items",[])[:3]]' 2>&1
echo "=== meta ==="
curl -s --max-time 15 "$B/api/plugins/JMComic/meta/1" | head -c 150
echo
echo "=== 插件 alive ==="
curl -s --max-time 5 $B/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p["alive"]), "/", len(ps))'