#!/bin/bash
echo "=== 当前生效的 raincough sudo 权限 ==="
sudo -n -l 2>&1 | grep -A3 'raincough' | head -5
echo "=== 直接测 dpkg 免密 ==="
sudo -n dpkg --list 'linux-image-*' 2>&1 | head -2
echo "rc=$?"
echo "=== 直接测 ufw ==="
sudo -n ufw status 2>&1 | head -2
echo "rc=$?"
echo "=== lvs ==="
sudo -n lvs --noheadings -o lv_name,lv_size 2>&1 | head -3