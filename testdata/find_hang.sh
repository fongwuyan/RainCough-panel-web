#!/bin/bash
# 逐个禁用插件找挂起源
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'

# 备份当前插件目录, 逐个测试
ORIG=/tmp/plugins-orig
rm -rf $ORIG && cp -a plugins $ORIG

# 每个插件单独测试是否阻塞(调度器 scan 是同步的)
for PLUG in "$ORIG"/*/; do
  NAME=$(basename "$PLUG")
  # 临时只留一个插件
  rm -rf /tmp/one-plugin && mkdir -p /tmp/one-plugin
  cp -a "$PLUG" /tmp/one-plugin/
  OUT=$(timeout 6 env RC_PLUGINS_DIR=/tmp/one-plugin ./raincough -port 3900 2>&1)
  RC=$?
  STATUS="OK"
  if [ $RC -eq 124 ] || echo "$OUT" | grep -qv '已启动'; then
    # rc 124 = 超时挂起
    if [ $RC -eq 124 ]; then STATUS="HANG"; fi
  fi
  # 有 '已启动' 且 rc!=124 才算正常
  if echo "$OUT" | grep -q '已启动' && [ $RC -eq 0 ]; then STATUS="OK"; fi
  echo "$STATUS  $NAME  rc=$RC"
done