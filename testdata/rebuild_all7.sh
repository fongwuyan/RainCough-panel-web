#!/bin/bash
echo "=== 重建后 webspy 执行测试 ==="
curl -s --max-time 8 http://127.0.0.1:3900/api/plugins/webspy/assets/plugin.js -o /tmp/ws2.js
node -e "
global.window = global;
global.SVGElement = global.SVGElement || class SVGElement extends HTMLElement {};
try {
  require('/tmp/ws2.js');
  const reg = global.window.__rcPlugin_webspy;
  console.log('registered:', typeof (reg||{}).mount);
  if (reg) {
    const el = { appendChild(){}, childNodes: [] };
    const ctx = { api: { get: (p)=>Promise.resolve({}), post: ()=>Promise.resolve({}) } };
    const fn = reg.mount(el, ctx);
    console.log('mount ok, unmount type:', typeof fn);
    if (fn) { try{fn()}catch(e){console.log('unmount err', e.message)} }
  }
} catch(e) { console.log('EXEC FAIL:', e.message); console.log((e.stack||'').split('\n').slice(0,3).join('\n')); }
"
echo "=== 顺带重建其它 6 个(build7 时可能同样有问题) ==="
cd ~/raincough-dev
node tools/build-plugin-frontend.js compress dltool filehash imagetool ocrqr texttool 2>&1 | tail -8
echo "=== 全部重建后 heads ==="
for n in compress dltool filehash imagetool ocrqr texttool webspy; do
  H=$(head -c 6 "plugins/$n/assets/plugin.js")
  echo "  $n: $H"
done