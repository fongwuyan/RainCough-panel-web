#!/bin/bash
echo "=== nohup 环境 PATH(服务同环境) ==="
echo $PATH
echo "=== lsblk 位置 ==="
which lsblk; ls -la /bin/lsblk 2>/dev/null || ls -la /usr/bin/lsblk 2>/dev/null
echo "=== 服务进程环境 PATH ==="
tr '\0' '\n' < /proc/$(pgrep -f 'raincough -port' | head -1)/environ 2>/dev/null | grep '^PATH=' || echo "(读不到)"
echo "=== 模拟 Run 的无 PATH 调用 ==="
env PATH=$PATH lsblk -J -b -o NAME,SIZE 2>&1 | head -3