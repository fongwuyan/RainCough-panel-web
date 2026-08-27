#!/bin/bash
echo "=== 直接测 proxy_image 需要的图(带UA/Referer) ==="
U="https://cdn-msp.jmapiproxy1.cc/media/photos/1460695/1"
curl -s --max-time 25 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" -H "Referer: https://18comic.vip/" -o /tmp/t1.webp -w "HTTP %{http_code} size=%{size_download} type=%{content_type}\n" "$U"
file /tmp/t1.webp 2>/dev/null | head -1
head -c 6 /tmp/t1.webp | od -An -c | head -1