#!/bin/bash
echo "=== 清旧 photo_cache(无 _v 或旧 cid) ==="
python3 -c "
import json
p='/home/f/raincough-dev/plugins/JMComic/photo_cache.json'
c={}
try: c=json.load(open(p))
except: pass
c2={k:v for k,v in c.items() if v.get('_v')==2}
json.dump(c2, open(p,'w'))
print('kept', len(c2), 'of', len(c))
"
echo "=== 跑用户模拟器最终版 ==="
python3 /tmp/user_sim.py 2>&1 | tail -8