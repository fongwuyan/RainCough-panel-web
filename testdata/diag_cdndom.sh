#!/bin/bash
echo "=== 各 CDN 域图片直连 ==="
for d in cdn-msp.jmapiproxy1.cc cdn-msp.jmapiproxy2.cc www.cdnhjk.net; do
  echo -n "  $d: "
  R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "https://$d/media/photos/1460674/1" -A "Mozilla/5.0 Chrome/120" -H "Referer: https://18comic.vip/")
  echo "http=$R"
done
echo "=== 官方库完整错误(重试域名列表) ==="
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
cid = getattr(d,'episode_list',None)[0][0]
ph = client.get_photo_detail(cid)
u = str(ph.get_img_data_original(1))
sc = getattr(ph,'scramble_id',None)
try:
    client.download_image(u, '/tmp/dl2.webp', sc, decode_image=True)
    import os; print('OK size', os.path.getsize('/tmp/dl2.webp'))
except Exception as e:
    print('ERR:', str(e)[:300])
" 2>&1 | grep -vE 'MainThread' | head -8