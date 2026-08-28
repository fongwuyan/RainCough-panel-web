#!/bin/bash
echo "=== 宿主 kvm server.py 的 images 实现 ==="
grep -n 'vol-list\|_sudo_run.*ls\|def _rt_images' ~/raincough-dev/plugins/kvm/server.py | head -6
echo "=== kvm server.py 大小/时间 ==="
ls -la ~/raincough-dev/plugins/kvm/server.py
echo "=== kvm 子进程 cwd(是不是真 kvm) ==="
for pid in $(pgrep -f 'python3 server.py'); do
  c=$(readlink /proc/$pid/cwd 2>/dev/null)
  if [ "$c" = "/home/f/raincough-dev/plugins/kvm" ]; then echo "kvm pid=$pid"; fi
done
echo "=== 手动起最新 kvm 直测 images ==="
cd ~/raincough-dev/plugins/kvm
RAINCOUGH_PORT=39991 RAINCOUGH_PLUGIN_DIR=$PWD timeout 8 python3 server.py >/tmp/kvm.log 2>&1 &
sleep 3
curl -s --max-time 10 http://127.0.0.1:39991/images | head -c 150
echo
wait
cat /tmp/kvm.log | tail -3