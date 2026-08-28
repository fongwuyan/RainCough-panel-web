#!/bin/bash
cd ~/raincough-dev
echo "=== 重建全部独立前端 assets ==="
node tools/build-plugin-frontend.js aigen docker laizhangsetu mcserver uptime vpn compress dltool filehash imagetool ocrqr texttool webspy 2>&1 | tail -14
echo "=== 重建后 mount 测试(带完整 DOM mock) ==="
for n in aigen docker laizhangsetu mcserver uptime vpn compress dltool filehash imagetool ocrqr texttool webspy; do
  R=$(node -e "
global.window = global;
global.document = { createElement:()=>({style:{},setAttribute(){},appendChild(){},children:[],parentNode:null,insertBefore(){} }), createTextNode:()=>({}), createComment:()=>({}), documentElement:{style:{}} };
global.SVGElement = class {}; global.HTMLElement = class {};
const container = { children: [], appendChild(c){this.children.push(c);} };
import('file:///home/f/raincough-dev/plugins/$n/assets/plugin.js').then(() => {
  const reg = window.__rcPlugin_$n;
  const ctx = { api: { get: ()=>Promise.resolve([]), post: ()=>Promise.resolve({ok:true}) } };
  try { reg.mount(container, ctx); console.log('$n: MOUNT OK'); }
  catch(e) { console.log('$n: MOUNT ERR: ' + (e.message||'').slice(0,50)); }
}).catch(e => console.log('$n: LOAD FAIL: ' + (e.message||'').slice(0,50)));
setTimeout(()=>{},300);
" 2>&1 | grep -E 'MOUNT OK|MOUNT ERR|LOAD FAIL' | head -1)
  echo "$R"
done