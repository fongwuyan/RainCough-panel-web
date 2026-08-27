#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
el = getattr(d,'episode_list',None)
print('ep len:', len(el))
for i, ep in enumerate(el[:4]):
    print(f'ep{i}:', repr(ep))
# 验证三个下标哪个能取图
ph0 = ph1 = ph2 = None
try:
    ph0 = client.get_photo_detail(str(ep[0]))
except Exception as e: print('ep[0]=', ep[0], '取图失败:', str(e)[:50])
try:
    ph1 = client.get_photo_detail(str(ep[1]))
except Exception as e: print('ep[1]=', ep[1], '取图失败:', str(e)[:50])
try:
    ph2 = client.get_photo_detail(str(ep[2]))
except Exception as e: print('ep[2]=', ep[2], '取图失败:', str(e)[:50])
for tag, ph in [('ep0',ph0), ('ep1',ph1), ('ep2',ph2)]:
    if ph: print(tag, 'OK id=', ph.photo_id, 'pages=', len(ph.page_arr or []))
" 2>&1 | grep -vE 'MainThread|api\.' | head -14