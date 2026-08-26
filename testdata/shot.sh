#!/bin/bash
# 用宿主机 Firefox headless 逐路由截图, 复现白屏
mkdir -p /tmp/shots
cd /tmp/shots
for page in "" "syscenter" "filemanager"; do
  url="http://127.0.0.1:3900/#/$page"
  name="${page:-home}"
  timeout 30 firefox --headless --screenshot "/tmp/shots/$name.png" --window-size=1400,900 "$url" 2>/dev/null
  echo "$name -> $(ls -la /tmp/shots/$name.png 2>/dev/null | awk '{print $5}' || echo MISSING)"
done
ls -la /tmp/shots/