#!/bin/bash
# 完整部署: Go 构建 + 插件前端构建 + 启动 + 验证
set -e
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH

echo "=== 1. 解压源码 ==="
rm -rf cmd internal core.go.tmp 2>/dev/null || true
tar -xf src.tar
rm -f src.tar
ls cmd/raincough/*.go | wc -l

echo "=== 2. 构建 Go 二进制 ==="
go build -o raincough ./cmd/raincough 2>&1
echo "build ok"

echo "=== 3. 构建插件前端(uptime) ==="
node - <<'EOF' 2>&1 | tail -2
const path=require('path'),fs=require('fs')
const esbuild=require(path.join(process.env.HOME,'raincough-dev','web-shim','node_modules','esbuild'))
if (fs.existsSync('plugins/uptime/frontend/plugin.js')) {
  esbuild.build({entryPoints:['plugins/uptime/frontend/plugin.js'],outfile:'plugins/uptime/assets/plugin.js',bundle:true,format:'iife',external:['vue']}).then(()=>console.log('frontend ok'))
}
EOF

echo "=== 4. 启动 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
pkill -9 -f 'server.py' 2>/dev/null
rm -f ~/raincough-dev/data/*.db 2>/dev/null || true
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8

echo "=== 5. 验证 ==="
echo "--- 插件 ---"
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'
echo "--- 系统中心 ---"
curl -s --max-time 8 http://127.0.0.1:3900/api/sysfunc/service/list | python3 -c 'import json,sys; d=json.load(sys.stdin); print("services:", len(d.get("services",[])))'
echo "--- 系统监控 ---"
curl -s --max-time 8 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("host:", d.get("hostname"), "cpu:", d.get("cpu_count"), "mem%:", round(d.get("memory_percent",0),1))'
echo "--- 前端 ---"
curl -s --max-time 8 http://127.0.0.1:3900/ | grep -o '<title>.*</title>'
echo "--- uptime assets ---"
curl -s --max-time 8 -o /dev/null -w "plugin.js HTTP %{http_code}\n" http://127.0.0.1:3900/api/plugins/uptime/assets/plugin.js