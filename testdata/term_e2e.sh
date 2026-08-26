#!/bin/bash
# 终端 e2e 验证(宿主机 Linux)
set -x
BASE=http://127.0.0.1:3900/api/terminal

echo "=== 1. 打开会话 ==="
OPEN=$(curl -s -X POST $BASE/open -H 'Content-Type: application/json' -d '{"rows":24,"cols":80}')
echo "$OPEN"
SID=$(echo "$OPEN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["sid"])')
echo "sid=$SID"

echo "=== 2. 会话列表 ==="
curl -s $BASE/sessions
echo

echo "=== 3. stream 读取初始输出(后台) ==="
(curl -s -N --max-time 5 "$BASE/stream?sid=$SID" > /tmp/term_out.txt 2>&1) &
STREAM_PID=$!
sleep 2

echo "=== 4. 发送命令 echo HELLO ==="
CMD=$(python3 -c "import base64; print(base64.b64encode(b'echo HELLO-FROM-TERM\n').decode())")
curl -s -X POST $BASE/input -H 'Content-Type: application/json' -d "{\"sid\":\"$SID\",\"data\":\"$CMD\"}"
echo

sleep 4
wait $STREAM_PID 2>/dev/null

echo "=== 5. stream 输出验证 ==="
if grep -q "HELLO-FROM-TERM" <(cat /tmp/term_out.txt | while read line; do
  case "$line" in data:*) echo "$line" | sed 's/^data: //' ;;
  esac
done | python3 -c "import base64,sys; [print(base64.b64decode(l).decode('utf-8','replace'),end='') for l in sys.stdin if l.strip()]")
then
  echo "PASS: 终端输出包含 HELLO-FROM-TERM"
else
  echo "FAIL: 未捕获到终端输出"
  cat /tmp/term_out.txt
fi

echo "=== 6. 关闭会话 ==="
curl -s -X POST $BASE/close -H 'Content-Type: application/json' -d "{\"sid\":\"$SID\"}"
echo
echo "=== 7. 关闭后列表 ==="
sleep 1
curl -s $BASE/sessions
echo