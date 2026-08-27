#!/bin/bash
B="https://api.jmcomic.win"
echo "=== 探测 api.jmcomic.win 的 API 结构 ==="
echo "-- 根路径/重定向 --"
curl -s -o /dev/null -w "  / -> %{http_code} loc=%{redirect_url}\n" --max-time 6 "$B/"
echo "-- /api/comics/search --"
curl -s --max-time 10 "$B/api/comics/search?keyword=test&page=1" | head -c 200
echo
echo "-- /api/comic/1/meta --"
curl -s --max-time 8 "$B/api/comic/1/meta" | head -c 150
echo
echo "-- /health 或 /ping 式端点 --"
curl -s -o /dev/null -w "  /api/comic/1/album?page=1 -> %{http_code}\n" --max-time 8 "$B/api/comic/1/album?page=1"