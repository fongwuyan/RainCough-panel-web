#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
export GOTMPDIR=$HOME/gotmp && mkdir -p $HOME/gotmp
echo "=== 源码确认 ==="
grep -c 'minutes 必填\|必填(>0)' cmd/raincough/syscenter_ext.go
echo "=== 清理 go build cache 后重建 ==="
go clean -cache 2>&1 | head -2
go build -o raincough.new ./cmd/raincough 2>&1 | head -5
echo "build rc=$?"
ls -la raincough.new 2>/dev/null | awk '{print $5}'
echo "=== 二进制验证(带 -a 强制全编译) ==="
strings raincough.new 2>/dev/null | grep -c 'minutes 必填'
echo "=== 反查 plan 字符串 ==="
strings raincough.new 2>/dev/null | grep -iE 'action.*必填|minutes 必填|minutes.*必填' | head -3 || echo "(无)"