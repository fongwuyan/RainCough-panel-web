#!/bin/bash
echo "=== 找浏览器 ==="
for b in chromium chromium-browser google-chrome google-chrome-stable firefox; do
  which $b 2>/dev/null && echo "found: $b"
done
ls /usr/bin/ | grep -iE 'chrom|firefox' | head -5
echo "=== node 有 puppeteer/playwright? ==="
ls ~/raincough-dev/web/node_modules/ 2>/dev/null | grep -iE 'puppeteer|playwright' | head -3
echo "=== 服务状态 ==="
curl -s --max-time 4 http://127.0.0.1:3900/ | head -c 60