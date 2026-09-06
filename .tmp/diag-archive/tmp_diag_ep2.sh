#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
el = getattr(d, 'episode_list', None)
print('ep len:', len(el))
for i, ep in enumerate(el[:3]):
    print('ep%d:' % i, repr(ep))
# 关键: 各下标取图
for tag in ['ep0', 'ep1', 'ep2']:
    item = el[1]  # 第二章节
    val = item[0] if tag == 'ep0' else (item[1] if tag == 'ep1' else item[2])
    try:
        ph = client.get_photo_detail(str(val))
        print(tag, 'val=', val, '-> id', ph.photo_id, 'pages', len(ph.page_arr or []))
    except Exception as e:
        print(tag, 'val=', val, '-> FAIL', str(e)[:60])
" 2>&1 | grep -vE 'MainThread|api\.' | head -14