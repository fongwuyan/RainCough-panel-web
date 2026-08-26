#!/bin/bash
# 验证 dltool split/join 修复
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 4
echo "=== split /etc/hosts(2 片) ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/dltool/networktools/split \
  -H "Content-Type: application/json" -d '{"path":"/etc/hosts","parts":2}' | python3 -m json.tool
echo "=== join 回去 ==="
curl -s -X POST http://127.0.0.1:3900/api/plugins/dltool/networktools/join \
  -H "Content-Type: application/json" \
  -d '{"paths":["/etc/hosts.part01","/etc/hosts.part02"],"dest":"/tmp/hosts.joined"}' | python3 -m json.tool
echo "=== 一致性校验 ==="
if cmp -s /etc/hosts /tmp/hosts.joined; then echo "IDENTICAL: 分片合并无损"; else echo "MISMATCH"; fi