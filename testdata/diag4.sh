#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 解压==="
tar -xf src.tar 2>/dev/null && rm -f src.tar
grep -c "sysfHardware" cmd/raincough/syscenter_ext.go
echo "=== build ==="
go build -o raincough ./cmd/raincough 2>&1
echo "build_rc=$?"
ls -la raincough | awk '{print $5}'
echo "=== 正在跑的进程 ==="
pgrep -a -f 'raincough -port' | head -3
echo "=== 手动测一个 ==="
timeout 5 bash -c 'curl -s http://127.0.0.1:3900/api/sysfunc/hardware | head -c 100'