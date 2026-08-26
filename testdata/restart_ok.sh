#!/bin/bash
cd ~/raincough-dev
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 服务当前渲染 ==="
curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.(js|css)'
JS=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s -o /dev/null -w "bundle %{size_download}B %{http_code}\n" "http://127.0.0.1:3900/$JS"
echo "=== 插件/系统 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'
echo "=== 断言: JS >1MB = 复用版(≥107组件), <300KB = 简化版 ==="