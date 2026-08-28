#!/bin/bash
PW='1'
echo "=== 1. 部署最新代码(pwr安全+fm校验) ==="
cd ~/raincough-dev
tar -xf src.tar 2>/dev/null && rm -f src.tar
export PATH=$HOME/go-tool/go/bin:$PATH
go build -o raincough ./cmd/raincough 2>&1 | head -3 && echo "go ok"
echo "=== 2. 补 sudoers 白名单(libvirt) ==="
cat > /tmp/rc-libvirt <<'EOF'
f ALL=(root) NOPASSWD: /usr/bin/virsh, /usr/bin/qemu-img, /usr/bin/ls, /bin/ls, /usr/bin/df, /bin/df, /usr/bin/du, /usr/bin/vgs, /usr/sbin/vgs, /usr/sbin/lvdisplay, /usr/sbin/vgdisplay, /usr/bin/mkdir, /bin/mkdir, /usr/bin/tee, /usr/bin/cp, /bin/cp, /usr/bin/chmod, /bin/chmod, /usr/bin/chown, /bin/chown, /usr/bin/qemu-system-x86_64, /usr/bin/openssl
EOF
echo "$PW" | sudo -S cp /tmp/rc-libvirt /etc/sudoers.d/raincough-libvirt 2>&1 | tail -1
echo "$PW" | sudo -S chmod 440 /etc/sudoers.d/raincough-libvirt 2>&1 | tail -1
echo "--- 验证白名单 ---"
sudo -n -l 2>&1 | grep -iE 'virsh|qemu-img|du' | head -3
echo "=== 3. 重启面板 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 12
echo "=== 4. 验证 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("alive:", sum(1 for p in ps if p.get("alive")), "/", len(ps))'
echo "-- kvm/images(应不再 500) --"
curl -s --max-time 15 http://127.0.0.1:3900/api/plugins/kvm/images | head -c 150
echo
echo "-- pwr/plan 空参(应 400 拒绝, 不再关机!) --"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 -X POST http://127.0.0.1:3900/api/sysfunc/pwr/plan -H 'Content-Type: application/json' -d '{}'
echo "-- fm/rename 空参(应 400) --"
curl -s --max-time 8 -X POST http://127.0.0.1:3900/api/fm/rename -H 'Content-Type: application/json' -d '{}' | head -c 80