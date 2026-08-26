#!/bin/bash
# 看 Scan 卡在哪: 给 startChild 前的 manifest 打印
# 直接跑主系统, 但先定住: 试手工逐个 startChild 语义
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export RC_DB='mysql://raincough:raincough-local-dev@127.0.0.1:3306/raincough'
# 模拟主系统拉起一个插件: 前台, 看是否阻塞
for P in aigen uptime webspy; do
  echo "=== 测试 $P ==="
  # 主系统会注 RAINCOUGH_PORT(随机), 我们手动挑一个
  rm -rf /tmp/tp && mkdir -p /tmp/tp
  cp -a plugins/$P /tmp/tp/
  timeout 10 env RC_PLUGINS_DIR=/tmp/tp ./raincough -port 3901 2>&1 | head -5
  echo "rc=$?"
  sleep 1
done