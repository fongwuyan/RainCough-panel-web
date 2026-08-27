#!/bin/bash
cd ~/raincough-dev
echo "=== 定位主 bundle 26行 col 120639 ==="
python3 - <<'PY'
data = open('/home/f/raincough-dev/public/assets/index-qCUIw25T.js','rb').read().decode('utf-8','replace')
lines = data.split('\n')
line = lines[25]
col = 120639
s = max(0, col-150); 
print('line len:', len(line))
print(line[s:col+200])
PY