#!/bin/bash
echo "=== jmcomic 官方库直接搜索验证(旧插件同款) ==="
python3 -c "
from jmcomic import JmOption
opt = JmOption.default()
client = opt.new_client()
try:
    r = client.search_site(search_query='白丝', page=1)
    ls = list(r) if r else []
    print('搜索 OK, 结果条数:', len(ls))
    for it in ls[:2]:
        print('  标题:', getattr(it, 'title', '?'), '| aid:', getattr(it, 'album_id', '?'))
except Exception as e:
    print('搜索失败:', type(e).__name__, str(e)[:120])
" 2>&1 | head -10