#!/bin/bash
echo "=== 官方 jmcomic 库连接测试 ==="
python3 -c "
from jmcomic import JmOption
opt = JmOption.default()
print('impl:', opt.client.impl)
# 库内部连接配置
import jmcomic
from jmcomic.jm_conn import JmApi
print('api class:', JmApi)
" 2>&1 | head -6
echo "=== 直接搜索测试 ==="
python3 -c "
from jmcomic import JmOption
opt = JmOption.default()
client = opt.new_client()
try:
    r = client.search_site(search_query='白丝', page=1)
    print('搜索返回:', type(r), '条数:', len(r) if r else 0)
except Exception as e:
    print('搜索失败:', e)
" 2>&1 | head -8