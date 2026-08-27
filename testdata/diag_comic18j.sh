#!/bin/bash
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
print('URL:', u)
import urllib.request
req = urllib.request.Request(u, headers={'User-Agent':'Mozilla/5.0 Chrome/120','Referer':'https://18comic.vip/'})
try:
    r = urllib.request.urlopen(req, timeout=15)
    data = r.read()
    print('direct OK size:', len(data), 'ctype:', r.headers.get('Content-Type'))
except Exception as e:
    print('direct err:', type(e).__name__, str(e)[:150])
" 2>&1 | grep -vE 'MainThread|api\.' | head -8