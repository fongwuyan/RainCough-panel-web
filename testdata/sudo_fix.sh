#!/bin/bash
# 给 f 用户配免密 sudo(仅面板系统功能所需命令白名单)
set -e
SRC=/etc/sudoers.d/raincough
if [ -f "$SRC" ]; then echo "已存在, 覆盖"; fi
cat > /tmp/raincough-sudoers <<'EOF'
# RainCough 面板系统功能所需的免密命令(白名单)
f ALL=(root) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /usr/sbin/timedatectl, /usr/bin/udisksctl, /bin/mount, /bin/umount, /usr/bin/mount, /usr/bin/umount, /bin/systemctl, /usr/bin/systemctl, /sbin/shutdown, /usr/sbin/shutdown, /usr/sbin/dpkg, /usr/sbin/lvcreate, /usr/sbin/lvs, /bin/umount
EOF
chmod 440 /tmp/raincough-sudoers
sudo -n install -o root -g root -m 440 /tmp/raincough-sudoers $SRC 2>/dev/null || sudo install -o root -g root -m 440 /tmp/raincough-sudoers $SRC
echo "=== 验证免密 ==="
sudo -n apt list --upgradable -q 2>&1 | head -2
echo "=== 表层验证 systemctl ==="
sudo -n systemctl is-active raincough 2>&1 | head -1