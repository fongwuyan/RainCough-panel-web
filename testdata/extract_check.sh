#!/bin/bash
cd ~/raincough-dev
echo "=== 重新 scp 的 src.tar 里 kvm ==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "解压后 kvm 620 行:"
sed -n '620,622p' plugins/kvm/server.py
echo "grep vol-list:"
grep -c "'vol-list'" plugins/kvm/server.py
echo "kvm 大小:"
stat -c%s plugins/kvm/server.py