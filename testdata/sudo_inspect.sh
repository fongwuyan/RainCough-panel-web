#!/bin/bash
echo "=== touchgal-disk 内容(白名单模板) ==="
sudo -n cat /etc/sudoers.d/touchgal-disk 2>&1 | head -10
echo "=== f 能否写 /etc/sudoers.d via tee? ==="
echo 'test' | sudo -n tee /etc/sudoers.d/.wtest >/dev/null 2>&1 && { echo "tee 可用"; sudo -n rm /etc/sudoers.d/.wtest; } || echo "tee 需密码"
echo "=== 检查 kvm server.py 怎么调用 sudo ==="
grep -nE 'sudo|virsh' ~/raincough-dev/plugins/kvm/server.py 2>/dev/null | head -8 || echo "(kvm 目录? 或 server 没部署)"