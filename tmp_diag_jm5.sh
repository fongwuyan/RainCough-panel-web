#!/bin/bash
echo "=== JMComic plugin.json 完整 ==="
cat ~/raincough-dev/plugins/JMComic/plugin.json
echo "=== 主系统 host.go 是否忽略某插件启动错误 ==="
grep -rn '启动失败\|已加载\|startErr\|start\b' ~/raincough-dev/internal/host/loader.go 2>/dev/null | head -8
ls ~/raincough-dev/internal/host/*.go | head
echo "=== 手动按主系统方式起 JMComic(2s) ==="
cd ~/raincough-dev/plugins/JMComic
RAINCOUGH_PORT=39001 RAINCOUGH_NS=jmcomic RAINCOUGH_PLUGIN_DIR=$PWD timeout 6 python3 server.py 2>&1 | head -10 &
sleep 4
curl -s --max-time 3 http://127.0.0.1:39001/__health; echo
wait