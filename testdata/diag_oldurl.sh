#!/bin/bash
echo "=== 旧形态 URL 测试(CDN/media/photos/cid/page_arr元素) ==="
for p in "00001.webp" "1" "0100.webp"; do
  for d in cdn-msp.jmapiproxy1.cc cdn-msp.jmapiproxy2.cc; do
    R=$(curl -s -o /dev/null -w "%{http_code} %{size_download}B" --max-time 10 "https://$d/media/photos/1460674/$p" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Referer: https://18comic.vip/")
    echo "  $d / $p: $R"
  done
done
echo "=== 旧插件实际获取的 page_arr(正确文件名) ==="
python3 -c "
from jmcomic import JmOption
opt = JmOption.default(); opt.client.impl='api'
client = opt.new_jm_client()
d = client.get_album_detail('1460674')
cid = getattr(d,'episode_list',None)[0][0]
ph = client.get_photo_detail(cid)
pa = getattr(ph,'page_arr',None)
print('cid:', cid)
print('page_arr 头部:', list(pa[:3]) if pa else None)
" 2>&1 | grep -vE 'MainThread|api\.' | head -6