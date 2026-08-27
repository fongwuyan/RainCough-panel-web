#!/bin/bash
echo "=== 每个 python 进程的工作目录(cwd) ==="
for pid in $(pgrep -f 'python3 server.py'); do
  CWD=$(readlink /proc/$pid/cwd 2>/dev/null)
  echo "pid $pid -> $CWD"
done
echo "=== srv.log 最近插件启动(找 JMComic 端口) ==="
grep -a 'JMComic\|jmcomic' ~/raincough-dev/srv.log | tail -6