#!/bin/bash
echo "=== 日志里出现过的插件名 ==="
grep -aoE '已加载: [a-z0-9-]+' ~/raincough-dev/srv.log | sort -u
echo "=== plugins/ 目录全部 ==="
ls -d ~/raincough-dev/plugins/*/ | xargs -n1 basename | sort
echo "=== 达到上限日志? ==="
grep -a '上限\|未拉起' ~/raincough-dev/srv.log
echo "=== maxChild 配置 ==="
grep -rn 'maxChild\|MaxChild\|max-child' ~/raincough-dev/cmd/raincough/*.go ~/raincough-dev/internal/host/*.go | grep -v _test | head -6