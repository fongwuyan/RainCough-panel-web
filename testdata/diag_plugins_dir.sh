#!/bin/bash
echo "=== 宿主 plugins 目录 ==="
ls ~/raincough-dev/plugins/ | sort | tr '\n' ' '
echo
echo "=== 各插件 server.py 存在性 ==="
for d in $(ls -d ~/raincough-dev/plugins/*/); do
  n=$(basename $d)
  [ -f "$d/server.py" ] && echo "  $n: server.py OK" || echo "  $n: ❌ 无 server.py"
done