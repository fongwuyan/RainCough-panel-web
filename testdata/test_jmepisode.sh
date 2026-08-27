#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
el = getattr(d,'episode_list',None)
print('episode_list len:', len(el) if el else 0)
if el:
    e = el[0]
    print('episode attrs:', [a for a in dir(e) if not a.startswith('_')][:30])
    print('id=', getattr(e,'id','?'), 'title=', getattr(e,'title','?'), 'index=', getattr(e,'index','?'))
" 2>&1 | grep -vE 'MainThread|api\.' | head -8