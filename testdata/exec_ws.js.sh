#!/bin/bash
echo "=== 用 node 模拟执行 webspy assets(检查 IIFE 是否有运行时错误) ==="
cd /tmp
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins/webspy/assets/plugin.js -o ws.js
node -e "
global.window = global;
try {
  require('/tmp/ws.js');
  console.log('exec OK, __rcPlugin_webspy:', typeof (global.window.__rcPlugin_webspy || {}).mount);
  const reg = global.window.__rcPlugin_webspy;
  const ctx = { api: { get: () => Promise.resolve({}), post: () => Promise.resolve({}) } };
  const el = { };
  const fn = reg.mount(el, ctx);
  console.log('mount returned:', typeof fn);
  if (fn) { try { fn() } catch(e) { console.log('unmount err', e.message) } }
} catch (e) {
  console.log('EXEC FAIL:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0,4).join('\n') : '');
}
"