#!/bin/bash
# 正确验证 dltool split/join(用 /tmp 可写文件)
cd ~/raincough-dev/plugins/dltool
TEST=/tmp/dltool_test.txt
printf 'line1 hello\nline2 world\nline3 rain\nline4 cough\n' > $TEST
echo "原始: $(cat $TEST | wc -c) 字节"
RAINCOUGH_PORT=34568 python3 server.py > /tmp/dltool2.log 2>&1 &
WPID=$!
sleep 2
echo "=== split(2 片) ==="
curl -s -X POST http://127.0.0.1:34568/networktools/split \
  -H "Content-Type: application/json" -d "{\"path\":\"$TEST\",\"parts\":2}" | python3 -m json.tool
echo "=== join 回去 ==="
curl -s -X POST http://127.0.0.1:34568/networktools/join \
  -H "Content-Type: application/json" \
  -d "{\"paths\":[\"$TEST.part01\",\"$TEST.part02\"],\"dest\":\"/tmp/dltool_joined.txt\"}" | python3 -m json.tool
echo "=== 无损验证 ==="
if cmp -s $TEST /tmp/dltool_joined.txt; then echo "IDENTICAL: 分片->合并 无损"; else echo "MISMATCH"; fi
kill $WPID 2>/dev/null