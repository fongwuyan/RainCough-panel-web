#!/bin/bash
echo "=== sudoers.d 权限 ==="
ls -la /etc/sudoers.d/
echo "=== sudoers 根文件 ==="
ls -la /etc/sudoers
echo "=== sudo 报错? ==="
sudo -n -l >/dev/null 2>/tmp/sudoerr; cat /tmp/sudoerr
echo "=== touchgal-disk 十六进制头 ==="
sudo -n cat /etc/sudoers.d/touchgal-disk 2>&1 | head -3
echo "=== 尝试直接测白名单已知命令 ==="
sudo -n systemctl --version 2>&1 | head -1 || echo "systemctl 也要密码"
sudo -n /bin/true 2>&1 && echo "true OK" || echo "true 也要密码"