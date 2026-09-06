#!/bin/bash
echo "=== JMComic 目录 ==="
ls ~/raincough-dev/plugins/JMComic/ | head
echo "=== server.py 是否最新(含 decode_jm_image) ==="
grep -c 'decode_jm_image\|DownloadManager' ~/raincough-dev/plugins/JMComic/server.py
echo "=== 手动跑 JMComic server(10s 看是否起来) ==="
cd ~/raincough-dev/plugins/JMComic
RAINCOUGH_PORT=39999 timeout 8 python3 server.py 2>&1 | head -6 &
sleep 5
curl -s --max-time 3 http://127.0.0.1:39999/__health | head -c 80
echo
wait