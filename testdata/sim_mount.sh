#!/bin/bash
cd ~/raincough-dev
echo "=== 模拟 PluginView 修复后的 mount 流程(WebAPI mock) ==="
node -e "
// 轻量 DOM mock 让 Vue mount 能执行
const listeners = {};
global.window = global;
global.document = {
  createElement: (t) => {
    const el = { tagName: t.toUpperCase(), style: {}, children: [], attrs: {},
      appendChild(c){ this.children.push(c); if (c.parentNode) c.parentNode = this; c.__parent=this; return c; },
      insertBefore(c, r){ this.children.unshift(c); return c; },
      setAttribute(k,v){ this.attrs[k]=v; },
      addEventListener(k, fn){ listeners[k] = fn; },
      removeEventListener(){},
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
    };
    return el;
  },
  createTextNode: (t) => ({ nodeType:3, textContent: t }),
  createComment: () => ({ nodeType:8 }),
};
global.SVGElement = class {};
global.HTMLElement = class {};
class MockEl { constructor(){ this.children=[]; this.style={}; } appendChild(c){ this.children.push(c); } }
const container = new MockEl();
// 加载真实 assets 并 mount(与 PluginView 修复后一致)
import('file:///home/f/raincough-dev/plugins/webspy/assets/plugin.js').then(() => {
  const reg = window.__rcPlugin_webspy;
  ctx = { api: { get: (p)=>Promise.resolve({results:[],feeds:[]}), post: ()=>Promise.resolve({ok:true}) } };
  const fn = reg.mount(container, ctx);
  const out = JSON.stringify(container.children).slice(0,200);
  console.log('MOUNT-RUN child nodes:', container.children.length);
  console.log('container first child tag:', container.children[0] && container.children[0].tagName);
  try { if (fn) fn(); } catch(e) { console.log('unmount:', e.message); }
}).catch(e => console.log('load fail', e.message));
"