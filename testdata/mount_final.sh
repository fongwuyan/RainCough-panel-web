#!/bin/bash
cd ~/raincough-dev
echo "=== 完整 DOM mock 终测(insertBefore 已补) ==="
for n in aigen docker laizhangsetu mcserver uptime vpn compress dltool filehash imagetool ocrqr texttool webspy; do
  R=$(node -e "
global.window = global;
function mkEl(){ return { style:{}, children:[], setAttribute(){}, appendChild(c){ this.children.push(c); c.__p=this; }, insertBefore(c, ref){ this.children.splice(ref?this.children.indexOf(ref):this.children.length, 0, c); c.__p=this; }, removeChild(c){ const i=this.children.indexOf(c); if(i>-1)this.children.splice(i,1); }, querySelector(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, removeEventListener(){} }; }
global.document = { createElement: mkEl, createTextNode:()=>({nodeType:3}), createComment:()=>({nodeType:8}), documentElement: mkEl(), addEventListener(){}, body: mkEl() };
global.SVGElement = class {}; global.HTMLElement = class {}; global.getComputedStyle = () => ({});
const container = mkEl();
import('file:///home/f/raincough-dev/plugins/$n/assets/plugin.js').then(() => {
  const reg = window.__rcPlugin_$n;
  const ctx = { api: { get: ()=>Promise.resolve({}), post: ()=>Promise.resolve({ok:true}) } };
  try { const fn = reg.mount(container, ctx); console.log('$n: MOUNT OK' + (fn?'+unmount':'') ); }
  catch(e) { console.log('$n: MOUNT ERR: ' + (e.message||'').slice(0,60)); }
}).catch(e => console.log('$n: LOAD FAIL: ' + (e.message||'').slice(0,60)));
setTimeout(()=>{},400);
" 2>&1 | grep -E 'MOUNT OK|MOUNT ERR|LOAD FAIL' | head -1)
  echo "  $R"
done