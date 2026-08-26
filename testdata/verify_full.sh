#!/bin/bash
cd ~/raincough-dev
export PATH=$HOME/go-tool/go/bin:$PATH
for p in $(pgrep -f 'raincough -port'); do kill -9 $p 2>/dev/null; done
sleep 1
nohup ./raincough -port 3900 > srv.log 2>&1 &
sleep 8
echo "=== 前端首页 ==="
curl -s http://127.0.0.1:3900/ | grep -oE '(title>[^<]+|rc_theme)' | head -3
echo "=== 新 JS 可达 ==="
curl -s -o /dev/null -w 'js HTTP %{http_code}\n' http://127.0.0.1:3900/assets/index-CQC_DbfP.js
echo "=== 新 CSS 可达 ==="
curl -s -o /dev/null -w 'css HTTP %{http_code}\n' http://127.0.0.1:3900/assets/index-l1dXeGui.css
echo "=== 系统 API ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/system | python3 -c 'import json,sys; d=json.load(sys.stdin); print("host:", d["hostname"], "mem%:", round(d["memory_percent"],1))'
echo "=== 插件 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins | python3 -c 'import json,sys; ps=json.load(sys.stdin); print("total:", len(ps), "alive:", sum(1 for p in ps if p["alive"]))'
echo "=== 文件管理 ==="
curl -s --max-time 8 "http://127.0.0.1:3900/api/fm/list?path=/etc" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("items:", len(d.get("items",[])))'
echo "=== 终端 ==="
curl -s --max-time 8 -X POST http://127.0.0.1:3900/api/terminal/open -H 'Content-Type: application/json' -d '{"rows":24,"cols":100}' | head -c 80