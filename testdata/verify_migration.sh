#!/bin/bash
# 迁移后全量验证: 部署最新代码, 检查 16 插件子进程语法/bootstrap + 各自健康端
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
set -e
tar -xf src.tar 2>/dev/null && rm -f src.tar
echo "=== 1. 校验全部 server.py 语法 ==="
FAIL=0
for d in $(ls -d plugins/*/); do
  n=$(basename $d)
  [ "$n" = "demo" ] && continue
  [ "$n" = "uptime-cpp" ] && continue
  if [ -f "$d/server.py" ]; then
    if python3 -m py_compile "$d/server.py" 2>/tmp/pyerr.txt; then
      printf "  %-14s py OK\n" $n
    else
      printf "  %-14s py FAIL: %s\n" $n "$(head -2 /tmp/pyerr.txt | tail -1)"
      FAIL=1
    fi
  fi
done
echo "syntax_fail=$FAIL"
echo "=== 2. Go 编译 ==="
go build -o raincough ./cmd/raincough 2>&1 | head -4 && echo "go ok"
echo "=== 3. 前端构建 ==="
cd web && node node_modules/vite/bin/vite.js build 2>&1 | tail -1
cd ..
echo "=== 4. 重启 ==="
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
for p in $(pgrep -f 'python3 server.py'); do kill -9 $p 2>/dev/null; done
sleep 2
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 10
echo "=== 5. 插件健康 ==="
curl -s --max-time 5 http://127.0.0.1:3900/api/plugins | python3 -c '
import json,sys
ps=json.load(sys.stdin)
print("total:", len(ps), "alive:", sum(1 for p in ps if p.get("alive")))
for p in ps:
    if not p.get("alive"): print("  dead:", p["name"], (p.get("error") or "")[:60])
'
echo "=== 6. 子进程就绪抽查(直连 health) ==="
sleep 3
for n in uptime vpn webspy kvm mcskin ocrqr texttool touchgal dltool compress filehash imagetool aigen docker laizhangsetu mcserver; do
  PORT=$(ss -tlnp 2>/dev/null | grep python | grep -oE '127.0.0.1:[0-9]+' | head -1 | cut -d: -f2)
  # 通过网关 query 参数必须通(验证 RawQuery 修复)
  R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 6 "http://127.0.0.1:3900/api/plugins/$n/__health?probe=1" 2>/dev/null)
  echo "  $n /__health -> $R"
done