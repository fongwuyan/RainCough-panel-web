#!/bin/bash
echo "=== jmcomic 是否支持 curl_cffi(浏览器指纹, 绕CF) ==="
python3 -c "
import jmcomic
print('version:', jmcomic.__version__)
# 查 impl/client 配置项
from jmcomic import JmOption
opt = JmOption.default()
print('impl:', opt.client.impl)
print('client type:', type(opt.client))
# impl 可选项
print('postman:', type(opt.client.postman))
" 2>&1 | grep -vE 'MainThread|api\.' | head -8
echo "=== jmcomic 源码里 curl_cffi 引用 ==="
grep -rE 'curl_cffi|curl-cffi' ~/.local/lib/python3.11/site-packages/jmcomic/ 2>/dev/null | head -5
echo "=== 可用 impl 值 ==="
grep -rE "client.impl|impl\s*=|'api'|'html'|'cli'" ~/.local/lib/python3.11/site-packages/jmcomic/jm_client_impl.py 2>/dev/null | head -10