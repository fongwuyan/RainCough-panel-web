#!/bin/bash
echo "=== /tmp 状态 ==="
ls -la /tmp/ 2>&1 | head -8
df -h /tmp 2>&1 | tail -2
echo "=== go build 详细 ==="
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
go build -o raincough ./cmd/raincough 2>&1 | head -6
ls -la raincough | head -1
echo "=== GOTMPDIR 设置 ==="
export GOTMPDIR=$HOME/got && mkdir -p $HOME/got
GOTMPDIR=$HOME/got go build -o raincough ./cmd/raincough 2>&1 | head -4
ls -la raincough | head -1