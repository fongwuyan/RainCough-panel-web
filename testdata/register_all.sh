#!/bin/bash
cd ~/raincough-dev
for p in webspy compress dltool filehash imagetool ocrqr texttool aigen docker laizhangsetu mcserver uptime vpn; do
  R=$(node -e "
global.window = global;
import('file:///home/f/raincough-dev/plugins/$p/assets/plugin.js').then(() => {
  const reg = global.window.__rcPlugin_ && global.window.__rcPlugin_$p;
  if (!reg || typeof reg.mount !== 'function') { console.log('$p => NO_REG'); return; }
  console.log('$p => REGISTERED');
}).catch(e => console.log('$p => LOAD_FAIL:' + (e.message||'').slice(0,50)));
setTimeout(()=>process.exit(0), 200);
" 2>&1 | grep -E 'REGISTERED|NO_REG|LOAD_FAIL' | head -1)
  echo "$R"
done