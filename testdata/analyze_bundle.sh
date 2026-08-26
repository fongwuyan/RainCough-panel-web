#!/bin/bash
cd ~/raincough-dev
echo "=== JS bundle 头部(找立即执行代码) ==="
curl -s http://127.0.0.1:3900/assets/index-CMnDP_iU.js -o /tmp/bundle.js
ls -la /tmp/bundle.js
echo "=== 搜 vue 模板编译期错误标记 ==="
grep -o 'Failed to resolve component\|Cannot read properties of undefined\|is not a function\|Invalid vnode' /tmp/bundle.js | sort | uniq -c | head
echo "=== 搜 window.__rcErr / blankHint 相关(确认 App.vue 打包) ==="
grep -c 'blankHint' /tmp/bundle.js
echo "=== 搜 'mount' ==="
grep -o "\.mount('#app')" /tmp/bundle.js | head -1