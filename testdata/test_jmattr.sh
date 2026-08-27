#!/bin/bash
python3 -c "
from jmcomic import JmOption
opt = JmOption.default()
opt.client.impl = 'api'
client = opt.new_jm_client()
detail = client.get_album_detail('1460674')
print('album attrs:', [a for a in dir(detail) if not a.startswith('_')][:40])
" 2>&1 | head -8