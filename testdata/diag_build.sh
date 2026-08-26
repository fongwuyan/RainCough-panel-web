#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 显式 build ==="
go build -o raincough ./cmd/raincough 2>&1
RC=$?
echo "build_exit=$RC"
if [ $RC -ne 0 ]; then
  echo "=== 尝试单个文件编译 ==="
  go build ./internal/core/ 2>&1 | head -10
  go build ./internal/host/ 2>&1 | head -5
  go build ./internal/shared/ 2>&1 | head -5
fi
ls -la raincough | awk '{print $6,$7,$8}'