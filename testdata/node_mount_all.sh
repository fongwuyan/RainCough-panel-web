#!/bin/bash
cd ~/raincough-dev
node -e "
// 补全 DOM mock: Vue3 mount 需要的全部 API
function mkEl(tag) {
  const el = {
    tagName: (tag||'div').toUpperCase(), nodeType: 1, style: {}, children: [],
    parentNode: null, attrs: {},
    setAttribute(k,v){ el.attrs[k]=v; },
    appendChild(c){ el.children.push(c); if (c && typeof c==='object') c.__parent=el; return c; },
    insertBefore(c, ref){ const i = ref ? el.children.indexOf(ref) : el.children.length; el.children.splice(i<0?el.children.length:i, 0, c); if(c&&typeof c==='object') c.__parent=el; return c; },
    removeChild(c){ const i=el.children.indexOf(c); if(i>-1) el.children.splice(i,1); return c; },
    replaceChild(n,o){ const i=el.children.indexOf(o); if(i>-1) el.children[i]=n; return o; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    addEventListener(){}, removeEventListener(){},
    get innerHTML(){ return el.children.map(c => c.nodeType===3 ? c.textContent : '<'+(c.tagName||'').toLowerCase()+'>').join(''); },
    textContent: '',
  };
  return el;
}
global.window = global;
global.document = {
  createElement: mkEl, createTextNode: (t)=>({nodeType:3, textContent:t, __parent:null}),
  createComment: ()=>({nodeType:8}), documentElement: mkEl('html'),
  addEventListener(){}, removeEventListener(){}, body: mkEl('body'),
};
global.SVGElement = class {}; global.HTMLElement = class Element {};
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.Node = class Node {};
global.requestAnimationFrame = (f) => setTimeout(f, 0);
global.cancelAnimationFrame = clearTimeout;
global.Proxy = Proxy;

const P = ['webspy','compress','dltool','filehash','imagetool','ocrqr','texttool','aigen','docker','laizhangsetu','mcserver','uptime','vpn'];
(async () => {
  for (const p of P) {
    const u = 'file:///home/f/raincough-dev/plugins/' + p + '/assets/plugin.js';
    try {
      await import(u);
      const reg = window.__rcPlugin_ && window.__rcPlugin_[p];
      if (!reg || typeof reg.mount !== 'function') { console.log(p + ' => NO_REG'); continue; }
      const c = mkEl('div');
      try {
        const fn = reg.mount(c, { plugin:{name:p}, api:{ get:()=>Promise.resolve({}), post:()=>Promise.resolve({ok:true}) } });
        console.log(p + ' => MOUNT_OK:' + (c.innerHTML ? c.innerHTML.length : 0));
      } catch (e) { console.log(p + ' => MOUNT_ERR:' + (e.message||e).slice(0,80)); }
    } catch (e) { console.log(p + ' => LOAD_FAIL:' + (e.message||e).slice(0,60)); }
  }
  process.exit(0);
})();
" 2>&1 | grep -E 'MOUNT_OK|MOUNT_ERR|NO_REG|LOAD_FAIL'