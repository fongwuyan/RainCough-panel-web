#!/bin/bash
cd ~/raincough-dev
echo "=== build 实际结果 ==="
export PATH=$HOME/go-tool/go/bin:$PATH
go build -o raincough ./cmd/raincough 2>&1 && echo BUILD_OK || echo BUILD_FAIL
ls -la raincough | awk '{print $6,$7,$8}'
echo "=== 服务日志(含 sysfunc 初始化?) ==="
grep -iE 'syscenter|已启动|失败' srv.log | tail -5
echo "=== 手动 curl sysfunc ==="
curl -sv --max-time 8 http://127.0.0.1:3900/api/sysfunc/service/list 2>&1 | tail -12