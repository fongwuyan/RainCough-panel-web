#!/bin/bash
echo "=== f 用户 virsh 直连(无需 sudo) ==="
virsh -c qemu:///system list 2>&1 | head -3 || echo "virsh 直连失败"
echo "=== libvirt 组 / 权限 ==="
id f
ls -la /var/run/libvirt/libvirt-sock 2>/dev/null || echo "(无 socket)"
echo "=== kvm images 实际命令(看 server.py fallback) ==="
grep -n 'images\|_list_img\|_img' ~/raincough-dev/plugins/kvm/server.py 2>/dev/null | head -8 || echo "(kvm 目录不存在? 之前插件目录被清过)"