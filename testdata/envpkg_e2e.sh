#!/bin/bash
# envpkg API 验证
cd ~/raincough-dev
pkill -f "raincough -port" 2>/dev/null
sleep 1
export PATH=$HOME/go-tool/go/bin:$PATH
go build -o raincough ./cmd/raincough
export RC_ENV_ROOT=/tmp/envs
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 3
echo "=== recipes ==="
curl -s http://127.0.0.1:3900/api/envpkg/recipes | python3 -c 'import json,sys; d=json.load(sys.stdin); print([r["label"] for r in d["recipes"]])'
echo "=== envs (空) ==="
curl -s http://127.0.0.1:3900/api/envpkg/envs
echo
echo "=== 无效安装参数拒绝 ==="
curl -s -X POST http://127.0.0.1:3900/api/envpkg/install -H "Content-Type: application/json" -d '{}'
echo
echo "=== 服务状态 ==="
ss -tlnp | grep 3900