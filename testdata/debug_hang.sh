#!/bin/bash
# 杀光, 用空插件目录启动定位挂起源
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
echo "=== 空插件目录 + MySQL 启动 ==="
mkdir -p /tmp/empty-plugins
timeout 8 env RC_PLUGINS_DIR=/tmp/empty-plugins ./raincough -port 3900 2>&1 | head -10
echo "rc=$?"
echo "=== SQLite 模式空插件对照 ==="
timeout 8 env RC_PLUGINS_DIR=/tmp/empty-plugins RC_DB=sqlite:////tmp/t1.db ./raincough -port 3900 2>&1 | head -5
echo "rc2=$?"
echo "=== MySQL 模式带插件(开路 12s) ==="
timeout 12 ./raincough -port 3900 2>&1 | head -15
echo "rc3=$?"