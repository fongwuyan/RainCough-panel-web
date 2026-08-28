#!/bin/bash
cd ~/raincough-dev
echo "=== ESM import 语义验证(与浏览器一致) ==="
for n in compress dltool filehash imagetool ocrqr texttool webspy aigen docker laizhangsetu mcserver uptime vpn; do
  F="plugins/$n/assets/plugin.js"
  if [ ! -f "$F" ]; then echo "  $n: 无 assets"; continue; fi
  cp "$F" /tmp/esm_$n.js
  # ESM 模式: 设置 window 全局后 import, 检查注册
  R=$(node --input-type=module -e "
globalThis.window = globalThis;
try {
  await import('file:///tmp/esm_$n.js');
  const r = globalThis.window.__rcPlugin_$n;
  console.log('  $n: ' + (r && typeof r.mount === 'function' ? 'MOUNT OK' : 'NO REG'));
} catch(e) { console.log('  $n: FAIL ' + e.message.slice(0,80)); }
" 2>&1 | grep -E "MOUNT OK|NO REG|FAIL")
  echo "$R"
done