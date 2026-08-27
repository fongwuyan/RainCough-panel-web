#!/bin/bash
B=http://127.0.0.1:3900
CID="1460695"
PAGE="00001.webp"
echo "=== image 502 排查: 连续 3 次 ==="
for i in 1 2 3; do
  R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 45 "$B/api/plugins/jmcomic/image/1460674/$CID/$PAGE")
  echo "  try$i: $R"
done
echo "=== 缓存已落盘? ==="
ls ~/raincough-dev/plugins/JMComic/downloads/1460674/1460695/ 2>/dev/null | head -4
echo "=== 子进程 stderr(srv.log) ==="
grep -a 'jmcomic\|Traceback\|Error' ~/raincough-dev/srv.log | tail -5