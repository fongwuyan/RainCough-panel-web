#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
cid = getattr(d,'episode_list',None)[0][0]
photo = client.get_photo_detail(cid)
print('all attrs:', [a for a in dir(photo) if not a.startswith('_')])
print('id=', getattr(photo,'id','?'))
# 尝试常见图片获取方法
for m in ['create_image_detail','get_images','image_list']:
    if hasattr(photo, m):
        try:
            r = getattr(photo, m)()
            print(m, '->', type(r), (len(r) if hasattr(r,'__len__') else ''))
        except Exception as e:
            print(m, 'err', str(e)[:60])
" 2>&1 | grep -vE 'MainThread|api\.' | head -14