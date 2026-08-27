#!/bin/bash
echo "=== 全部 python 进程(含非 server.py) ==="
ps aux | grep -iE 'python|jmcomic' | grep -v grep | awk '{print $2, $11, $12, $13, $14}'
echo "=== JMComic 目录 .runtime.log 修改时间 ==="
ls -la ~/raincough-dev/plugins/JMComic/.runtime.log 2>/dev/null
echo "=== 现在进程里有 JMComic?(直接 lsof 端口) ==="
ss -tlnp 2>/dev/null | grep -iE 'python' | head -20