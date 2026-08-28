#!/bin/bash
echo "=== webspy 执行测试 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins/webspy/assets/plugin.js -o /tmp/ws3.js
node -e "
global.window = global;
global.SVGElement = global.SVGElement || class SVGElement {};
try {
  require('/tmp/ws3.js');
  const reg = global.window.__rcPlugin_webspy;
  console.log('registered:', typeof (reg||{}).mount);
} catch(e) { console.log('FAIL:', e.message); }
"
echo "=== node 直接跑(不 curl) ==="
node -e "
global.window = global;
try { require('/home/f/raincough-dev/plugins/webspy/assets/plugin.js'); console.log('reg ok:', typeof global.window.__rcPlugin_webspy.mount); } catch(e){ console.log('FAIL:', e.message); }
"