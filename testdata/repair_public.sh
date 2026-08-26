#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 当前 public 状态 ==="
ls -la public/ 2>/dev/null || echo "public 缺失!"
echo "=== 重新构建(输出 mysql ../public = ~/raincough-dev/public) ==="
cd web
node node_modules/vite/bin/vite.js build 2>&1 | tail -3
cd ..
echo "=== 构建后 public ==="
ls -la public/assets/ 2>/dev/null | head -4
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 验证 ==="
JS=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
echo "JS: $JS"
curl -s -o /dev/null -w "bundle %{size_download}B %{http_code}\n" "http://127.0.0.1:3900/$JS"
echo "=== python_version 修复验证 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("python_version:", d.get("python_version"), "| go_version:", d.get("go_version"))'