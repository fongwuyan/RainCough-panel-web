#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
cid = getattr(d,'episode_list',None)[0][0]
photo = client.get_photo_detail(cid)
pa = getattr(photo,'page_arr',None)
print('pages:', len(pa) if pa else 0)
try:
    u = photo.get_img_data_original(1)
    print('page1 url:', str(u)[:110])
except Exception as e:
    print('err:', str(e)[:160])
" 2>&1 | grep -vE 'MainThread|api\.' | head -6