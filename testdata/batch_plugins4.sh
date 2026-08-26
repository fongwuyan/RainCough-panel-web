#!/bin/bash
# 验证 3 个新插件(ocrqr/vpn/kvm)
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
setsid ./raincough -port 3900 > srv.log 2>&1 < /dev/null &
disown
sleep 7
echo "=== 插件列表 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps)); [print(" ", p["name"], "alive=", p["alive"]) for p in ps]'
echo "=== 1. ocrqr: check(工具可用性) ==="
curl -s http://127.0.0.1:3900/api/plugins/ocrqr/ocr/check | python3 -m json.tool
echo "=== 2. vpn: env ==="
curl -s http://127.0.0.1:3900/api/plugins/vpn/env | python3 -m json.tool
echo "=== 3. vpn: overview ==="
curl -s http://127.0.0.1:3900/api/plugins/vpn/overview | python3 -m json.tool
echo "=== 4. kvm: config(virsh?) ==="
curl -s http://127.0.0.1:3900/api/plugins/kvm/config | python3 -m json.tool
echo "=== 5. kvm: domains ==="
curl -s http://127.0.0.1:3900/api/plugins/kvm/domains | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok:", d.get("ok"), "domains:", len(d.get("domains",[])), d.get("error",""))'