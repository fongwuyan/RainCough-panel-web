#!/bin/bash
cd ~/raincough-dev
echo "=== kvm plugin.json ==="
cat plugins/kvm/plugin.json 2>/dev/null | head -20
echo "=== kvm server.py 语法 ==="
python3 -m py_compile plugins/kvm/server.py 2>&1 && echo "py OK"
echo "=== kvm .runtime.log ==="
cat plugins/kvm/.runtime.log 2>/dev/null | tail -8 || echo "(无)"
echo "=== 手动起 kvm ==="
cd plugins/kvm
RAINCOUGH_PORT=39991 RAINCOUGH_PLUGIN_DIR=$PWD timeout 6 python3 server.py 2>&1 | head -8 &
sleep 4
curl -s --max-time 3 http://127.0.0.1:39991/__health; echo
wait