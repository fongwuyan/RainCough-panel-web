#!/bin/bash
echo "=== ps 全量 python ==="
ps aux | grep python | grep -v grep | awk '{print $2, $11, $12, $13}'
echo "=== 网关 handlePlugin 用 routes 吗? ==="
grep -n 'routes\|manifest.Routes\|\.Routes' ~/raincough-dev/cmd/raincough/main.go | head -8
grep -n 'func (s \*server) handlePlugin' ~/raincough-dev/cmd/raincough/main.go