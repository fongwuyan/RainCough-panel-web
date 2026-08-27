#!/bin/bash
echo "=== raincough-dev 内容 ==="
ls -la ~/raincough-dev/ 2>/dev/null
echo "=== raincough-test(另一备份?) ==="
ls ~/raincough-test/ 2>/dev/null | head
echo "=== find plugin.json(全home) ==="
find ~ -maxdepth 5 -name 'plugin.json' 2>/dev/null | head -8
echo "=== 面板 srv.log 最后 ==="
tail -3 ~/raincough-dev/srv.log 2>/dev/null