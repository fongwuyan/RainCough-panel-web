#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
echo "=== 显式 build ==="
go build -o raincough ./cmd/raincough 2>&1
echo "rc=$?"
ls -la raincough | awk '{print $6,$7,$8}'