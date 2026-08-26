#!/bin/bash
# 验证 aigen/mcskin
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 7
echo "=== 插件列表 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"])); [print(" ", p["name"], p["alive"]) for p in ps if p["name"] in ("aigen","mcskin")]'
echo "=== 1. aigen: models ==="
curl -s http://127.0.0.1:3900/api/plugins/aigen/models | python3 -m json.tool
echo "=== 2. mcskin: health(pillow?) ==="
curl -s http://127.0.0.1:3900/api/plugins/mcskin/__health | python3 -m json.tool
echo "=== 3. mcskin: detect(1x1 png) ==="
# 生成 1x1 PNG base64
PX=$(python3 -c "import base64,io; from PIL import Image; b=io.BytesIO(); Image.new('RGB',(1,1),(255,0,0)).save(b,'PNG'); print(base64.b64encode(b.getvalue()).decode())")
curl -s -X POST http://127.0.0.1:3900/api/plugins/mcskin/detect \
  -H "Content-Type: application/json" -d "{\"image\":\"$PX\"}" | python3 -m json.tool
echo "=== 4. mcskin: convert ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/mcskin/convert \
  -H "Content-Type: application/json" -d "{\"image\":\"$PX\"}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:", d.get("ok"), "size:", d.get("size"), "skin_b64_len:", len(d.get("skin_b64","")))'