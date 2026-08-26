#!/bin/bash
# 验证系统中心 + 浅色模式
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
tar -xf src.tar 2>/dev/null && rm -f src.tar
export RC_SUDO_PW=1
go build -o raincough ./cmd/raincough 2>&1 | head -3
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 1. 服务列表(前几项) ==="
curl -s http://127.0.0.1:3900/api/sysfunc/service/list | python3 -c 'import json,sys; d=json.load(sys.stdin); s=d.get("services",[]); print("count:", len(s)); [print(" ", x["name"], x["active"]) for x in s[:5]]' 2>&1
echo "=== 2. 进程列表 ==="
curl -s http://127.0.0.1:3900/api/sysfunc/process/list | python3 -c 'import json,sys; d=json.load(sys.stdin); p=d.get("processes",[]); print("count:", len(p)); [print(" ", x["pid"], x["user"], x["cmd"][:40]) for x in p[:5]]' 2>&1
echo "=== 3. 日志 tail ==="
curl -s "http://127.0.0.1:3900/api/sysfunc/log?path=/var/log/syslog&lines=5" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("lines:", len(d.get("logs",[]))); [print(" ", l[:80]) for l in d.get("logs",[])[:3]]' 2>&1
echo "=== 4. 防火墙状态 ==="
curl -s http://127.0.0.1:3900/api/sysfunc/fw/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print("enabled:", d.get("enabled"), "rules:", len(d.get("rules",[])))' 2>&1
echo "=== 5. 前端浅色默认(HTML 无 data-theme) ==="
curl -s http://127.0.0.1:3900/ | grep -o "rc_theme" | head -1
echo "=== 6. 插件仍活 ==="
curl -s http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))' 2>&1