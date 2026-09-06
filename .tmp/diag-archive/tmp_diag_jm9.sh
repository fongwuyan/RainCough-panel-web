#!/bin/bash
echo "=== srv.log 行数 ==="
wc -l ~/raincough-dev/srv.log
echo "=== 全部内容(136 lines?) ==="
cat ~/raincough-dev/srv.log | head -45