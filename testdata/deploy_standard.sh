#!/bin/bash
# 标准部署: 编译 Go + 构建前端 + 复制到 BaseDir/public + 重启
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== Go build ==="
go build -o raincough ./cmd/raincough 2>&1 | head -5 && echo "go ok"
echo "=== 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -3
echo "=== 复制到 Go 服务目录 (BaseDir/public) ==="
rm -rf ../public
mkdir -p ../public
cp -r dist ../public/ 2>/dev/null || cp -r public ../public/ 2>/dev/null || true
# vite outDir=../public 已直接输出到 web/../public, 但目标应为 ~/raincough-dev/public
ls -la ../public/ | head -5
echo "--- 确认新 bundle ---"
ls ../public/assets/ | head -4
echo "=== 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
cd ..
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 验证: 服务实际渲染的 JS ==="
curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.(js|css)'
echo "=== bundle 大小(复用版应 >1MB) ==="
JS=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s -o /dev/null -w "JS: %{size_download}B %{http_code}\n" "http://127.0.0.1:3900/$JS"