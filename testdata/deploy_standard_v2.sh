#!/bin/bash
# RainCough 标准部署(带产物校验)
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
echo "=== 1. 解压 ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 2. Go 编译 ==="
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
echo "=== 3. 前端构建 ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -1
cd ..
echo "=== 4. 产物校验 ==="
JS=$(ls public/assets/index-*.js | head -1 | xargs basename)
SZ=$(stat -c%s "public/assets/$JS")
echo "JS: $JS size: $SZ"
if [ "$SZ" -lt 300000 ]; then echo "!! bundle 过小, 疑似简化版, 中止"; exit 1; fi
echo "OK: bundle $SZ B = 复用版"
echo "=== 5. 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 10
echo "=== 6. 线上验证 ==="
JS2=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s -o /dev/null -w "bundle: %{size_download}B %{http_code}\n" "http://127.0.0.1:3900/$JS2"
curl -s --max-time 6 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", len(ps), "alive:", sum(1 for p in ps if p.get("alive")))'