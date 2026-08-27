#!/bin/bash
echo "=== jm_config.py curl_cffi 配置上下文 ==="
grep -B3 -A8 "curl_cffi" ~/.local/lib/python3.11/site-packages/jmcomic/jm_config.py 2>/dev/null | head -30
echo "=== 能否用 html impl + curl_cffi 取图 ==="
python3 -c "
from jmcomic import JmOption
opt = JmOption.default()
opt.client.impl = 'html'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
cid = getattr(d,'episode_list',None)[0][0]
ph = client.get_photo_detail(cid)
u = str(ph.get_img_data_original(1))
sc = getattr(ph,'scramble_id',None)
print('url:', u)
try:
    client.download_image(u, '/tmp/dl_html.webp', sc, decode_image=True)
    import os
    print('HTML-IMPL OK size:', os.path.getsize('/tmp/dl_html.webp'))
except Exception as e:
    print('html impl err:', str(e)[:250])
" 2>&1 | grep -vE 'MainThread' | head -12