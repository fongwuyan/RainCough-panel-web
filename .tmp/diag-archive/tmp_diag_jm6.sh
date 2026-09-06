#!/bin/bash
echo "=== srv.log 开头(JMComic 加载时机) ==="
head -25 ~/raincough-dev/srv.log
echo "=== srv.log 含 error/fail 全行 ==="
grep -a -iE 'error|fail|超时|timeout|kill|退出' ~/raincough-dev/srv.log | head -10