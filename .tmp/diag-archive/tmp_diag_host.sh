#!/bin/bash
echo "=== 重载插件: 只重启 JMComic 观察 ==="
cd ~/raincough-dev
# 当前主系统加载 JMComic 的 manifest entry
echo "entry: python3 server.py, timeout: 40"
echo "=== 手动模拟主系统启动方式(RAINCOUGH_PORT 从哪来?) ==="
grep -n 'RAINCOUGH_PORT\|RAINCOUGH_NS\|RAINCOUGH_PLUGIN_DIR' ~/raincough-dev/internal/host/runtime.go | head -6
echo "=== 看主系统给子进程的 env ==="
grep -n 'env\b\|Env\|RAINCOUGH' ~/raincough-dev/internal/host/child.go | head -10