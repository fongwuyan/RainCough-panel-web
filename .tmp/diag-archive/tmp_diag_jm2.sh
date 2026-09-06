#!/bin/bash
echo "=== srv.log JMComic 相关(含错误) ==="
grep -a -i -B2 -A4 'jmcomic' ~/raincough-dev/srv.log | tail -30