#!/bin/bash
cd ~/raincough-dev
echo "=== 检查 PluginView 源码是否新版 ==="
grep -c '回退: 有内置组件' web/src/components/PluginView.vue 2>/dev/null || echo "0(旧版!)"
echo "=== 未解压则解压 ==="
ls src.tar 2>/dev/null && { tar -xf src.tar && rm -f src.tar && echo "已解压"; } || echo "无 tar"
grep -c '回退: 有内置组件' web/src/components/PluginView.vue 2>/dev/null
echo "=== 重建 ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -2
cd ..
JS=$(ls public/assets/index-*.js | head -1 | xargs basename)
echo "bundle: $JS"
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'