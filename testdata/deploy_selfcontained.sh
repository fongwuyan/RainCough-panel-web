#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
echo "=== 1. 解压 ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 2. Go 编译 ==="
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
echo "=== 3. 前端 build ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -2
cd ..
echo "=== 4. 重建 7 插件前端(Vue 内联自包含) ==="
node tools/build-plugin-frontend.js uptime aigen laizhangsetu vpn docker mcserver JMComic 2>&1 | tail -9
echo "=== 5. 产物自包含校验(含 vue, >100KB) ==="
for pl in uptime aigen docker; do
  SZ=$(stat -c%s plugins/$pl/assets/plugin.js 2>/dev/null || echo 0)
  echo "  $pl: ${SZ}B $( [ "$SZ" -gt 80000 ] && echo '= 自包含(含Vue) OK' || echo '!! 疑似未打包Vue' )"
done
echo "=== 6. 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 7
echo "=== 7. 验证 ==="
curl -s -o /dev/null -w "index %{http_code}\n" http://127.0.0.1:3900/
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'
JS=$(curl -s http://127.0.0.1:3900/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s -o /dev/null -w "main bundle: %{size_download}B\n" "http://127.0.0.1:3900/$JS"