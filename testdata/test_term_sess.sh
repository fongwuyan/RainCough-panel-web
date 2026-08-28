#!/bin/bash
B=http://127.0.0.1:3900
echo "=== 创建终端会话 ==="
SID=$(curl -s --max-time 8 -X POST $B/api/terminal/open -H 'Content-Type: application/json' -d '{"rows":24,"cols":80}' | python3 -c 'import json,sys; print(json.load(sys.stdin).get("sid",""))' 2>/dev/null)
echo "sid=$SID"
echo "=== input(有效会话) ==="
curl -s -o /dev/null -w "input: %{http_code}\n" --max-time 8 -X POST $B/api/terminal/input -H 'Content-Type: application/json' -d "{\"sid\":\"$SID\",\"data\":\"bHMK\"}"
echo "=== resize(有效会话) ==="
curl -s -o /dev/null -w "resize: %{http_code}\n" --max-time 8 -X POST $B/api/terminal/resize -H 'Content-Type: application/json' -d "{\"sid\":\"$SID\",\"cols\":100,\"rows\":30}"
echo "=== 无会话(404 语义 - 正常) ==="
curl -s -o /dev/null -w "input无会话: %{http_code}\n" --max-time 6 -X POST $B/api/terminal/input -H 'Content-Type: application/json' -d '{"sid":"none","data":"eA=="}'
echo "=== close ==="
curl -s -o /dev/null -w "close: %{http_code}\n" --max-time 6 -X POST $B/api/terminal/close -H 'Content-Type: application/json' -d "{\"sid\":\"$SID\"}"