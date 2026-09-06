#!/bin/bash
echo "=== 日志全部 已加载/失败 行 ==="
grep -aE '已加载|加载失败|启动失败|上限|未拉起' ~/raincough-dev/srv.log | head -40
echo "=== 插件目录 ==="
ls ~/raincough-dev/plugins/ | sort
echo "=== maxChild 默认 ==="
grep -rn 'PluginMaxChildren\|MaxChildren' ~/raincough-dev/cmd/raincough/main.go | head -4