#!/bin/bash
cd ~/raincough-dev
echo "=== 宿主 kvm server.py 618-625 行 ==="
sed -n '618,625p' plugins/kvm/server.py
echo "=== 本地 git HEAD kvm 该段(应 vol-list) ==="
git -C /e/jiaob/RainCough-Core show HEAD:plugins/kvm/server.py 2>/dev/null | sed -n '620,625p' || echo "(路径问题, 用 grep)"
echo "=== 宿主 tar 是否还在? ==="
ls -la src.tar 2>/dev/null || echo "无 tar"
echo "=== 另一可能: tar 解压时 kvm 被 SKIP(某处占用) ==="
grep -c 'vol-list' plugins/kvm/server.py