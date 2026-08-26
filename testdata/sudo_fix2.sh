#!/bin/bash
echo "=== 命令实际路径 ==="
which dpkg lvs lvcreate ufw apt timedatectl systemctl shutdown 2>/dev/null
echo "=== 重建 sudoers(精确路径) ==="
cat > /tmp/rc-sudoers <<'EOF'
# RainCough 面板系统功能免密命令(精确路径)
f ALL=(root) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /usr/sbin/timedatectl, /usr/bin/udisksctl, /bin/mount, /bin/umount, /usr/bin/mount, /usr/bin/umount, /bin/systemctl, /usr/bin/systemctl, /sbin/shutdown, /usr/sbin/shutdown, /usr/bin/dpkg, /usr/sbin/dpkg, /usr/sbin/lvcreate, /usr/sbin/lvs, /sbin/lvs, /usr/sbin/ufw
EOF
echo "1" | sudo -S install -o root -g root -m 440 /tmp/rc-sudoers /etc/sudoers.d/raincough 2>&1 | head -2
echo "=== 重测 ==="
sudo -n dpkg --list 'linux-image-*' 2>&1 | head -1
sudo -n ufw status 2>&1 | head -1
sudo -n lvs --noheadings -o lv_name 2>&1 | head -1