#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
el = getattr(d,'episode_list',None)
cid = el[0][0] if el else ''
print('cid=', cid)
# 拉章节图
photo = client.get_photo_detail(cid)
print('photo attrs:', [a for a in dir(photo) if 'image' in a.lower() or a=='id'][:10])
urls = getattr(photo,'image_urls',None) or getattr(photo,'images',None) or []
print('images:', len(urls))
print('sample:', (urls[0] if urls else '')[:80])
" 2>&1 | grep -vE 'MainThread|api\.' | head -10