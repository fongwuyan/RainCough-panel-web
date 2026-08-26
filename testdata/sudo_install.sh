#!/bin/bash
# 用 pty 交互安装 sudoers(密码 1)
echo "1" | sudo -S install -o root -g root -m 440 /tmp/raincough-sudoers /etc/sudoers.d/raincough 2>&1 | head -2
echo "=== 校验语法 ==="
sudo -n -l 2>/dev/null | tail -6
echo "=== 免密实测 ==="
sudo -n systemctl is-active raincough 2>&1 | head -1
sudo -n apt list --upgradable -q 2>&1 | head -1
sudo -n timedatectl set-ntp true 2>&1 | head -1 && echo "timedatectl OK"