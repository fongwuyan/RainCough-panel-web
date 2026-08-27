#!/bin/bash
echo "=== touchgal plugin.json ==="
cat ~/raincough-dev/plugins/touchgal/plugin.json
echo "=== touchgal .runtime.log ==="
cat ~/raincough-dev/plugins/touchgal/.runtime.log 2>/dev/null | tail -8 || echo "(无)"
echo "=== 手动起 touchgal ==="
cd ~/raincough-dev/plugins/touchgal
RAINCOUGH_PORT=39998 RAINCOUGH_PLUGIN_DIR=$PWD timeout 6 python3 server.py 2>&1 | head -6 &
sleep 4
curl -s --max-time 3 http://127.0.0.1:39998/__health; echo
wait
echo "=== server.py 依赖(可能缺模块) ==="
grep -nE '^import |^from ' ~/raincough-dev/plugins/touchgal/server.py | head -12