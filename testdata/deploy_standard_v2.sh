#!/bin/bash
# 标准部署 v2(根治"简化版"问题): 
# - src.tar 不再含 public(已从 git 移除)
# - 前端构建: web/vite outDir=../public → 输出到 ~/raincough-dev/public (即 Go BaseDir/public)
# - 产物校验: bundle 必须 >1MB, 否则报警
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
echo "=== 1. 解压 src.tar(不含 public) ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 2. 清掉可能残留的旧 public(防旧产物) ==="
rm -rf public
echo "=== 3. Go 编译 ==="
go build -o raincough ./cmd/raincough 2>&1 | head -5 && echo "go ok"
echo "=== 4. 前端构建(outDir ../public = ~/raincough-dev/public) ==="
cd web
node node_modules/vite/bin/vite.js build 2>&1 | tail -3
cd ..
echo "=== 5. 产物校验 ==="
JS=$(cat public/index.html | grep -oE 'assets/index-[^"]+\.js' | head -1)
SIZE=$(stat -c%s "public/$JS" 2>/dev/null || echo 0)
echo "JS: $JS  size: $SIZE"
if [ "$SIZE" -lt 300000 ]; then
  echo "!! 警告: bundle <300KB, 可能是简化版, 部署中止"
  exit 1
fi
echo "OK: bundle $SIZE B = 复用版(旧前端全量)"
echo "=== 6. 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 7. 线上验证 ==="
JS2=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s -o /dev/null -w "线上 bundle: %{size_download}B %{http_code}\n" "http://127.0.0.1:3900/$JS2"
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'