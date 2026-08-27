#!/bin/bash
cd ~/raincough-dev
JS=public/assets/index-qCUIw25T.js
echo "=== bundle 中 import('/api/plugins/...') 形态 ==="
grep -oE 'import\([^)]*plugins[^)]*\)' $JS | head -3
echo "=== 附近字面量 ==="
grep -oE 'assets/plugin\.js' $JS | head -2
grep -oE '/api/plugins/' $JS | head -2
echo "=== 展开 import 调用上下文 ==="
python3 - <<'PY'
data=open('/home/f/raincough-dev/public/assets/index-qCUIw25T.js',encoding='utf-8',errors='replace').read()
i=data.find('assets/plugin.js')
print('idx:',i)
if i>0: print(data[max(0,i-200):i+120])
PY