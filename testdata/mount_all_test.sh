#!/bin/bash
cd ~/raincough-dev
echo "=== 全部独立前端 mount 崩溃测试 ==="
for n in aigen docker laizhangsetu mcserver uptime vpn compress dltool filehash imagetool ocrqr texttool webspy; do
  F="plugins/$n/assets/plugin.js"
  [ -f "$F" ] || { echo "  $n: 无assets"; continue; }
  R=$(node -e "
global.window = global;
global.document = { createElement:()=>({style:{},setAttribute(){},appendChild(){},children:[]}), createTextNode:()=>({}), createComment:()=>({}) };
global.SVGElement = class {}; global.HTMLElement = class {};
const container = { children: [] }; container.appendChild = function(c){ this.children.push(c); };
import('file:///home/f/raincough-dev/plugins/$n/assets/plugin.js').then(() => {
  const reg = window.__rcPlugin_$n;
  const ctx = { api: { get: ()=>Promise.resolve([]), post: ()=>Promise.resolve({ok:true}) } };
  try { reg.mount(container, ctx); console.log('  $n: MOUNT OK'); }
  catch(e) { console.log('  $n: MOUNT ERR: ' + e.message.slice(0,60)); }
}).catch(e => console.log('  $n: LOAD FAIL: ' + e.message.slice(0,60)));
setTimeout(()=>{},200);
" 2>&1 | grep -E 'MOUNT OK|MOUNT ERR|LOAD FAIL' | head -1)
  echo "$R"
done