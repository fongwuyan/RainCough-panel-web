#!/bin/bash
echo "=== sudoers.d 现状 ==="
ls -la /etc/sudoers.d/ 2>/dev/null
echo "=== raincough 白名单在? ==="
cat /etc/sudoers.d/raincough 2>/dev/null || echo "(缺失!)"
echo "=== 测试 sudo -n ==="
sudo -n -l 2>&1 | head -8 || echo "sudo -n 不可用(需要密码)"