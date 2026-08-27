#!/bin/bash
echo "=== jmapiproxy 是否兼 API(带路径测试) ==="
for d in "cdn-msp.jmapiproxy1.cc" "cdn-msp.jmapiproxy2.cc"; do
  echo "-- $d --"
  curl -s -o /dev/null -w "  /api/comics/search: %{http_code}\n" --max-time 6 "https://$d/api/comics/search?keyword=test"
  curl -s --max-time 6 "https://$d/api/comics/search?keyword=test" | head -c 80
  echo
done
echo "=== 官方 jmcomic 库装一下看默认域 + config 域列表 ==="
pip3 install --user --break-system-packages jmcomic 2>&1 | tail -1
python3 -c "
import jmcomic
from jmcomic import JmOption
opt = JmOption.default()
print('client impl:', opt.client.impl)
print('base url sample:', opt.client.postman.diox)
" 2>&1 | head -6