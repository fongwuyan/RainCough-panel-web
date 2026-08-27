#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
el = getattr(d,'episode_list',None)
print('type:', type(el))
for item in el[:3]:
    print('item:', repr(item) if not isinstance(item,(list,tuple)) else f'len={len(item)}')
    if isinstance(item,(list,tuple)) and len(item)>=2:
        print('  [0]=', repr(item[0]), ' [1]=', repr(item[1]))
" 2>&1 | grep -vE 'MainThread|api\.' | head -12