#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== build(完整) ==="
go build -o raincough ./cmd/raincough 2>&1
echo "rc=$?"
echo "=== 启动日志 ==="
cat srv.log 2>/dev/null | tail -6
echo "=== 端口 ==="
ss -tlnp 2>/dev/null | grep 3900 || echo NO_LISTEN