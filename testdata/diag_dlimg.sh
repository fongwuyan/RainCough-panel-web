#!/bin/bash
B=http://127.0.0.1:3900
CID=$(curl -s --max-time 20 "$B/api/plugins/jmcomic/album/1460674" | python3 -c 'import json,sys; cs=json.load(sys.stdin).get("album",{}).get("chapters",[]); print(cs[1]["cid"] if len(cs)>1 else (cs[0]["cid"] if cs else ""))' 2>/dev/null)
echo "=== 错误响应体 ==="
curl -s --max-time 60 "$B/api/plugins/jmcomic/image/1460674/$CID/1" | head -c 300
echo
echo "=== 子进程 stderr(srv.log 含插件输出?) ==="
tail -6 ~/raincough-dev/srv.log
echo "=== 直接 python 测 download_image ==="
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
cid = getattr(d,'episode_list',None)[0][0]
ph = client.get_photo_detail(cid)
u = str(ph.get_img_data_original(1))
sc = getattr(ph, 'scramble_id', None)
print('url:', u)
print('scramble:', sc)
try:
    client.download_image(u, '/tmp/dl_test.webp', sc, decode_image=True)
    import os
    print('save ok size:', os.path.getsize('/tmp/dl_test.webp'))
except Exception as e:
    print('dl err:', str(e)[:120])
" 2>&1 | grep -vE 'MainThread|api\.' | head -12