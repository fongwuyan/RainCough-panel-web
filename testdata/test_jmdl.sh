#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
# 找下载图片的方法
methods = [m for m in dir(client) if 'image' in m.lower() or 'download' in m.lower() or 'photo' in m.lower()]
print('client image/download methods:', methods)
" 2>&1 | grep -vE 'MainThread|api\.' | head -6
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
cid = getattr(d,'episode_list',None)[0][0]
photo = client.get_photo_detail(cid)
# 试试 download_image 直接取一张
import inspect
for m in ['download_image','download_photo']:
    if hasattr(photo,m) or hasattr(client,m):
        fn = getattr(client,m) if hasattr(client,m) else getattr(photo,m)
        try:
            print(m, 'sig:', str(inspect.signature(fn))[:80])
        except Exception as e:
            print(m, 'no sig', e)
" 2>&1 | grep -vE 'MainThread|api\.' | head -6