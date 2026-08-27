#!/bin/bash
echo "=== 追加 libvirt sudoers(f 免密 virsh 等) ==="
echo 'f ALL=(root) NOPASSWD: /usr/bin/virsh, /usr/bin/ls, /usr/bin/df, /bin/ls, /bin/df, /usr/bin/vgs, /usr/sbin/vgs, /usr/sbin/lvdisplay, /usr/sbin/vgdisplay, /usr/bin/mkdir, /bin/mkdir, /usr/bin/qemu-img, /usr/bin/openssl, /usr/bin/tee' > /tmp/rc-libvirt
sudo -n cp /tmp/rc-libvirt /etc/sudoers.d/raincough-libvirt 2>&1 && sudo -n chmod 440 /etc/sudoers.d/raincough-libvirt 2>&1 && echo "written"
echo "=== 验证 ==="
sudo -n -l 2>&1 | grep -iE 'virsh|qemu-img' || echo "(未生效)"
echo "=== 测 kvm/images ==="
curl -s --max-time 10 http://127.0.0.1:3900/api/plugins/kvm/images | head -c 120