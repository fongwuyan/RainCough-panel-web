#!/bin/bash
B=http://127.0.0.1:3900
for p in webspy compress dltool filehash imagetool ocrqr texttool aigen docker laizhangsetu mcserver uptime vpn; do
  T=$(timeout 25 firefox --headless --dump-dom "$B/wstest.html?p=$p" 2>/dev/null | grep -oE '<title>[^<]*' | head -1 | sed 's/<title>//')
  echo "$p => $T"
done