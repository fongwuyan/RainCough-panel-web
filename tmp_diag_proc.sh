#!/bin/bash
echo "=== JMComic 子进程 ==="
pgrep -af 'server.py' | grep -i jm | head -3
ps aux | grep -iE 'jmcomic|server.py' | grep -v grep | head -4
echo "=== 监听端口(python) ==="
ss -tlnp 2>/dev/null | grep -i python | head -8