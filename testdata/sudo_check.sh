#!/bin/bash
echo "=== f 用户 sudo 测试 ==="
echo "" | sudo -S -n -l 2>&1 | head -4
echo "=== sudoers 文件 ==="
ls /etc/sudoers.d/ 2>/dev/null
for f in /etc/sudoers.d/*; do echo "--- $f"; cat "$f" 2>/dev/null | head -8; done
echo "=== 主 sudoers NOPASSWD ==="
grep -E 'NOPASSWD|f ALL' /etc/sudoers 2>/dev/null | head -5
echo "=== 面板存储配置 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/store/settings | python3 -m json.tool 2>/dev/null | head -12