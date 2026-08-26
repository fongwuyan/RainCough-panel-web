#!/bin/bash
echo "=== index.html 内容 ==="
curl -s http://127.0.0.1:3900/ | head -30
echo "=== 引用的 JS/CSS ==="
JS=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
CSS=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.css' | head -1)
echo "JS: $JS  CSS: $CSS"
curl -s -o /dev/null -w "JS %{http_code} %{size_download}B\n" "http://127.0.0.1:3900/$JS"
curl -s -o /dev/null -w "CSS %{http_code} %{size_download}B\n" "http://127.0.0.1:3900/$CSS"