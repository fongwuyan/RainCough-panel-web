#!/bin/bash
echo "=== f 直接读 images 目录 ==="
ls -la /var/lib/libvirt/images/ 2>&1 | head -6
echo "=== 直接 list 名 ==="
python3 -c 'import os; print(os.listdir("/var/lib/libvirt/images"))' 2>&1 | head -3
echo "=== sudoers raincough 内容(白名单路径) ==="
grep -eristinct "" /etc/sudoers.d/raincough 2>/dev/null
sudo -n -l 2>/dev/null | grep 'NOPASSWD' | tail -3