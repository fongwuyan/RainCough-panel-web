#!/bin/bash
cd /tmp
curl -s http://127.0.0.1:3900/assets/index-DUJ5kCU-.js -o b.js 2>/dev/null
ls -la b.js
echo "=== 定位 26:75569 ≈ 第26行 col 75569 ==="
python3 - <<'PY'
data = open('/tmp/b.js','rb').read().decode('utf-8','replace')
lines = data.split('\n')
# 26 行(1-indexed)
if len(lines) >= 26:
    line = lines[25]
    # col 75569 - 但该行可能很长; 取 col 附近 120 字符
    col = 75569
    start = max(0, col-80)
    print("line26 len:", len(line))
    print("around col:", line[start:col+120])
else:
    print("less than 26 lines, total lines:", len(lines))
    # minified 通常 1-3 行; 找包含 toFixed 的所有位置
    import re
    for m in re.finditer(r'toFixed', data):
        s=max(0,m.start()-100); e=m.end()+40
        seg=data[s:e]
        if 'q' in seg[:60]:
            print("---", seg)
PY