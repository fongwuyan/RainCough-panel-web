#!/bin/bash
cd ~/raincough-dev
node -e "
global.window = global;
global.document = { createElement:()=>({style:{},setAttribute(){},appendChild(){},children:[]}), createTextNode:()=>({}), createComment:()=>({}) };
global.SVGElement = class {}; global.HTMLElement = class {};
const container = { children: [] };
container.appendChild = function(c){ this.children.push(c); };
import('file:///home/f/raincough-dev/plugins/webspy/assets/plugin.js').then(() => {
  const reg = window.__rcPlugin_webspy;
  const ctx = { api: { get: ()=>Promise.resolve([]), post: ()=>Promise.resolve({}) } };
  const fn = reg.mount(container, ctx);
  console.log('mount returned fn:', typeof fn);
}).catch(e => { console.log('MOUNT ERR:', e.message); console.log((e.stack||'').split('\n').slice(0,6).join('\n')); });
setTimeout(()=>{ console.log('done'); process.exit(0); }, 3000);
" 2>&1 | grep -vE 'Vue warn|development build|production build' | head -12