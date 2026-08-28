#!/bin/bash
# RainCough 一键部署+恢复脚本(持久化): 重启系统后执行此脚本可恢复面板
# 用法: bash ~/rc-persist-deploy.sh [--rebuild]
# --rebuild: 强制重构建前端+插件资产(升级后); 默认仅重启服务
set -e
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export GOTMPDIR=$HOME/gotmp && mkdir -p $HOME/gotmp

echo "=== [1/5] 解压最新源码 ==="
if [ -f src.tar ]; then tar -xf src.tar && rm -f src.tar; fi

echo "=== [2/5] Go 编译二进制 ==="
go build -o raincough ./cmd/raincough 2>&1 | head -3 && echo "go ok"

if [ "$1" = "--rebuild" ]; then
  echo "=== [3/5] 前端 bundle 重建 ==="
  cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -1 && cd ..
  echo "=== [3.5] 插件前端资产重建 ==="
  node tools/build-plugin-frontend.js 2>&1 | tail -3
fi

echo "=== [4/5] 清理旧进程 + 启动 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 >> srv.log 2>&1 &
sleep 12

echo "=== [5/5] 验证 ==="
JS=$(ls public/assets/index-*.js 2>/dev/null | head -1 | xargs basename)
curl -s -o /dev/null -w "bundle: %{http_code} " --max-time 5 "http://127.0.0.1:3900/$JS"
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("plugins alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'
echo "完成。http://局域网IP:3900"