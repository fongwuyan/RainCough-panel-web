(()=>{var vl,ze,ke,_s,Ss,Cn,Ki,Tn,Wr,_i,zi,ai,Jr;function bt(e){let t=Object.create(null);for(let i of e.split(","))t[i]=1;return i=>i in t}var de={},Qi=[],He=()=>{},$i=()=>!1,Oi=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&(e.charCodeAt(2)>122||97>e.charCodeAt(2)),nr=e=>e.startsWith("onUpdate:"),ce=Object.assign,Aa=(e,t)=>{let i=e.indexOf(t);i>-1&&e.splice(i,1)},gp=Object.prototype.hasOwnProperty,me=(e,t)=>gp.call(e,t),J=Array.isArray,te=e=>typeof e=="function",se=e=>typeof e=="string",Ze=e=>typeof e=="symbol",fe=e=>e!==null&&typeof e=="object",Ea=e=>(fe(e)||te(e))&&te(e.then)&&te(e.catch),Ne=Object.prototype.toString,rr=e=>se(e)&&e!=="NaN"&&e[0]!=="-"&&""+parseInt(e,10)===e,Vt=bt(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"),bp=bt("bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"),ar=e=>{let t=Object.create(null);return i=>t[i]||(t[i]=e(i))},yp=/-\w/g,ye=ar(e=>e.replace(yp,t=>t.slice(1).toUpperCase())),xp=/\B([A-Z])/g,dt=ar(e=>e.replace(xp,"-$1").toLowerCase()),Pi=ar(e=>e.charAt(0).toUpperCase()+e.slice(1)),Wi=ar(e=>e?`on${Pi(e)}`:""),De=(e,t)=>!Object.is(e,t),Ji=(e,...t)=>{for(let i=0;i<e.length;i++)e[i](...t)},To=(e,t,i,s=!1)=>{Object.defineProperty(e,t,{configurable:!0,enumerable:!1,writable:s,value:i})},lr=e=>{let t=parseFloat(e);return isNaN(t)?e:t},Gi=e=>{let t=se(e)?Number(e):NaN;return isNaN(t)?e:t},or=()=>vl||(vl="u">typeof globalThis?globalThis:"u">typeof self?self:"u">typeof window?window:"u">typeof global?global:{}),wp=bt("Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol");function Vs(e){if(J(e)){let t={};for(let i=0;i<e.length;i++){let s=e[i],n=se(s)?No(s):Vs(s);if(n)for(let r in n)t[r]=n[r]}return t}if(se(e)||fe(e))return e}var kp=/;(?![^(]*\))/g,_p=/:([^]+)/,Sp=/\/\*[^]*?\*\//g;function No(e){let t={};return e.replace(Sp,"").split(kp).forEach(i=>{if(i){let s=i.split(_p);s.length>1&&(t[s[0].trim()]=s[1].trim())}}),t}function Hs(e){let t="";if(se(e))t=e;else if(J(e))for(let i=0;i<e.length;i++){let s=Hs(e[i]);s&&(t+=s+" ")}else if(fe(e))for(let i in e)e[i]&&(t+=i+" ");return t.trim()}function qp(e){if(!e)return null;let{class:t,style:i}=e;return t&&!se(t)&&(e.class=Hs(t)),i&&(e.style=Vs(i)),e}var Cp=bt("html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot"),Tp=bt("svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view"),Np=bt("annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics"),Ap=bt("area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr"),Ep=bt("itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly");function Jt(e,t){let i,s;if(e===t)return!0;let n=(i=e,Ne.call(i)==="[object Date]"),r=(s=t,Ne.call(s)==="[object Date]");if(n||r)return!!n&&!!r&&e.getTime()===t.getTime();if(n=Ze(e),r=Ze(t),n||r)return e===t;if(n=J(e),r=J(t),n||r)return!!n&&!!r&&function(a,l){if(a.length!==l.length)return!1;let o=!0;for(let c=0;o&&c<a.length;c++)o=Jt(a[c],l[c]);return o}(e,t);if(n=fe(e),r=fe(t),n||r){if(!n||!r||Object.keys(e).length!==Object.keys(t).length)return!1;for(let a in e){let l=e.hasOwnProperty(a),o=t.hasOwnProperty(a);if(l&&!o||!l&&o||!Jt(e[a],t[a]))return!1}}return String(e)===String(t)}function cr(e,t){return e.findIndex(i=>Jt(i,t))}var Ao=e=>!!(e&&e.__v_isRef===!0),Eo=e=>se(e)?e:e==null?"":J(e)||fe(e)&&(e.toString===Ne||!te(e.toString))?Ao(e)?Eo(e.value):JSON.stringify(e,Mo,2):String(e),Mo=(e,t)=>{let i;if(Ao(t))return Mo(e,t.value);if(i=t,Ne.call(i)==="[object Map]")return{[`Map(${t.size})`]:[...t.entries()].reduce((s,[n,r],a)=>(s[Mr(n,a)+" =>"]=r,s),{})};{let s;if(s=t,Ne.call(s)==="[object Set]")return{[`Set(${t.size})`]:[...t.values()].map(n=>Mr(n))};{if(Ze(t))return Mr(t);let n;if(fe(t)&&!J(t)&&(n=t,Ne.call(n)!=="[object Object]"))return String(t)}}return t},Mr=(e,t="")=>{var i;return Ze(e)?`Symbol(${(i=e.description)!=null?i:t})`:e},Ms=class{constructor(t=!1){this.detached=t,this._active=!0,this._on=0,this.effects=[],this.cleanups=[],this._isPaused=!1,this._warnOnRun=!0,this.__v_skip=!0,!t&&ze&&(ze.active?(this.parent=ze,this.index=(ze.scopes||(ze.scopes=[])).push(this)-1):(this._active=!1,this._warnOnRun=!1))}get active(){return this._active}pause(){if(this._active){let t,i;if(this._isPaused=!0,this.scopes){let s=this.scopes.slice();for(t=0,i=s.length;t<i;t++)s[t].pause()}for(t=0,i=this.effects.length;t<i;t++)this.effects[t].pause()}}resume(){if(this._active&&this._isPaused){let t,i;if(this._isPaused=!1,this.scopes){let n=this.scopes.slice();for(t=0,i=n.length;t<i;t++)n[t].resume()}let s=this.effects.slice();for(t=0,i=s.length;t<i;t++)s[t].resume()}}run(t){if(this._active){let i=ze;try{return ze=this,t()}finally{ze=i}}}on(){++this._on==1&&(this.prevScope=ze,ze=this)}off(){if(this._on>0&&--this._on==0){if(ze===this)ze=this.prevScope;else{let t=ze;for(;t;){if(t.prevScope===this){t.prevScope=this.prevScope;break}t=t.prevScope}}this.prevScope=void 0}}stop(t){if(this._active){let i,s;for(this._active=!1,i=0,s=this.effects.length;i<s;i++)this.effects[i].stop();for(this.effects.length=0,i=0,s=this.cleanups.length;i<s;i++)this.cleanups[i]();if(this.cleanups.length=0,this.scopes){let n=this.scopes.slice();for(i=0,s=n.length;i<s;i++)n[i].stop(!0);this.scopes.length=0}if(!this.detached&&this.parent&&!t){let n=this.parent.scopes.pop();n&&n!==this&&(this.parent.scopes[this.index]=n,n.index=this.index)}this.parent=void 0}}};function Mp(e){return new Ms(e)}function Io(){return ze}function Ip(e,t=!1){ze&&ze.cleanups.push(e)}var Ir=new WeakSet,Ni=class{constructor(t){this.fn=t,this.deps=void 0,this.depsTail=void 0,this.flags=5,this.next=void 0,this.cleanup=void 0,this.scheduler=void 0,ze&&(ze.active?ze.effects.push(this):this.flags&=-2)}pause(){this.flags|=64}resume(){64&this.flags&&(this.flags&=-65,Ir.has(this)&&(Ir.delete(this),this.trigger()))}notify(){(!(2&this.flags)||32&this.flags)&&(8&this.flags||Ro(this))}run(){if(!(1&this.flags))return this.fn();this.flags|=2,gl(this),Oo(this);let t=ke,i=Tt;ke=this,Tt=!0;try{return this.fn()}finally{Po(this),ke=t,Tt=i,this.flags&=-3}}stop(){if(1&this.flags){for(let t=this.deps;t;t=t.nextDep)Ia(t);this.deps=this.depsTail=void 0,gl(this),this.onStop&&this.onStop(),this.flags&=-2}}trigger(){64&this.flags?Ir.add(this):this.scheduler?this.scheduler():this.runIfDirty()}runIfDirty(){Gr(this)&&this.run()}get dirty(){return Gr(this)}},dr=0;function Ro(e,t=!1){if(e.flags|=8,t){e.next=Ss,Ss=e;return}e.next=_s,_s=e}function Ma(){let e;if(!(--dr>0)){if(Ss){let t=Ss;for(Ss=void 0;t;){let i=t.next;t.next=void 0,t.flags&=-9,t=i}}for(;_s;){let t=_s;for(_s=void 0;t;){let i=t.next;if(t.next=void 0,t.flags&=-9,1&t.flags)try{t.trigger()}catch(s){e||(e=s)}t=i}}if(e)throw e}}function Oo(e){for(let t=e.deps;t;t=t.nextDep)t.version=-1,t.prevActiveLink=t.dep.activeLink,t.dep.activeLink=t}function Po(e){let t,i=e.depsTail,s=i;for(;s;){let n=s.prevDep;s.version===-1?(s===i&&(i=n),Ia(s),function(r){let{prevDep:a,nextDep:l}=r;a&&(a.nextDep=l,r.prevDep=void 0),l&&(l.prevDep=a,r.nextDep=void 0)}(s)):t=s,s.dep.activeLink=s.prevActiveLink,s.prevActiveLink=void 0,s=n}e.deps=t,e.depsTail=i}function Gr(e){for(let t=e.deps;t;t=t.nextDep)if(t.dep.version!==t.version||t.dep.computed&&(Lo(t.dep.computed)||t.dep.version!==t.version))return!0;return!!e._dirty}function Lo(e){if(4&e.flags&&!(16&e.flags)||(e.flags&=-17,e.globalVersion===Is)||(e.globalVersion=Is,!e.isSSR&&128&e.flags&&(!e.deps&&!e._dirty||!Gr(e))))return;e.flags|=2;let t=e.dep,i=ke,s=Tt;ke=e,Tt=!0;try{Oo(e);let n=e.fn(e._value);(t.version===0||De(n,e._value))&&(e.flags|=128,e._value=n,t.version++)}catch(n){throw t.version++,n}finally{ke=i,Tt=s,Po(e),e.flags&=-3}}function Ia(e,t=!1){let{dep:i,prevSub:s,nextSub:n}=e;if(s&&(s.nextSub=n,e.prevSub=void 0),n&&(n.prevSub=s,e.nextSub=void 0),i.subs===e&&(i.subs=s,!s&&i.computed)){i.computed.flags&=-5;for(let r=i.computed.deps;r;r=r.nextDep)Ia(r,!0)}t||--i.sc||!i.map||i.map.delete(i.key)}function Rp(e,t){e.effect instanceof Ni&&(e=e.effect.fn);let i=new Ni(e);t&&ce(i,t);try{i.run()}catch(n){throw i.stop(),n}let s=i.run.bind(i);return s.effect=i,s}function Op(e){e.effect.stop()}var Tt=!0,Fo=[];function Gt(){Fo.push(Tt),Tt=!1}function Yt(){let e=Fo.pop();Tt=e===void 0||e}function gl(e){let{cleanup:t}=e;if(e.cleanup=void 0,t){let i=ke;ke=void 0;try{t()}finally{ke=i}}}var Is=0,Yr=class{constructor(t,i){this.sub=t,this.dep=i,this.version=i.version,this.nextDep=this.prevDep=this.nextSub=this.prevSub=this.prevActiveLink=void 0}},ts=class{constructor(t){this.computed=t,this.version=0,this.activeLink=void 0,this.subs=void 0,this.map=void 0,this.key=void 0,this.sc=0,this.__v_skip=!0}track(t){if(!ke||!Tt||ke===this.computed)return;let i=this.activeLink;if(i===void 0||i.sub!==ke)i=this.activeLink=new Yr(ke,this),ke.deps?(i.prevDep=ke.depsTail,ke.depsTail.nextDep=i,ke.depsTail=i):ke.deps=ke.depsTail=i,function s(n){if(n.dep.sc++,4&n.sub.flags){let r=n.dep.computed;if(r&&!n.dep.subs){r.flags|=20;for(let l=r.deps;l;l=l.nextDep)s(l)}let a=n.dep.subs;a!==n&&(n.prevSub=a,a&&(a.nextSub=n)),n.dep.subs=n}}(i);else if(i.version===-1&&(i.version=this.version,i.nextDep)){let s=i.nextDep;s.prevDep=i.prevDep,i.prevDep&&(i.prevDep.nextDep=s),i.prevDep=ke.depsTail,i.nextDep=void 0,ke.depsTail.nextDep=i,ke.depsTail=i,ke.deps===i&&(ke.deps=s)}return i}trigger(t){this.version++,Is++,this.notify(t)}notify(t){dr++;try{for(let i=this.subs;i;i=i.prevSub)i.sub.notify()&&i.sub.dep.notify()}finally{Ma()}}},Nn=new WeakMap,Si=Symbol(""),Xr=Symbol(""),Rs=Symbol("");function Ye(e,t,i){if(Tt&&ke){let s=Nn.get(e);s||Nn.set(e,s=new Map);let n=s.get(i);n||(s.set(i,n=new ts),n.map=s,n.key=i),n.track()}}function Dt(e,t,i,s,n,r){let a=Nn.get(e);if(!a)return void Is++;let l=o=>{o&&o.trigger()};if(dr++,t==="clear")a.forEach(l);else{let o=J(e),c=o&&rr(i);if(o&&i==="length"){let d=Number(s);a.forEach((p,m)=>{(m==="length"||m===Rs||!Ze(m)&&m>=d)&&l(p)})}else switch((i!==void 0||a.has(void 0))&&l(a.get(i)),c&&l(a.get(Rs)),t){case"add":if(o)c&&l(a.get("length"));else{let p;l(a.get(Si)),p=e,Ne.call(p)==="[object Map]"&&l(a.get(Xr))}break;case"delete":if(!o){let p;l(a.get(Si)),p=e,Ne.call(p)==="[object Map]"&&l(a.get(Xr))}break;case"set":let d;d=e,Ne.call(d)==="[object Map]"&&l(a.get(Si))}}Ma()}function Bi(e){let t=pe(e);return t===e?t:(Ye(t,"iterate",Rs),ut(e)?t:t.map(Nt))}function pr(e){return Ye(e=pe(e),"iterate",Rs),e}function Ot(e,t){return Pt(e)?Ht(e)?Yi(Nt(t)):Yi(t):Nt(t)}var Pp={__proto__:null,[Symbol.iterator](){return Rr(this,Symbol.iterator,e=>Ot(this,e))},concat(...e){return Bi(this).concat(...e.map(t=>J(t)?Bi(t):t))},entries(){return Rr(this,"entries",e=>(e[1]=Ot(this,e[1]),e))},every(e,t){return Ft(this,"every",e,t,void 0,arguments)},filter(e,t){return Ft(this,"filter",e,t,i=>i.map(s=>Ot(this,s)),arguments)},find(e,t){return Ft(this,"find",e,t,i=>Ot(this,i),arguments)},findIndex(e,t){return Ft(this,"findIndex",e,t,void 0,arguments)},findLast(e,t){return Ft(this,"findLast",e,t,i=>Ot(this,i),arguments)},findLastIndex(e,t){return Ft(this,"findLastIndex",e,t,void 0,arguments)},forEach(e,t){return Ft(this,"forEach",e,t,void 0,arguments)},includes(...e){return Or(this,"includes",e)},indexOf(...e){return Or(this,"indexOf",e)},join(e){return Bi(this).join(e)},lastIndexOf(...e){return Or(this,"lastIndexOf",e)},map(e,t){return Ft(this,"map",e,t,void 0,arguments)},pop(){return fs(this,"pop")},push(...e){return fs(this,"push",e)},reduce(e,...t){return bl(this,"reduce",e,t)},reduceRight(e,...t){return bl(this,"reduceRight",e,t)},shift(){return fs(this,"shift")},some(e,t){return Ft(this,"some",e,t,void 0,arguments)},splice(...e){return fs(this,"splice",e)},toReversed(){return Bi(this).toReversed()},toSorted(e){return Bi(this).toSorted(e)},toSpliced(...e){return Bi(this).toSpliced(...e)},unshift(...e){return fs(this,"unshift",e)},values(){return Rr(this,"values",e=>Ot(this,e))}};function Rr(e,t,i){let s=pr(e),n=s[t]();return s===e||ut(e)||(n._next=n.next,n.next=()=>{let r=n._next();return r.done||(r.value=i(r.value)),r}),n}var Lp=Array.prototype;function Ft(e,t,i,s,n,r){let a=pr(e),l=a!==e&&!ut(e),o=a[t];if(o!==Lp[t]){let p=o.apply(e,r);return l?Nt(p):p}let c=i;a!==e&&(l?c=function(p,m){return i.call(this,Ot(e,p),m,e)}:i.length>2&&(c=function(p,m){return i.call(this,p,m,e)}));let d=o.call(a,c,s);return l&&n?n(d):d}function bl(e,t,i,s){let n=pr(e),r=n!==e&&!ut(e),a=i,l=!1;n!==e&&(r?(l=s.length===0,a=function(c,d,p){return l&&(l=!1,c=Ot(e,c)),i.call(this,c,Ot(e,d),p,e)}):i.length>3&&(a=function(c,d,p){return i.call(this,c,d,p,e)}));let o=n[t](a,...s);return l?Ot(e,o):o}function Or(e,t,i){let s=pe(e);Ye(s,"iterate",Rs);let n=s[t](...i);return(n===-1||n===!1)&&Ks(i[0])?(i[0]=pe(i[0]),s[t](...i)):n}function fs(e,t,i=[]){Gt(),dr++;let s=pe(e)[t].apply(e,i);return Ma(),Yt(),s}var Fp=bt("__proto__,__v_isRef,__isVue"),zo=new Set(Object.getOwnPropertyNames(Symbol).filter(e=>e!=="arguments"&&e!=="caller").map(e=>Symbol[e]).filter(Ze));function zp(e){Ze(e)||(e=String(e));let t=pe(this);return Ye(t,"has",e),t.hasOwnProperty(e)}var An=class{constructor(t=!1,i=!1){this._isReadonly=t,this._isShallow=i}get(t,i,s){if(i==="__v_skip")return t.__v_skip;let n=this._isReadonly,r=this._isShallow;if(i==="__v_isReactive")return!n;if(i==="__v_isReadonly")return n;if(i==="__v_isShallow")return r;if(i==="__v_raw")return s===(n?r?$o:Do:r?jo:Bo).get(t)||Object.getPrototypeOf(t)===Object.getPrototypeOf(s)?t:void 0;let a=J(t);if(!n){let o;if(a&&(o=Pp[i]))return o;if(i==="hasOwnProperty")return zp}let l=Reflect.get(t,i,Fe(t)?t:s);if((Ze(i)?zo.has(i):Fp(i))||(n||Ye(t,"get",i),r))return l;if(Fe(l)){let o=a&&rr(i)?l:l.value;return n&&fe(o)?In(o):o}return fe(l)?n?In(l):ui(l):l}},En=class extends An{constructor(t=!1){super(!1,t)}set(t,i,s,n){let r=t[i],a=J(t)&&rr(i);if(!this._isShallow){let c=Pt(r);if(ut(s)||Pt(s)||(r=pe(r),s=pe(s)),!a&&Fe(r)&&!Fe(s))return c||(r.value=s),!0}let l=a?Number(i)<t.length:me(t,i),o=Reflect.set(t,i,s,Fe(t)?t:n);return t===pe(n)&&o&&(l?De(s,r)&&Dt(t,"set",i,s):Dt(t,"add",i,s)),o}deleteProperty(t,i){let s=me(t,i);t[i];let n=Reflect.deleteProperty(t,i);return n&&s&&Dt(t,"delete",i,void 0),n}has(t,i){let s=Reflect.has(t,i);return Ze(i)&&zo.has(i)||Ye(t,"has",i),s}ownKeys(t){return Ye(t,"iterate",J(t)?"length":Si),Reflect.ownKeys(t)}},Mn=class extends An{constructor(t=!1){super(!0,t)}set(t,i){return!0}deleteProperty(t,i){return!0}},Bp=new En,jp=new Mn,Dp=new En(!0),$p=new Mn(!0),Pr=e=>e;function on(e){return function(){return e!=="delete"&&(e==="clear"?void 0:this)}}function ur(e,t){let i,s=(ce(i={get(n){let r=this.__v_raw,a=pe(r),l=pe(n);e||(De(n,l)&&Ye(a,"get",n),Ye(a,"get",l));let{has:o}=Reflect.getPrototypeOf(a),c=t?Pr:e?Yi:Nt;return o.call(a,n)?c(r.get(n)):o.call(a,l)?c(r.get(l)):void(r!==a&&r.get(n))},get size(){let n=this.__v_raw;return e||Ye(pe(n),"iterate",Si),n.size},has(n){let r=this.__v_raw,a=pe(r),l=pe(n);return e||(De(n,l)&&Ye(a,"has",n),Ye(a,"has",l)),n===l?r.has(n):r.has(n)||r.has(l)},forEach(n,r){let a=this,l=a.__v_raw,o=pe(l),c=t?Pr:e?Yi:Nt;return e||Ye(o,"iterate",Si),l.forEach((d,p)=>n.call(r,c(d),c(p),a))}},e?{add:on("add"),set:on("set"),delete:on("delete"),clear:on("clear")}:{add(n){let r=pe(this),a=Reflect.getPrototypeOf(r),l=pe(n),o=t||ut(n)||Pt(n)?n:l;return a.has.call(r,o)||De(n,o)&&a.has.call(r,n)||De(l,o)&&a.has.call(r,l)||(r.add(o),Dt(r,"add",o,o)),this},set(n,r){t||ut(r)||Pt(r)||(r=pe(r));let a=pe(this),{has:l,get:o}=Reflect.getPrototypeOf(a),c=l.call(a,n);c||(n=pe(n),c=l.call(a,n));let d=o.call(a,n);return a.set(n,r),c?De(r,d)&&Dt(a,"set",n,r):Dt(a,"add",n,r),this},delete(n){let r=pe(this),{has:a,get:l}=Reflect.getPrototypeOf(r),o=a.call(r,n);o||(n=pe(n),o=a.call(r,n)),l&&l.call(r,n);let c=r.delete(n);return o&&Dt(r,"delete",n,void 0),c},clear(){let n=pe(this),r=n.size!==0,a=n.clear();return r&&Dt(n,"clear",void 0,void 0),a}}),["keys","values","entries",Symbol.iterator].forEach(n=>{i[n]=function(...r){let a,l=this.__v_raw,o=pe(l),c=(a=o,Ne.call(a)==="[object Map]"),d=n==="entries"||n===Symbol.iterator&&c,p=l[n](...r),m=t?Pr:e?Yi:Nt;return e||Ye(o,"iterate",n==="keys"&&c?Xr:Si),ce(Object.create(p),{next(){let{value:y,done:f}=p.next();return f?{value:y,done:f}:{value:d?[m(y[0]),m(y[1])]:m(y),done:f}}})}}),i);return(n,r,a)=>r==="__v_isReactive"?!e:r==="__v_isReadonly"?e:r==="__v_raw"?n:Reflect.get(me(s,r)&&r in n?s:n,r,a)}var Up={get:ur(!1,!1)},Vp={get:ur(!1,!0)},Hp={get:ur(!0,!1)},Kp={get:ur(!0,!0)},Bo=new WeakMap,jo=new WeakMap,Do=new WeakMap,$o=new WeakMap;function ui(e){return Pt(e)?e:hr(e,!1,Bp,Up,Bo)}function Uo(e){return hr(e,!1,Dp,Vp,jo)}function In(e){return hr(e,!0,jp,Hp,Do)}function Qp(e){return hr(e,!0,$p,Kp,$o)}function hr(e,t,i,s,n){let r;if(!fe(e)||e.__v_raw&&!(t&&e.__v_isReactive)||e.__v_skip||!Object.isExtensible(e))return e;let a=n.get(e);if(a)return a;let l=function(c){switch(c){case"Object":case"Array":return 1;case"Map":case"Set":case"WeakMap":case"WeakSet":return 2;default:return 0}}((r=e,Ne.call(r)).slice(8,-1));if(l===0)return e;let o=new Proxy(e,l===2?s:i);return n.set(e,o),o}function Ht(e){return Pt(e)?Ht(e.__v_raw):!!(e&&e.__v_isReactive)}function Pt(e){return!!(e&&e.__v_isReadonly)}function ut(e){return!!(e&&e.__v_isShallow)}function Ks(e){return!!e&&!!e.__v_raw}function pe(e){let t=e&&e.__v_raw;return t?pe(t):e}function Vo(e){return!me(e,"__v_skip")&&Object.isExtensible(e)&&To(e,"__v_skip",!0),e}var Nt=e=>fe(e)?ui(e):e,Yi=e=>fe(e)?In(e):e;function Fe(e){return!!e&&e.__v_isRef===!0}function qs(e){return Ko(e,!1)}function Ho(e){return Ko(e,!0)}function Ko(e,t){return Fe(e)?e:new Zr(e,t)}var Zr=class{constructor(t,i){this.dep=new ts,this.__v_isRef=!0,this.__v_isShallow=!1,this._rawValue=i?t:pe(t),this._value=i?t:Nt(t),this.__v_isShallow=i}get value(){return this.dep.track(),this._value}set value(t){let i=this._rawValue,s=this.__v_isShallow||ut(t)||Pt(t);De(t=s?t:pe(t),i)&&(this._rawValue=t,this._value=s?t:Nt(t),this.dep.trigger())}};function Wp(e){e.dep&&e.dep.trigger()}function Qs(e){return Fe(e)?e.value:e}function Jp(e){return te(e)?e():Qs(e)}var Gp={get:(e,t,i)=>t==="__v_raw"?e:Qs(Reflect.get(e,t,i)),set:(e,t,i,s)=>{let n=e[t];return Fe(n)&&!Fe(i)?(n.value=i,!0):Reflect.set(e,t,i,s)}};function Ra(e){return Ht(e)?e:new Proxy(e,Gp)}var ea=class{constructor(t){this.__v_isRef=!0,this._value=void 0;let i=this.dep=new ts,{get:s,set:n}=t(i.track.bind(i),i.trigger.bind(i));this._get=s,this._set=n}get value(){return this._value=this._get()}set value(t){this._set(t)}};function Qo(e){return new ea(e)}function Yp(e){let t=J(e)?Array(e.length):{};for(let i in e)t[i]=new Rn(e,i,void 0);return t}var Rn=class{constructor(t,i,s){this._object=t,this._defaultValue=s,this.__v_isRef=!0,this._value=void 0,this._key=Ze(i)?i:String(i),this._raw=pe(t);let n=!0,r=t;if(!J(t)||Ze(this._key)||!rr(this._key))do n=!Ks(r)||ut(r);while(n&&(r=r.__v_raw));this._shallow=n}get value(){let t=this._object[this._key];return this._shallow&&(t=Qs(t)),this._value=t===void 0?this._defaultValue:t}set value(t){if(this._shallow&&Fe(this._raw[this._key])){let i=this._object[this._key];if(Fe(i)){i.value=t;return}}this._object[this._key]=t}get dep(){var t,i;let s;return t=this._raw,i=this._key,(s=Nn.get(t))&&s.get(i)}},ta=class{constructor(t){this._getter=t,this.__v_isRef=!0,this.__v_isReadonly=!0,this._value=void 0}get value(){return this._value=this._getter()}};function Xp(e,t,i){return Fe(e)?e:te(e)?new ta(e):!fe(e)||!(arguments.length>1)?qs(e):new Rn(e,t,i)}var ia=class{constructor(t,i,s){this.fn=t,this.setter=i,this._value=void 0,this.dep=new ts(this),this.__v_isRef=!0,this.deps=void 0,this.depsTail=void 0,this.flags=16,this.globalVersion=Is-1,this.next=void 0,this.effect=this,this.__v_isReadonly=!i,this.isSSR=s}notify(){if(this.flags|=16,!(8&this.flags)&&ke!==this)return Ro(this,!0),!0}get value(){let t=this.dep.track();return Lo(this),t&&(t.version=this.dep.version),this._value}set value(t){this.setter&&this.setter(t)}},Zp={GET:"get",HAS:"has",ITERATE:"iterate"},eu={SET:"set",ADD:"add",DELETE:"delete",CLEAR:"clear"},cn={},On=new WeakMap;function tu(){return ai}function Wo(e,t=!1,i=ai){if(i){let s=On.get(i);s||On.set(i,s=[]),s.push(e)}}function $t(e,t=1/0,i){if(t<=0||!fe(e)||e.__v_skip||((i=i||new Map).get(e)||0)>=t)return e;if(i.set(e,t),t--,Fe(e))$t(e.value,t,i);else if(J(e))for(let s=0;s<e.length;s++)$t(e[s],t,i);else{let s,n;if(s=e,Ne.call(s)==="[object Set]"||(n=e,Ne.call(n)==="[object Map]"))e.forEach(r=>{$t(r,t,i)});else{let r;if(r=e,Ne.call(r)==="[object Object]"){for(let a in e)$t(e[a],t,i);for(let a of Object.getOwnPropertySymbols(e))Object.prototype.propertyIsEnumerable.call(e,a)&&$t(e[a],t,i)}}}return e}function iu(e,t){}var su={SETUP_FUNCTION:0,0:"SETUP_FUNCTION",RENDER_FUNCTION:1,1:"RENDER_FUNCTION",NATIVE_EVENT_HANDLER:5,5:"NATIVE_EVENT_HANDLER",COMPONENT_EVENT_HANDLER:6,6:"COMPONENT_EVENT_HANDLER",VNODE_HOOK:7,7:"VNODE_HOOK",DIRECTIVE_HOOK:8,8:"DIRECTIVE_HOOK",TRANSITION_HOOK:9,9:"TRANSITION_HOOK",APP_ERROR_HANDLER:10,10:"APP_ERROR_HANDLER",APP_WARN_HANDLER:11,11:"APP_WARN_HANDLER",FUNCTION_REF:12,12:"FUNCTION_REF",ASYNC_COMPONENT_LOADER:13,13:"ASYNC_COMPONENT_LOADER",SCHEDULER:14,14:"SCHEDULER",COMPONENT_UPDATE:15,15:"COMPONENT_UPDATE",APP_UNMOUNT_CLEANUP:16,16:"APP_UNMOUNT_CLEANUP"};function ls(e,t,i,s){try{return s?e(...s):e()}catch(n){Li(n,t,i)}}function vt(e,t,i,s){if(te(e)){let n=ls(e,t,i,s);return n&&Ea(n)&&n.catch(r=>{Li(r,t,i)}),n}if(J(e)){let n=[];for(let r=0;r<e.length;r++)n.push(vt(e[r],t,i,s));return n}}function Li(e,t,i,s=!0){let n=t?t.vnode:null,{errorHandler:r,throwUnhandledErrorInProduction:a}=t&&t.appContext.config||de;if(t){let l=t.parent,o=t.proxy,c=`https://vuejs.org/error-reference/#runtime-${i}`;for(;l;){let d=l.ec;if(d){for(let p=0;p<d.length;p++)if(d[p](e,o,c)===!1)return}l=l.parent}if(r){Gt(),ls(r,null,10,[e,o,c]),Yt();return}}(function(l,o=!0,c=!1){if(c)throw l;console.error(l)})(e,s,a)}var nt=[],It=-1,Xi=[],li=null,Di=0,Jo=Promise.resolve(),kn=null;function fr(e){let t=kn||Jo;return e?t.then(this?e.bind(this):e):t}function Oa(e){if(!(1&e.flags)){let t=Cs(e),i=nt[nt.length-1];!i||!(2&e.flags)&&t>=Cs(i)?nt.push(e):nt.splice(function(s){let n=It+1,r=nt.length;for(;n<r;){let a=n+r>>>1,l=nt[a],o=Cs(l);o<s||o===s&&2&l.flags?n=a+1:r=a}return n}(t),0,e),e.flags|=1,Go()}}function Go(){kn||(kn=Jo.then(function e(t){try{for(It=0;It<nt.length;It++){let i=nt[It];i&&!(8&i.flags)&&(4&i.flags&&(i.flags&=-2),ls(i,i.i,i.i?15:14),4&i.flags||(i.flags&=-2))}}finally{for(;It<nt.length;It++){let i=nt[It];i&&(i.flags&=-2)}It=-1,nt.length=0,Pn(),kn=null,(nt.length||Xi.length)&&e()}}))}function Os(e){J(e)?Xi.push(...e):li&&e.id===-1?li.splice(Di+1,0,e):1&e.flags||(Xi.push(e),e.flags|=1),Go()}function yl(e,t,i=It+1){for(;i<nt.length;i++){let s=nt[i];if(s&&2&s.flags){if(e&&s.id!==e.uid)continue;nt.splice(i,1),i--,4&s.flags&&(s.flags&=-2),s(),4&s.flags||(s.flags&=-2)}}}function Pn(e){if(Xi.length){let t=[...new Set(Xi)].sort((i,s)=>Cs(i)-Cs(s));if(Xi.length=0,li)return void li.push(...t);for(li=t,Di=0;Di<li.length;Di++){let i=li[Di];4&i.flags&&(i.flags&=-2),8&i.flags||i(),i.flags&=-2}li=null,Di=0}}var Cs=e=>e.id==null?2&e.flags?-1:1/0:e.id,Qe=null,mr=null;function Ps(e){let t=Qe;return Qe=e,mr=e&&e.type.__scopeId||null,t}function nu(e){mr=e}function ru(){mr=null}var au=e=>Pa;function Pa(e,t=Qe,i){if(!t||e._n)return e;let s=(...n)=>{let r;s._d&&zs(-1);let a=Ps(t),l=Qt.length;try{r=e(...n)}finally{for(let o=Qt.length;o>l;o--)xr();Ps(a),s._d&&zs(1)}return r};return s._n=!0,s._c=!0,s._d=!0,s}function lu(e,t){if(Qe===null)return e;let i=Xs(Qe),s=e.dirs||(e.dirs=[]);for(let n=0;n<t.length;n++){let[r,a,l,o=de]=t[n];r&&(te(r)&&(r={mounted:r,updated:r}),r.deep&&$t(a),s.push({dir:r,instance:i,value:a,oldValue:void 0,arg:l,modifiers:o}))}return e}function Rt(e,t,i,s){let n=e.dirs,r=t&&t.dirs;for(let a=0;a<n.length;a++){let l=n[a];r&&(l.oldValue=r[a].value);let o=l.dir[s];o&&(Gt(),vt(o,i,8,[e.el,l,e,t]),Yt())}}function Yo(e,t){if(Ke){let i=Ke.provides,s=Ke.parent&&Ke.parent.provides;s===i&&(i=Ke.provides=Object.create(s)),i[e]=t}}function Ts(e,t,i=!1){let s=rt();if(s||qi){let n=qi?qi._context.provides:s?s.parent==null||s.ce?s.vnode.appContext&&s.vnode.appContext.provides:s.parent.provides:void 0;if(n&&e in n)return n[e];if(arguments.length>1)return i&&te(t)?t.call(s&&s.proxy):t}}function ou(){return!!(rt()||qi)}var Xo=Symbol.for("v-scx"),Zo=()=>Ts(Xo);function cu(e,t){return Ws(e,null,t)}function du(e,t){return Ws(e,null,{flush:"post"})}function ec(e,t){return Ws(e,null,{flush:"sync"})}function Zi(e,t,i){return Ws(e,t,i)}function Ws(e,t,i=de){let s,{immediate:n,flush:r}=i,a=ce({},i),l=t&&n||!t&&r!=="post";if(Ei){if(r==="sync"){let p=Zo();s=p.__watcherHandles||(p.__watcherHandles=[])}else if(!l){let p=()=>{};return p.stop=He,p.resume=He,p.pause=He,p}}let o=Ke;a.call=(p,m,y)=>vt(p,o,m,y);let c=!1;r==="post"?a.scheduler=p=>{Pe(p,o&&o.suspense)}:r!=="sync"&&(c=!0,a.scheduler=(p,m)=>{m?p():Oa(p)}),a.augmentJob=p=>{t&&(p.flags|=4),c&&(p.flags|=2,o&&(p.id=o.uid,p.i=o))};let d=function(p,m,y=de){let f,x,S,C,{immediate:u,deep:h,once:g,scheduler:w,augmentJob:k,call:_}=y,T=N=>h?N:ut(N)||h===!1||h===0?$t(N,1):$t(N),R=!1,O=!1;if(Fe(p)?(x=()=>p.value,R=ut(p)):Ht(p)?(x=()=>T(p),R=!0):J(p)?(O=!0,R=p.some(N=>Ht(N)||ut(N)),x=()=>p.map(N=>Fe(N)?N.value:Ht(N)?T(N):te(N)?_?_(N,2):N():void 0)):x=te(p)?m?_?()=>_(p,2):p:()=>{if(S){Gt();try{S()}finally{Yt()}}let N=ai;ai=f;try{return _?_(p,3,[C]):p(C)}finally{ai=N}}:He,m&&h){let N=x,K=h===!0?1/0:h;x=()=>$t(N(),K)}let j=Io(),q=()=>{f.stop(),j&&j.active&&Aa(j.effects,f)};if(g&&m){let N=m;m=(...K)=>{let U=N(...K);return q(),U}}let z=O?Array(p.length).fill(cn):cn,F=N=>{if(1&f.flags&&(f.dirty||N))if(m){let K=f.run();if(N||h||R||(O?K.some((U,W)=>De(U,z[W])):De(K,z))){S&&S();let U=ai;ai=f;try{let W=[K,z===cn?void 0:O&&z[0]===cn?[]:z,C];z=K,_?_(m,3,W):m(...W)}finally{ai=U}}}else f.run()};return k&&k(F),(f=new Ni(x)).scheduler=w?()=>w(F,!1):F,C=N=>Wo(N,!1,f),S=f.onStop=()=>{let N=On.get(f);if(N){if(_)_(N,4);else for(let K of N)K();On.delete(f)}},m?u?F(!0):z=f.run():w?w(F.bind(null,!0),!0):f.run(),q.pause=f.pause.bind(f),q.resume=f.resume.bind(f),q.stop=q,q}(e,t,a);return Ei&&(s?s.push(d):l&&d()),d}function pu(e,t,i){let s,n=this.proxy,r=se(e)?e.includes(".")?tc(n,e):()=>n[e]:e.bind(n,n);te(t)?s=t:(s=t.handler,i=t);let a=os(this),l=Ws(r,s.bind(n),i);return a(),l}function tc(e,t){let i=t.split(".");return()=>{let s=e;for(let n=0;n<i.length&&s;n++)s=s[i[n]];return s}}var ni=new WeakMap,ic=Symbol("_vte"),yi=e=>e&&(e.disabled||e.disabled===""),xl=e=>"u">typeof SVGElement&&e instanceof SVGElement,wl=e=>typeof MathMLElement=="function"&&e instanceof MathMLElement,Lr=(e,t)=>{let i=e&&e.to;return se(i)?t?t(i):null:i};function dn(e,t,i,{o:{insert:s},m:n},r=2){r===0&&s(e.targetAnchor,t,i);let{el:a,anchor:l,shapeFlag:o,children:c,props:d}=e,p=r===2;if(p&&s(a,t,i),!ni.has(e)&&(!p||yi(d))&&16&o)for(let m=0;m<c.length;m++)n(c[m],t,i,2);p&&s(l,t,i)}var uu={name:"Teleport",__isTeleport:!0,process(e,t,i,s,n,r,a,l,o,c){let{mc:d,pc:p,pbc:m,o:{insert:y,querySelector:f,createText:x,parentNode:S}}=c,C=yi(t.props),{dynamicChildren:u}=t,h=(k,_,T)=>{16&k.shapeFlag&&d(k.children,_,T,n,r,a,l,o)},g=(k=t)=>{let _=yi(k.props),T=k.target=Lr(k.props,f),R=Fr(T,k,x,y);T&&(a!=="svg"&&xl(T)?a="svg":a!=="mathml"&&wl(T)&&(a="mathml"),n&&n.isCE&&(n.ce._teleportTargets||(n.ce._teleportTargets=new Set)).add(T),_||(h(k,T,R),ms(k,!1)))},w=k=>{let _=()=>{if(ni.get(k)===_){if(ni.delete(k),yi(k.props)){let T=S(k.el)||i;h(k,T,k.anchor),ms(k,!0)}g(k)}};ni.set(k,_),Pe(_,r)};if(e==null){let k,_=t.el=x(""),T=t.anchor=x("");if(y(_,i,s),y(T,i,s),(k=t.props)&&(k.defer||k.defer==="")||r&&r.pendingBranch)return void w(t);C&&(h(t,i,T),ms(t,!0)),g()}else{t.el=e.el;let k=t.anchor=e.anchor,_=ni.get(e);if(_){_.flags|=8,ni.delete(e),w(t);return}t.targetStart=e.targetStart;let T=t.target=e.target,R=t.targetAnchor=e.targetAnchor,O=yi(e.props),j=O?i:T,q=O?k:R;if(a==="svg"||xl(T)?a="svg":(a==="mathml"||wl(T))&&(a="mathml"),u?(m(e.dynamicChildren,u,j,n,r,a,l),Qa(e,t,!0)):o||p(e,t,j,q,n,r,a,l,!1),C)O?t.props&&e.props&&t.props.to!==e.props.to&&(t.props.to=e.props.to):dn(t,i,k,c,1);else if((t.props&&t.props.to)!==(e.props&&e.props.to)){let z=Lr(t.props,f);z&&(t.target=z,dn(t,z,null,c,0))}else O&&dn(t,T,R,c,1);ms(t,C)}},remove(e,t,i,{um:s,o:{remove:n}},r){let{shapeFlag:a,children:l,anchor:o,targetStart:c,targetAnchor:d,target:p,props:m}=e,y=yi(m),f=r||!y,x=ni.get(e);if(x&&(x.flags|=8,ni.delete(e)),p&&(n(c),n(d)),r&&n(o),!x&&(y||p)&&16&a)for(let S=0;S<l.length;S++){let C=l[S];s(C,t,i,f,!!C.dynamicChildren)}},move:dn,hydrate:function(e,t,i,s,n,r,{o:{nextSibling:a,parentNode:l,querySelector:o,insert:c,createText:d}},p){function m(S,C){let u=C;for(;u;){if(u&&u.nodeType===8){if(u.data==="teleport start anchor")t.targetStart=u;else if(u.data==="teleport anchor"){t.targetAnchor=u,S._lpa=t.targetAnchor&&a(t.targetAnchor);break}}u=a(u)}}function y(S,C){C.anchor=p(a(S),C,l(S),i,s,n,r)}let f=t.target=Lr(t.props,o),x=yi(t.props);if(f){let S=f._lpa||f.firstChild;16&t.shapeFlag&&(x?(y(e,t),m(f,S),t.targetAnchor||Fr(f,t,d,c,l(e)===f?e:null)):(t.anchor=a(e),m(f,S),t.targetAnchor||Fr(f,t,d,c),p(S&&a(S),t,f,i,s,n,r))),ms(t,x)}else x&&16&t.shapeFlag&&(y(e,t),t.targetStart=e,t.targetAnchor=a(e));return t.anchor&&a(t.anchor)}};function ms(e,t){let i=e.ctx;if(i&&i.ut){let s,n;for(t?(s=e.el,n=e.anchor):(s=e.targetStart,n=e.targetAnchor);s&&s!==n;)s.nodeType===1&&s.setAttribute("data-v-owner",i.uid),s=s.nextSibling;i.ut()}}function Fr(e,t,i,s,n=null){let r=t.targetStart=i(""),a=t.targetAnchor=i("");return r[ic]=a,e&&(s(r,e,n),s(a,e,n)),a}var kt=Symbol("_leaveCb"),vs=Symbol("_enterCb");function La(){let e={isMounted:!1,isLeaving:!1,isUnmounting:!1,leavingVNodes:new Map};return Gs(()=>{e.isMounted=!0}),br(()=>{e.isUnmounting=!0}),e}var wt=[Function,Array],Fa={mode:String,appear:Boolean,persisted:Boolean,onBeforeEnter:wt,onEnter:wt,onAfterEnter:wt,onEnterCancelled:wt,onBeforeLeave:wt,onLeave:wt,onAfterLeave:wt,onLeaveCancelled:wt,onBeforeAppear:wt,onAppear:wt,onAfterAppear:wt,onAppearCancelled:wt},sc=e=>{let t=e.subTree;return t.component?sc(t.component):t};function nc(e){let t=e[0];if(e.length>1){for(let i of e)if(i.type!==Oe){t=i;break}}return t}var rc={name:"BaseTransition",props:Fa,setup(e,{slots:t}){let i=rt(),s=La();return()=>{let n=t.default&&vr(t.default(),!0),r=n&&n.length?nc(n):i.subTree?Ic():void 0;if(!r)return;let a=pe(e),{mode:l}=a;if(s.isLeaving)return zr(r);let o=kl(r);if(!o)return zr(r);let c=is(o,a,s,i,p=>c=p);o.type!==Oe&&Xt(o,c);let d=i.subTree&&kl(i.subTree);if(d&&d.type!==Oe&&!Ct(d,o)&&sc(i).type!==Oe){let p=is(d,a,s,i);if(Xt(d,p),l==="out-in"&&o.type!==Oe)return s.isLeaving=!0,p.afterLeave=()=>{s.isLeaving=!1,8&i.job.flags||i.update(),delete p.afterLeave,d=void 0},zr(r);l==="in-out"&&o.type!==Oe?p.delayLeave=(m,y,f)=>{ac(s,d)[String(d.key)]=d,m[kt]=()=>{y(),m[kt]=void 0,delete c.delayedLeave,d=void 0},c.delayedLeave=()=>{f(),delete c.delayedLeave,d=void 0}}:d=void 0}else d&&(d=void 0);return r}}};function ac(e,t){let{leavingVNodes:i}=e,s=i.get(t.type);return s||(s=Object.create(null),i.set(t.type,s)),s}function is(e,t,i,s,n){let{appear:r,mode:a,persisted:l=!1,onBeforeEnter:o,onEnter:c,onAfterEnter:d,onEnterCancelled:p,onBeforeLeave:m,onLeave:y,onAfterLeave:f,onLeaveCancelled:x,onBeforeAppear:S,onAppear:C,onAfterAppear:u,onAppearCancelled:h}=t,g=String(e.key),w=ac(i,e),k=(R,O)=>{R&&vt(R,s,9,O)},_=(R,O)=>{let j=O[1];k(R,O),J(R)?R.every(q=>q.length<=1)&&j():R.length<=1&&j()},T={mode:a,persisted:l,beforeEnter(R){let O=o;if(!i.isMounted)if(r)O=S||o;else return;R[kt]&&R[kt](!0);let j=w[g];j&&Ct(e,j)&&j.el[kt]&&j.el[kt](),k(O,[R])},enter(R){if(w[g]===e)return;let O=c,j=d,q=p;if(!i.isMounted)if(r)O=C||c,j=u||d,q=h||p;else return;let z=!1;R[vs]=N=>{z||(z=!0,N?k(q,[R]):k(j,[R]),T.delayedLeave&&T.delayedLeave(),R[vs]=void 0)};let F=R[vs].bind(null,!1);O?_(O,[R,F]):F()},leave(R,O){let j=String(e.key);if(R[vs]&&R[vs](!0),i.isUnmounting)return O();k(m,[R]);let q=!1;R[kt]=F=>{q||(q=!0,O(),F?k(x,[R]):k(f,[R]),R[kt]=void 0,w[j]===e&&delete w[j])};let z=R[kt].bind(null,!1);w[j]=e,y?_(y,[R,z]):z()},clone(R){let O=is(R,t,i,s,n);return n&&n(O),O}};return T}function zr(e){if(Js(e))return(e=Lt(e)).children=null,e}function kl(e){if(!Js(e))return e.type.__isTeleport&&e.children?nc(e.children):e;if(e.component)return e.component.subTree;let{shapeFlag:t,children:i}=e;if(i){if(16&t)return i[0];if(32&t&&te(i.default))return i.default()}}function Xt(e,t){6&e.shapeFlag&&e.component?(e.transition=t,Xt(e.component.subTree,t)):128&e.shapeFlag?(e.ssContent.transition=t.clone(e.ssContent),e.ssFallback.transition=t.clone(e.ssFallback)):e.transition=t}function vr(e,t=!1,i){let s=[],n=0;for(let r=0;r<e.length;r++){let a=e[r],l=i==null?a.key:String(i)+String(a.key!=null?a.key:r);a.type===$e?(128&a.patchFlag&&n++,s=s.concat(vr(a.children,t,l))):(t||a.type!==Oe)&&s.push(l!=null?Lt(a,{key:l}):a)}if(n>1)for(let r=0;r<s.length;r++)s[r].patchFlag=-2;return s}function za(e,t){return te(e)?ce({name:e.name},t,{setup:e}):e}function hu(){let e=rt();return e?(e.appContext.config.idPrefix||"v")+"-"+e.ids[0]+e.ids[1]++:""}function Ba(e){e.ids=[e.ids[0]+e.ids[2]+++"-",0,0]}function fu(e){let t=rt(),i=Ho(null);return t&&Object.defineProperty(t.refs===de?t.refs={}:t.refs,e,{enumerable:!0,get:()=>i.value,set:s=>i.value=s}),i}function _l(e,t){let i;return!!((i=Object.getOwnPropertyDescriptor(e,t))&&!i.configurable)}var Ln=new WeakMap;function es(e,t,i,s,n=!1){if(J(e))return void e.forEach((x,S)=>es(x,t&&(J(t)?t[S]:t),i,s,n));if(Kt(s)&&!n){512&s.shapeFlag&&s.type.__asyncResolved&&s.component.subTree.component&&es(e,t,i,s.component.subTree);return}let r=4&s.shapeFlag?Xs(s.component):s.el,a=n?null:r,{i:l,r:o}=e,c=t&&t.r,d=l.refs===de?l.refs={}:l.refs,p=l.setupState,m=pe(p),y=p===de?$i:x=>!_l(d,x)&&me(m,x),f=(x,S)=>!(S&&_l(d,S));if(c!=null&&c!==o&&(Sl(t),se(c)?(d[c]=null,y(c)&&(p[c]=null)):Fe(c)&&(f(c,t.k)&&(c.value=null),t.k&&(d[t.k]=null))),te(o))ls(o,l,12,[a,d]);else{let x=se(o),S=Fe(o);if(x||S){let C=()=>{if(e.f){let u=x?y(o)?p[o]:d[o]:f()||!e.k?o.value:d[e.k];if(n)J(u)&&Aa(u,r);else if(J(u))u.includes(r)||u.push(r);else if(x)d[o]=[r],y(o)&&(p[o]=d[o]);else{let h=[r];f(o,e.k)&&(o.value=h),e.k&&(d[e.k]=h)}}else x?(d[o]=a,y(o)&&(p[o]=a)):S&&(f(o,e.k)&&(o.value=a),e.k&&(d[e.k]=a))};if(a){let u=()=>{C(),Ln.delete(e)};u.id=-1,Ln.set(e,u),Pe(u,i)}else Sl(e),C()}}}function Sl(e){let t=Ln.get(e);t&&(t.flags|=8,Ln.delete(e))}var ql=!1,ji=()=>{ql||(console.error("Hydration completed but contains mismatches."),ql=!0)},pn=e=>{if(e.nodeType===1){if(e.namespaceURI.includes("svg")&&e.tagName!=="foreignObject")return"svg";if(e.namespaceURI.includes("MathML"))return"mathml"}},Ui=e=>e.nodeType===8;function mu(e){let{mt:t,p:i,o:{patchProp:s,createText:n,nextSibling:r,parentNode:a,remove:l,insert:o,createComment:c}}=e,d=(u,h,g,w,k,_=!1)=>{_=_||!!h.dynamicChildren;let T=Ui(u)&&u.data==="[",R=()=>f(u,h,g,w,k,T),{type:O,ref:j,shapeFlag:q,patchFlag:z}=h,F=u.nodeType;h.el=u,z===-2&&(_=!1,h.dynamicChildren=null);let N=null;switch(O){case oi:F!==3?h.children===""?(o(h.el=n(""),a(u),u),N=u):N=R():(u.data!==h.children&&(ji(),u.data=h.children),N=r(u));break;case Oe:C(u)?(N=r(u),S(h.el=u.content.firstChild,u,g)):N=F!==8||T?R():r(u);break;case Ci:if(T&&(F=(u=r(u)).nodeType),F===1||F===3){N=u;let K=!h.children.length;for(let U=0;U<h.staticCount;U++)K&&(h.children+=N.nodeType===1?N.outerHTML:N.data),U===h.staticCount-1&&(h.anchor=N),N=r(N);return T?r(N):N}R();break;case $e:N=T?y(u,h,g,w,k,_):R();break;default:if(1&q)N=F===1&&h.type.toLowerCase()===u.tagName.toLowerCase()||C(u)?p(u,h,g,w,k,_):R();else if(6&q){h.slotScopeIds=k;let K=a(u);if(N=T?x(u):Ui(u)&&u.data==="teleport start"?x(u,u.data,"teleport end"):r(u),t(h,K,null,g,w,pn(K),_),Kt(h)&&!h.type.__asyncResolved){let U;T?(U=Ce($e)).anchor=N?N.previousSibling:K.lastChild:U=u.nodeType===3?Ja(""):Ce("div"),U.el=u,h.component.subTree=U}}else 64&q?N=F!==8?R():h.type.hydrate(u,h,g,w,k,_,e,m):128&q&&(N=h.type.hydrate(u,h,g,w,pn(a(u)),k,_,e,d))}return j!=null&&es(j,null,w,h),N},p=(u,h,g,w,k,_)=>{_=_||!!h.dynamicChildren;let{type:T,dynamicProps:R,props:O,patchFlag:j,shapeFlag:q,dirs:z,transition:F}=h,N=T==="input"||T==="option",K=!!R;if(N||K||j!==-1){let U;z&&Rt(h,null,g,"created");let W=!1;if(C(u)){W=Tc(null,F)&&g&&g.vnode.props&&g.vnode.props.appear;let H=u.content.firstChild;if(W){let Z=H.getAttribute("class");Z&&(H.$cls=Z),F.beforeEnter(H)}S(H,u,g),h.el=u=H}if(16&q&&!(O&&(O.innerHTML||O.textContent))){let H=m(u.firstChild,h,u,g,w,k,_);for(H&&!un(u,1)&&ji();H;){let Z=H;H=H.nextSibling,l(Z)}}else if(8&q){let H=h.children;H[0]===`
`&&(u.tagName==="PRE"||u.tagName==="TEXTAREA")&&(H=H.slice(1));let{textContent:Z}=u;Z!==H&&Z!==H.replace(/\r\n|\r/g,`
`)&&(un(u,0)||ji(),u.textContent=h.children)}if(O){if(N||K||!_||48&j){let H=u.tagName.includes("-"),Z=u.namespaceURI.includes("svg")?"svg":u.namespaceURI.includes("MathML")?"mathml":void 0;for(let ie in O)(N&&(ie.endsWith("value")||ie==="indeterminate")||Oi(ie)&&!Vt(ie)||ie[0]==="."||H&&!Vt(ie)||R&&R.includes(ie))&&s(u,ie,null,O[ie],Z,g)}else if(O.onClick)s(u,"onClick",null,O.onClick,void 0,g);else if(4&j&&Ht(O.style))for(let H in O.style)O.style[H]}(U=O&&O.onVnodeBeforeMount)&&ot(U,g,h),z&&Rt(h,null,g,"beforeMount"),((U=O&&O.onVnodeMounted)||z||W)&&Nc(()=>{U&&ot(U,g,h),W&&F.enter(u),z&&Rt(h,null,g,"mounted")},w)}return u.nextSibling},m=(u,h,g,w,k,_,T)=>{T=T||!!h.dynamicChildren;let R=h.children,O=R.length,j=!1;for(let q=0;q<O;q++){let z=T?R[q]:R[q]=ct(R[q]),F=z.type===oi;u?(F&&!T&&q+1<O&&ct(R[q+1]).type===oi&&(o(n(u.data.slice(z.children.length)),g,r(u)),u.data=z.children),u=d(u,z,w,k,_,T)):F&&!z.children?o(z.el=n(""),g):(!j&&(j=!0,un(g,1)||ji()),i(null,z,g,null,w,k,pn(g),_))}return u},y=(u,h,g,w,k,_)=>{let{slotScopeIds:T}=h;T&&(k=k?k.concat(T):T);let R=a(u),O=m(r(u),h,R,g,w,k,_);return O&&Ui(O)&&O.data==="]"?r(h.anchor=O):(ji(),o(h.anchor=c("]"),R,O),O)},f=(u,h,g,w,k,_)=>{var T,R,O;if(T=u,R=h,un(T.parentElement,1)||(O=T).nodeType===1&&sa(O.getAttribute(Fn),1)||function({props:z}){let F=z&&z[Fn];return typeof F=="string"&&sa(F,1)}(R)||ji(),h.el=null,_){let z=x(u);for(;;){let F=r(u);if(F&&F!==z)l(F);else break}}let j=r(u),q=a(u);return l(u),i(null,h,q,j,g,w,pn(q),k),g&&(g.vnode.el=h.el,yr(g,h.el)),j},x=(u,h="[",g="]")=>{let w=0;for(;u;)if((u=r(u))&&Ui(u)&&(u.data===h&&w++,u.data===g)){if(w===0)return r(u);w--}return u},S=(u,h,g)=>{let w=h.parentNode;w&&w.replaceChild(u,h);let k=g;for(;k;)k.vnode.el===h&&(k.vnode.el=k.subTree.el=u),k=k.parent},C=u=>u.nodeType===1&&u.tagName==="TEMPLATE";return[(u,h)=>{if(!h.hasChildNodes()){i(null,u,h),Pn(),h._vnode=u;return}d(h.firstChild,u,null,null,null),Pn(),h._vnode=u},d]}var Fn="data-allow-mismatch",vu={0:"text",1:"children",2:"class",3:"style",4:"attribute"};function un(e,t){if(t===0||t===1)for(;e&&!e.hasAttribute(Fn);)e=e.parentElement;return sa(e&&e.getAttribute(Fn),t)}function sa(e,t){if(e==null)return!1;{if(e==="")return!0;let i=e.split(",");return!!(t===0&&i.includes("children"))||i.includes(vu[t])}}var gu=or().requestIdleCallback||(e=>setTimeout(e,1)),bu=or().cancelIdleCallback||(e=>clearTimeout(e)),yu=(e=1e4)=>t=>{let i=gu(t,{timeout:e});return()=>bu(i)},xu=e=>(t,i)=>{let s=new IntersectionObserver(n=>{for(let r of n)if(r.isIntersecting){s.disconnect(),t();break}},e);return i(n=>{if(n instanceof Element){if(function(r){let{top:a,left:l,bottom:o,right:c}=r.getBoundingClientRect(),{innerHeight:d,innerWidth:p}=window;return(a>0&&a<d||o>0&&o<d)&&(l>0&&l<p||c>0&&c<p)}(n))return t(),s.disconnect(),!1;s.observe(n)}}),()=>s.disconnect()},wu=e=>t=>{if(e){let i=matchMedia(e);if(!i.matches)return i.addEventListener("change",t,{once:!0}),()=>i.removeEventListener("change",t);t()}},ku=(e=[])=>(t,i)=>{se(e)&&(e=[e]);let s=!1,n=a=>{s||(s=!0,r(),t(),a.target.dispatchEvent(new a.constructor(a.type,a)))},r=()=>{i(a=>{for(let l of e)a.removeEventListener(l,n)})};return i(a=>{for(let l of e)a.addEventListener(l,n,{once:!0})}),r},Kt=e=>!!e.type.__asyncLoader;function _u(e){let t;te(e)&&(e={loader:e});let{loader:i,loadingComponent:s,errorComponent:n,delay:r=200,hydrate:a,timeout:l,suspensible:o=!0,onError:c}=e,d=null,p=0,m=()=>{let y;return d||(y=d=i().catch(f=>{if(f=f instanceof Error?f:Error(String(f)),c)return new Promise((x,S)=>{c(f,()=>x((p++,d=null,m())),()=>S(f),p+1)});throw f}).then(f=>y!==d&&d?d:(f&&(f.__esModule||f[Symbol.toStringTag]==="Module")&&(f=f.default),t=f,f)))};return za({name:"AsyncComponentWrapper",__asyncLoader:m,__asyncHydrate(y,f,x){let S=y.isConnected,C=!1;(f.bu||(f.bu=[])).push(()=>C=!0);let u=()=>{C||y.parentNode&&(!S||y.isConnected)&&x()},h=a?()=>{let g=a(u,w=>function(k,_){if(Ui(k)&&k.data==="["){let T=1,R=k.nextSibling;for(;R;){if(R.nodeType===1){if(_(R)===!1)break}else if(Ui(R))if(R.data==="]"){if(--T==0)break}else R.data==="["&&T++;R=R.nextSibling}}else _(k)}(y,w));g&&(f.bum||(f.bum=[])).push(g)}:u;t?h():m().then(()=>!f.isUnmounted&&h())},get __asyncResolved(){return t},setup(){let y,f,x=Ke;if(Ba(x),t)return()=>hn(t,x);let S=g=>{d=null,Li(g,x,13,!n)};if(o&&x.suspense||Ei)return m().then(g=>()=>hn(g,x)).catch(g=>(S(g),()=>n?Ce(n,{error:g}):null));let C=qs(!1),u=qs(),h=qs(!!r);return Ys(()=>{y!=null&&clearTimeout(y),f!=null&&clearTimeout(f)}),r&&(f=setTimeout(()=>{x.isUnmounted||(h.value=!1)},r)),l!=null&&(y=setTimeout(()=>{if(!x.isUnmounted&&!C.value&&!u.value){let g=Error(`Async component timed out after ${l}ms.`);S(g),u.value=g}},l)),m().then(()=>{!x.isUnmounted&&(C.value=!0,x.parent&&Js(x.parent.vnode)&&x.parent.update())}).catch(g=>{if(x.isUnmounted){d=null;return}S(g),u.value=g}),()=>C.value&&t?hn(t,x):u.value&&n?Ce(n,{error:u.value}):s&&!h.value?hn(s,x):void 0}})}function hn(e,t){let{ref:i,props:s,children:n,ce:r}=t.vnode,a=Ce(e,s,n);return a.ref=i,a.ce=r,delete t.vnode.ce,a}var Js=e=>e.type.__isKeepAlive,Su={name:"KeepAlive",__isKeepAlive:!0,props:{include:[String,RegExp,Array],exclude:[String,RegExp,Array],max:[String,Number]},setup(e,{slots:t}){let i=rt(),s=i.ctx;if(!s.renderer)return()=>{let u=t.default&&t.default();return u&&u.length===1?u[0]:u};let n=new Map,r=new Set,a=null,l=i.suspense,{renderer:{p:o,m:c,um:d,o:{createElement:p}}}=s,m=p("div");function y(u){Br(u),d(u,i,l,!0)}function f(u){n.forEach((h,g)=>{let w=ha(Kt(h)?h.type.__asyncResolved||{}:h.type);w&&!u(w)&&x(g)})}function x(u){let h=n.get(u);!h||a&&Ct(h,a)?a&&Br(a):y(h),n.delete(u),r.delete(u)}s.activate=(u,h,g,w,k)=>{let _=u.component;c(u,h,g,0,l),o(_.vnode,u,h,g,_,l,w,u.slotScopeIds,k),Pe(()=>{_.isDeactivated=!1,_.a&&Ji(_.a);let T=u.props&&u.props.onVnodeMounted;T&&ot(T,_.parent,u)},l)},s.deactivate=u=>{let h=u.component;Dn(h.m),Dn(h.a),c(u,m,null,1,l),Pe(()=>{h.da&&Ji(h.da);let g=u.props&&u.props.onVnodeUnmounted;g&&ot(g,h.parent,u),h.isDeactivated=!0},l)},Zi(()=>[e.include,e.exclude],([u,h])=>{u&&f(g=>xs(u,g)),h&&f(g=>!xs(h,g))},{flush:"post",deep:!0});let S=null,C=()=>{S!=null&&($n(i.subTree.type)?Pe(()=>{n.set(S,fn(i.subTree))},i.subTree.suspense):n.set(S,fn(i.subTree)))};return Gs(C),gr(C),br(()=>{n.forEach(u=>{let{subTree:h,suspense:g}=i,w=fn(h);if(u.type===w.type&&u.key===w.key){Br(w);let k=w.component.da;k&&Pe(k,g);return}y(u)})}),()=>{if(S=null,!t.default)return a=null;let u=t.default(),h=u[0];if(u.length>1)return a=null,u;if(!Zt(h)||!(4&h.shapeFlag)&&!(128&h.shapeFlag))return a=null,h;let g=fn(h);if(g.type===Oe)return a=null,g;let w=g.type,k=ha(Kt(g)?g.type.__asyncResolved||{}:w),{include:_,exclude:T,max:R}=e;if(_&&(!k||!xs(_,k))||T&&k&&xs(T,k))return g.shapeFlag&=-257,a=g,h;let O=g.key==null?w:g.key,j=n.get(O);return g.el&&(g=Lt(g),128&h.shapeFlag&&(h.ssContent=g)),S=O,j?(g.el=j.el,g.component=j.component,g.transition&&Xt(g,g.transition),g.shapeFlag|=512,r.delete(O),r.add(O)):(r.add(O),R&&r.size>parseInt(R,10)&&x(r.values().next().value)),g.shapeFlag|=256,a=g,$n(h.type)?h:g}}};function xs(e,t){let i;return J(e)?e.some(s=>xs(s,t)):se(e)?e.split(",").includes(t):(i=e,Ne.call(i)==="[object RegExp]"&&(e.lastIndex=0,e.test(t)))}function lc(e,t){cc(e,"a",t)}function oc(e,t){cc(e,"da",t)}function cc(e,t,i=Ke){let s=e.__wdc||(e.__wdc=()=>{let n=i;for(;n;){if(n.isDeactivated)return;n=n.parent}return e()});if(zn(t,s,i),i){let n=i.parent;for(;n&&n.parent;)Js(n.parent.vnode)&&function(r,a,l,o){let c=zn(a,r,o,!0);Ys(()=>{Aa(o[a],c)},l)}(s,t,i,n),n=n.parent}}function Br(e){e.shapeFlag&=-257,e.shapeFlag&=-513}function fn(e){return 128&e.shapeFlag?e.ssContent:e}function zn(e,t,i=Ke,s=!1){if(i){let n=i[e]||(i[e]=[]),r=t.__weh||(t.__weh=(...a)=>{Gt();let l=os(i),o=vt(t,i,e,a);return l(),Yt(),o});return s?n.unshift(r):n.push(r),r}}var ei=e=>(t,i=Ke)=>{Ei&&e!=="sp"||zn(e,(...s)=>t(...s),i)},dc=ei("bm"),Gs=ei("m"),ja=ei("bu"),gr=ei("u"),br=ei("bum"),Ys=ei("um"),pc=ei("sp"),uc=ei("rtg"),hc=ei("rtc");function fc(e,t=Ke){zn("ec",e,t)}var Da="components";function qu(e,t){return $a(Da,e,!0,t)||e}var mc=Symbol.for("v-ndc");function Cu(e){return se(e)?$a(Da,e,!1)||e:e||mc}function Tu(e){return $a("directives",e)}function $a(e,t,i=!0,s=!1){let n=Qe||Ke;if(n){let r=n.type;if(e===Da){let l=ha(r,!1);if(l&&(l===t||l===ye(t)||l===Pi(ye(t))))return r}let a=Cl(n[e]||r[e],t)||Cl(n.appContext[e],t);return!a&&s?r:a}}function Cl(e,t){return e&&(e[t]||e[ye(t)]||e[Pi(ye(t))])}function Nu(e,t,i,s){let n,r=i&&i[s],a=J(e);if(a||se(e)){let l=a&&Ht(e),o=!1,c=!1;l&&(o=!ut(e),c=Pt(e),e=pr(e)),n=Array(e.length);for(let d=0,p=e.length;d<p;d++)n[d]=t(o?c?Yi(Nt(e[d])):Nt(e[d]):e[d],d,void 0,r&&r[d])}else if(typeof e=="number"){n=Array(e);for(let l=0;l<e;l++)n[l]=t(l+1,l,void 0,r&&r[l])}else if(fe(e))if(e[Symbol.iterator])n=Array.from(e,(l,o)=>t(l,o,void 0,r&&r[o]));else{let l=Object.keys(e);n=Array(l.length);for(let o=0,c=l.length;o<c;o++){let d=l[o];n[o]=t(e[d],d,o,r&&r[o])}}else n=[];return i&&(i[s]=n),n}function Au(e,t){for(let i=0;i<t.length;i++){let s=t[i];if(J(s))for(let n=0;n<s.length;n++)e[s[n].name]=s[n].fn;else s&&(e[s.name]=s.key?(...n)=>{let r=s.fn(...n);return r&&(r.key=s.key),r}:s.fn)}return e}function Eu(e,t,i={},s,n,r){let a;if(Qe.ce||Qe.parent&&Kt(Qe.parent)&&Qe.parent.ce){let c=r!=null&&i.key==null?ce({},i,{key:r}):i,d=Object.keys(c).length>0;return t!=="default"&&(c.name=t),Fs(),Un($e,null,[Ce("slot",c,s&&s())],d?-2:64)}let l=e[t];l&&l._c&&(l._d=!1);let o=Qt.length;Fs();try{let c=l&&Ua(l(i)),d=i.key||r||c&&c.key;a=Un($e,{key:(d&&!Ze(d)?d:`_${t}`)+(!c&&s?"_fb":"")},c||(s?s():[]),c&&e._===1?64:-2)}catch(c){for(let d=Qt.length;d>o;d--)xr();throw c}finally{l&&l._c&&(l._d=!0)}return!n&&a.scopeId&&(a.slotScopeIds=[a.scopeId+"-s"]),a}function Ua(e){return e.some(t=>!Zt(t)||t.type!==Oe&&(t.type!==$e||!!Ua(t.children)))?e:null}function Mu(e,t){let i={};for(let s in e)i[t&&/[A-Z]/.test(s)?`on:${s}`:Wi(s)]=e[s];return i}var na=e=>e?Pc(e)?Xs(e):na(e.parent):null,Ns=ce(Object.create(null),{$:e=>e,$el:e=>e.vnode.el,$data:e=>e.data,$props:e=>e.props,$attrs:e=>e.attrs,$slots:e=>e.slots,$refs:e=>e.refs,$parent:e=>na(e.parent),$root:e=>na(e.root),$host:e=>e.ce,$emit:e=>e.emit,$options:e=>la(e),$forceUpdate:e=>e.f||(e.f=()=>{Oa(e.update)}),$nextTick:e=>e.n||(e.n=fr.bind(e.proxy)),$watch:e=>pu.bind(e)}),jr=(e,t)=>e!==de&&!e.__isScriptSetup&&me(e,t),ra={get({_:e},t){let i,s;if(t==="__v_skip")return!0;let{ctx:n,setupState:r,data:a,props:l,accessCache:o,type:c,appContext:d}=e;if(t[0]!=="$"){let m=o[t];if(m!==void 0)switch(m){case 1:return r[t];case 2:return a[t];case 4:return n[t];case 3:return l[t]}else{if(jr(r,t))return o[t]=1,r[t];if(a!==de&&me(a,t))return o[t]=2,a[t];if(me(l,t))return o[t]=3,l[t];if(n!==de&&me(n,t))return o[t]=4,n[t];aa&&(o[t]=0)}}let p=Ns[t];return p?(t==="$attrs"&&Ye(e.attrs,"get",""),p(e)):(i=c.__cssModules)&&(i=i[t])?i:n!==de&&me(n,t)?(o[t]=4,n[t]):me(s=d.config.globalProperties,t)?s[t]:void 0},set({_:e},t,i){let{data:s,setupState:n,ctx:r}=e;return jr(n,t)?(n[t]=i,!0):s!==de&&me(s,t)?(s[t]=i,!0):!me(e.props,t)&&!(t[0]==="$"&&t.slice(1)in e)&&(r[t]=i,!0)},has({_:{data:e,setupState:t,accessCache:i,ctx:s,appContext:n,props:r,type:a}},l){let o;return!!(i[l]||e!==de&&l[0]!=="$"&&me(e,l)||jr(t,l)||me(r,l)||me(s,l)||me(Ns,l)||me(n.config.globalProperties,l)||(o=a.__cssModules)&&o[l])},defineProperty(e,t,i){return i.get!=null?e._.accessCache[t]=0:me(i,"value")&&this.set(e,t,i.value,null),Reflect.defineProperty(e,t,i)}},Iu=ce({},ra,{get(e,t){if(t!==Symbol.unscopables)return ra.get(e,t,e)},has:(e,t)=>t[0]!=="_"&&!wp(t)});function Ru(){return null}function Ou(){return null}function Pu(e){}function Lu(e){}function Fu(){return null}function zu(){}function Bu(e,t){return null}function ju(){return vc().slots}function Du(){return vc().attrs}function vc(e){let t=rt();return t.setupContext||(t.setupContext=Bc(t))}function Ls(e){return J(e)?e.reduce((t,i)=>(t[i]=null,t),{}):e}function $u(e,t){let i=Ls(e);for(let s in t){if(s.startsWith("__skip"))continue;let n=i[s];n?J(n)||te(n)?n=i[s]={type:n,default:t[s]}:n.default=t[s]:n===null&&(n=i[s]={default:t[s]}),n&&t[`__skip_${s}`]&&(n.skipFactory=!0)}return i}function Uu(e,t){return e&&t?J(e)&&J(t)?e.concat(t):ce({},Ls(e),Ls(t)):e||t}function Vu(e,t){let i={};for(let s in e)t.includes(s)||Object.defineProperty(i,s,{enumerable:!0,get:()=>e[s]});return i}function Hu(e){let t=rt(),i=Ei,s=e();Bs(),i&&Ki(!1);let n=()=>{os(t),i&&Ki(!0)},r=()=>{rt()!==t&&t.scope.off(),Bs(),i&&Ki(!1)};return Ea(s)&&(s=s.catch(a=>{throw n(),Promise.resolve().then(()=>Promise.resolve().then(r)),a})),[s,()=>{n(),Promise.resolve().then(r)}]}var aa=!0;function Tl(e,t,i){vt(J(e)?e.map(s=>s.bind(t.proxy)):e.bind(t.proxy),t,i)}function la(e){let t,i=e.type,{mixins:s,extends:n}=i,{mixins:r,optionsCache:a,config:{optionMergeStrategies:l}}=e.appContext,o=a.get(i);return o?t=o:r.length||s||n?(t={},r.length&&r.forEach(c=>Bn(t,c,l,!0)),Bn(t,i,l)):t=i,fe(i)&&a.set(i,t),t}function Bn(e,t,i,s=!1){let{mixins:n,extends:r}=t;for(let a in r&&Bn(e,r,i,!0),n&&n.forEach(l=>Bn(e,l,i,!0)),t)if(!(s&&a==="expose")){let l=Ku[a]||i&&i[a];e[a]=l?l(e[a],t[a]):t[a]}return e}var Ku={data:Nl,props:Al,emits:Al,methods:gs,computed:gs,beforeCreate:it,created:it,beforeMount:it,mounted:it,beforeUpdate:it,updated:it,beforeDestroy:it,beforeUnmount:it,destroyed:it,unmounted:it,activated:it,deactivated:it,errorCaptured:it,serverPrefetch:it,components:gs,directives:gs,watch:function(e,t){if(!e)return t;if(!t)return e;let i=ce(Object.create(null),e);for(let s in t)i[s]=it(e[s],t[s]);return i},provide:Nl,inject:function(e,t){return gs(oa(e),oa(t))}};function Nl(e,t){return t?e?function(){return ce(te(e)?e.call(this,this):e,te(t)?t.call(this,this):t)}:t:e}function oa(e){if(J(e)){let t={};for(let i=0;i<e.length;i++)t[e[i]]=e[i];return t}return e}function it(e,t){return e?[...new Set([].concat(e,t))]:t}function gs(e,t){return e?ce(Object.create(null),e,t):t}function Al(e,t){return e?J(e)&&J(t)?[...new Set([...e,...t])]:ce(Object.create(null),Ls(e),Ls(t??{})):t}function gc(){return{app:null,config:{isNativeTag:$i,performance:!1,globalProperties:{},optionMergeStrategies:{},errorHandler:void 0,warnHandler:void 0,compilerOptions:{}},mixins:[],components:{},directives:{},provides:Object.create(null),optionsCache:new WeakMap,propsCache:new WeakMap,emitsCache:new WeakMap}}var Qu=0,qi=null;function Wu(e,t,i=de){let s=rt(),n=ye(t),r=dt(t),a=bc(e,n),l=Qo((o,c)=>{let d,p,m=de;return ec(()=>{let y=e[n];De(d,y)&&(d=y,c())}),{get:()=>(o(),i.get?i.get(d):d),set(y){let f=i.set?i.set(y):y;if(!De(f,d)&&!(m!==de&&De(y,m)))return;let x=s.vnode.props,S=!!(x&&(t in x||n in x||r in x)&&(`onUpdate:${t}`in x||`onUpdate:${n}`in x||`onUpdate:${r}`in x));S||(d=y,c()),s.emit(`update:${t}`,f),De(y,m)&&(De(y,f)&&!De(f,p)||S&&m!==de&&!De(f,d))&&c(),m=y,p=f}}});return l[Symbol.iterator]=()=>{let o=0;return{next:()=>o<2?{value:o++?a||de:l,done:!1}:{done:!0}}},l}var bc=(e,t)=>t==="modelValue"||t==="model-value"?e.modelModifiers:e[`${t}Modifiers`]||e[`${ye(t)}Modifiers`]||e[`${dt(t)}Modifiers`];function Ju(e,t,...i){let s;if(e.isUnmounted)return;let n=e.vnode.props||de,r=i,a=t.startsWith("update:"),l=a&&bc(n,t.slice(7));l&&(l.trim&&(r=i.map(d=>se(d)?d.trim():d)),l.number&&(r=i.map(lr)));let o=n[s=Wi(t)]||n[s=Wi(ye(t))];!o&&a&&(o=n[s=Wi(dt(t))]),o&&vt(o,e,6,r);let c=n[s+"Once"];if(c){if(e.emitted){if(e.emitted[s])return}else e.emitted={};e.emitted[s]=!0,vt(c,e,6,r)}}var Gu=new WeakMap;function jn(e,t){return!!e&&!!Oi(t)&&(me(e,(t=(t=t.slice(2))==="Once"?t:t.replace(/Once$/,""))[0].toLowerCase()+t.slice(1))||me(e,dt(t))||me(e,t))}function _n(e){let t,i,{type:s,vnode:n,proxy:r,withProxy:a,propsOptions:[l],slots:o,attrs:c,emit:d,render:p,renderCache:m,props:y,data:f,setupState:x,ctx:S,inheritAttrs:C}=e,u=Ps(e);try{if(4&n.shapeFlag){let g=a||r;t=ct(p.call(g,g,m,y,x,f,S)),i=c}else t=ct(s.length>1?s(y,{attrs:c,slots:o,emit:d}):s(y,null)),i=s.props?c:Yu(c)}catch(g){Qt.length=0,Li(g,e,1),t=Ce(Oe)}let h=t;if(i&&C!==!1){let g=Object.keys(i),{shapeFlag:w}=h;g.length&&7&w&&(l&&g.some(nr)&&(i=Xu(i,l)),h=Lt(h,i,!1,!0))}return n.dirs&&((h=Lt(h,null,!1,!0)).dirs=h.dirs?h.dirs.concat(n.dirs):n.dirs),n.transition&&Xt(h,n.transition),t=h,Ps(u),t}var Yu=e=>{let t;for(let i in e)(i==="class"||i==="style"||Oi(i))&&((t||(t={}))[i]=e[i]);return t},Xu=(e,t)=>{let i={};for(let s in e)nr(s)&&s.slice(9)in t||(i[s]=e[s]);return i};function El(e,t,i){let s=Object.keys(t);if(s.length!==Object.keys(e).length)return!0;for(let n=0;n<s.length;n++){let r=s[n];if(yc(t,e,r)&&!jn(i,r))return!0}return!1}function yc(e,t,i){let s=e[i],n=t[i];return i==="style"&&fe(s)&&fe(n)?!Jt(s,n):s!==n}function yr({vnode:e,parent:t,suspense:i},s){for(;t;){let n=t.subTree;if(n.suspense&&n.suspense.activeBranch===e&&(n.suspense.vnode.el=n.el=s,e=n),n===e)(e=t.vnode).el=s,t=t.parent;else break}i&&i.activeBranch===e&&(i.vnode.el=s)}var ca={},xc=e=>Object.getPrototypeOf(e)===ca;function wc(e,t,i,s){let n,[r,a]=e.propsOptions,l=!1;if(t)for(let o in t){let c;if(Vt(o))continue;let d=t[o];r&&me(r,c=ye(o))?a&&a.includes(c)?(n||(n={}))[c]=d:i[c]=d:jn(e.emitsOptions,o)||o in s&&d===s[o]||(s[o]=d,l=!0)}if(a){let o=pe(i),c=n||de;for(let d=0;d<a.length;d++){let p=a[d];i[p]=da(r,o,p,c[p],e,!me(c,p))}}return l}function da(e,t,i,s,n,r){let a=e[i];if(a!=null){let l=me(a,"default");if(l&&s===void 0){let o=a.default;if(a.type!==Function&&!a.skipFactory&&te(o)){let{propsDefaults:c}=n;if(i in c)s=c[i];else{let d=os(n);s=c[i]=o.call(null,t),d()}}else s=o;n.ce&&n.ce._setProp(i,s)}a[0]&&(r&&!l?s=!1:a[1]&&(s===""||s===dt(i))&&(s=!0))}return s}var Zu=new WeakMap;function Ml(e){return!(e[0]==="$"||Vt(e))}var Va=e=>e==="_"||e==="_ctx"||e==="$stable",Ha=e=>J(e)?e.map(ct):[ct(e)],eh=(e,t,i)=>{if(t._n)return t;let s=Pa((...n)=>Ha(t(...n)),i);return s._c=!1,s},kc=(e,t,i)=>{let s=e._ctx;for(let n in e){if(Va(n))continue;let r=e[n];if(te(r))t[n]=eh(n,r,s);else if(r!=null){let a=Ha(r);t[n]=()=>a}}},_c=(e,t)=>{let i=Ha(t);e.slots.default=()=>i},Sc=(e,t,i)=>{for(let s in t)(i||!Va(s))&&(e[s]=t[s])},Pe=Nc;function Ka(e){return Cc(e)}function qc(e){return Cc(e,mu)}function Cc(e,t){var i;let s,n;or().__VUE__=!0;let{insert:r,remove:a,patchProp:l,createElement:o,createText:c,createComment:d,setText:p,setElementText:m,parentNode:y,nextSibling:f,setScopeId:x=He,insertStaticContent:S}=e,C=(v,b,A,D=null,P=null,E=null,B,I=null,L=!!b.dynamicChildren)=>{if(v===b)return;v&&!Ct(v,b)&&(D=oe(v),he(v,P,E,!0),v=null),b.patchFlag===-2&&(L=!1,b.dynamicChildren=null);let{type:M,ref:$,shapeFlag:V}=b;switch(M){case oi:u(v,b,A,D);break;case Oe:h(v,b,A,D);break;case Ci:v==null&&g(b,A,D,B);break;case $e:q(v,b,A,D,P,E,B,I,L);break;default:1&V?w(v,b,A,D,P,E,B,I,L):6&V?z(v,b,A,D,P,E,B,I,L):(64&V||128&V)&&M.process(v,b,A,D,P,E,B,I,L,Se)}$!=null&&P?es($,v&&v.ref,E,b||v,!b):$==null&&v&&v.ref!=null&&es(v.ref,null,E,v,!0)},u=(v,b,A,D)=>{if(v==null)r(b.el=c(b.children),A,D);else{let P=b.el=v.el;b.children!==v.children&&p(P,b.children)}},h=(v,b,A,D)=>{v==null?r(b.el=d(b.children||""),A,D):b.el=v.el},g=(v,b,A,D)=>{[v.el,v.anchor]=S(v.children,b,A,D,v.el,v.anchor)},w=(v,b,A,D,P,E,B,I,L)=>{if(b.type==="svg"?B="svg":b.type==="math"&&(B="mathml"),v==null)k(b,A,D,P,E,B,I,L);else{let M=v.el&&v.el._isVueCE?v.el:null;try{M&&M._beginPatch(),R(v,b,P,E,B,I,L)}finally{M&&M._endPatch()}}},k=(v,b,A,D,P,E,B,I)=>{let L,M,{props:$,shapeFlag:V,transition:Y,dirs:G}=v;if(L=v.el=o(v.type,E,$&&$.is,$),8&V?m(L,v.children):16&V&&T(v.children,L,null,D,P,Dr(v,E),B,I),G&&Rt(v,null,D,"created"),_(L,v,v.scopeId,B,D),$){for(let ee in $)ee==="value"||Vt(ee)||l(L,ee,null,$[ee],E,D);"value"in $&&l(L,"value",null,$.value,E),(M=$.onVnodeBeforeMount)&&ot(M,D,v)}G&&Rt(v,null,D,"beforeMount");let re=Tc(P,Y);re&&Y.beforeEnter(L),r(L,b,A),((M=$&&$.onVnodeMounted)||re||G)&&Pe(()=>{M&&ot(M,D,v),re&&Y.enter(L),G&&Rt(v,null,D,"mounted")},P)},_=(v,b,A,D,P)=>{if(A&&x(v,A),D)for(let E=0;E<D.length;E++)x(v,D[E]);if(P){let E=P.subTree;if(b===E||$n(E.type)&&(E.ssContent===b||E.ssFallback===b)){let B=P.vnode;_(v,B,B.scopeId,B.slotScopeIds,P.parent)}}},T=(v,b,A,D,P,E,B,I,L=0)=>{for(let M=L;M<v.length;M++)C(null,v[M]=I?jt(v[M]):ct(v[M]),b,A,D,P,E,B,I)},R=(v,b,A,D,P,E,B)=>{let I,L=b.el=v.el,{patchFlag:M,dynamicChildren:$,dirs:V}=b;M|=16&v.patchFlag;let Y=v.props||de,G=b.props||de;if(A&&gi(A,!1),(I=G.onVnodeBeforeUpdate)&&ot(I,A,b,v),V&&Rt(b,v,A,"beforeUpdate"),A&&gi(A,!0),$&&(!v.dynamicChildren||v.dynamicChildren.length!==$.length)&&(M=0,B=!1,$=null),(Y.innerHTML&&G.innerHTML==null||Y.textContent&&G.textContent==null)&&m(L,""),$?O(v.dynamicChildren,$,L,A,D,Dr(b,P),E):B||W(v,b,L,null,A,D,Dr(b,P),E,!1),M>0){if(16&M)j(L,Y,G,A,P);else if(2&M&&Y.class!==G.class&&l(L,"class",null,G.class,P),4&M&&l(L,"style",Y.style,G.style,P),8&M){let re=b.dynamicProps;for(let ee=0;ee<re.length;ee++){let ge=re[ee],Te=Y[ge],Ee=G[ge];(Ee!==Te||ge==="value")&&l(L,ge,Te,Ee,P,A)}}1&M&&v.children!==b.children&&m(L,b.children)}else B||$!=null||j(L,Y,G,A,P);((I=G.onVnodeUpdated)||V)&&Pe(()=>{I&&ot(I,A,b,v),V&&Rt(b,v,A,"updated")},D)},O=(v,b,A,D,P,E,B)=>{for(let I=0;I<b.length;I++){let L=v[I],M=b[I],$=L.el&&(L.type===$e||!Ct(L,M)||198&L.shapeFlag)?y(L.el):A;C(L,M,$,null,D,P,E,B,!0)}},j=(v,b,A,D,P)=>{if(b!==A){if(b!==de)for(let E in b)Vt(E)||E in A||l(v,E,b[E],null,P,D);for(let E in A){if(Vt(E))continue;let B=A[E],I=b[E];B!==I&&E!=="value"&&l(v,E,I,B,P,D)}"value"in A&&l(v,"value",b.value,A.value,P)}},q=(v,b,A,D,P,E,B,I,L)=>{let M=b.el=v?v.el:c(""),$=b.anchor=v?v.anchor:c(""),{patchFlag:V,dynamicChildren:Y,slotScopeIds:G}=b;G&&(I=I?I.concat(G):G),v==null?(r(M,A,D),r($,A,D),T(b.children||[],A,$,P,E,B,I,L)):V>0&&64&V&&Y&&v.dynamicChildren&&v.dynamicChildren.length===Y.length?(O(v.dynamicChildren,Y,A,P,E,B,I),(b.key!=null||P&&b===P.subTree)&&Qa(v,b,!0)):W(v,b,A,$,P,E,B,I,L)},z=(v,b,A,D,P,E,B,I,L)=>{b.slotScopeIds=I,v==null?512&b.shapeFlag?P.ctx.activate(b,A,D,B,L):F(b,A,D,P,E,B,L):N(v,b,L)},F=(v,b,A,D,P,E,B)=>{let I=v.component=Oc(v,D,P);if(Js(v)&&(I.ctx.renderer=Se),Lc(I,!1,B),I.asyncDep){if(P&&P.registerDep(I,K,B),!v.el){let L=I.subTree=Ce(Oe);h(null,L,b,A),v.placeholder=L.el}}else K(I,v,b,A,P,E,B)},N=(v,b,A)=>{let D=b.component=v.component;if(function(P,E,B){let{props:I,children:L,component:M}=P,{props:$,children:V,patchFlag:Y}=E,G=M.emitsOptions;if(E.dirs||E.transition)return!0;if(!B||!(Y>=0))return(!!L||!!V)&&(!V||!V.$stable)||I!==$&&(I?!$||El(I,$,G):!!$);if(1024&Y)return!0;if(16&Y)return I?El(I,$,G):!!$;if(8&Y){let re=E.dynamicProps;for(let ee=0;ee<re.length;ee++){let ge=re[ee];if(yc($,I,ge)&&!jn(G,ge))return!0}}return!1}(v,b,A)){if(D.asyncDep&&!D.asyncResolved)return void U(D,b,A);D.next=b,D.update()}else b.el=v.el,D.vnode=b},K=(v,b,A,D,P,E,B)=>{v.scope.on();let I=v.effect=new Ni(()=>{if(v.isMounted){let $,{next:V,bu:Y,u:G,parent:re,vnode:ee}=v;{let lt=function an(mi){let ti=mi.subTree.component;if(ti)return ti.asyncDep&&!ti.asyncResolved?ti:an(ti)}(v);if(lt){V&&(V.el=ee.el,U(v,V,B)),lt.asyncDep.then(()=>{Pe(()=>{v.isUnmounted||L()},P)});return}}let ge=V;gi(v,!1),V?(V.el=ee.el,U(v,V,B)):V=ee,Y&&Ji(Y),($=V.props&&V.props.onVnodeBeforeUpdate)&&ot($,re,V,ee),gi(v,!0);let Te=_n(v),Ee=v.subTree;v.subTree=Te,C(Ee,Te,y(Ee.el),oe(Ee),v,P,E),V.el=Te.el,ge===null&&yr(v,Te.el),G&&Pe(G,P),($=V.props&&V.props.onVnodeUpdated)&&Pe(()=>ot($,re,V,ee),P)}else{let $,{el:V,props:Y}=b,{bm:G,m:re,parent:ee,root:ge,type:Te}=v,Ee=Kt(b);if(gi(v,!1),G&&Ji(G),!Ee&&($=Y&&Y.onVnodeBeforeMount)&&ot($,ee,b),gi(v,!0),V&&n){let lt=()=>{v.subTree=_n(v),n(V,v.subTree,v,P,null)};Ee&&Te.__asyncHydrate?Te.__asyncHydrate(V,v,lt):lt()}else{ge.ce&&ge.ce._hasShadowRoot()&&ge.ce._injectChildStyle(Te,v.parent?v.parent.type:void 0);let lt=v.subTree=_n(v);C(null,lt,A,D,v,P,E),b.el=lt.el}if(re&&Pe(re,P),!Ee&&($=Y&&Y.onVnodeMounted)){let lt=b;Pe(()=>ot($,ee,lt),P)}(256&b.shapeFlag||ee&&Kt(ee.vnode)&&256&ee.vnode.shapeFlag)&&v.a&&Pe(v.a,P),v.isMounted=!0,b=A=D=null}});v.scope.off();let L=v.update=I.run.bind(I),M=v.job=I.runIfDirty.bind(I);M.i=v,M.id=v.uid,I.scheduler=()=>Oa(M),gi(v,!0),L()},U=(v,b,A)=>{b.component=v;let D=v.vnode.props;v.vnode=b,v.next=null,function(P,E,B,I){let{props:L,attrs:M,vnode:{patchFlag:$}}=P,V=pe(L),[Y]=P.propsOptions,G=!1;if((I||$>0)&&!(16&$)){if(8&$){let re=P.vnode.dynamicProps;for(let ee=0;ee<re.length;ee++){let ge=re[ee];if(jn(P.emitsOptions,ge))continue;let Te=E[ge];if(Y)if(me(M,ge))Te!==M[ge]&&(M[ge]=Te,G=!0);else{let Ee=ye(ge);L[Ee]=da(Y,V,Ee,Te,P,!1)}else Te!==M[ge]&&(M[ge]=Te,G=!0)}}}else{let re;for(let ee in wc(P,E,L,M)&&(G=!0),V)E&&(me(E,ee)||(re=dt(ee))!==ee&&me(E,re))||(Y?B&&(B[ee]!==void 0||B[re]!==void 0)&&(L[ee]=da(Y,V,ee,void 0,P,!0)):delete L[ee]);if(M!==V)for(let ee in M)E&&me(E,ee)||(delete M[ee],G=!0)}G&&Dt(P.attrs,"set","")}(v,b.props,D,A),((P,E,B)=>{let{vnode:I,slots:L}=P,M=!0,$=de;if(32&I.shapeFlag){let V=E._;V?B&&V===1?M=!1:Sc(L,E,B):(M=!E.$stable,kc(E,L)),$=E}else E&&(_c(P,E),$={default:1});if(M)for(let V in L)Va(V)||$[V]!=null||delete L[V]})(v,b.children,A),Gt(),yl(v),Yt()},W=(v,b,A,D,P,E,B,I,L=!1)=>{let M=v&&v.children,$=v?v.shapeFlag:0,V=b.children,{patchFlag:Y,shapeFlag:G}=b;if(Y>0){if(128&Y)return void Z(M,V,A,D,P,E,B,I,L);if(256&Y)return void H(M,V,A,D,P,E,B,I,L)}8&G?(16&$&&et(M,P,E),V!==M&&m(A,V)):16&$?16&G?Z(M,V,A,D,P,E,B,I,L):et(M,P,E,!0):(8&$&&m(A,""),16&G&&T(V,A,D,P,E,B,I,L))},H=(v,b,A,D,P,E,B,I,L)=>{let M;v=v||Qi,b=b||Qi;let $=v.length,V=b.length,Y=Math.min($,V);for(M=0;M<Y;M++){let G=b[M]=L?jt(b[M]):ct(b[M]);C(v[M],G,A,null,P,E,B,I,L)}$>V?et(v,P,E,!0,!1,Y):T(b,A,D,P,E,B,I,L,Y)},Z=(v,b,A,D,P,E,B,I,L)=>{let M=0,$=b.length,V=v.length-1,Y=$-1;for(;M<=V&&M<=Y;){let G=v[M],re=b[M]=L?jt(b[M]):ct(b[M]);if(Ct(G,re))C(G,re,A,null,P,E,B,I,L);else break;M++}for(;M<=V&&M<=Y;){let G=v[V],re=b[Y]=L?jt(b[Y]):ct(b[Y]);if(Ct(G,re))C(G,re,A,null,P,E,B,I,L);else break;V--,Y--}if(M>V){if(M<=Y){let G=Y+1,re=G<$?b[G].el:D;for(;M<=Y;)C(null,b[M]=L?jt(b[M]):ct(b[M]),A,re,P,E,B,I,L),M++}}else if(M>Y)for(;M<=V;)he(v[M],P,E,!0),M++;else{let G,re=M,ee=M,ge=new Map;for(M=ee;M<=Y;M++){let Me=b[M]=L?jt(b[M]):ct(b[M]);Me.key!=null&&ge.set(Me.key,M)}let Te=0,Ee=Y-ee+1,lt=!1,an=0,mi=Array(Ee);for(M=0;M<Ee;M++)mi[M]=0;for(M=re;M<=V;M++){let Me,je=v[M];if(Te>=Ee){he(je,P,E,!0);continue}if(je.key!=null)Me=ge.get(je.key);else for(G=ee;G<=Y;G++)if(mi[G-ee]===0&&Ct(je,b[G])){Me=G;break}Me===void 0?he(je,P,E,!0):(mi[Me-ee]=M+1,Me>=an?an=Me:lt=!0,C(je,b[Me],A,null,P,E,B,I,L),Te++)}let ti=lt?function(Me){let je,hs,tt,Et,vi,Fi=Me.slice(),xt=[0],vp=Me.length;for(je=0;je<vp;je++){let ln=Me[je];if(ln!==0){if(Me[hs=xt[xt.length-1]]<ln){Fi[je]=hs,xt.push(je);continue}for(tt=0,Et=xt.length-1;tt<Et;)Me[xt[vi=tt+Et>>1]]<ln?tt=vi+1:Et=vi;ln<Me[xt[tt]]&&(tt>0&&(Fi[je]=xt[tt-1]),xt[tt]=je)}}for(tt=xt.length,Et=xt[tt-1];tt-- >0;)xt[tt]=Et,Et=Fi[Et];return xt}(mi):Qi;for(G=ti.length-1,M=Ee-1;M>=0;M--){let Me=ee+M,je=b[Me],hs=b[Me+1],tt=Me+1<$?hs.el||function Et(vi){if(vi.placeholder)return vi.placeholder;let Fi=vi.component;return Fi?Et(Fi.subTree):null}(hs):D;mi[M]===0?C(null,je,A,tt,P,E,B,I,L):lt&&(G<0||M!==ti[G]?ie(je,A,tt,2):G--)}}},ie=(v,b,A,D,P=null)=>{let{el:E,type:B,transition:I,children:L,shapeFlag:M}=v;if(6&M)return void ie(v.component.subTree,b,A,D);if(128&M)return void v.suspense.move(b,A,D);if(64&M)return void B.move(v,b,A,Se);if(B===$e){r(E,b,A);for(let $=0;$<L.length;$++)ie(L[$],b,A,D);r(v.anchor,b,A);return}if(B===Ci)return void(({el:$,anchor:V},Y,G)=>{let re;for(;$&&$!==V;)re=f($),r($,Y,G),$=re;r(V,Y,G)})(v,b,A);if(D!==2&&1&M&&I)if(D===0)I.persisted&&!E[kt]?r(E,b,A):(I.beforeEnter(E),r(E,b,A),Pe(()=>I.enter(E),P));else{let{leave:$,delayLeave:V,afterLeave:Y}=I,G=()=>{v.ctx.isUnmounted?a(E):r(E,b,A)},re=()=>{let ee=E._isLeaving||!!E[kt];E._isLeaving&&E[kt](!0),I.persisted&&!ee?G():$(E,()=>{G(),Y&&Y()})};V?V(E,G,re):re()}else r(E,b,A)},he=(v,b,A,D=!1,P=!1)=>{let E,{type:B,props:I,ref:L,children:M,dynamicChildren:$,shapeFlag:V,patchFlag:Y,dirs:G,cacheIndex:re,memo:ee}=v;if(Y===-2&&(P=!1),L!=null&&(Gt(),es(L,null,A,v,!0),Yt()),re!=null&&(b.renderCache[re]=void 0),256&V)return void b.ctx.deactivate(v);let ge=1&V&&G,Te=!Kt(v);if(Te&&(E=I&&I.onVnodeBeforeUnmount)&&ot(E,b,v),6&V)Ve(v.component,A,D);else{if(128&V)return void v.suspense.unmount(A,D);ge&&Rt(v,null,b,"beforeUnmount"),64&V?v.type.remove(v,b,A,Se,D):$&&!$.hasOnce&&(B!==$e||Y>0&&64&Y)?et($,b,A,!1,!0):(B===$e&&384&Y||!P&&16&V)&&et(M,b,A),D&&Ae(v)}let Ee=ee!=null&&re==null;(Te&&(E=I&&I.onVnodeUnmounted)||ge||Ee)&&Pe(()=>{E&&ot(E,b,v),ge&&Rt(v,null,b,"unmounted"),Ee&&(v.el=null)},A)},Ae=v=>{let{type:b,el:A,anchor:D,transition:P}=v;if(b===$e)return void _e(A,D);if(b===Ci)return void(({el:B,anchor:I})=>{let L;for(;B&&B!==I;)L=f(B),a(B),B=L;a(I)})(v);let E=()=>{a(A),P&&!P.persisted&&P.afterLeave&&P.afterLeave()};if(1&v.shapeFlag&&P&&!P.persisted){let{leave:B,delayLeave:I}=P,L=()=>B(A,E);I?I(v.el,E,L):L()}else E()},_e=(v,b)=>{let A;for(;v!==b;)A=f(v),a(v),v=A;a(b)},Ve=(v,b,A)=>{let{bum:D,scope:P,job:E,subTree:B,um:I,m:L,a:M}=v;Dn(L),Dn(M),D&&Ji(D),P.stop(),E&&(E.flags|=8,he(B,v,b,A)),I&&Pe(I,b),Pe(()=>{v.isUnmounted=!0},b)},et=(v,b,A,D=!1,P=!1,E=0)=>{for(let B=E;B<v.length;B++)he(v[B],b,A,D,P)},oe=v=>{if(6&v.shapeFlag)return oe(v.component.subTree);if(128&v.shapeFlag)return v.suspense.next();let b=f(v.anchor||v.el),A=b&&b[ic];return A?f(A):b},ne=!1,xe=(v,b,A)=>{let D;v==null?b._vnode&&(he(b._vnode,null,null,!0),D=b._vnode.component):C(b._vnode||null,v,b,null,null,null,A),b._vnode=v,ne||(ne=!0,yl(D),Pn(),ne=!1)},Se={p:C,um:he,m:ie,r:Ae,mt:F,mc:T,pc:W,pbc:O,n:oe,o:e};return t&&([s,n]=t(Se)),{render:xe,hydrate:s,createApp:(i=s,function(v,b=null){te(v)||(v=ce({},v)),b==null||fe(b)||(b=null);let A=gc(),D=new WeakSet,P=[],E=!1,B=A.app={_uid:Qu++,_component:v,_props:b,_container:null,_context:A,_instance:null,version:Uc,get config(){return A.config},set config(I){},use:(I,...L)=>(D.has(I)||(I&&te(I.install)?(D.add(I),I.install(B,...L)):te(I)&&(D.add(I),I(B,...L))),B),mixin:I=>(A.mixins.includes(I)||A.mixins.push(I),B),component:(I,L)=>L?(A.components[I]=L,B):A.components[I],directive:(I,L)=>L?(A.directives[I]=L,B):A.directives[I],mount(I,L,M){if(!E){let $=B._ceVNode||Ce(v,b);return $.appContext=A,M===!0?M="svg":M===!1&&(M=void 0),L&&i?i($,I):xe($,I,M),E=!0,B._container=I,I.__vue_app__=B,Xs($.component)}},onUnmount(I){P.push(I)},unmount(){E&&(vt(P,B._instance,16),xe(null,B._container),delete B._container.__vue_app__)},provide:(I,L)=>(A.provides[I]=L,B),runWithContext(I){let L=qi;qi=B;try{return I()}finally{qi=L}}};return B})}}function Dr({type:e,props:t},i){return i==="svg"&&e==="foreignObject"||i==="mathml"&&e==="annotation-xml"&&t&&t.encoding&&t.encoding.includes("html")?void 0:i}function gi({effect:e,job:t},i){i?(e.flags|=32,t.flags|=4):(e.flags&=-33,t.flags&=-5)}function Tc(e,t){return(!e||e&&!e.pendingBranch)&&t&&!t.persisted}function Qa(e,t,i=!1){let s=e.children,n=t.children;if(J(s)&&J(n))for(let r=0;r<s.length;r++){let a=s[r],l=n[r];1&l.shapeFlag&&!l.dynamicChildren&&((l.patchFlag<=0||l.patchFlag===32)&&((l=n[r]=jt(n[r])).el=a.el),i||l.patchFlag===-2||Qa(a,l)),l.type===oi&&(l.patchFlag===-1&&(l=n[r]=jt(l)),l.el=a.el),l.type!==Oe||l.el||(l.el=a.el)}}function Dn(e){if(e)for(let t=0;t<e.length;t++)e[t].flags|=8}var $n=e=>e.__isSuspense,pa=0,th={name:"Suspense",__isSuspense:!0,process(e,t,i,s,n,r,a,l,o,c){if(e==null)(function(d,p,m,y,f,x,S,C,u){let{p:h,o:{createElement:g}}=u,w=g("div"),k=d.suspense=Il(d,f,y,p,w,m,x,S,C,u);h(null,k.pendingBranch=d.ssContent,w,null,y,k,x,S),k.deps>0?(As(d,"onPending"),As(d,"onFallback"),h(null,d.ssFallback,p,m,y,null,x,S),Vi(k,d.ssFallback)):k.resolve(!1,!0)})(t,i,s,n,r,a,l,o,c);else{if(r&&r.deps>0&&!e.suspense.isInFallback){t.suspense=e.suspense,t.suspense.vnode=t,t.el=e.el;return}(function(d,p,m,y,f,x,S,C,{p:u,um:h,o:{createElement:g}}){let w=p.suspense=d.suspense;w.vnode=p,p.el=d.el;let k=p.ssContent,_=p.ssFallback,{activeBranch:T,pendingBranch:R,isInFallback:O,isHydrating:j}=w;if(R)w.pendingBranch=k,Ct(R,k)?(u(R,k,w.hiddenContainer,null,f,w,x,S,C),w.deps<=0?w.resolve():O&&!j&&(u(T,_,m,y,f,null,x,S,C),Vi(w,_))):(w.pendingId=pa++,j?(w.isHydrating=!1,w.activeBranch=R):h(R,f,w),w.deps=0,w.effects.length=0,w.hiddenContainer=g("div"),O?(u(null,k,w.hiddenContainer,null,f,w,x,S,C),w.deps<=0?w.resolve():(u(T,_,m,y,f,null,x,S,C),Vi(w,_))):T&&Ct(T,k)?(u(T,k,m,y,f,w,x,S,C),w.resolve(!0)):(u(null,k,w.hiddenContainer,null,f,w,x,S,C),w.deps<=0&&w.resolve()));else if(T&&Ct(T,k))u(T,k,m,y,f,w,x,S,C),Vi(w,k);else if(As(p,"onPending"),w.pendingBranch=k,512&k.shapeFlag?w.pendingId=k.component.suspenseId:w.pendingId=pa++,u(null,k,w.hiddenContainer,null,f,w,x,S,C),w.deps<=0)w.resolve();else{let{timeout:q,pendingId:z}=w;q>0?setTimeout(()=>{w.pendingId===z&&w.fallback(_)},q):q===0&&w.fallback(_)}})(e,t,i,s,n,a,l,o,c)}},hydrate:function(e,t,i,s,n,r,a,l,o){let c=t.suspense=Il(t,s,i,e.parentNode,document.createElement("div"),null,n,r,a,l,!0),d=o(e,c.pendingBranch=t.ssContent,i,c,r,a);return c.deps===0&&c.resolve(!1,!0),d},normalize:function(e){let{shapeFlag:t,children:i}=e,s=32&t;e.ssContent=Rl(s?i.default:i),e.ssFallback=s?Rl(i.fallback):Ce(Oe)}};function As(e,t){let i=e.props&&e.props[t];te(i)&&i()}function Il(e,t,i,s,n,r,a,l,o,c,d=!1){var p;let m,y,{p:f,m:x,um:S,n:C,o:{parentNode:u,remove:h}}=c,g=(m=(p=e).props&&p.props.suspensible)!=null&&m!==!1;g&&t&&t.pendingBranch&&(y=t.pendingId,t.deps++);let w=e.props?Gi(e.props.timeout):void 0,k=r,_={vnode:e,parent:t,parentComponent:i,namespace:a,container:s,hiddenContainer:n,deps:0,pendingId:pa++,timeout:typeof w=="number"?w:-1,activeBranch:null,isFallbackMountPending:!1,pendingBranch:null,isInFallback:!d,isHydrating:d,isUnmounted:!1,effects:[],resolve(T=!1,R=!1){let{vnode:O,activeBranch:j,pendingBranch:q,pendingId:z,effects:F,parentComponent:N,container:K,isInFallback:U}=_,W=!1;if(_.isHydrating)_.isHydrating=!1;else if(!T){W=j&&q.transition&&q.transition.mode==="out-in";let ie=!1;W&&(j.transition.afterLeave=()=>{z===_.pendingId&&(x(q,K,r!==k||ie?r:C(j),0),Os(F),U&&O.ssFallback&&(O.ssFallback.el=null))}),j&&!_.isFallbackMountPending&&(u(j.el)===K&&(r=C(j),ie=!0),S(j,N,_,!0),!W&&U&&O.ssFallback&&Pe(()=>O.ssFallback.el=null,_)),W||x(q,K,r,0)}_.isFallbackMountPending=!1,Vi(_,q),_.pendingBranch=null,_.isInFallback=!1;let H=_.parent,Z=!1;for(;H;){if(H.pendingBranch){H.effects.push(...F),Z=!0;break}H=H.parent}Z||W||Os(F),_.effects=[],g&&t&&t.pendingBranch&&y===t.pendingId&&(t.deps--,t.deps!==0||R||t.resolve()),As(O,"onResolve")},fallback(T){if(!_.pendingBranch)return;let{vnode:R,activeBranch:O,parentComponent:j,container:q,namespace:z}=_;As(R,"onFallback");let F=C(O),N=()=>{_.isFallbackMountPending=!1,_.isInFallback&&(f(null,T,q,F,j,null,z,l,o),Vi(_,T))},K=T.transition&&T.transition.mode==="out-in";K&&(_.isFallbackMountPending=!0,O.transition.afterLeave=N),_.isInFallback=!0,S(O,j,null,!0),K||N()},move(T,R,O){_.activeBranch&&x(_.activeBranch,T,R,O),_.container=T},next:()=>_.activeBranch&&C(_.activeBranch),registerDep(T,R,O){let j=!!_.pendingBranch;j&&_.deps++;let q=T.vnode.el;T.asyncDep.catch(z=>{Li(z,T,0)}).then(z=>{if(T.isUnmounted||_.isUnmounted||_.pendingId!==T.suspenseId)return;Bs(),T.asyncResolved=!0;let{vnode:F}=T;ua(T,z,!1),q&&(F.el=q);let N=!q&&T.subTree.el;R(T,F,u(q||T.subTree.el),q?null:C(T.subTree),_,a,O),N&&(F.placeholder=null,h(N)),yr(T,F.el),j&&--_.deps==0&&_.resolve()})},unmount(T,R){_.isUnmounted=!0,_.activeBranch&&S(_.activeBranch,i,T,R),_.pendingBranch&&S(_.pendingBranch,i,T,R)}};return _}function Rl(e){let t;if(te(e)){let i=Ai&&e._c;i&&(e._d=!1,Fs()),e=e(),i&&(e._d=!0,t=Xe,xr())}return J(e)&&(e=function(i){let s;for(let n=0;n<i.length;n++){let r=i[n];if(!Zt(r))return;if(r.type!==Oe||r.children==="v-if"){if(s)return;s=r}}return s}(e)),e=ct(e),t&&!e.dynamicChildren&&(e.dynamicChildren=t.filter(i=>i!==e)),e}function Nc(e,t){t&&t.pendingBranch?J(e)?t.effects.push(...e):t.effects.push(e):Os(e)}function Vi(e,t){e.activeBranch=t;let{vnode:i,parentComponent:s}=e,n=t.el;for(;!n&&t.component;)n=(t=t.component.subTree).el;i.el=n,s&&s.subTree===i&&(s.vnode.el=n,yr(s,n))}var $e=Symbol.for("v-fgt"),oi=Symbol.for("v-txt"),Oe=Symbol.for("v-cmt"),Ci=Symbol.for("v-stc"),Qt=[],Xe=null;function Fs(e=!1){Qt.push(Xe=e?null:[])}function xr(){Qt.pop(),Xe=Qt[Qt.length-1]||null}var Ai=1;function zs(e,t=!1){Ai+=e,e<0&&Xe&&t&&(Xe.hasOnce=!0)}function Ac(e){return e.dynamicChildren=Ai>0?Xe||Qi:null,xr(),Ai>0&&Xe&&Xe.push(e),e}function ih(e,t,i,s,n,r){return Ac(Wa(e,t,i,s,n,r,!0))}function Un(e,t,i,s,n){return Ac(Ce(e,t,i,s,n,!0))}function Zt(e){return!!e&&e.__v_isVNode===!0}function Ct(e,t){return e.type===t.type&&e.key===t.key}function sh(e){}var Ec=({key:e})=>e??null,Sn=({ref:e,ref_key:t,ref_for:i})=>(typeof e=="number"&&(e=""+e),e!=null?se(e)||Fe(e)||te(e)?{i:Qe,r:e,k:t,f:!!i}:e:null);function Wa(e,t=null,i=null,s=0,n=null,r=+(e!==$e),a=!1,l=!1){let o={__v_isVNode:!0,__v_skip:!0,type:e,props:t,key:t&&Ec(t),ref:t&&Sn(t),scopeId:mr,slotScopeIds:null,children:i,component:null,suspense:null,ssContent:null,ssFallback:null,dirs:null,transition:null,el:null,anchor:null,target:null,targetStart:null,targetAnchor:null,staticCount:0,shapeFlag:r,patchFlag:s,dynamicProps:n,dynamicChildren:null,appContext:null,ctx:Qe};return l?(Vn(o,i),128&r&&e.normalize(o)):i&&(o.shapeFlag|=se(i)?8:16),Ai>0&&!a&&Xe&&(o.patchFlag>0||6&r)&&o.patchFlag!==32&&Xe.push(o),o}var Ce=function(e,t=null,i=null,s=0,n=null,r=!1){var a;if(e&&e!==mc||(e=Oe),Zt(e)){let o=Lt(e,t,!0);return i&&Vn(o,i),Ai>0&&!r&&Xe&&(6&o.shapeFlag?Xe[Xe.indexOf(e)]=o:Xe.push(o)),o.patchFlag=-2,o}if(te(a=e)&&"__vccOpts"in a&&(e=e.__vccOpts),t){let{class:o,style:c}=t=Mc(t);o&&!se(o)&&(t.class=Hs(o)),fe(c)&&(Ks(c)&&!J(c)&&(c=ce({},c)),t.style=Vs(c))}let l=se(e)?1:$n(e)?128:e.__isTeleport?64:fe(e)?4:2*!!te(e);return Wa(e,t,i,s,n,l,r,!0)};function Mc(e){return e?Ks(e)||xc(e)?ce({},e):e:null}function Lt(e,t,i=!1,s=!1){let{props:n,ref:r,patchFlag:a,children:l,transition:o}=e,c=t?Rc(n||{},t):n,d={__v_isVNode:!0,__v_skip:!0,type:e.type,props:c,key:c&&Ec(c),ref:t&&t.ref?i&&r?J(r)?r.concat(Sn(t)):[r,Sn(t)]:Sn(t):r,scopeId:e.scopeId,slotScopeIds:e.slotScopeIds,children:l,target:e.target,targetStart:e.targetStart,targetAnchor:e.targetAnchor,staticCount:e.staticCount,shapeFlag:e.shapeFlag,patchFlag:t&&e.type!==$e?a===-1?16:16|a:a,dynamicProps:e.dynamicProps,dynamicChildren:e.dynamicChildren,appContext:e.appContext,dirs:e.dirs,transition:o,component:e.component,suspense:e.suspense,ssContent:e.ssContent&&Lt(e.ssContent),ssFallback:e.ssFallback&&Lt(e.ssFallback),placeholder:e.placeholder,el:e.el,anchor:e.anchor,ctx:e.ctx,ce:e.ce};return o&&s&&Xt(d,o.clone(d)),d}function Ja(e=" ",t=0){return Ce(oi,null,e,t)}function nh(e,t){let i=Ce(Ci,null,e);return i.staticCount=t,i}function Ic(e="",t=!1){return t?(Fs(),Un(Oe,null,e)):Ce(Oe,null,e)}function ct(e){return e==null||typeof e=="boolean"?Ce(Oe):J(e)?Ce($e,null,e.slice()):Zt(e)?jt(e):Ce(oi,null,String(e))}function jt(e){return e.el===null&&e.patchFlag!==-1||e.memo?e:Lt(e)}function Vn(e,t){let i=0,{shapeFlag:s}=e;if(t==null)t=null;else if(J(t))i=16;else if(typeof t=="object")if(65&s){let n=t.default;n&&(n._c&&(n._d=!1),Vn(e,n()),n._c&&(n._d=!0));return}else{i=32;let n=t._;n||xc(t)?n===3&&Qe&&(Qe.slots._===1?t._=1:(t._=2,e.patchFlag|=1024)):t._ctx=Qe}else if(te(t)){if(65&s)return void Vn(e,{default:t});t={default:t,_ctx:Qe},i=32}else t=String(t),64&s?(i=16,t=[Ja(t)]):i=8;e.children=t,e.shapeFlag|=i}function Rc(...e){let t={};for(let i=0;i<e.length;i++){let s=e[i];for(let n in s)if(n==="class")t.class!==s.class&&(t.class=Hs([t.class,s.class]));else if(n==="style")t.style=Vs([t.style,s.style]);else if(Oi(n)){let r=t[n],a=s[n];a&&r!==a&&!(J(r)&&r.includes(a))?t[n]=r?[].concat(r,a):a:a!=null||r!=null||nr(n)||(t[n]=a)}else n!==""&&(t[n]=s[n])}return t}function ot(e,t,i,s=null){vt(e,t,7,[i,s])}var rh=gc(),ah=0;function Oc(e,t,i){let s=e.type,n=(t?t.appContext:e.appContext)||rh,r={uid:ah++,vnode:e,type:s,parent:t,appContext:n,root:null,next:null,subTree:null,effect:null,update:null,job:null,scope:new Ms(!0),render:null,proxy:null,exposed:null,exposeProxy:null,withProxy:null,provides:t?t.provides:Object.create(n.provides),ids:t?t.ids:["",0,0],accessCache:null,renderCache:[],components:null,directives:null,propsOptions:function a(l,o,c=!1){let d=c?Zu:o.propsCache,p=d.get(l);if(p)return p;let m=l.props,y={},f=[],x=!1;if(!te(l)){let C=u=>{x=!0;let[h,g]=a(u,o,!0);ce(y,h),g&&f.push(...g)};!c&&o.mixins.length&&o.mixins.forEach(C),l.extends&&C(l.extends),l.mixins&&l.mixins.forEach(C)}if(!m&&!x)return fe(l)&&d.set(l,Qi),Qi;if(J(m))for(let C=0;C<m.length;C++){let u=ye(m[C]);Ml(u)&&(y[u]=de)}else if(m)for(let C in m){let u=ye(C);if(Ml(u)){let h=m[C],g=y[u]=J(h)||te(h)?{type:h}:ce({},h),w=g.type,k=!1,_=!0;if(J(w))for(let T=0;T<w.length;++T){let R=w[T],O=te(R)&&R.name;if(O==="Boolean"){k=!0;break}O==="String"&&(_=!1)}else k=te(w)&&w.name==="Boolean";g[0]=k,g[1]=_,(k||me(g,"default"))&&f.push(u)}}let S=[y,f];return fe(l)&&d.set(l,S),S}(s,n),emitsOptions:function a(l,o,c=!1){let d=c?Gu:o.emitsCache,p=d.get(l);if(p!==void 0)return p;let m=l.emits,y={},f=!1;if(!te(l)){let x=S=>{let C=a(S,o,!0);C&&(f=!0,ce(y,C))};!c&&o.mixins.length&&o.mixins.forEach(x),l.extends&&x(l.extends),l.mixins&&l.mixins.forEach(x)}return m||f?(J(m)?m.forEach(x=>y[x]=null):ce(y,m),fe(l)&&d.set(l,y),y):(fe(l)&&d.set(l,null),null)}(s,n),emit:null,emitted:null,propsDefaults:de,inheritAttrs:s.inheritAttrs,ctx:de,data:de,props:de,attrs:de,slots:de,refs:de,setupState:de,setupContext:null,suspense:i,suspenseId:i?i.pendingId:0,asyncDep:null,asyncResolved:!1,isMounted:!1,isUnmounted:!1,isDeactivated:!1,bc:null,c:null,bm:null,m:null,bu:null,u:null,um:null,bum:null,da:null,a:null,rtg:null,rtc:null,ec:null,sp:null};return r.ctx={_:r},r.root=t?t.root:r,r.emit=Ju.bind(null,r),e.ce&&e.ce(r),r}var Ke=null,rt=()=>Ke||Qe;{let e=or(),t=(i,s)=>{let n;return(n=e[i])||(n=e[i]=[]),n.push(s),r=>{n.length>1?n.forEach(a=>a(r)):n[0](r)}};Cn=t("__VUE_INSTANCE_SETTERS__",i=>Ke=i),Ki=t("__VUE_SSR_SETTERS__",i=>Ei=i)}var os=e=>{let t=Ke;return Cn(e),e.scope.on(),()=>{e.scope.off(),Cn(t)}},Bs=()=>{Ke&&Ke.scope.off(),Cn(null)};function Pc(e){return 4&e.vnode.shapeFlag}var Ei=!1;function Lc(e,t=!1,i=!1){t&&Ki(t);let{props:s,children:n}=e.vnode,r=Pc(e);(function(c,d,p,m=!1){let y={},f=Object.create(ca);for(let x in c.propsDefaults=Object.create(null),wc(c,d,y,f),c.propsOptions[0])x in y||(y[x]=void 0);p?c.props=m?y:Uo(y):c.type.props?c.props=y:c.props=f,c.attrs=f})(e,s,r,t);var a=i||t;let l=e.slots=Object.create(ca);if(32&e.vnode.shapeFlag){let c=n._;c?(Sc(l,n,a),a&&To(l,"_",c,!0)):kc(n,l)}else n&&_c(e,n);let o=r?function(c,d){let p=c.type;c.accessCache=Object.create(null),c.proxy=new Proxy(c.ctx,ra);let{setup:m}=p;if(m){Gt();let y=c.setupContext=m.length>1?Bc(c):null,f=os(c),x=ls(m,c,0,[c.props,y]),S=Ea(x);if(Yt(),f(),(S||c.sp)&&!Kt(c)&&Ba(c),S){if(x.then(Bs,Bs),d)return x.then(C=>{ua(c,C,d)}).catch(C=>{Li(C,c,0)});c.asyncDep=x}else ua(c,x,d)}else zc(c,d)}(e,t):void 0;return t&&Ki(!1),o}function ua(e,t,i){te(t)?e.type.__ssrInlineRender?e.ssrRender=t:e.render=t:fe(t)&&(e.setupState=Ra(t)),zc(e,i)}function Fc(e){Tn=e,Wr=t=>{t.render._rc&&(t.withProxy=new Proxy(t.ctx,Iu))}}var lh=()=>!Tn;function zc(e,t,i){let s=e.type;if(!e.render){if(!t&&Tn&&!s.render){let n=s.template||la(e).template;if(n){let{isCustomElement:r,compilerOptions:a}=e.appContext.config,{delimiters:l,compilerOptions:o}=s,c=ce(ce({isCustomElement:r,delimiters:l},a),o);s.render=Tn(n,c)}}e.render=s.render||He,Wr&&Wr(e)}{let n=os(e);Gt();try{(function(r){let a=la(r),l=r.proxy,o=r.ctx;aa=!1,a.beforeCreate&&Tl(a.beforeCreate,r,"bc");let{data:c,computed:d,methods:p,watch:m,provide:y,inject:f,created:x,beforeMount:S,mounted:C,beforeUpdate:u,updated:h,activated:g,deactivated:w,beforeUnmount:k,unmounted:_,render:T,renderTracked:R,renderTriggered:O,errorCaptured:j,serverPrefetch:q,expose:z,inheritAttrs:F,components:N,directives:K}=a;if(f&&function(W,H){for(let Z in J(W)&&(W=oa(W)),W){let ie,he=W[Z];Fe(ie=fe(he)?"default"in he?Ts(he.from||Z,he.default,!0):Ts(he.from||Z):Ts(he))?Object.defineProperty(H,Z,{enumerable:!0,configurable:!0,get:()=>ie.value,set:Ae=>ie.value=Ae}):H[Z]=ie}}(f,o),p)for(let W in p){let H=p[W];te(H)&&(o[W]=H.bind(l))}if(c){let W=c.call(l,l);fe(W)&&(r.data=ui(W))}if(aa=!0,d)for(let W in d){let H=d[W],Z=te(H)?H.bind(l,l):te(H.get)?H.get.bind(l,l):He,ie=jc({get:Z,set:!te(H)&&te(H.set)?H.set.bind(l):He});Object.defineProperty(o,W,{enumerable:!0,configurable:!0,get:()=>ie.value,set:he=>ie.value=he})}if(m)for(let W in m)(function H(Z,ie,he,Ae){let _e=Ae.includes(".")?tc(he,Ae):()=>he[Ae];if(se(Z)){let Ve=ie[Z];te(Ve)&&Zi(_e,Ve)}else if(te(Z))Zi(_e,Z.bind(he));else if(fe(Z))if(J(Z))Z.forEach(Ve=>H(Ve,ie,he,Ae));else{let Ve=te(Z.handler)?Z.handler.bind(he):ie[Z.handler];te(Ve)&&Zi(_e,Ve,Z)}})(m[W],o,l,W);if(y){let W=te(y)?y.call(l):y;Reflect.ownKeys(W).forEach(H=>{Yo(H,W[H])})}function U(W,H){J(H)?H.forEach(Z=>W(Z.bind(l))):H&&W(H.bind(l))}if(x&&Tl(x,r,"c"),U(dc,S),U(Gs,C),U(ja,u),U(gr,h),U(lc,g),U(oc,w),U(fc,j),U(hc,R),U(uc,O),U(br,k),U(Ys,_),U(pc,q),J(z))if(z.length){let W=r.exposed||(r.exposed={});z.forEach(H=>{Object.defineProperty(W,H,{get:()=>l[H],set:Z=>l[H]=Z,enumerable:!0})})}else r.exposed||(r.exposed={});T&&r.render===He&&(r.render=T),F!=null&&(r.inheritAttrs=F),N&&(r.components=N),K&&(r.directives=K),q&&Ba(r)})(e)}finally{Yt(),n()}}}var oh={get:(e,t)=>(Ye(e,"get",""),e[t])};function Bc(e){return{attrs:new Proxy(e.attrs,oh),slots:e.slots,emit:e.emit,expose:t=>{e.exposed=t||{}}}}function Xs(e){return e.exposed?e.exposeProxy||(e.exposeProxy=new Proxy(Ra(Vo(e.exposed)),{get:(t,i)=>i in t?t[i]:i in Ns?Ns[i](e):void 0,has:(t,i)=>i in t||i in Ns})):e.proxy}function ha(e,t=!0){return te(e)?e.displayName||e.name:e.name||t&&e.__name}var jc=(e,t)=>function(i,s=!1){let n,r;return te(i)?n=i:(n=i.get,r=i.set),new ia(n,r,s)}(e,Ei);function Dc(e,t,i){try{zs(-1);let s=arguments.length;return s!==2?(s>3?i=Array.prototype.slice.call(arguments,2):s===3&&Zt(i)&&(i=[i]),Ce(e,t,i)):!fe(t)||J(t)?Ce(e,null,t):Zt(t)?Ce(e,null,[t]):Ce(e,t)}finally{zs(1)}}function ch(){}function dh(e,t,i,s){let n=i[s];if(n&&$c(n,e))return n;let r=t();return r.memo=e.slice(),r.cacheIndex=s,i[s]=r}function $c(e,t){let i=e.memo;if(i.length!=t.length)return!1;for(let s=0;s<i.length;s++)if(De(i[s],t[s]))return!1;return Ai>0&&Xe&&Xe.push(e),!0}var Uc="3.5.40",ph=He,uh=null,hh,fh=He,mh={createComponentInstance:Oc,setupComponent:Lc,renderComponentRoot:_n,setCurrentRenderingInstance:Ps,isVNode:Zt,normalizeVNode:ct,getComponentPublicInstance:Xs,ensureValidVNode:Ua,pushWarningContext:function(e){},popWarningContext:function(){}},vh=null,gh=null,bh=null,Ol="u">typeof window&&window.trustedTypes;if(Ol)try{Jr=Ol.createPolicy("vue",{createHTML:e=>e})}catch{}var Vc=Jr?e=>Jr.createHTML(e):e=>e,Bt="u">typeof document?document:null,Pl=Bt&&Bt.createElement("template"),Hc={insert:(e,t,i)=>{t.insertBefore(e,i||null)},remove:e=>{let t=e.parentNode;t&&t.removeChild(e)},createElement:(e,t,i,s)=>{let n=t==="svg"?Bt.createElementNS("http://www.w3.org/2000/svg",e):t==="mathml"?Bt.createElementNS("http://www.w3.org/1998/Math/MathML",e):i?Bt.createElement(e,{is:i}):Bt.createElement(e);return e==="select"&&s&&s.multiple!=null&&n.setAttribute("multiple",s.multiple),n},createText:e=>Bt.createTextNode(e),createComment:e=>Bt.createComment(e),setText:(e,t)=>{e.nodeValue=t},setElementText:(e,t)=>{e.textContent=t},parentNode:e=>e.parentNode,nextSibling:e=>e.nextSibling,querySelector:e=>Bt.querySelector(e),setScopeId(e,t){e.setAttribute(t,"")},insertStaticContent(e,t,i,s,n,r){let a=i?i.previousSibling:t.lastChild;if(n&&(n===r||n.nextSibling))for(;t.insertBefore(n.cloneNode(!0),i),n!==r&&(n=n.nextSibling););else{Pl.innerHTML=Vc(s==="svg"?`<svg>${e}</svg>`:s==="mathml"?`<math>${e}</math>`:e);let l=Pl.content;if(s==="svg"||s==="mathml"){let o=l.firstChild;for(;o.firstChild;)l.appendChild(o.firstChild);l.removeChild(o)}t.insertBefore(l,i)}return[a?a.nextSibling:t.firstChild,i?i.previousSibling:t.lastChild]}},ii="transition",bs="animation",ss=Symbol("_vtc"),Kc={name:String,type:String,css:{type:Boolean,default:!0},duration:[String,Number,Object],enterFromClass:String,enterActiveClass:String,enterToClass:String,appearFromClass:String,appearActiveClass:String,appearToClass:String,leaveFromClass:String,leaveActiveClass:String,leaveToClass:String},Qc=ce({},Fa,Kc),yh=((Vr=(e,{slots:t})=>Dc(rc,Wc(e),t)).displayName="Transition",Vr.props=Qc,Vr),bi=(e,t=[])=>{J(e)?e.forEach(i=>i(...t)):e&&e(...t)},Ll=e=>!!e&&(J(e)?e.some(t=>t.length>1):e.length>1);function Wc(e){let t={};for(let q in e)q in Kc||(t[q]=e[q]);if(e.css===!1)return t;let{name:i="v",type:s,duration:n,enterFromClass:r=`${i}-enter-from`,enterActiveClass:a=`${i}-enter-active`,enterToClass:l=`${i}-enter-to`,appearFromClass:o=r,appearActiveClass:c=a,appearToClass:d=l,leaveFromClass:p=`${i}-leave-from`,leaveActiveClass:m=`${i}-leave-active`,leaveToClass:y=`${i}-leave-to`}=e,f=function(q){if(q==null)return null;{if(fe(q))return[function(F){return Gi(F)}(q.enter),function(F){return Gi(F)}(q.leave)];let z=function(F){return Gi(F)}(q);return[z,z]}}(n),x=f&&f[0],S=f&&f[1],{onBeforeEnter:C,onEnter:u,onEnterCancelled:h,onLeave:g,onLeaveCancelled:w,onBeforeAppear:k=C,onAppear:_=u,onAppearCancelled:T=h}=t,R=(q,z,F,N)=>{q._enterCancelled=N,ri(q,z?d:l),ri(q,z?c:a),F&&F()},O=(q,z)=>{q._isLeaving=!1,ri(q,p),ri(q,y),ri(q,m),z&&z()},j=q=>(z,F)=>{let N=q?_:u,K=()=>R(z,q,F);bi(N,[z,K]),Fl(()=>{ri(z,q?o:r),Mt(z,q?d:l),Ll(N)||zl(z,s,x,K)})};return ce(t,{onBeforeEnter(q){bi(C,[q]),Mt(q,r),Mt(q,a)},onBeforeAppear(q){bi(k,[q]),Mt(q,o),Mt(q,c)},onEnter:j(!1),onAppear:j(!0),onLeave(q,z){q._isLeaving=!0;let F=()=>O(q,z);Mt(q,p),q._enterCancelled?(Mt(q,m),fa(q)):(fa(q),Mt(q,m)),Fl(()=>{q._isLeaving&&(ri(q,p),Mt(q,y),Ll(g)||zl(q,s,S,F))}),bi(g,[q,F])},onEnterCancelled(q){R(q,!1,void 0,!0),bi(h,[q])},onAppearCancelled(q){R(q,!0,void 0,!0),bi(T,[q])},onLeaveCancelled(q){O(q),bi(w,[q])}})}function Mt(e,t){t.split(/\s+/).forEach(i=>i&&e.classList.add(i)),(e[ss]||(e[ss]=new Set)).add(t)}function ri(e,t){t.split(/\s+/).forEach(s=>s&&e.classList.remove(s));let i=e[ss];i&&(i.delete(t),i.size||(e[ss]=void 0))}function Fl(e){requestAnimationFrame(()=>{requestAnimationFrame(e)})}var xh=0;function zl(e,t,i,s){let n=e._endId=++xh,r=()=>{n===e._endId&&s()};if(i!=null)return setTimeout(r,i);let{type:a,timeout:l,propCount:o}=Jc(e,t);if(!a)return s();let c=a+"end",d=0,p=()=>{e.removeEventListener(c,m),r()},m=y=>{y.target===e&&++d>=o&&p()};setTimeout(()=>{d<o&&p()},l+1),e.addEventListener(c,m)}function Jc(e,t){let i=window.getComputedStyle(e),s=f=>(i[f]||"").split(", "),n=s(`${ii}Delay`),r=s(`${ii}Duration`),a=Bl(n,r),l=s(`${bs}Delay`),o=s(`${bs}Duration`),c=Bl(l,o),d=null,p=0,m=0;t===ii?a>0&&(d=ii,p=a,m=r.length):t===bs?c>0&&(d=bs,p=c,m=o.length):m=(d=(p=Math.max(a,c))>0?a>c?ii:bs:null)?d===ii?r.length:o.length:0;let y=d===ii&&/\b(?:transform|all)(?:,|$)/.test(s(`${ii}Property`).toString());return{type:d,timeout:p,propCount:m,hasTransform:y}}function Bl(e,t){for(;e.length<t.length;)e=e.concat(e);return Math.max(...t.map((i,s)=>jl(i)+jl(e[s])))}function jl(e){return e==="auto"?0:1e3*Number(e.slice(0,-1).replace(",","."))}function fa(e){return(e?e.ownerDocument:document).body.offsetHeight}var Hn=Symbol("_vod"),Ga=Symbol("_vsh"),Gc={name:"show",beforeMount(e,{value:t},{transition:i}){e[Hn]=e.style.display==="none"?"":e.style.display,i&&t?i.beforeEnter(e):ys(e,t)},mounted(e,{value:t},{transition:i}){i&&t&&i.enter(e)},updated(e,{value:t,oldValue:i},{transition:s}){!t!=!i&&(s?t?(s.beforeEnter(e),ys(e,!0),s.enter(e)):s.leave(e,()=>{ys(e,!1)}):ys(e,t))},beforeUnmount(e,{value:t}){ys(e,t)}};function ys(e,t){e.style.display=t?e[Hn]:"none",e[Ga]=!t}var Yc=Symbol("");function wh(e){let t=rt();if(!t)return;let i=t.ut=(n=e(t.proxy))=>{Array.from(document.querySelectorAll(`[data-v-owner="${t.uid}"]`)).forEach(r=>mn(r,n))},s=()=>{let n=e(t.proxy);t.ce?mn(t.ce,n):function r(a,l){if(128&a.shapeFlag){let o=a.suspense;a=o.activeBranch,o.pendingBranch&&!o.isHydrating&&o.effects.push(()=>{r(o.activeBranch,l)})}for(;a.component;)a=a.component.subTree;if(1&a.shapeFlag&&a.el)mn(a.el,l);else if(a.type===$e)a.children.forEach(o=>r(o,l));else if(a.type===Ci){let{el:o,anchor:c}=a;for(;o&&(mn(o,l),o!==c);)o=o.nextSibling}}(t.subTree,n),i(n)};ja(()=>{Os(s)}),Gs(()=>{Zi(s,He,{flush:"post"});let n=new MutationObserver(s);n.observe(t.subTree.el.parentNode,{childList:!0}),Ys(()=>n.disconnect())})}function mn(e,t){if(e.nodeType===1){let s=e.style,n="";for(let r in t){var i;let a=(i=t[r])==null?"initial":typeof i=="string"?i===""?" ":i:String(i);s.setProperty(`--${r}`,a),n+=`--${r}: ${a};`}s[Yc]=n}}var kh=/(?:^|;)\s*display\s*:/,Dl=/\s*!important$/;function ws(e,t,i){if(J(i))i.forEach(s=>ws(e,t,s));else if(i==null&&(i=""),t.startsWith("--"))e.setProperty(t,i);else{let s=function(n,r){let a=$r[r];if(a)return a;let l=ye(r);if(l!=="filter"&&l in n)return $r[r]=l;l=Pi(l);for(let o=0;o<$l.length;o++){let c=$l[o]+l;if(c in n)return $r[r]=c}return r}(e,t);Dl.test(i)?e.setProperty(dt(s),i.replace(Dl,""),"important"):e[s]=i}}var $l=["Webkit","Moz","ms"],$r={},Ul="http://www.w3.org/1999/xlink";function Vl(e,t,i,s,n,r=Ep(t)){s&&t.startsWith("xlink:")?i==null?e.removeAttributeNS(Ul,t.slice(6,t.length)):e.setAttributeNS(Ul,t,i):i==null||r&&!(i||i==="")?e.removeAttribute(t):e.setAttribute(t,r?"":Ze(i)?String(i):i)}function Hl(e,t,i,s,n){if(t==="innerHTML"||t==="textContent"){i!=null&&(e[t]=t==="innerHTML"?Vc(i):i);return}let r=e.tagName;if(t==="value"&&r!=="PROGRESS"&&!r.includes("-")){let o=r==="OPTION"?e.getAttribute("value")||"":e.value,c=i==null?e.type==="checkbox"?"on":"":String(i);o===c&&"_value"in e||(e.value=c),i==null&&e.removeAttribute(t),e._value=i;return}let a=!1;if(i===""||i==null){let o=typeof e[t];if(o==="boolean"){var l;i=!!(l=i)||l===""}else i==null&&o==="string"?(i="",a=!0):o==="number"&&(i=0,a=!0)}try{e[t]=i}catch{}a&&e.removeAttribute(n||t)}function Ut(e,t,i,s){e.addEventListener(t,i,s)}var Kl=Symbol("_vei"),_h=/(Once|Passive|Capture)$/,Sh=/^on:?(?:Once|Passive|Capture)$/,Ur=0,qh=Promise.resolve(),Ql=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&e.charCodeAt(2)>96&&123>e.charCodeAt(2),Xc=(e,t,i,s,n,r)=>{let a=n==="svg";if(t==="class"){var l;let o;l=s,(o=e[ss])&&(l=(l?[l,...o]:[...o]).join(" ")),l==null?e.removeAttribute("class"):a?e.setAttribute("class",l):e.className=l}else t==="style"?function(o,c,d){let p=o.style,m=se(d),y=!1;if(d&&!m){if(c)if(se(c))for(let u of c.split(";")){let h=u.slice(0,u.indexOf(":")).trim();d[h]==null&&ws(p,h,"")}else for(let u in c)d[u]==null&&ws(p,u,"");for(let u in d){var f,x,S,C;u==="display"&&(y=!0);let h=d[u];h!=null?(f=o,x=u,S=!se(c)&&c?c[u]:void 0,C=h,f.tagName==="TEXTAREA"&&(x==="width"||x==="height")&&se(C)&&S===C||ws(p,u,h)):ws(p,u,"")}}else if(m){if(c!==d){let u=p[Yc];u&&(d+=";"+u),p.cssText=d,y=kh.test(d)}}else c&&o.removeAttribute("style");Hn in o&&(o[Hn]=y?p.display:"",o[Ga]&&(p.display="none"))}(e,i,s):Oi(t)?nr(t)||function(o,c,d,p=null){let m=o[Kl]||(o[Kl]={}),y=m[c];if(d&&y)y.value=d;else{let[S,C]=function(u){let h,g;for(;(g=u.match(_h))&&!Sh.test(u);)h||(h={}),u=u.slice(0,u.length-g[1].length),h[g[1].toLowerCase()]=!0;return[u[2]===":"?u.slice(3):dt(u.slice(2)),h]}(c);if(d){var f,x;let u;Ut(o,S,m[c]=(f=d,x=p,(u=h=>{if(h._vts){if(h._vts<=u.attached)return}else h._vts=Date.now();let g=u.value;if(J(g)){let w=h.stopImmediatePropagation;h.stopImmediatePropagation=()=>{w.call(h),h._stopped=!0};let k=g.slice(),_=[h];for(let T=0;T<k.length&&!h._stopped;T++){let R=k[T];R&&vt(R,x,5,_)}}else vt(g,x,5,[h])}).value=f,u.attached=Ur||(qh.then(()=>Ur=0),Ur=Date.now()),u),C)}else y&&(o.removeEventListener(S,y,C),m[c]=void 0)}}(e,t,s,r):(t[0]==="."?(t=t.slice(1),0):t[0]==="^"?(t=t.slice(1),1):!function(o,c,d,p){if(p)return!!(c==="innerHTML"||c==="textContent"||c in o&&Ql(c)&&te(d));if(c==="spellcheck"||c==="draggable"||c==="translate"||c==="autocorrect"||c==="sandbox"&&o.tagName==="IFRAME"||c==="form"||c==="list"&&o.tagName==="INPUT"||c==="type"&&o.tagName==="TEXTAREA")return!1;if(c==="width"||c==="height"){let m=o.tagName;if(m==="IMG"||m==="VIDEO"||m==="CANVAS"||m==="SOURCE")return!1}return!(Ql(c)&&se(d))&&c in o}(e,t,s,a))?e._isVueCE&&(function(o,c){let d=o._def.props;if(!d)return!1;let p=ye(c);return Array.isArray(d)?d.some(m=>ye(m)===p):Object.keys(d).some(m=>ye(m)===p)}(e,t)||e._def.__asyncLoader&&(/[A-Z]/.test(t)||!se(s)))?Hl(e,ye(t),s,r,t):(t==="true-value"?e._trueValue=s:t==="false-value"&&(e._falseValue=s),Vl(e,t,s,a)):(Hl(e,t,s),e.tagName.includes("-")||t!=="value"&&t!=="checked"&&t!=="selected"||Vl(e,t,s,a,r,t!=="value"))},Wl={};function Zc(e,t,i){let s,n=za(e,t);s=n,Ne.call(s)==="[object Object]"&&(n=ce({},n,t));class r extends Kn{constructor(l){super(n,l,i)}}return r.def=n,r}var Ch=(e,t)=>Zc(e,t,dd),Th="u">typeof HTMLElement?HTMLElement:class{},Kn=class e extends Th{constructor(t,i={},s=js){super(),this._def=t,this._props=i,this._createApp=s,this._isVueCE=!0,this._instance=null,this._app=null,this._nonce=this._def.nonce,this._connected=!1,this._resolved=!1,this._patching=!1,this._dirty=!1,this._numberProps=null,this._styleChildren=new WeakSet,this._styleAnchors=new WeakMap,this._ob=null,this.shadowRoot&&s!==js?this._root=this.shadowRoot:t.shadowRoot!==!1?(this.attachShadow(ce({},t.shadowRootOptions,{mode:"open"})),this._root=this.shadowRoot):this._root=this}connectedCallback(){if(!this.isConnected)return;this.shadowRoot||this._resolved||this._parseSlots(),this._connected=!0;let t=this;for(;t=t&&(t.assignedSlot||t.parentNode||t.host);)if(t instanceof e){this._parent=t;break}this._instance||(this._resolved?this._mount(this._def):t&&t._pendingResolve?this._pendingResolve=t._pendingResolve.then(()=>{this._pendingResolve=void 0,this._resolveDef()}):this._resolveDef())}_setParent(t=this._parent){t&&(this._instance.parent=t._instance,this._inheritParentContext(t))}_inheritParentContext(t=this._parent){t&&this._app&&Object.setPrototypeOf(this._app._context.provides,t._instance.provides)}disconnectedCallback(){this._connected=!1,fr(()=>{!this._connected&&(this._ob&&(this._ob.disconnect(),this._ob=null),this._app&&this._app.unmount(),this._instance&&(this._instance.ce=void 0),this._app=this._instance=null,this._teleportTargets&&(this._teleportTargets.clear(),this._teleportTargets=void 0))})}_processMutations(t){for(let i of t)this._setAttr(i.attributeName)}_resolveDef(){if(this._pendingResolve)return;for(let s=0;s<this.attributes.length;s++)this._setAttr(this.attributes[s].name);this._ob=new MutationObserver(this._processMutations.bind(this)),this._ob.observe(this,{attributes:!0});let t=(s,n=!1)=>{let r;this._resolved=!0,this._pendingResolve=void 0;let{props:a,styles:l}=s;if(a&&!J(a))for(let o in a){let c=a[o];(c===Number||c&&c.type===Number)&&(o in this._props&&(this._props[o]=Gi(this._props[o])),(r||(r=Object.create(null)))[ye(o)]=!0)}this._numberProps=r,this._resolveProps(s),this.shadowRoot&&this._applyStyles(l),this._mount(s)},i=this._def.__asyncLoader;i?this._pendingResolve=i().then(s=>{s.configureApp=this._def.configureApp,t(this._def=s,!0)}):t(this._def)}_mount(t){this._app=this._createApp(t),this._inheritParentContext(),t.configureApp&&t.configureApp(this._app),this._app._ceVNode=this._createVNode(),this._app.mount(this._root);let i=this._instance&&this._instance.exposed;if(i)for(let s in i)me(this,s)||Object.defineProperty(this,s,{get:()=>Qs(i[s])})}_resolveProps(t){let{props:i}=t,s=J(i)?i:Object.keys(i||{});for(let n of Object.keys(this))n[0]!=="_"&&s.includes(n)&&this._setProp(n,this[n]);for(let n of s.map(ye))Object.defineProperty(this,n,{get(){return this._getProp(n)},set(r){this._setProp(n,r,!0,!this._patching)}})}_setAttr(t){if(t.startsWith("data-v-"))return;let i=this.hasAttribute(t),s=i?this.getAttribute(t):Wl,n=ye(t);i&&this._numberProps&&this._numberProps[n]&&(s=Gi(s)),this._setProp(n,s,!1,!0)}_getProp(t){return this._props[t]}_setProp(t,i,s=!0,n=!1){if(i!==this._props[t]&&(this._dirty=!0,i===Wl?delete this._props[t]:(this._props[t]=i,t==="key"&&this._app&&(this._app._ceVNode.key=i)),n&&this._instance&&this._update(),s)){let r=this._ob;r&&(this._processMutations(r.takeRecords()),r.disconnect()),i===!0?this.setAttribute(dt(t),""):typeof i=="string"||typeof i=="number"?this.setAttribute(dt(t),i+""):i||this.removeAttribute(dt(t)),r&&r.observe(this,{attributes:!0})}}_update(){let t=this._createVNode();this._app&&(t.appContext=this._app._context),cd(t,this._root)}_createVNode(){let t={};this.shadowRoot||(t.onVnodeMounted=t.onVnodeUpdated=this._renderSlots.bind(this));let i=Ce(this._def,ce(t,this._props));return this._instance||(i.ce=s=>{this._instance=s,s.ce=this,s.isCE=!0;let n=(r,a)=>{let l;this.dispatchEvent(new CustomEvent(r,(l=a[0],Ne.call(l)==="[object Object]"?ce({detail:a},a[0]):{detail:a})))};s.emit=(r,...a)=>{n(r,a),dt(r)!==r&&n(dt(r),a)},this._setParent()}),i}_applyStyles(t,i,s){if(!t)return;if(i){if(i===this._def||this._styleChildren.has(i))return;this._styleChildren.add(i)}let n=this._nonce,r=this.shadowRoot,a=s?this._getStyleAnchor(s)||this._getStyleAnchor(this._def):this._getRootStyleInsertionAnchor(r),l=null;for(let o=t.length-1;o>=0;o--){let c=document.createElement("style");n&&c.setAttribute("nonce",n),c.textContent=t[o],r.insertBefore(c,l||a),l=c,o===0&&(s||this._styleAnchors.set(this._def,c),i&&this._styleAnchors.set(i,c))}}_getStyleAnchor(t){if(!t)return null;let i=this._styleAnchors.get(t);return i&&i.parentNode===this.shadowRoot?i:(i&&this._styleAnchors.delete(t),null)}_getRootStyleInsertionAnchor(t){for(let i=0;i<t.childNodes.length;i++){let s=t.childNodes[i];if(!(s instanceof HTMLStyleElement))return s}return null}_parseSlots(){let t,i=this._slots={};for(;t=this.firstChild;){let s=t.nodeType===1&&t.getAttribute("slot")||"default";(i[s]||(i[s]=[])).push(t),this.removeChild(t)}}_renderSlots(){let t=this._getSlots(),i=this._instance.type.__scopeId;for(let s=0;s<t.length;s++){let n=t[s],r=n.getAttribute("name")||"default",a=this._slots[r],l=n.parentNode;if(a)for(let o of a){if(i&&o.nodeType===1){let c,d=i+"-s",p=document.createTreeWalker(o,1);for(o.setAttribute(d,"");c=p.nextNode();)c.setAttribute(d,"")}l.insertBefore(o,n)}else for(;n.firstChild;)l.insertBefore(n.firstChild,n);l.removeChild(n)}}_getSlots(){let t=[this];this._teleportTargets&&t.push(...this._teleportTargets);let i=new Set;for(let s of t){let n=s.querySelectorAll("slot");for(let r=0;r<n.length;r++)i.add(n[r])}return Array.from(i)}_injectChildStyle(t,i){this._applyStyles(t.styles,t,i)}_beginPatch(){this._patching=!0,this._dirty=!1}_endPatch(){this._patching=!1,this._dirty&&this._instance&&this._update()}_hasShadowRoot(){return this._def.shadowRoot!==!1}_removeChildStyle(t){}};function ed(e){let t=rt();return t&&t.ce||null}function Nh(){let e=ed();return e&&e.shadowRoot}function Ah(e="$style"){{let t=rt();if(!t)return de;let i=t.type.__cssModules;return i&&i[e]||de}}var td=new WeakMap,id=new WeakMap,Qn=Symbol("_moveCb"),Jl=Symbol("_enterCb"),Eh=(Hr={name:"TransitionGroup",props:ce({},Qc,{tag:String,moveClass:String}),setup(e,{slots:t}){let i,s,n=rt(),r=La();return gr(()=>{if(!i.length)return;let a=e.moveClass||`${e.name||"v"}-move`;if(!function(o,c,d){let p=o.cloneNode(),m=o[ss];m&&m.forEach(x=>{x.split(/\s+/).forEach(S=>S&&p.classList.remove(S))}),d.split(/\s+/).forEach(x=>x&&p.classList.add(x)),p.style.display="none";let y=c.nodeType===1?c:c.parentNode;y.appendChild(p);let{hasTransform:f}=Jc(p);return y.removeChild(p),f}(i[0].el,n.vnode.el,a)){i=[];return}i.forEach(Mh),i.forEach(Ih);let l=i.filter(Rh);fa(n.vnode.el),l.forEach(o=>{let c=o.el,d=c.style;Mt(c,a),d.transform=d.webkitTransform=d.transitionDuration="";let p=c[Qn]=m=>{(!m||m.target===c)&&(!m||m.propertyName.endsWith("transform"))&&(c.removeEventListener("transitionend",p),c[Qn]=null,ri(c,a))};c.addEventListener("transitionend",p)}),i=[]}),()=>{let a=pe(e),l=Wc(a),o=a.tag||$e;if(i=[],s)for(let c=0;c<s.length;c++){let d=s[c];d.el&&d.el instanceof Element&&!d.el[Ga]&&(i.push(d),Xt(d,is(d,l,r,n)),td.set(d,sd(d.el)))}s=t.default?vr(t.default()):[];for(let c=0;c<s.length;c++){let d=s[c];d.key!=null&&Xt(d,is(d,l,r,n))}return Ce(o,null,s)}}},delete Hr.props.mode,Hr);function Mh(e){let t=e.el;t[Qn]&&t[Qn](),t[Jl]&&t[Jl]()}function Ih(e){id.set(e,sd(e.el))}function Rh(e){let t=td.get(e),i=id.get(e),s=t.left-i.left,n=t.top-i.top;if(s||n){let r=e.el,a=r.style,l=r.getBoundingClientRect(),o=1,c=1;return r.offsetWidth&&(o=l.width/r.offsetWidth),r.offsetHeight&&(c=l.height/r.offsetHeight),Number.isFinite(o)&&o!==0||(o=1),Number.isFinite(c)&&c!==0||(c=1),.01>Math.abs(o-1)&&(o=1),.01>Math.abs(c-1)&&(c=1),a.transform=a.webkitTransform=`translate(${s/o}px,${n/c}px)`,a.transitionDuration="0s",e}}function sd(e){let t=e.getBoundingClientRect();return{left:t.left,top:t.top}}var ci=e=>{let t=e.props["onUpdate:modelValue"]||!1;return J(t)?i=>Ji(t,i):t};function Oh(e){e.target.composing=!0}function Gl(e){let t=e.target;t.composing&&(t.composing=!1,t.dispatchEvent(new Event("input")))}var qt=Symbol("_assign");function Yl(e,t,i){return t&&(e=e.trim()),i&&(e=lr(e)),e}var Wn={created(e,{modifiers:{lazy:t,trim:i,number:s}},n){e[qt]=ci(n);let r=s||n.props&&n.props.type==="number";Ut(e,t?"change":"input",a=>{a.target.composing||e[qt](Yl(e.value,i,r))}),(i||r)&&Ut(e,"change",()=>{e.value=Yl(e.value,i,r)}),t||(Ut(e,"compositionstart",Oh),Ut(e,"compositionend",Gl),Ut(e,"change",Gl))},mounted(e,{value:t}){e.value=t??""},beforeUpdate(e,{value:t,oldValue:i,modifiers:{lazy:s,trim:n,number:r}},a){if(e[qt]=ci(a),e.composing)return;let l=(r||e.type==="number")&&!/^0\d/.test(e.value)?lr(e.value):e.value,o=t??"";if(l===o)return;let c=e.getRootNode();(c instanceof Document||c instanceof ShadowRoot)&&c.activeElement===e&&e.type!=="range"&&(s&&t===i||n&&e.value.trim()===o)||(e.value=o)}},Ya={deep:!0,created(e,t,i){e[qt]=ci(i),Ut(e,"change",()=>{let s=e._modelValue,n=ns(e),r=e.checked,a=e[qt];if(J(s)){let l=cr(s,n),o=l!==-1;if(r&&!o)a(s.concat(n));else if(!r&&o){let c=[...s];c.splice(l,1),a(c)}}else{let l;if(l=s,Ne.call(l)==="[object Set]"){let o=new Set(s);r?o.add(n):o.delete(n),a(o)}else a(rd(e,r))}})},mounted:Xl,beforeUpdate(e,t,i){e[qt]=ci(i),Xl(e,t,i)}};function Xl(e,{value:t,oldValue:i},s){let n;if(e._modelValue=t,J(t))n=cr(t,s.props.value)>-1;else{let r;if(r=t,Ne.call(r)==="[object Set]")n=t.has(s.props.value);else{if(t===i)return;n=Jt(t,rd(e,!0))}}e.checked!==n&&(e.checked=n)}var Xa={created(e,{value:t},i){e.checked=Jt(t,i.props.value),e[qt]=ci(i),Ut(e,"change",()=>{e[qt](ns(e))})},beforeUpdate(e,{value:t,oldValue:i},s){e[qt]=ci(s),t!==i&&(e.checked=Jt(t,s.props.value))}},nd={deep:!0,created(e,{value:t,modifiers:{number:i}},s){e._modelValue=t,Ut(e,"change",()=>{let n,r=Array.prototype.filter.call(e.options,a=>a.selected).map(a=>i?lr(ns(a)):ns(a));e[qt](e.multiple?(n=e._modelValue,Ne.call(n)==="[object Set]"?new Set(r):r):r[0]),e._assigning=!0,fr(()=>{e._assigning=!1})}),e[qt]=ci(s)},mounted(e,{value:t}){Zl(e,t)},beforeUpdate(e,{value:t},i){e._modelValue=t,e[qt]=ci(i)},updated(e,{value:t}){e._assigning||Zl(e,t)}};function Zl(e,t){let i,s=e.multiple,n=J(t);if(!s||n||(i=t,Ne.call(i)==="[object Set]")){for(let r=0,a=e.options.length;r<a;r++){let l=e.options[r],o=ns(l);if(s)if(n){let c=typeof o;c==="string"||c==="number"?l.selected=t.some(d=>String(d)===String(o)):l.selected=cr(t,o)>-1}else l.selected=t.has(o);else if(Jt(ns(l),t)){e.selectedIndex!==r&&(e.selectedIndex=r);return}}s||e.selectedIndex===-1||(e.selectedIndex=-1)}}function ns(e){return"_value"in e?e._value:e.value}function rd(e,t){let i=t?"_trueValue":"_falseValue";return i in e?e[i]:t}var ad={created(e,t,i){vn(e,t,i,null,"created")},mounted(e,t,i){vn(e,t,i,null,"mounted")},beforeUpdate(e,t,i,s){vn(e,t,i,s,"beforeUpdate")},updated(e,t,i,s){vn(e,t,i,s,"updated")}};function ld(e,t){switch(e){case"SELECT":return nd;case"TEXTAREA":return Wn;default:switch(t){case"checkbox":return Ya;case"radio":return Xa;default:return Wn}}}function vn(e,t,i,s,n){let r=ld(e.tagName,i.props&&i.props.type)[n];r&&r(e,t,i,s)}var Ph=["ctrl","shift","alt","meta"],Lh={stop:e=>e.stopPropagation(),prevent:e=>e.preventDefault(),self:e=>e.target!==e.currentTarget,ctrl:e=>!e.ctrlKey,shift:e=>!e.shiftKey,alt:e=>!e.altKey,meta:e=>!e.metaKey,left:e=>"button"in e&&e.button!==0,middle:e=>"button"in e&&e.button!==1,right:e=>"button"in e&&e.button!==2,exact:(e,t)=>Ph.some(i=>e[`${i}Key`]&&!t.includes(i))},Fh=(e,t)=>{if(!e)return e;let i=e._withMods||(e._withMods={}),s=t.join(".");return i[s]||(i[s]=(n,...r)=>{for(let a=0;a<t.length;a++){let l=Lh[t[a]];if(l&&l(n,t))return}return e(n,...r)})},zh={esc:"escape",space:" ",up:"arrow-up",left:"arrow-left",right:"arrow-right",down:"arrow-down",delete:"backspace"},Bh=(e,t)=>{let i=e._withKeys||(e._withKeys={}),s=t.join(".");return i[s]||(i[s]=n=>{if(!("key"in n))return;let r=dt(n.key);if(t.some(a=>a===r||zh[a]===r))return e(n)})},Za=ce({patchProp:Xc},Hc),eo=!1;function od(){return _i=eo?_i:qc(Za),eo=!0,_i}var cd=(...e)=>{(_i||(_i=Ka(Za))).render(...e)},jh=(...e)=>{od().hydrate(...e)},js=(...e)=>{let t=(_i||(_i=Ka(Za))).createApp(...e),{mount:i}=t;return t.mount=s=>{let n=ud(s);if(!n)return;let r=t._component;te(r)||r.render||r.template||(r.template=n.innerHTML),n.nodeType===1&&(n.textContent="");let a=i(n,!1,pd(n));return n instanceof Element&&(n.removeAttribute("v-cloak"),n.setAttribute("data-v-app","")),a},t},dd=(...e)=>{let t=od().createApp(...e),{mount:i}=t;return t.mount=s=>{let n=ud(s);if(n)return i(n,!0,pd(n))},t};function pd(e){return e instanceof SVGElement?"svg":typeof MathMLElement=="function"&&e instanceof MathMLElement?"mathml":void 0}function ud(e){return se(e)?document.querySelector(e):e}var to=!1,Dh=()=>{to||(to=!0,Wn.getSSRProps=({value:e})=>({value:e}),Xa.getSSRProps=({value:e},t)=>{if(t.props&&Jt(t.props.value,e))return{checked:!0}},Ya.getSSRProps=({value:e},t)=>{if(J(e)){if(t.props&&cr(e,t.props.value)>-1)return{checked:!0}}else{let i;if(i=e,Ne.call(i)==="[object Set]"){if(t.props&&e.has(t.props.value))return{checked:!0}}else if(e)return{checked:!0}}},ad.getSSRProps=(e,t)=>{if(typeof t.type!="string")return;let i=ld(t.type.toUpperCase(),t.props&&t.props.type);if(i.getSSRProps)return i.getSSRProps(e,t)},Gc.getSSRProps=({value:e})=>{if(!e)return{style:{display:"none"}}})},Vr,Hr,io,$h=Object.freeze({__proto__:null,BaseTransition:rc,BaseTransitionPropsValidators:Fa,Comment:Oe,DeprecationTypes:bh,EffectScope:Ms,ErrorCodes:su,ErrorTypeStrings:uh,Fragment:$e,KeepAlive:Su,ReactiveEffect:Ni,Static:Ci,Suspense:th,Teleport:uu,Text:oi,TrackOpTypes:Zp,Transition:yh,TransitionGroup:Eh,TriggerOpTypes:eu,VueElement:Kn,assertNumber:iu,callWithAsyncErrorHandling:vt,callWithErrorHandling:ls,camelize:ye,capitalize:Pi,cloneVNode:Lt,compatUtils:gh,computed:jc,createApp:js,createBlock:Un,createCommentVNode:Ic,createElementBlock:ih,createElementVNode:Wa,createHydrationRenderer:qc,createPropsRestProxy:Vu,createRenderer:Ka,createSSRApp:dd,createSlots:Au,createStaticVNode:nh,createTextVNode:Ja,createVNode:Ce,customRef:Qo,defineAsyncComponent:_u,defineComponent:za,defineCustomElement:Zc,defineEmits:Ou,defineExpose:Pu,defineModel:zu,defineOptions:Lu,defineProps:Ru,defineSSRCustomElement:Ch,defineSlots:Fu,devtools:hh,effect:Rp,effectScope:Mp,getCurrentInstance:rt,getCurrentScope:Io,getCurrentWatcher:tu,getTransitionRawChildren:vr,guardReactiveProps:Mc,h:Dc,handleError:Li,hasInjectionContext:ou,hydrate:jh,hydrateOnIdle:yu,hydrateOnInteraction:ku,hydrateOnMediaQuery:wu,hydrateOnVisible:xu,initCustomFormatter:ch,initDirectivesForSSR:Dh,inject:Ts,isMemoSame:$c,isProxy:Ks,isReactive:Ht,isReadonly:Pt,isRef:Fe,isRuntimeOnly:lh,isShallow:ut,isVNode:Zt,markRaw:Vo,mergeDefaults:$u,mergeModels:Uu,mergeProps:Rc,nextTick:fr,nodeOps:Hc,normalizeClass:Hs,normalizeProps:qp,normalizeStyle:Vs,onActivated:lc,onBeforeMount:dc,onBeforeUnmount:br,onBeforeUpdate:ja,onDeactivated:oc,onErrorCaptured:fc,onMounted:Gs,onRenderTracked:hc,onRenderTriggered:uc,onScopeDispose:Ip,onServerPrefetch:pc,onUnmounted:Ys,onUpdated:gr,onWatcherCleanup:Wo,openBlock:Fs,patchProp:Xc,popScopeId:ru,provide:Yo,proxyRefs:Ra,pushScopeId:nu,queuePostFlushCb:Os,reactive:ui,readonly:In,ref:qs,registerRuntimeCompiler:Fc,render:cd,renderList:Nu,renderSlot:Eu,resolveComponent:qu,resolveDirective:Tu,resolveDynamicComponent:Cu,resolveFilter:vh,resolveTransitionHooks:is,setBlockTracking:zs,setDevtoolsHook:fh,setTransitionHooks:Xt,shallowReactive:Uo,shallowReadonly:Qp,shallowRef:Ho,ssrContextKey:Xo,ssrUtils:mh,stop:Op,toDisplayString:Eo,toHandlerKey:Wi,toHandlers:Mu,toRaw:pe,toRef:Xp,toRefs:Yp,toValue:Jp,transformVNodeArgs:sh,triggerRef:Wp,unref:Qs,useAttrs:Du,useCssModule:Ah,useCssVars:wh,useHost:ed,useId:hu,useModel:Wu,useSSRContext:Zo,useShadowRoot:Nh,useSlots:ju,useTemplateRef:fu,useTransitionState:La,vModelCheckbox:Ya,vModelDynamic:ad,vModelRadio:Xa,vModelSelect:nd,vModelText:Wn,vShow:Gc,version:Uc,warn:ph,watch:Zi,watchEffect:cu,watchPostEffect:du,watchSyncEffect:ec,withAsyncContext:Hu,withCtx:Pa,withDefaults:Bu,withDirectives:lu,withKeys:Bh,withMemo:dh,withModifiers:Fh,withScopeId:au}),Ds=Symbol(""),Es=Symbol(""),el=Symbol(""),Jn=Symbol(""),hd=Symbol(""),Mi=Symbol(""),Ii=Symbol(""),Ri=Symbol(""),di=Symbol(""),pi=Symbol(""),Zs=Symbol(""),tl=Symbol(""),fd=Symbol(""),il=Symbol(""),ma=Symbol(""),sl=Symbol(""),Uh=Symbol(""),nl=Symbol(""),rl=Symbol(""),md=Symbol(""),vd=Symbol(""),wr=Symbol(""),Gn=Symbol(""),al=Symbol(""),ll=Symbol(""),$s=Symbol(""),en=Symbol(""),ol=Symbol(""),va=Symbol(""),Vh=Symbol(""),ga=Symbol(""),Yn=Symbol(""),Hh=Symbol(""),Kh=Symbol(""),cl=Symbol(""),Qh=Symbol(""),Wh=Symbol(""),dl=Symbol(""),gd=Symbol(""),rs={[Ds]:"Fragment",[Es]:"Teleport",[el]:"Suspense",[Jn]:"KeepAlive",[hd]:"BaseTransition",[Mi]:"openBlock",[Ii]:"createBlock",[Ri]:"createElementBlock",[di]:"createVNode",[pi]:"createElementVNode",[Zs]:"createCommentVNode",[tl]:"createTextVNode",[fd]:"createStaticVNode",[il]:"resolveComponent",[ma]:"resolveDynamicComponent",[sl]:"resolveDirective",[Uh]:"resolveFilter",[nl]:"withDirectives",[rl]:"renderList",[md]:"renderSlot",[vd]:"createSlots",[wr]:"toDisplayString",[Gn]:"mergeProps",[al]:"normalizeClass",[ll]:"normalizeStyle",[$s]:"normalizeProps",[en]:"guardReactiveProps",[ol]:"toHandlers",[va]:"camelize",[Vh]:"capitalize",[ga]:"toHandlerKey",[Yn]:"setBlockTracking",[Hh]:"pushScopeId",[Kh]:"popScopeId",[cl]:"withCtx",[Qh]:"unref",[Wh]:"isRef",[dl]:"withMemo",[gd]:"isMemoSame"},gt={start:{line:1,column:1,offset:0},end:{line:1,column:1,offset:0},source:""};function Us(e,t,i,s,n,r,a,l=!1,o=!1,c=!1,d=gt){var p,m,y,f;return e&&(l?(e.helper(Mi),e.helper((p=e.inSSR,m=c,p||m?Ii:Ri))):e.helper((y=e.inSSR,f=c,y||f?di:pi)),a&&e.helper(nl)),{type:13,tag:t,props:i,children:s,patchFlag:n,dynamicProps:r,directives:a,isBlock:l,disableTracking:o,isComponent:c,loc:d}}function Ti(e,t=gt){return{type:17,loc:t,elements:e}}function St(e,t=gt){return{type:15,loc:t,properties:e}}function Le(e,t){return{type:16,loc:gt,key:se(e)?ae(e,!0):e,value:t}}function ae(e,t=!1,i=gt,s=0){return{type:4,loc:i,content:e,isStatic:t,constType:t?3:s}}function At(e,t=gt){return{type:8,loc:t,children:e}}function Be(e,t=[],i=gt){return{type:14,loc:i,callee:e,arguments:t}}function as(e,t,i=!1,s=!1,n=gt){return{type:18,params:e,returns:t,newline:i,isSlot:s,loc:n}}function ba(e,t,i,s=!0){return{type:19,test:e,consequent:t,alternate:i,newline:s,loc:gt}}function pl(e,{helper:t,removeHelper:i,inSSR:s}){if(!e.isBlock){var n,r;e.isBlock=!0,i((n=e.isComponent,s||n?di:pi)),t(Mi),t((r=e.isComponent,s||r?Ii:Ri))}}var so=new Uint8Array([123,123]),no=new Uint8Array([125,125]);function ro(e){return e>=97&&e<=122||e>=65&&e<=90}function ft(e){return e===32||e===10||e===9||e===12||e===13}function si(e){return e===47||e===62||ft(e)}function Xn(e){let t=new Uint8Array(e.length);for(let i=0;i<e.length;i++)t[i]=e.charCodeAt(i);return t}var We={Cdata:new Uint8Array([67,68,65,84,65,91]),CdataEnd:new Uint8Array([93,93,62]),CommentEnd:new Uint8Array([45,45,62]),ScriptEnd:new Uint8Array([60,47,115,99,114,105,112,116]),StyleEnd:new Uint8Array([60,47,115,116,121,108,101]),TitleEnd:new Uint8Array([60,47,116,105,116,108,101]),TextareaEnd:new Uint8Array([60,47,116,101,120,116,97,114,101,97])};function ya(e){throw e}function bd(e){}function be(e,t,i,s){let n=SyntaxError(`https://vuejs.org/error-reference/#compiler-${e}`);return n.code=e,n.loc=t,n}var pt=e=>e.type===4&&e.isStatic;function yd(e){switch(e){case"Teleport":case"teleport":return Es;case"Suspense":case"suspense":return el;case"KeepAlive":case"keep-alive":return Jn;case"BaseTransition":case"base-transition":return hd}}var xa=/^$|^\d|[^\$\w\xA0-\uFFFF]/,xd=/[A-Za-z_$\xA0-\uFFFF]/,Jh=/[\.\?\w$\xA0-\uFFFF]/,Gh=/\s+[.[]\s*|\s*[.[]\s+/g,wd=e=>e.type===4?e.content:e.loc.source,kd=e=>{let t=wd(e).trim().replace(Gh,l=>l.trim()),i=0,s=[],n=0,r=0,a=null;for(let l=0;l<t.length;l++){let o=t.charAt(l);switch(i){case 0:if(o==="[")s.push(i),i=1,n++;else if(o==="(")s.push(i),i=2,r++;else if(!(l===0?xd:Jh).test(o))return!1;break;case 1:o==="'"||o==='"'||o==="`"?(s.push(i),i=3,a=o):o==="["?n++:o!=="]"||--n||(i=s.pop());break;case 2:if(o==="'"||o==='"'||o==="`")s.push(i),i=3,a=o;else if(o==="(")r++;else if(o===")"){if(l===t.length-1)return!1;--r||(i=s.pop())}break;case 3:o===a&&(i=s.pop(),a=null)}}return!n&&!r},Yh=/^\s*(?:async\s*)?(?:\([^)]*?\)|[\w$_]+)\s*(?::[^=]+)?=>|^\s*(?:async\s+)?function(?:\s+[\w$]+)?\s*\(/;function _t(e,t,i=!1){for(let s=0;s<e.props.length;s++){let n=e.props[s];if(n.type===7&&(i||n.exp)&&(se(t)?n.name===t:t.test(n.name)))return n}}function kr(e,t,i=!1,s=!1){for(let n=0;n<e.props.length;n++){let r=e.props[n];if(r.type===6){if(i)continue;if(r.name===t&&(r.value||s))return r}else if(r.name==="bind"&&(r.exp||s)&&Hi(r.arg,t))return r}}function Hi(e,t){return!!(e&&pt(e)&&e.content===t)}function Kr(e){return e.type===5||e.type===2}function ao(e){return e.type===7&&e.name==="pre"}function Xh(e){return e.type===7&&e.name==="slot"}function Zn(e){return e.type===1&&e.tagType===3}function er(e){return e.type===1&&e.tagType===2}var Zh=new Set([$s,en]);function wa(e,t=[]){if(e&&!se(e)&&e.type===14){let i=e.callee;if(!se(i)&&Zh.has(i))return wa(e.arguments[0],t.concat(e))}return[e,t]}function tr(e,t,i){let s,n;if(e.type!==13&&function(l,o){var c,d,p;if(o.key.type!==4||o.key.content!=="key")return!1;let m=l.arguments[2];if(m&&!se(m)){let[y]=wa(m);if(y&&!se(y)&&y.type===15&&Qr(o,y))return!0}return(c=l.arguments)[2]||(c[2]="{}"),(d=l.arguments)[3]||(d[3]="undefined"),(p=l.arguments)[4]||(p[4]="undefined"),l.arguments[5]=o.value,!0}(e,t))return;let r=e.type===13?e.props:e.arguments[2],a=[];if(r&&!se(r)&&r.type===14){let l=wa(r);r=l[0],n=(a=l[1])[a.length-1]}if(r==null||se(r))s=St([t]);else if(r.type===14){let l=r.arguments[0];se(l)||l.type!==15?r.callee===ol?s=Be(i.helper(Gn),[St([t]),r]):r.arguments.unshift(St([t])):Qr(t,l)||l.properties.unshift(t),s||(s=r)}else r.type===15?(Qr(t,r)||r.properties.unshift(t),s=r):(s=Be(i.helper(Gn),[St([t]),r]),n&&n.callee===en&&(n=a[a.length-2]));e.type===13?n?n.arguments[0]=s:e.props=s:n?n.arguments[0]=s:e.arguments[2]=s}function Qr(e,t){let i=!1;if(e.key.type===4){let s=e.key.content;i=t.properties.some(n=>n.key.type===4&&n.key.content===s)}return i}function ka(e,t){return`_${t}_${e.replace(/[^\w]/g,(i,s)=>i==="-"?"_":e.charCodeAt(s).toString())}`}var ef=/([\s\S]*?)\s+(?:in|of)\s+(\S[\s\S]*)/;function _d(e){for(let t=0;t<e.length;t++)if(!ft(e.charCodeAt(t)))return!1;return!0}function ul(e){return e.type===2&&_d(e.content)||e.type===12&&ul(e.content)}function Sd(e){return e.type===3||ul(e)}var qd={parseMode:"base",ns:0,delimiters:["{{","}}"],getNamespace:()=>0,isVoidTag:$i,isPreTag:$i,isIgnoreNewlineTag:$i,isCustomElement:$i,onError:ya,onWarn:bd,comments:!1,prefixIdentifiers:!1},we=qd,ir=null,Wt="",Ge=null,ve=null,ht="",zt=-1,xi=-1,hl=0,wi=!1,_a=null,qe=[],Re=new class{constructor(e,t){this.stack=e,this.cbs=t,this.state=1,this.buffer="",this.sectionStart=0,this.index=0,this.entityStart=0,this.baseState=1,this.inRCDATA=!1,this.inXML=!1,this.inVPre=!1,this.newlines=[],this.mode=0,this.delimiterOpen=so,this.delimiterClose=no,this.delimiterIndex=-1,this.currentSequence=void 0,this.sequenceIndex=0}get inSFCRoot(){return this.mode===2&&this.stack.length===0}reset(){this.state=1,this.mode=0,this.buffer="",this.sectionStart=0,this.index=0,this.baseState=1,this.inRCDATA=!1,this.currentSequence=void 0,this.newlines.length=0,this.delimiterOpen=so,this.delimiterClose=no}getPos(e){let t=1,i=e+1,s=this.newlines.length,n=-1;if(s>100){let r=-1,a=s;for(;r+1<a;){let l=r+a>>>1;this.newlines[l]<e?r=l:a=l}n=r}else for(let r=s-1;r>=0;r--)if(e>this.newlines[r]){n=r;break}return n>=0&&(t=n+2,i=e-this.newlines[n]),{column:i,line:t,offset:e}}peek(){return this.buffer.charCodeAt(this.index+1)}stateText(e){e===60?(this.index>this.sectionStart&&this.cbs.ontext(this.sectionStart,this.index),this.state=5,this.sectionStart=this.index):this.inVPre||e!==this.delimiterOpen[0]||(this.state=2,this.delimiterIndex=0,this.stateInterpolationOpen(e))}stateInterpolationOpen(e){if(e===this.delimiterOpen[this.delimiterIndex])if(this.delimiterIndex===this.delimiterOpen.length-1){let t=this.index+1-this.delimiterOpen.length;t>this.sectionStart&&this.cbs.ontext(this.sectionStart,t),this.state=3,this.sectionStart=t}else this.delimiterIndex++;else this.inRCDATA?(this.state=32,this.stateInRCDATA(e)):(this.state=1,this.stateText(e))}stateInterpolation(e){e===this.delimiterClose[0]&&(this.state=4,this.delimiterIndex=0,this.stateInterpolationClose(e))}stateInterpolationClose(e){e===this.delimiterClose[this.delimiterIndex]?this.delimiterIndex===this.delimiterClose.length-1?(this.cbs.oninterpolation(this.sectionStart,this.index+1),this.inRCDATA?this.state=32:this.state=1,this.sectionStart=this.index+1):this.delimiterIndex++:(this.state=3,this.stateInterpolation(e))}stateSpecialStartSequence(e){let t=this.sequenceIndex===this.currentSequence.length;if(t?si(e):(32|e)===this.currentSequence[this.sequenceIndex]){if(!t)return void this.sequenceIndex++}else this.inRCDATA=!1;this.sequenceIndex=0,this.state=6,this.stateInTagName(e)}stateInRCDATA(e){if(this.sequenceIndex===this.currentSequence.length){if(e===62||ft(e)){let t=this.index-this.currentSequence.length;if(this.sectionStart<t){let i=this.index;this.index=t,this.cbs.ontext(this.sectionStart,t),this.index=i}this.sectionStart=t+2,this.stateInClosingTagName(e),this.inRCDATA=!1;return}this.sequenceIndex=0}(32|e)===this.currentSequence[this.sequenceIndex]?this.sequenceIndex+=1:this.sequenceIndex===0?this.currentSequence!==We.TitleEnd&&(this.currentSequence!==We.TextareaEnd||this.inSFCRoot)?this.fastForwardTo(60)&&(this.sequenceIndex=1):this.inVPre||e!==this.delimiterOpen[0]||(this.state=2,this.delimiterIndex=0,this.stateInterpolationOpen(e)):this.sequenceIndex=+(e===60)}stateCDATASequence(e){e===We.Cdata[this.sequenceIndex]?++this.sequenceIndex===We.Cdata.length&&(this.state=28,this.currentSequence=We.CdataEnd,this.sequenceIndex=0,this.sectionStart=this.index+1):(this.sequenceIndex=0,this.state=23,this.stateInDeclaration(e))}fastForwardTo(e){for(;++this.index<this.buffer.length;){let t=this.buffer.charCodeAt(this.index);if(t===10&&this.newlines.push(this.index),t===e)return!0}return this.index=this.buffer.length-1,!1}stateInCommentLike(e){e===this.currentSequence[this.sequenceIndex]?++this.sequenceIndex===this.currentSequence.length&&(this.currentSequence===We.CdataEnd?this.cbs.oncdata(this.sectionStart,this.index-2):this.cbs.oncomment(this.sectionStart,this.index-2),this.sequenceIndex=0,this.sectionStart=this.index+1,this.state=1):this.sequenceIndex===0?this.fastForwardTo(this.currentSequence[0])&&(this.sequenceIndex=1):e!==this.currentSequence[this.sequenceIndex-1]&&(this.sequenceIndex=0)}startSpecial(e,t){this.enterRCDATA(e,t),this.state=31}enterRCDATA(e,t){this.inRCDATA=!0,this.currentSequence=e,this.sequenceIndex=t}stateBeforeTagName(e){e===33?(this.state=22,this.sectionStart=this.index+1):e===63?(this.state=24,this.sectionStart=this.index+1):ro(e)?(this.sectionStart=this.index,this.mode===0?this.state=6:this.inSFCRoot?this.state=34:this.inXML?this.state=6:e===116?this.state=30:this.state=e===115?29:6):e===47?this.state=8:(this.state=1,this.stateText(e))}stateInTagName(e){si(e)&&this.handleTagName(e)}stateInSFCRootTagName(e){if(si(e)){let t=this.buffer.slice(this.sectionStart,this.index);t!=="template"&&this.enterRCDATA(Xn("</"+t),0),this.handleTagName(e)}}handleTagName(e){this.cbs.onopentagname(this.sectionStart,this.index),this.sectionStart=-1,this.state=11,this.stateBeforeAttrName(e)}stateBeforeClosingTagName(e){ft(e)||(e===62?(this.state=1,this.sectionStart=this.index+1):(this.state=ro(e)?9:27,this.sectionStart=this.index))}stateInClosingTagName(e){(e===62||ft(e))&&(this.cbs.onclosetag(this.sectionStart,this.index),this.sectionStart=-1,this.state=10,this.stateAfterClosingTagName(e))}stateAfterClosingTagName(e){e===62&&(this.state=1,this.sectionStart=this.index+1)}stateBeforeAttrName(e){e===62?(this.cbs.onopentagend(this.index),this.inRCDATA?this.state=32:this.state=1,this.sectionStart=this.index+1):e===47?this.state=7:e===60&&this.peek()===47?(this.cbs.onopentagend(this.index),this.state=5,this.sectionStart=this.index):ft(e)||this.handleAttrStart(e)}handleAttrStart(e){e===118&&this.peek()===45?(this.state=13,this.sectionStart=this.index):e===46||e===58||e===64||e===35?(this.cbs.ondirname(this.index,this.index+1),this.state=14,this.sectionStart=this.index+1):(this.state=12,this.sectionStart=this.index)}stateInSelfClosingTag(e){e===62?(this.cbs.onselfclosingtag(this.index),this.state=1,this.sectionStart=this.index+1,this.inRCDATA=!1):ft(e)||(this.state=11,this.stateBeforeAttrName(e))}stateInAttrName(e){(e===61||si(e))&&(this.cbs.onattribname(this.sectionStart,this.index),this.handleAttrNameEnd(e))}stateInDirName(e){e===61||si(e)?(this.cbs.ondirname(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===58?(this.cbs.ondirname(this.sectionStart,this.index),this.state=14,this.sectionStart=this.index+1):e===46&&(this.cbs.ondirname(this.sectionStart,this.index),this.state=16,this.sectionStart=this.index+1)}stateInDirArg(e){e===61||si(e)?(this.cbs.ondirarg(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===91?this.state=15:e===46&&(this.cbs.ondirarg(this.sectionStart,this.index),this.state=16,this.sectionStart=this.index+1)}stateInDynamicDirArg(e){e===93?this.state=14:(e===61||si(e))&&(this.cbs.ondirarg(this.sectionStart,this.index+1),this.handleAttrNameEnd(e))}stateInDirModifier(e){e===61||si(e)?(this.cbs.ondirmodifier(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===46&&(this.cbs.ondirmodifier(this.sectionStart,this.index),this.sectionStart=this.index+1)}handleAttrNameEnd(e){this.sectionStart=this.index,this.state=17,this.cbs.onattribnameend(this.index),this.stateAfterAttrName(e)}stateAfterAttrName(e){e===61?this.state=18:e===47||e===62?(this.cbs.onattribend(0,this.sectionStart),this.sectionStart=-1,this.state=11,this.stateBeforeAttrName(e)):ft(e)||(this.cbs.onattribend(0,this.sectionStart),this.handleAttrStart(e))}stateBeforeAttrValue(e){e===34?(this.state=19,this.sectionStart=this.index+1):e===39?(this.state=20,this.sectionStart=this.index+1):ft(e)||(this.sectionStart=this.index,this.state=21,this.stateInAttrValueNoQuotes(e))}handleInAttrValue(e,t){(e===t||this.fastForwardTo(t))&&(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=-1,this.cbs.onattribend(t===34?3:2,this.index+1),this.state=11)}stateInAttrValueDoubleQuotes(e){this.handleInAttrValue(e,34)}stateInAttrValueSingleQuotes(e){this.handleInAttrValue(e,39)}stateInAttrValueNoQuotes(e){ft(e)||e===62?(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=-1,this.cbs.onattribend(1,this.index),this.state=11,this.stateBeforeAttrName(e)):(e===39||e===60||e===61||e===96)&&this.cbs.onerr(18,this.index)}stateBeforeDeclaration(e){e===91?(this.state=26,this.sequenceIndex=0):this.state=e===45?25:23}stateInDeclaration(e){(e===62||this.fastForwardTo(62))&&(this.state=1,this.sectionStart=this.index+1)}stateInProcessingInstruction(e){(e===62||this.fastForwardTo(62))&&(this.cbs.onprocessinginstruction(this.sectionStart,this.index),this.state=1,this.sectionStart=this.index+1)}stateBeforeComment(e){e===45?(this.state=28,this.currentSequence=We.CommentEnd,this.sequenceIndex=2,this.sectionStart=this.index+1):this.state=23}stateInSpecialComment(e){(e===62||this.fastForwardTo(62))&&(this.cbs.oncomment(this.sectionStart,this.index),this.state=1,this.sectionStart=this.index+1)}stateBeforeSpecialS(e){e===We.ScriptEnd[3]?this.startSpecial(We.ScriptEnd,4):e===We.StyleEnd[3]?this.startSpecial(We.StyleEnd,4):(this.state=6,this.stateInTagName(e))}stateBeforeSpecialT(e){e===We.TitleEnd[3]?this.startSpecial(We.TitleEnd,4):e===We.TextareaEnd[3]?this.startSpecial(We.TextareaEnd,4):(this.state=6,this.stateInTagName(e))}startEntity(){}stateInEntity(){}parse(e){for(this.buffer=e;this.index<this.buffer.length;){let t=this.buffer.charCodeAt(this.index);switch(t===10&&this.state!==33&&this.newlines.push(this.index),this.state){case 1:this.stateText(t);break;case 2:this.stateInterpolationOpen(t);break;case 3:this.stateInterpolation(t);break;case 4:this.stateInterpolationClose(t);break;case 31:this.stateSpecialStartSequence(t);break;case 32:this.stateInRCDATA(t);break;case 26:this.stateCDATASequence(t);break;case 19:this.stateInAttrValueDoubleQuotes(t);break;case 12:this.stateInAttrName(t);break;case 13:this.stateInDirName(t);break;case 14:this.stateInDirArg(t);break;case 15:this.stateInDynamicDirArg(t);break;case 16:this.stateInDirModifier(t);break;case 28:this.stateInCommentLike(t);break;case 27:this.stateInSpecialComment(t);break;case 11:this.stateBeforeAttrName(t);break;case 6:this.stateInTagName(t);break;case 34:this.stateInSFCRootTagName(t);break;case 9:this.stateInClosingTagName(t);break;case 5:this.stateBeforeTagName(t);break;case 17:this.stateAfterAttrName(t);break;case 20:this.stateInAttrValueSingleQuotes(t);break;case 18:this.stateBeforeAttrValue(t);break;case 8:this.stateBeforeClosingTagName(t);break;case 10:this.stateAfterClosingTagName(t);break;case 29:this.stateBeforeSpecialS(t);break;case 30:this.stateBeforeSpecialT(t);break;case 21:this.stateInAttrValueNoQuotes(t);break;case 7:this.stateInSelfClosingTag(t);break;case 23:this.stateInDeclaration(t);break;case 22:this.stateBeforeDeclaration(t);break;case 25:this.stateBeforeComment(t);break;case 24:this.stateInProcessingInstruction(t);break;case 33:this.stateInEntity()}this.index++}this.cleanup(),this.finish()}cleanup(){this.sectionStart!==this.index&&(this.state===1||this.state===32&&this.sequenceIndex===0?(this.cbs.ontext(this.sectionStart,this.index),this.sectionStart=this.index):(this.state===19||this.state===20||this.state===21)&&(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=this.index))}finish(){this.handleTrailingData(),this.cbs.onend()}handleTrailingData(){let e=this.buffer.length;this.sectionStart>=e||(this.state===28?this.currentSequence===We.CdataEnd?this.cbs.oncdata(this.sectionStart,e):this.cbs.oncomment(this.sectionStart,e):this.state===6||this.state===11||this.state===18||this.state===17||this.state===12||this.state===13||this.state===14||this.state===15||this.state===16||this.state===20||this.state===19||this.state===21||this.state===9||this.cbs.ontext(this.sectionStart,e))}emitCodePoint(e,t){}}(qe,{onerr:co,ontext(e,t){gn(Je(e,t),e,t)},ontextentity(e,t,i){gn(e,t,i)},oninterpolation(e,t){if(wi)return gn(Je(e,t),e,t);let i=e+Re.delimiterOpen.length,s=t-Re.delimiterClose.length;for(;ft(Wt.charCodeAt(i));)i++;for(;ft(Wt.charCodeAt(s-1));)s--;let n=Je(i,s);n.includes("&")&&(n=we.decodeEntities(n,!1)),Sa({type:5,content:bn(n,!1,Ie(i,s)),loc:Ie(e,t)})},onopentagname(e,t){let i=Je(e,t);Ge={type:1,tag:i,ns:we.getNamespace(i,qe[0],we.ns),tagType:0,props:[],children:[],loc:Ie(e-1,t),codegenNode:void 0}},onopentagend(e){oo(e)},onclosetag(e,t){let i=Je(e,t);if(!we.isVoidTag(i)){let s=!1;for(let n=0;n<qe.length;n++)if(qe[n].tag.toLowerCase()===i.toLowerCase()){s=!0,n>0&&qe[0].loc.start.offset;for(let r=0;r<=n;r++)qn(qe.shift(),t,r<n);break}s||Cd(e,60)}},onselfclosingtag(e){let t=Ge.tag;Ge.isSelfClosing=!0,oo(e),qe[0]&&qe[0].tag===t&&qn(qe.shift(),e)},onattribname(e,t){ve={type:6,name:Je(e,t),nameLoc:Ie(e,t),value:void 0,loc:Ie(e)}},ondirname(e,t){let i=Je(e,t),s=i==="."||i===":"?"bind":i==="@"?"on":i==="#"?"slot":i.slice(2);if(wi||s==="")ve={type:6,name:i,nameLoc:Ie(e,t),value:void 0,loc:Ie(e)};else if(ve={type:7,name:s,rawName:i,exp:void 0,arg:void 0,modifiers:i==="."?[ae("prop")]:[],loc:Ie(e)},s==="pre"){wi=Re.inVPre=!0,_a=Ge;let n=Ge.props;for(let r=0;r<n.length;r++)n[r].type===7&&(n[r]=function(a){let l={type:6,name:a.rawName,nameLoc:Ie(a.loc.start.offset,a.loc.start.offset+a.rawName.length),value:void 0,loc:a.loc};if(a.exp){let o=a.exp.loc;o.end.offset<a.loc.end.offset&&(o.start.offset--,o.start.column--,o.end.offset++,o.end.column++),l.value={type:2,content:a.exp.content,loc:o}}return l}(n[r]))}},ondirarg(e,t){if(e===t)return;let i=Je(e,t);if(wi&&!ao(ve))ve.name+=i,ki(ve.nameLoc,t);else{let s=i[0]!=="[";ve.arg=bn(s?i:i.slice(1,-1),s,Ie(e,t),3*!!s)}},ondirmodifier(e,t){let i=Je(e,t);if(wi&&!ao(ve))ve.name+="."+i,ki(ve.nameLoc,t);else if(ve.name==="slot"){let s=ve.arg;s&&(s.content+="."+i,ki(s.loc,t))}else{let s=ae(i,!0,Ie(e,t));ve.modifiers.push(s)}},onattribdata(e,t){ht+=Je(e,t),zt<0&&(zt=e),xi=t},onattribentity(e,t,i){ht+=e,zt<0&&(zt=t),xi=i},onattribnameend(e){let t=Je(ve.loc.start.offset,e);ve.type===7&&(ve.rawName=t),Ge.props.some(i=>(i.type===7?i.rawName:i.name)===t)},onattribend(e,t){Ge&&ve&&(ki(ve.loc,t),e!==0&&(ht.includes("&")&&(ht=we.decodeEntities(ht,!0)),ve.type===6?(ve.name==="class"&&(ht=Nd(ht).trim()),ve.value={type:2,content:ht,loc:e===1?Ie(zt,xi):Ie(zt-1,xi+1)},Re.inSFCRoot&&Ge.tag==="template"&&ve.name==="lang"&&ht&&ht!=="html"&&Re.enterRCDATA(Xn("</template"),0)):(ve.exp=bn(ht,!1,Ie(zt,xi),0,0),ve.name==="for"&&(ve.forParseResult=function(i){let s=i.loc,n=i.content,r=n.match(ef);if(!r)return;let[,a,l]=r,o=(y,f,x=!1)=>{let S=s.start.offset+f,C=S+y.length;return bn(y,!1,Ie(S,C),0,+!!x)},c={source:o(l.trim(),n.indexOf(l,a.length)),value:void 0,key:void 0,index:void 0,finalized:!1},d=a.trim().replace(tf,"").trim(),p=a.indexOf(d),m=d.match(lo);if(m){let y;d=d.replace(lo,"").trim();let f=m[1].trim();if(f&&(y=n.indexOf(f,p+d.length),c.key=o(f,y,!0)),m[2]){let x=m[2].trim();x&&(c.index=o(x,n.indexOf(x,c.key?y+f.length:p+d.length),!0))}}return d&&(c.value=o(d,p,!0)),c}(ve.exp)))),(ve.type!==7||ve.name!=="pre")&&Ge.props.push(ve)),ht="",zt=xi=-1},oncomment(e,t){we.comments&&Sa({type:3,content:Je(e,t),loc:Ie(e-4,t+3)})},onend(){let e=Wt.length;for(let t=0;t<qe.length;t++)qn(qe[t],e-1),qe[t].loc.start.offset},oncdata(e,t){(qe[0]?qe[0].ns:we.ns)!==0&&gn(Je(e,t),e,t)},onprocessinginstruction(e){(qe[0]?qe[0].ns:we.ns)===0&&co(21,e-1)}}),lo=/,([^,\}\]]*)(?:,([^,\}\]]*))?$/,tf=/^\(|\)$/g;function Je(e,t){return Wt.slice(e,t)}function oo(e){Re.inSFCRoot&&(Ge.innerLoc=Ie(e+1,e+1)),Sa(Ge);let{tag:t,ns:i}=Ge;i===0&&we.isPreTag(t)&&hl++,we.isVoidTag(t)?qn(Ge,e):(qe.unshift(Ge),(i===1||i===2)&&(Re.inXML=!0)),Ge=null}function gn(e,t,i){{let r=qe[0]&&qe[0].tag;r!=="script"&&r!=="style"&&e.includes("&")&&(e=we.decodeEntities(e,!1))}let s=qe[0]||ir,n=s.children[s.children.length-1];n&&n.type===2?(n.content+=e,ki(n.loc,i)):s.children.push({type:2,content:e,loc:Ie(t,i)})}function qn(e,t,i=!1){i?ki(e.loc,Cd(t,60)):ki(e.loc,function(a){let l=a;for(;Wt.charCodeAt(l)!==62&&l<Wt.length-1;)l++;return l}(t)+1),Re.inSFCRoot&&(e.children.length?e.innerLoc.end=ce({},e.children[e.children.length-1].loc.end):e.innerLoc.end=ce({},e.innerLoc.start),e.innerLoc.source=Je(e.innerLoc.start.offset,e.innerLoc.end.offset));let{tag:s,ns:n,children:r}=e;if(!wi&&(s==="slot"?e.tagType=2:function({tag:a,props:l}){if(a==="template"){for(let o=0;o<l.length;o++)if(l[o].type===7&&sf.has(l[o].name))return!0}return!1}(e)?e.tagType=3:function({tag:a,props:l}){var o;if(we.isCustomElement(a))return!1;if(a==="component"||(o=a.charCodeAt(0))>64&&o<91||yd(a)||we.isBuiltInComponent&&we.isBuiltInComponent(a)||we.isNativeTag&&!we.isNativeTag(a))return!0;for(let c=0;c<l.length;c++){let d=l[c];if(d.type===6&&d.name==="is"&&d.value&&d.value.content.startsWith("vue:"))return!0}return!1}(e)&&(e.tagType=1)),Re.inRCDATA||(e.children=Td(r)),n===0&&we.isIgnoreNewlineTag(s)){let a=r[0];a&&a.type===2&&(a.content=a.content.replace(/^\r?\n/,""))}n===0&&we.isPreTag(s)&&hl--,_a===e&&(wi=Re.inVPre=!1,_a=null),Re.inXML&&(qe[0]?qe[0].ns:we.ns)===0&&(Re.inXML=!1)}function Cd(e,t){let i=e;for(;Wt.charCodeAt(i)!==t&&i>=0;)i--;return i}var sf=new Set(["if","else","else-if","for","slot"]),nf=/\r\n/g;function Td(e){let t=we.whitespace!=="preserve",i=!1;for(let s=0;s<e.length;s++){let n=e[s];if(n.type===2)if(hl)n.content=n.content.replace(nf,`
`);else if(_d(n.content)){let r=e[s-1]&&e[s-1].type,a=e[s+1]&&e[s+1].type;!r||!a||t&&(r===3&&(a===3||a===1)||r===1&&(a===3||a===1&&function(l){for(let o=0;o<l.length;o++){let c=l.charCodeAt(o);if(c===10||c===13)return!0}return!1}(n.content)))?(i=!0,e[s]=null):n.content=" "}else t&&(n.content=Nd(n.content))}return i?e.filter(Boolean):e}function Nd(e){let t="",i=!1;for(let s=0;s<e.length;s++)ft(e.charCodeAt(s))?i||(t+=" ",i=!0):(t+=e[s],i=!1);return t}function Sa(e){(qe[0]||ir).children.push(e)}function Ie(e,t){return{start:Re.getPos(e),end:t==null?t:Re.getPos(t),source:t==null?t:Je(e,t)}}function ki(e,t){e.end=Re.getPos(t),e.source=Je(e.start.offset,t)}function bn(e,t=!1,i,s=0,n=0){return ae(e,t,i,s)}function co(e,t,i){we.onError(be(e,Ie(t,t)))}function po(e){let t=e.children.filter(i=>i.type!==3);return t.length!==1||t[0].type!==1||er(t[0])?null:t[0]}function mt(e,t){let{constantCache:i}=t;switch(e.type){case 1:if(e.tagType!==0)return 0;let l=i.get(e);if(l!==void 0)return l;let o=e.codegenNode;if(o.type!==13||o.isBlock&&e.tag!=="svg"&&e.tag!=="foreignObject"&&e.tag!=="math")return 0;if(o.patchFlag!==void 0)return i.set(e,0),0;{let d=3,p=Ad(e,t);if(p===0)return i.set(e,0),0;p<d&&(d=p);for(let m=0;m<e.children.length;m++){let y=mt(e.children[m],t);if(y===0)return i.set(e,0),0;y<d&&(d=y)}if(d>1)for(let m=0;m<e.props.length;m++){let y=e.props[m];if(y.type===7&&y.name==="bind"&&y.exp){let f=mt(y.exp,t);if(f===0)return i.set(e,0),0;f<d&&(d=f)}}if(o.isBlock){var s,n,r,a;for(let m=0;m<e.props.length;m++)if(e.props[m].type===7)return i.set(e,0),0;t.removeHelper(Mi),t.removeHelper((s=t.inSSR,n=o.isComponent,s||n?Ii:Ri)),o.isBlock=!1,t.helper((r=t.inSSR,a=o.isComponent,r||a?di:pi))}return i.set(e,d),d}case 2:case 3:return 3;case 9:case 11:case 10:default:return 0;case 5:case 12:return mt(e.content,t);case 4:return e.constType;case 8:let c=3;for(let d=0;d<e.children.length;d++){let p=e.children[d];if(se(p)||Ze(p))continue;let m=mt(p,t);if(m===0)return 0;m<c&&(c=m)}return c;case 20:return 2}}var rf=new Set([al,ll,$s,en]);function Ad(e,t){let i=3,s=Ed(e);if(s&&s.type===15){let{properties:n}=s;for(let r=0;r<n.length;r++){let a,{key:l,value:o}=n[r],c=mt(l,t);if(c===0)return c;if(c<i&&(i=c),(a=o.type===4?mt(o,t):o.type===14?function d(p,m){if(p.type===14&&!se(p.callee)&&rf.has(p.callee)){let y=p.arguments[0];if(y.type===4)return mt(y,m);if(y.type===14)return d(y,m)}return 0}(o,t):0)===0)return a;a<i&&(i=a)}}return i}function Ed(e){let t=e.codegenNode;if(t.type===13)return t.props}function sr(e,t){t.currentNode=e;let{nodeTransforms:i}=t,s=[];for(let a=0;a<i.length;a++){let l=i[a](e,t);if(l&&(J(l)?s.push(...l):s.push(l)),!t.currentNode)return;e=t.currentNode}switch(e.type){case 3:t.ssr||t.helper(Zs);break;case 5:t.ssr||t.helper(wr);break;case 9:for(let o=0;o<e.branches.length;o++)sr(e.branches[o],t);break;case 10:case 11:case 1:case 0:var n=e;let a=0,l=()=>{a--};for(;a<n.children.length;a++){let o=n.children[a];se(o)||(t.grandParent=t.parent,t.parent=n,t.childIndex=a,t.onNodeRemoved=l,sr(o,t))}}t.currentNode=e;let r=s.length;for(;r--;)s[r]()}function Md(e,t){let i=se(e)?s=>s===e:s=>e.test(s);return(s,n)=>{if(s.type===1){let{props:r}=s;if(s.tagType===3&&r.some(Xh))return;let a=[];for(let l=0;l<r.length;l++){let o=r[l];if(o.type===7&&i(o.name)){r.splice(l,1),l--;let c=t(s,o,n);c&&a.push(c)}}return a}}}var yn="/*@__PURE__*/",uo=e=>`${rs[e]}: _${rs[e]}`;function ho(e,t,{helper:i,push:s,newline:n,isTS:r}){let a=i(t==="component"?il:sl);for(let l=0;l<e.length;l++){let o=e[l],c=o.endsWith("__self");c&&(o=o.slice(0,-6)),s(`const ${ka(o,t)} = ${a}(${JSON.stringify(o)}${c?", true":""})${r?"!":""}`),l<e.length-1&&n()}}function qa(e,t){let i=e.length>3;t.push("["),i&&t.indent(),ks(e,t,i),i&&t.deindent(),t.push("]")}function ks(e,t,i=!1,s=!0){let{push:n,newline:r}=t;for(let a=0;a<e.length;a++){let l=e[a];se(l)?n(l,-3):J(l)?qa(l,t):st(l,t),a<e.length-1&&(i?(s&&n(","),r()):s&&n(", "))}}function st(e,t){var i,s,n;if(se(e))return void t.push(e,-3);if(Ze(e))return void t.push(t.helper(e));switch(e.type){case 1:case 9:case 11:case 12:st(e.codegenNode,t);break;case 2:i=e,t.push(JSON.stringify(i.content),-3,i);break;case 4:fo(e,t);break;case 5:(function(r,a){let{push:l,helper:o,pure:c}=a;c&&l(yn),l(`${o(wr)}(`),st(r.content,a),l(")")})(e,t);break;case 8:mo(e,t);break;case 3:(function(r,a){let{push:l,helper:o,pure:c}=a;c&&l(yn),l(`${o(Zs)}(${JSON.stringify(r.content)})`,-3,r)})(e,t);break;case 13:(function(r,a){var l,o;let c,{push:d,helper:p,pure:m}=a,{tag:y,props:f,children:x,patchFlag:S,dynamicProps:C,directives:u,isBlock:h,disableTracking:g,isComponent:w}=r;S&&(c=String(S)),u&&d(p(nl)+"("),h&&d(`(${p(Mi)}(${g?"true":""}), `),m&&d(yn),d(p(h?(l=a.inSSR,l||w?Ii:Ri):(o=a.inSSR,o||w?di:pi))+"(",-2,r),ks(function(k){let _=k.length;for(;_--&&k[_]==null;);return k.slice(0,_+1).map(T=>T||"null")}([y,f,x,c,C]),a),d(")"),h&&d(")"),u&&(d(", "),st(u,a),d(")"))})(e,t);break;case 14:(function(r,a){let{push:l,helper:o,pure:c}=a,d=se(r.callee)?r.callee:o(r.callee);c&&l(yn),l(d+"(",-2,r),ks(r.arguments,a),l(")")})(e,t);break;case 15:(function(r,a){let{push:l,indent:o,deindent:c,newline:d}=a,{properties:p}=r;if(!p.length)return l("{}",-2,r);let m=p.length>1;l(m?"{":"{ "),m&&o();for(let y=0;y<p.length;y++){let{key:f,value:x}=p[y];(function(S,C){let{push:u}=C;if(S.type===8)u("["),mo(S,C),u("]");else if(S.isStatic){let h;u((h=S.content,xa.test(h)?JSON.stringify(S.content):S.content),-2,S)}else u(`[${S.content}]`,-3,S)})(f,a),l(": "),st(x,a),y<p.length-1&&(l(","),d())}m&&c(),l(m?"}":" }")})(e,t);break;case 17:s=e,n=t,qa(s.elements,n);break;case 18:(function(r,a){let{push:l,indent:o,deindent:c}=a,{params:d,returns:p,body:m,newline:y,isSlot:f}=r;f&&l(`_${rs[cl]}(`),l("(",-2,r),J(d)?ks(d,a):d&&st(d,a),l(") => "),(y||m)&&(l("{"),o()),p?(y&&l("return "),J(p)?qa(p,a):st(p,a)):m&&st(m,a),(y||m)&&(c(),l("}")),f&&l(")")})(e,t);break;case 19:(function(r,a){let{test:l,consequent:o,alternate:c,newline:d}=r,{push:p,indent:m,deindent:y,newline:f}=a;if(l.type===4){let S,C=(S=l.content,!!xa.test(S));C&&p("("),fo(l,a),C&&p(")")}else p("("),st(l,a),p(")");d&&m(),a.indentLevel++,d||p(" "),p("? "),st(o,a),a.indentLevel--,d&&f(),d||p(" "),p(": ");let x=c.type===19;!x&&a.indentLevel++,st(c,a),!x&&a.indentLevel--,d&&y(!0)})(e,t);break;case 20:(function(r,a){let{push:l,helper:o,indent:c,deindent:d,newline:p}=a,{needPauseTracking:m,needArraySpread:y}=r;y&&l("[...("),l(`_cache[${r.index}] || (`),m&&(c(),l(`${o(Yn)}(-1`),r.inVOnce&&l(", true"),l("),"),p(),l("(")),l(`_cache[${r.index}] = `),st(r.value,a),m&&(l(`).cacheIndex = ${r.index},`),p(),l(`${o(Yn)}(1),`),p(),l(`_cache[${r.index}]`),d()),l(")"),y&&l(")]")})(e,t);break;case 21:ks(e.body,t,!0,!1)}}function fo(e,t){let{content:i,isStatic:s}=e;t.push(s?JSON.stringify(i):i,-3,e)}function mo(e,t){for(let i=0;i<e.children.length;i++){let s=e.children[i];se(s)?t.push(s,-3):st(s,t)}}var af=Md(/^(?:if|else|else-if)$/,(e,t,i)=>function(s,n,r,a){if(n.name!=="else"&&(!n.exp||!n.exp.content.trim())){let o=n.exp?n.exp.loc:s.loc;r.onError(be(28,n.loc)),n.exp=ae("true",!1,o)}if(n.name==="if"){var l;let o=vo(s,n),c={type:9,loc:Ie((l=s.loc).start.offset,l.end.offset),branches:[o]};if(r.replaceNode(c),a)return a(c,o,!0)}else{let o=r.parent.children,c=o.indexOf(s);for(;c-->=-1;){let d=o[c];if(d&&Sd(d)){r.removeNode(d);continue}if(d&&d.type===9){(n.name==="else-if"||n.name==="else")&&d.branches[d.branches.length-1].condition===void 0&&r.onError(be(30,s.loc)),r.removeNode();let p=vo(s,n);d.branches.push(p);let m=a&&a(d,p,!1);sr(p,r),m&&m(),r.currentNode=null}else r.onError(be(30,s.loc));break}}}(e,t,i,(s,n,r)=>{let a=i.parent.children,l=a.indexOf(s),o=0;for(;l-->=0;){let c=a[l];c&&c.type===9&&(o+=c.branches.length)}return()=>{r?s.codegenNode=go(n,o,i):function(c){for(;;)if(c.type===19){if(c.alternate.type!==19)return c;c=c.alternate}else c.type===20&&(c=c.value)}(s.codegenNode).alternate=go(n,o+s.branches.length-1,i)}}));function vo(e,t){let i=e.tagType===3;return{type:10,loc:e.loc,condition:t.name==="else"?void 0:t.exp,children:i&&!_t(e,"for")?e.children:[e],userKey:kr(e,"key"),isTemplateIf:i}}function go(e,t,i){return e.condition?ba(e.condition,bo(e,t,i),Be(i.helper(Zs),['""',"true"])):bo(e,t,i)}function bo(e,t,i){let{helper:s}=i,n=Le("key",ae(`${t}`,!1,gt,2)),{children:r}=e,a=r[0];if(r.length!==1||a.type!==1){if(r.length!==1||a.type!==11)return Us(i,s(Ds),St([n]),r,64,void 0,void 0,!0,!1,!1,e.loc);{let l=a.codegenNode;return tr(l,n,i),l}}{let l=a.codegenNode,o=l.type===14&&l.callee===dl?l.arguments[1].returns:l;return o.type===13&&pl(o,i),tr(o,n,i),l}}var lf=Md("for",(e,t,i)=>{let{helper:s,removeHelper:n}=i;return function(r,a,l,o){if(!a.exp)return void l.onError(be(31,a.loc));let c=a.forParseResult;if(!c)return void l.onError(be(32,a.loc));Id(c);let{scopes:d}=l,{source:p,value:m,key:y,index:f}=c,x={type:11,loc:a.loc,source:p,valueAlias:m,keyAlias:y,objectIndexAlias:f,parseResult:c,children:Zn(r)?r.children:[r]};l.replaceNode(x),d.vFor++;let S=o&&o(x);return()=>{d.vFor--,S&&S()}}(e,t,i,r=>{let a=Be(s(rl),[r.source]),l=Zn(e),o=_t(e,"memo"),c=kr(e,"key",!1,!0);c&&c.type;let d=c&&(c.type===6?c.value?ae(c.value.content,!0):void 0:c.exp),p=d?Le("key",d):null,m=r.source.type===4&&r.source.constType>0,y=m?64:c?128:256;return r.codegenNode=Us(i,s(Ds),void 0,a,y,void 0,void 0,!0,!m,!1,e.loc),()=>{let f,{children:x}=r,S=x.length!==1||x[0].type!==1,C=er(e)?e:l&&e.children.length===1&&er(e.children[0])?e.children[0]:null;if(C)f=C.codegenNode,l&&p&&tr(f,p,i);else if(S)f=Us(i,s(Ds),p?St([p]):void 0,e.children,64,void 0,void 0,!0,void 0,!1);else{var u,h,g,w,k,_,T,R;f=x[0].codegenNode,l&&p&&tr(f,p,i),!m!==f.isBlock&&(f.isBlock?(n(Mi),n((u=i.inSSR,h=f.isComponent,u||h?Ii:Ri))):n((g=i.inSSR,w=f.isComponent,g||w?di:pi))),f.isBlock=!m,f.isBlock?(s(Mi),s((k=i.inSSR,_=f.isComponent,k||_?Ii:Ri))):s((T=i.inSSR,R=f.isComponent,T||R?di:pi))}if(o){let O=as(Ca(r.parseResult,[ae("_cached")]));O.body={type:21,body:[At(["const _memo = (",o.exp,")"]),At(["if (_cached && _cached.el",...d?[" && _cached.key === ",d]:[],` && ${i.helperString(gd)}(_cached, _memo)) return _cached`]),At(["const _item = ",f]),ae("_item.memo = _memo"),ae("return _item")],loc:gt},a.arguments.push(O,ae("_cache"),ae(String(i.cached.length))),i.cached.push(null)}else a.arguments.push(as(Ca(r.parseResult),f,!0))}})});function Id(e,t){e.finalized||(e.finalized=!0)}function Ca({value:e,key:t,index:i},s=[]){var n=[e,t,i,...s];let r=n.length;for(;r--&&!n[r];);return n.slice(0,r+1).map((a,l)=>a||ae("_".repeat(l+1),!1))}var yo=ae("undefined",!1),of=(e,t)=>{if(e.type===1&&(e.tagType===1||e.tagType===3)){let i=_t(e,"slot");if(i)return i.exp,t.scopes.vSlot++,()=>{t.scopes.vSlot--}}};function xn(e,t,i){let s=[Le("name",e),Le("fn",t)];return i!=null&&s.push(Le("key",ae(String(i),!0))),St(s)}var Rd=new WeakMap,cf=(e,t)=>function(){let i,s,n,r,a;if((e=t.currentNode).type!==1||e.tagType!==0&&e.tagType!==1)return;let{tag:l,props:o}=e,c=e.tagType===1,d=c?function(f,x,S=!1){let{tag:C}=f,u=Ta(C),h=kr(f,"is",!1,!0);if(h)if(u){let w;if(h.type===6?w=h.value&&ae(h.value.content,!0):(w=h.exp)||(w=ae("is",!1,h.arg.loc)),w)return Be(x.helper(ma),[w])}else h.type===6&&h.value.content.startsWith("vue:")&&(C=h.value.content.slice(4));let g=yd(C)||x.isBuiltInComponent(C);return g?(S||x.helper(g),g):(x.helper(il),x.components.add(C),ka(C,"component"))}(e,t):`"${l}"`,p=fe(d)&&d.callee===ma,m=0,y=p||d===Es||d===el||!c&&(l==="svg"||l==="foreignObject"||l==="math");if(o.length>0){let f=Od(e,t,void 0,c,p);i=f.props,m=f.patchFlag,r=f.dynamicPropNames;let x=f.directives;a=x&&x.length?Ti(x.map(S=>function(C,u){let h=[],g=Rd.get(C);g?h.push(u.helperString(g)):(u.helper(sl),u.directives.add(C.name),h.push(ka(C.name,"directive")));let{loc:w}=C;if(C.exp&&h.push(C.exp),C.arg&&(C.exp||h.push("void 0"),h.push(C.arg)),Object.keys(C.modifiers).length){C.arg||(C.exp||h.push("void 0"),h.push("void 0"));let k=ae("true",!1,w);h.push(St(C.modifiers.map(_=>Le(_,k)),w))}return Ti(h,C.loc)}(S,t))):void 0,f.shouldUseBlock&&(y=!0)}if(e.children.length>0)if(d===Jn&&(y=!0,m|=1024),c&&d!==Es&&d!==Jn){let{slots:f,hasDynamicSlots:x}=function(S,C,u=(h,g,w,k)=>as(h,w,!1,!0,w.length?w[0].loc:k)){C.helper(cl);let{children:h,loc:g}=S,w=[],k=[],_=C.scopes.vSlot>0||C.scopes.vFor>0,T=_t(S,"slot",!0);if(T){let{arg:K,exp:U}=T;K&&!pt(K)&&(_=!0),w.push(Le(K||ae("default",!0),u(U,void 0,h,g)))}let R=!1,O=!1,j=[],q=new Set,z=0;for(let K=0;K<h.length;K++){let U,W,H,Z,ie=h[K];if(!Zn(ie)||!(U=_t(ie,"slot",!0))){ie.type!==3&&j.push(ie);continue}if(T){C.onError(be(37,U.loc));break}R=!0;let{children:he,loc:Ae}=ie,{arg:_e=ae("default",!0),exp:Ve,loc:et}=U;pt(_e)?W=_e?_e.content:"default":_=!0;let oe=_t(ie,"for"),ne=u(Ve,oe,he,Ae);if(H=_t(ie,"if"))_=!0,k.push(ba(H.exp,xn(_e,ne,z++),yo));else if(Z=_t(ie,/^else(?:-if)?$/,!0)){let xe,Se=K;for(;Se--&&Sd(xe=h[Se]););if(xe&&Zn(xe)&&_t(xe,/^(?:else-)?if$/)){let v=k[k.length-1];for(;v.alternate.type===19;)v=v.alternate;v.alternate=Z.exp?ba(Z.exp,xn(_e,ne,z++),yo):xn(_e,ne,z++)}else C.onError(be(30,Z.loc))}else if(oe){_=!0;let xe=oe.forParseResult;xe?(Id(xe),k.push(Be(C.helper(rl),[xe.source,as(Ca(xe),xn(_e,ne),!0)]))):C.onError(be(32,oe.loc))}else{if(W){if(q.has(W)){C.onError(be(38,et));continue}q.add(W),W==="default"&&(O=!0)}w.push(Le(_e,ne))}}if(!T){let K=(U,W)=>Le("default",u(U,void 0,W,g));R?j.length&&!j.every(ul)&&(O?C.onError(be(39,j[0].loc)):w.push(K(void 0,j))):w.push(K(void 0,h))}let F=_?2:function K(U){for(let W=0;W<U.length;W++){let H=U[W];switch(H.type){case 1:if(H.tagType===2||K(H.children))return!0;break;case 9:if(K(H.branches))return!0;break;case 10:case 11:if(K(H.children))return!0}}return!1}(S.children)?3:1,N=St(w.concat(Le("_",ae(F+"",!1))),g);return k.length&&(N=Be(C.helper(vd),[N,Ti(k)])),{slots:N,hasDynamicSlots:_}}(e,t);s=f,x&&(m|=1024)}else if(e.children.length===1&&d!==Es){let f=e.children[0],x=f.type,S=x===5||x===8;S&&mt(f,t)===0&&(m|=1),s=S||x===2?f:e.children}else s=e.children;r&&r.length&&(n=function(f){let x="[";for(let S=0,C=f.length;S<C;S++)x+=JSON.stringify(f[S]),S<C-1&&(x+=", ");return x+"]"}(r)),e.codegenNode=Us(t,d,i,s,m===0?void 0:m,n,a,!!y,!1,c,e.loc)};function Od(e,t,i=e.props,s,n,r=!1){let a,{tag:l,loc:o,children:c}=e,d=[],p=[],m=[],y=c.length>0,f=!1,x=0,S=!1,C=!1,u=!1,h=!1,g=!1,w=!1,k=[],_=O=>{d.length&&(p.push(St(xo(d),o)),d=[]),O&&p.push(O)},T=()=>{t.scopes.vFor>0&&d.push(Le(ae("ref_for",!0),ae("true")))},R=({key:O,value:j})=>{if(pt(O)){let q=O.content,z=Oi(q);z&&(!s||n)&&q.toLowerCase()!=="onclick"&&q!=="onUpdate:modelValue"&&!Vt(q)&&(h=!0),z&&Vt(q)&&(w=!0),z&&j.type===14&&(j=j.arguments[0]),j.type===20||(j.type===4||j.type===8)&&mt(j,t)>0||(q==="ref"?S=!0:q==="class"?C=!0:q==="style"?u=!0:q==="key"||k.includes(q)||k.push(q),s&&(q==="class"||q==="style")&&!k.includes(q)&&k.push(q))}else g=!0};for(let O=0;O<i.length;O++){let j=i[O];if(j.type===6){let{loc:q,name:z,nameLoc:F,value:N}=j;if(z==="ref"&&(S=!0,T()),z==="is"&&(Ta(l)||N&&N.content.startsWith("vue:")))continue;d.push(Le(ae(z,!0,F),ae(N?N.content:"",!0,N?N.loc:q)))}else{let{name:q,arg:z,exp:F,loc:N,modifiers:K}=j,U=q==="bind",W=q==="on";if(q==="slot"){s||t.onError(be(40,N));continue}if(q==="once"||q==="memo"||q==="is"||U&&Hi(z,"is")&&Ta(l)||W&&r)continue;if((U&&Hi(z,"key")||W&&y&&Hi(z,"vue:before-update"))&&(f=!0),U&&Hi(z,"ref")&&T(),!z&&(U||W)){g=!0,F?U?(T(),_(),p.push(F)):_({type:14,loc:N,callee:t.helper(ol),arguments:s?[F]:[F,"true"]}):t.onError(be(U?34:35,N));continue}U&&K.some(Z=>Z.content==="prop")&&(x|=32);let H=t.directiveTransforms[q];if(H){let{props:Z,needRuntime:ie}=H(j,e,t);r||Z.forEach(R),W&&z&&!pt(z)?_(St(Z,o)):d.push(...Z),ie&&(m.push(j),Ze(ie)&&Rd.set(j,ie))}else!bp(q)&&(m.push(j),y&&(f=!0))}}if(p.length?(_(),a=p.length>1?Be(t.helper(Gn),p,o):p[0]):d.length&&(a=St(xo(d),o)),g?x|=16:(C&&!s&&(x|=2),u&&!s&&(x|=4),k.length&&(x|=8),h&&(x|=32)),!f&&(x===0||x===32)&&(S||w||m.length>0)&&(x|=512),!t.inSSR&&a)switch(a.type){case 15:let O=-1,j=-1,q=!1;for(let N=0;N<a.properties.length;N++){let K=a.properties[N].key;pt(K)?K.content==="class"?O=N:K.content==="style"&&(j=N):K.isHandlerKey||(q=!0)}let z=a.properties[O],F=a.properties[j];q?a=Be(t.helper($s),[a]):(z&&!pt(z.value)&&(z.value=Be(t.helper(al),[z.value])),F&&(u||F.value.type===4&&F.value.content.trim()[0]==="["||F.value.type===17)&&(F.value=Be(t.helper(ll),[F.value])));break;case 14:break;default:a=Be(t.helper($s),[Be(t.helper(en),[a])])}return{props:a,directives:m,patchFlag:x,dynamicPropNames:k,shouldUseBlock:f}}function xo(e){let t=new Map,i=[];for(let r=0;r<e.length;r++){var s,n;let a=e[r];if(a.key.type===8||!a.key.isStatic){i.push(a);continue}let l=a.key.content,o=t.get(l);o?(l==="style"||l==="class"||Oi(l))&&(s=o,n=a,s.value.type===17?s.value.elements.push(n.value):s.value=Ti([s.value,n.value],s.loc)):(t.set(l,a),i.push(a))}return i}function Ta(e){return e==="component"||e==="Component"}var df=(e,t)=>{if(er(e)){let{children:i,loc:s}=e,{slotName:n,slotProps:r}=function(o,c){let d,p='"default"',m=[];for(let y=0;y<o.props.length;y++){let f=o.props[y];if(f.type===6)f.value&&(f.name==="name"?p=JSON.stringify(f.value.content):(f.name=ye(f.name),m.push(f)));else if(f.name==="bind"&&Hi(f.arg,"name")){if(f.exp)p=f.exp;else if(f.arg&&f.arg.type===4){let x=ye(f.arg.content);p=f.exp=ae(x,!1,f.arg.loc)}}else f.name==="bind"&&f.arg&&pt(f.arg)&&(f.arg.content=ye(f.arg.content)),m.push(f)}if(m.length>0){let{props:y,directives:f}=Od(o,c,m,!1,!1);d=y,f.length&&c.onError(be(36,f[0].loc))}return{slotName:p,slotProps:d}}(e,t),a=[t.prefixIdentifiers?"_ctx.$slots":"$slots",n,"{}","undefined","true"],l=2;r&&(a[2]=r,l=3),i.length&&(a[3]=as([],i,!1,!1,s),l=4),t.scopeId&&!t.slotted&&(l=5),a.splice(l),e.codegenNode=Be(t.helper(md),a,s)}},Pd=(e,t,i,s)=>{let n,{loc:r,modifiers:a,arg:l}=e;if(!e.exp&&a.length,l.type===4)if(l.isStatic){let p=l.content;p.startsWith("vue:")&&(p=`vnode-${p.slice(4)}`),n=ae(t.tagType!==0||p.startsWith("vnode")||!/[A-Z]/.test(p)?Wi(ye(p)):`on:${p}`,!0,l.loc)}else n=At([`${i.helperString(ga)}(`,l,")"]);else(n=l).children.unshift(`${i.helperString(ga)}(`),n.children.push(")");let o=e.exp;o&&!o.content.trim()&&(o=void 0);let c=i.cacheHandlers&&!o&&!i.inVOnce;if(o){let p,m=kd(o),y=!(m||(p=o,Yh.test(wd(p)))),f=o.content.includes(";");(y||c&&m)&&(o=At([`${y?"$event":"(...args)"} => ${f?"{":"("}`,o,f?"}":")"]))}let d={props:[Le(n,o||ae("() => {}",!1,r))]};return s&&(d=s(d)),c&&(d.props[0].value=i.cache(d.props[0].value)),d.props.forEach(p=>p.key.isHandlerKey=!0),d},pf=(e,t,i)=>{let{modifiers:s}=e,n=e.arg,{exp:r}=e;return r&&r.type===4&&!r.content.trim()&&(r=void 0),n.type!==4?(n.children.unshift("("),n.children.push(') || ""')):n.isStatic||(n.content=n.content?`${n.content} || ""`:'""'),s.some(a=>a.content==="camel")&&(n.type===4?n.isStatic?n.content=ye(n.content):n.content=`${i.helperString(va)}(${n.content})`:(n.children.unshift(`${i.helperString(va)}(`),n.children.push(")"))),!i.inSSR&&(s.some(a=>a.content==="prop")&&wo(n,"."),s.some(a=>a.content==="attr")&&wo(n,"^")),{props:[Le(n,r)]}},wo=(e,t)=>{e.type===4?e.isStatic?e.content=t+e.content:e.content=`\`${t}\${${e.content}}\``:(e.children.unshift(`'${t}' + (`),e.children.push(")"))},uf=(e,t)=>{if(e.type===0||e.type===1||e.type===11||e.type===10)return()=>{let i,s=e.children,n=!1;for(let r=0;r<s.length;r++){let a=s[r];if(Kr(a)){n=!0;for(let l=r+1;l<s.length;l++){let o=s[l];if(Kr(o))i||(i=s[r]=At([a],a.loc)),i.children.push(" + ",o),s.splice(l,1),l--;else{i=void 0;break}}}}if(n&&(s.length!==1||e.type!==0&&(e.type!==1||e.tagType!==0||e.props.find(r=>r.type===7&&!t.directiveTransforms[r.name]))))for(let r=0;r<s.length;r++){let a=s[r];if(Kr(a)||a.type===8){let l=[];(a.type!==2||a.content!==" ")&&l.push(a),t.ssr||mt(a,t)!==0||l.push("1"),s[r]={type:12,content:a,loc:a.loc,codegenNode:Be(t.helper(tl),l)}}}}},ko=new WeakSet,hf=(e,t)=>{if(e.type===1&&_t(e,"once",!0)&&!ko.has(e)&&!t.inVOnce&&!t.inSSR)return ko.add(e),t.inVOnce=!0,t.helper(Yn),()=>{t.inVOnce=!1;let i=t.currentNode;i.codegenNode&&(i.codegenNode=t.cache(i.codegenNode,!0,!0))}},Ld=(e,t,i)=>{let s,{exp:n,arg:r}=e;if(!n)return i.onError(be(41,e.loc)),wn();let a=n.loc.source.trim(),l=n.type===4?n.content:a,o=i.bindingMetadata[a];if(o==="props"||o==="props-aliased"||o==="literal-const"||o==="setup-const")return n.loc,wn();if(!l.trim()||!kd(n))return i.onError(be(42,n.loc)),wn();let c=r||ae("modelValue",!0),d=r?pt(r)?`onUpdate:${ye(r.content)}`:At(['"onUpdate:" + ',r]):"onUpdate:modelValue",p=i.isTS?"($event: any)":"$event";s=At([`${p} => ((`,n,") = $event)"]);let m=[Le(c,e.exp),Le(d,s)];if(e.modifiers.length&&t.tagType===1){let y=e.modifiers.map(x=>x.content).map(x=>(xa.test(x)?JSON.stringify(x):x)+": true").join(", "),f=r?pt(r)?`${r.content}Modifiers`:At([r,' + "Modifiers"']):"modelModifiers";m.push(Le(f,ae(`{ ${y} }`,!1,e.loc,2)))}return wn(m)};function wn(e=[]){return{props:e}}var _o=new WeakSet,ff=(e,t)=>{if(e.type===1){let i=_t(e,"memo");if(!(!i||_o.has(e))&&!t.inSSR)return _o.add(e),()=>{let s=e.codegenNode||t.currentNode.codegenNode;s&&s.type===13&&(e.tagType!==1&&pl(s,t),e.codegenNode=Be(t.helper(dl),[i.exp,as(void 0,s),"_cache",String(t.cached.length)]),t.cached.push(null))}}},mf=(e,t)=>{if(e.type===1){for(let i of e.props)if(i.type===7&&i.name==="bind"&&(!i.exp||i.exp.type===4&&!i.exp.content.trim())&&i.arg){let s=i.arg;if(s.type===4&&s.isStatic){let n=ye(s.content);(xd.test(n[0])||n[0]==="-")&&(i.exp=ae(n,!1,s.loc))}else t.onError(be(53,s.loc)),i.exp=ae("",!0,s.loc)}}},Fd=Symbol(""),zd=Symbol(""),Bd=Symbol(""),jd=Symbol(""),Na=Symbol(""),Dd=Symbol(""),$d=Symbol(""),Ud=Symbol(""),Vd=Symbol(""),Hd=Symbol("");Object.getOwnPropertySymbols(io={[Fd]:"vModelRadio",[zd]:"vModelCheckbox",[Bd]:"vModelText",[jd]:"vModelSelect",[Na]:"vModelDynamic",[Dd]:"withModifiers",[$d]:"withKeys",[Ud]:"vShow",[Vd]:"Transition",[Hd]:"TransitionGroup"}).forEach(e=>{rs[e]=io[e]});var vf={parseMode:"html",isVoidTag:Ap,isNativeTag:e=>Cp(e)||Tp(e)||Np(e),isPreTag:e=>e==="pre",isIgnoreNewlineTag:e=>e==="pre"||e==="textarea",decodeEntities:function(e,t=!1){return zi||(zi=document.createElement("div")),t?(zi.innerHTML=`<div foo="${e.replace(/"/g,"&quot;")}">`,zi.children[0].getAttribute("foo")):(zi.innerHTML=e,zi.textContent)},isBuiltInComponent:e=>e==="Transition"||e==="transition"?Vd:e==="TransitionGroup"||e==="transition-group"?Hd:void 0,getNamespace(e,t,i){let s=t?t.ns:i;if(t&&s===2)if(t.tag==="annotation-xml"){if(e==="svg")return 1;t.props.some(n=>n.type===6&&n.name==="encoding"&&n.value!=null&&(n.value.content==="text/html"||n.value.content==="application/xhtml+xml"))&&(s=0)}else/^m(?:[ions]|text)$/.test(t.tag)&&e!=="mglyph"&&e!=="malignmark"&&(s=0);else t&&s===1&&(t.tag==="foreignObject"||t.tag==="desc"||t.tag==="title")&&(s=0);if(s===0){if(e==="svg")return 1;if(e==="math")return 2}return s}},gf=bt("passive,once,capture"),bf=bt("stop,prevent,self,ctrl,shift,alt,meta,exact,middle"),yf=bt("left,right"),So=bt("onkeyup,onkeydown,onkeypress"),qo=(e,t)=>pt(e)&&e.content.toLowerCase()==="onclick"?ae(t,!0):e.type!==4?At(["(",e,`) === "onClick" ? "${t}" : (`,e,")"]):e,xf=(e,t)=>{e.type===1&&e.tagType===0&&(e.tag==="script"||e.tag==="style")&&t.removeNode()},wf=[e=>{e.type===1&&e.props.forEach((t,i)=>{let s,n;t.type===6&&t.name==="style"&&t.value&&(e.props[i]={type:7,name:"bind",arg:ae("style",!0,t.loc),exp:(s=t.value.content,n=t.loc,ae(JSON.stringify(No(s)),!1,n,3)),modifiers:[],loc:t.loc})})}],kf={cloak:()=>({props:[]}),html:(e,t,i)=>{let{exp:s,loc:n}=e;return s||i.onError(be(54,n)),t.children.length&&(i.onError(be(55,n)),t.children.length=0),{props:[Le(ae("innerHTML",!0,n),s||ae("",!0))]}},text:(e,t,i)=>{let{exp:s,loc:n}=e;return s||i.onError(be(56,n)),t.children.length&&(i.onError(be(57,n)),t.children.length=0),{props:[Le(ae("textContent",!0),s?mt(s,i)>0?s:Be(i.helperString(wr),[s],n):ae("",!0))]}},model:(e,t,i)=>{let s=Ld(e,t,i);if(!s.props.length||t.tagType===1)return s;e.arg&&i.onError(be(59,e.arg.loc));let{tag:n}=t,r=i.isCustomElement(n);if(n==="input"||n==="textarea"||n==="select"||r){let a=Bd,l=!1;if(n==="input"||r){let o=kr(t,"type");if(o){if(o.type===7)a=Na;else if(o.value)switch(o.value.content){case"radio":a=Fd;break;case"checkbox":a=zd;break;case"file":l=!0,i.onError(be(60,e.loc))}}else t.props.some(c=>c.type===7&&c.name==="bind"&&(!c.arg||c.arg.type!==4||!c.arg.isStatic))&&(a=Na)}else n==="select"&&(a=jd);l||(s.needRuntime=i.helper(a))}else i.onError(be(58,e.loc));return s.props=s.props.filter(a=>a.key.type!==4||a.key.content!=="modelValue"),s},on:(e,t,i)=>Pd(e,t,i,s=>{let{modifiers:n}=e;if(!n.length)return s;let{key:r,value:a}=s.props[0],{keyModifiers:l,nonKeyModifiers:o,eventOptionModifiers:c}=((d,p,m,y)=>{let f=[],x=[],S=[];for(let C=0;C<p.length;C++){let u=p[C].content;gf(u)?S.push(u):yf(u)?pt(d)?So(d.content.toLowerCase())?f.push(u):x.push(u):(f.push(u),x.push(u)):bf(u)?x.push(u):f.push(u)}return{keyModifiers:f,nonKeyModifiers:x,eventOptionModifiers:S}})(r,n,0,e.loc);if(o.includes("right")&&(r=qo(r,"onContextmenu")),o.includes("middle")&&(r=qo(r,"onMouseup")),o.length&&(a=Be(i.helper(Dd),[a,JSON.stringify(o)])),l.length&&(!pt(r)||So(r.content.toLowerCase()))&&(a=Be(i.helper($d),[a,JSON.stringify(l)])),c.length){let d=c.map(Pi).join("");r=pt(r)?ae(`${r.content}${d}`,!0):At(["(",r,`) + "${d}"`])}return{props:[Le(r,a)]}}),show:(e,t,i)=>{let{exp:s,loc:n}=e;return s||i.onError(be(62,n)),{props:[],needRuntime:i.helper(Ud)}}},Co=Object.create(null);function _f(e,t){if(!se(e))if(e.nodeType)e=e.innerHTML;else return He;let i=e+JSON.stringify(t,(l,o)=>typeof o=="function"?o.toString():o),s=Co[i];if(s)return s;if(e[0]==="#"){let l=document.querySelector(e);e=l?l.innerHTML:""}let n=ce({hoistStatic:!0,onError:void 0,onWarn:He},t);!n.isCustomElement&&"u">typeof customElements&&(n.isCustomElement=l=>!!customElements.get(l));let{code:r}=function(l,o={}){return function(c,d={}){var p;let m,y=d.onError||ya,f=d.mode==="module";d.prefixIdentifiers===!0?y(be(48)):f&&y(be(49)),d.cacheHandlers&&y(be(50)),d.scopeId&&!f&&y(be(51));let x=ce({},d,{prefixIdentifiers:!1}),S=se(c)?function(h,g){if(Re.reset(),Ge=null,ve=null,ht="",zt=-1,xi=-1,qe.length=0,Wt=h,we=ce({},qd),g){let _;for(_ in g)g[_]!=null&&(we[_]=g[_])}Re.mode=we.parseMode==="html"?1:2*(we.parseMode==="sfc"),Re.inXML=we.ns===1||we.ns===2;let w=g&&g.delimiters;w&&(Re.delimiterOpen=Xn(w[0]),Re.delimiterClose=Xn(w[1]));let k=ir=function(_,T=""){return{type:0,source:T,children:_,helpers:new Set,components:[],directives:[],hoists:[],imports:[],cached:[],temps:0,codegenNode:void 0,loc:gt}}([],h);return Re.parse(Wt),k.loc=Ie(0,h.length),k.children=Td(k.children),ir=null,k}(c,x):c,[C,u]=[[mf,hf,af,ff,lf,df,cf,of,uf],{on:Pd,bind:pf,model:Ld}];return m=function(h,{filename:g="",prefixIdentifiers:w=!1,hoistStatic:k=!1,hmr:_=!1,cacheHandlers:T=!1,nodeTransforms:R=[],directiveTransforms:O={},transformHoist:j=null,isBuiltInComponent:q=He,isCustomElement:z=He,expressionPlugins:F=[],scopeId:N=null,slotted:K=!0,ssr:U=!1,inSSR:W=!1,ssrCssVars:H="",bindingMetadata:Z=de,inline:ie=!1,isTS:he=!1,onError:Ae=ya,onWarn:_e=bd,compatConfig:Ve}){let et=g.replace(/\?.*$/,"").match(/([^/\\]+)\.\w+$/),oe={filename:g,selfName:et&&Pi(ye(et[1])),prefixIdentifiers:w,hoistStatic:k,hmr:_,cacheHandlers:T,nodeTransforms:R,directiveTransforms:O,transformHoist:j,isBuiltInComponent:q,isCustomElement:z,expressionPlugins:F,scopeId:N,slotted:K,ssr:U,inSSR:W,ssrCssVars:H,bindingMetadata:Z,inline:ie,isTS:he,onError:Ae,onWarn:_e,compatConfig:Ve,root:h,helpers:new Map,components:new Set,directives:new Set,hoists:[],imports:[],cached:[],constantCache:new WeakMap,vForMemoKeyedNodes:new WeakSet,temps:0,identifiers:Object.create(null),scopes:{vFor:0,vSlot:0,vPre:0,vOnce:0},parent:null,grandParent:null,currentNode:h,childIndex:0,inVOnce:!1,helper(ne){let xe=oe.helpers.get(ne)||0;return oe.helpers.set(ne,xe+1),ne},removeHelper(ne){let xe=oe.helpers.get(ne);if(xe){let Se=xe-1;Se?oe.helpers.set(ne,Se):oe.helpers.delete(ne)}},helperString:ne=>`_${rs[oe.helper(ne)]}`,replaceNode(ne){oe.parent.children[oe.childIndex]=oe.currentNode=ne},removeNode(ne){let xe=oe.parent.children,Se=ne?xe.indexOf(ne):oe.currentNode?oe.childIndex:-1;ne&&ne!==oe.currentNode?oe.childIndex>Se&&(oe.childIndex--,oe.onNodeRemoved()):(oe.currentNode=null,oe.onNodeRemoved()),oe.parent.children.splice(Se,1)},onNodeRemoved:He,addIdentifiers(ne){},removeIdentifiers(ne){},hoist(ne){se(ne)&&(ne=ae(ne)),oe.hoists.push(ne);let xe=ae(`_hoisted_${oe.hoists.length}`,!1,ne.loc,2);return xe.hoisted=ne,xe},cache(ne,xe=!1,Se=!1){let v=function(b,A,D=!1,P=!1){return{type:20,index:b,value:A,needPauseTracking:D,inVOnce:P,needArraySpread:!1,loc:gt}}(oe.cached.length,ne,xe,Se);return oe.cached.push(v),v}};return oe}(S,p=ce({},x,{nodeTransforms:[...C,...d.nodeTransforms||[]],directiveTransforms:ce({},u,d.directiveTransforms||{})})),sr(S,m),p.hoistStatic&&function h(g,w,k,_=!1,T=!1){let{children:R}=g,O=[];for(let F=0;F<R.length;F++){let N=R[F];if(N.type===1&&N.tagType===0){let K=_?0:mt(N,k);if(K>0){if(K>=2){N.codegenNode.patchFlag=-1,O.push(N);continue}}else{let U=N.codegenNode;if(U.type===13){let W=U.patchFlag;if((W===void 0||W===512||W===1)&&Ad(N,k)>=2){let H=Ed(N);H&&(U.props=k.hoist(H))}U.dynamicProps&&(U.dynamicProps=k.hoist(U.dynamicProps))}}}else if(N.type===12&&(_?0:mt(N,k))>=2){N.codegenNode.type===14&&N.codegenNode.arguments.length>0&&N.codegenNode.arguments.push("-1"),O.push(N);continue}if(N.type===1){let K=N.tagType===1;K&&k.scopes.vSlot++,h(N,g,k,!1,T),K&&k.scopes.vSlot--}else if(N.type===11)h(N,g,k,N.children.length===1,!0);else if(N.type===9)for(let K=0;K<N.branches.length;K++)h(N.branches[K],g,k,N.branches[K].children.length===1,T)}let j=!1;if(O.length===R.length&&g.type===1){if(g.tagType===0&&g.codegenNode&&g.codegenNode.type===13&&J(g.codegenNode.children))g.codegenNode.children=q(Ti(g.codegenNode.children)),j=!0;else if(g.tagType===1&&g.codegenNode&&g.codegenNode.type===13&&g.codegenNode.children&&!J(g.codegenNode.children)&&g.codegenNode.children.type===15){let F=z(g.codegenNode,"default");F&&(F.returns=q(Ti(F.returns)),j=!0)}else if(g.tagType===3&&w&&w.type===1&&w.tagType===1&&w.codegenNode&&w.codegenNode.type===13&&w.codegenNode.children&&!J(w.codegenNode.children)&&w.codegenNode.children.type===15){let F=_t(g,"slot",!0),N=F&&F.arg&&z(w.codegenNode,F.arg);N&&(N.returns=q(Ti(N.returns)),j=!0)}}if(!j)for(let F of O)F.codegenNode=k.cache(F.codegenNode);function q(F){let N=k.cache(F);return N.needArraySpread=!0,N}function z(F,N){if(F.children&&!J(F.children)&&F.children.type===15){let K=F.children.properties.find(U=>U.key===N||U.key.content===N);return K&&K.value}}O.length&&k.transformHoist&&k.transformHoist(R,k,g)}(S,void 0,m,!!po(S)),p.ssr||function(h,g){let{helper:w}=g,{children:k}=h;if(k.length===1){let _=po(h);if(_&&_.codegenNode){let T=_.codegenNode;T.type===13&&pl(T,g),h.codegenNode=T}else h.codegenNode=k[0]}else k.length>1&&(h.codegenNode=Us(g,w(Ds),void 0,h.children,64,void 0,void 0,!0,void 0,!1))}(S,m),S.helpers=new Set([...m.helpers.keys()]),S.components=[...m.components],S.directives=[...m.directives],S.imports=m.imports,S.hoists=m.hoists,S.temps=m.temps,S.cached=m.cached,S.transformed=!0,function(h,g={}){let w=function(U,{mode:W="function",prefixIdentifiers:H=W==="module",sourceMap:Z=!1,filename:ie="template.vue.html",scopeId:he=null,optimizeImports:Ae=!1,runtimeGlobalName:_e="Vue",runtimeModuleName:Ve="vue",ssrRuntimeModuleName:et="vue/server-renderer",ssr:oe=!1,isTS:ne=!1,inSSR:xe=!1}){let Se={mode:W,prefixIdentifiers:H,sourceMap:Z,filename:ie,scopeId:he,optimizeImports:Ae,runtimeGlobalName:_e,runtimeModuleName:Ve,ssrRuntimeModuleName:et,ssr:oe,isTS:ne,inSSR:xe,source:U.source,code:"",column:1,line:1,offset:0,indentLevel:0,pure:!1,map:void 0,helper:b=>`_${rs[b]}`,push(b,A=-2,D){Se.code+=b},indent(){v(++Se.indentLevel)},deindent(b=!1){b?--Se.indentLevel:v(--Se.indentLevel)},newline(){v(Se.indentLevel)}};function v(b){Se.push(`
`+"  ".repeat(b),0)}return Se}(h,g);g.onContextCreated&&g.onContextCreated(w);let{mode:k,push:_,prefixIdentifiers:T,indent:R,deindent:O,newline:j,ssr:q}=w,z=Array.from(h.helpers),F=z.length>0,N=!T&&k!=="module";(function(U,W){let{push:H,newline:Z,runtimeGlobalName:ie}=W,he=Array.from(U.helpers);if(he.length>0&&(H(`const _Vue = ${ie}
`,-1),U.hoists.length)){let Ae=[di,pi,Zs,tl,fd].filter(_e=>he.includes(_e)).map(uo).join(", ");H(`const { ${Ae} } = _Vue
`,-1)}(function(Ae,_e){if(!Ae.length)return;_e.pure=!0;let{push:Ve,newline:et}=_e;et();for(let oe=0;oe<Ae.length;oe++){let ne=Ae[oe];ne&&(Ve(`const _hoisted_${oe+1} = `),st(ne,_e),et())}_e.pure=!1})(U.hoists,W),Z(),H("return ")})(h,w);let K=(q?["_ctx","_push","_parent","_attrs"]:["_ctx","_cache"]).join(", ");if(_(`function ${q?"ssrRender":"render"}(${K}) {`),R(),N&&(_("with (_ctx) {"),R(),F&&(_(`const { ${z.map(uo).join(", ")} } = _Vue
`,-1),j())),h.components.length&&(ho(h.components,"component",w),(h.directives.length||h.temps>0)&&j()),h.directives.length&&(ho(h.directives,"directive",w),h.temps>0&&j()),h.temps>0){_("let ");for(let U=0;U<h.temps;U++)_(`${U>0?", ":""}_temp${U}`)}return(h.components.length||h.directives.length||h.temps)&&(_(`
`,0),j()),q||_("return "),h.codegenNode?st(h.codegenNode,w):_("null"),N&&(O(),_("}")),O(),_("}"),{ast:h,code:w.code,preamble:"",map:w.map?w.map.toJSON():void 0}}(S,x)}(l,ce({},vf,o,{nodeTransforms:[xf,...wf,...o.nodeTransforms||[]],directiveTransforms:ce({},kf,o.directiveTransforms||{}),transformHoist:null}))}(e,n),a=Function("Vue",r)($h);return a._rc=!0,Co[i]=a}Fc(_f);var _r=null;function Kd(e){_r=e}async function Sf(e,t){if(!_r||!_r.invoke)throw new Error("\u63D2\u4EF6\u8FD0\u884C\u65F6\u672A\u5C31\u7EEA");return await _r.invoke(e,t||{})}async function at(e,t){let i=await Sf(e,t);return i&&typeof i=="object"&&"data"in i&&i.data!==null&&i.data!==void 0?i.data:i}var Q=ui({ready:!1,err:"",uin:"",sessions:[],sid:"",msgs:[],loading:!1,loadingMore:!1,hasMore:!0,keyword:"",msgKeyword:"",viewer:"",pageSize:50,cap:600,atBottom:!0});async function Qd(){try{let e=await at("qqbot.account.info");Q.uin=String(e&&(e.uin||e.self_id)||"")}catch{}}async function cs(e){Q.err="";try{let t=await at("qqbot.chat.sessions",{limit:200,kw:e||""}),i=t&&t.items||[];Q.sessions=i.filter(s=>s&&s.target_id),!Q.sid&&Q.sessions.length&&(Q.sid=Q.sessions[0].session_id),Q.ready=!0}catch(t){Q.err=String(t&&t.message||t)}}async function ds(e,t){e&&(Q.sid=e,Q.msgKeyword=String(t||""),Q.msgs=[],Q.hasMore=!0,Q.atBottom=!0,await tn(!1))}async function tn(e){if(Q.sid&&!(e&&(Q.loadingMore||!Q.hasMore))){e?Q.loadingMore=!0:Q.loading=!0;try{let t={session_id:Q.sid,limit:Q.pageSize};Q.msgKeyword&&(t.kw=Q.msgKeyword),e&&Q.msgs.length&&(t.before_id=Q.msgs[0].id);let i=await at("qqbot.chat.messages",t),s=i&&i.items||[];e?(Q.msgs=s.concat(Q.msgs),Q.msgs.length>Q.cap&&(Q.msgs=Q.msgs.slice(-Q.cap))):Q.msgs=s,Q.hasMore=s.length>=Q.pageSize}catch(t){Q.err=String(t&&t.message||t)}finally{Q.loading=!1,Q.loadingMore=!1}}}function Wd(){return Q.sessions.find(e=>e.session_id===Q.sid)||null}function Jd(e){if(!e)return!1;if(e.role==="assistant")return!0;let t=String(e.sender_id||"");return!!(Q.uin&&t&&t===Q.uin)}var Gd="rcq.im.read";function Yd(){try{return JSON.parse(localStorage.getItem(Gd)||"{}")||{}}catch{return{}}}function Sr(e){let t=Q.sessions.find(i=>i.session_id===e);return t&&Number(t.last_read_id||0)>0?Number(t.last_read_id):Number(Yd()[e]||0)}function Xd(e,t){if(!e||!t)return;let i=Yd();if(!(Number(i[e]||0)>=Number(t))){i[e]=Number(t);try{localStorage.setItem(Gd,JSON.stringify(i))}catch{}try{let s=at("qqbot.chat.session_ui",{session_id:e,last_read_id:Number(t)});s&&s.catch&&s.catch(()=>{})}catch{}}}var Zd=e=>e<10?"0"+e:""+e;function Cr(e){if(!e)return"";let t=new Date(e*1e3);return Zd(t.getHours())+":"+Zd(t.getMinutes())}function qr(e){let t=new Date(e);return t.setHours(0,0,0,0),t.getTime()}function ep(e){if(!e)return"";let t=new Date(e*1e3),i=qr(Date.now()),s=qr(t),n=Math.round((i-s)/864e5);return n===0?Cr(e):n===1?"\u6628\u5929":t.getFullYear()===new Date().getFullYear()?t.getMonth()+1+"\u6708"+t.getDate()+"\u65E5":t.getFullYear()+"/"+(t.getMonth()+1)+"/"+t.getDate()}function tp(e){if(!e)return"";let t=new Date(e*1e3),i=Math.round((qr(Date.now())-qr(t))/864e5),s=Cr(e);return i===0?s:i===1?"\u6628\u5929 "+s:(t.getFullYear()===new Date().getFullYear()?t.getMonth()+1+"\u6708"+t.getDate()+"\u65E5 ":t.getFullYear()+"\u5E74"+(t.getMonth()+1)+"\u6708"+t.getDate()+"\u65E5 ")+s}function ps(e){if(!e)return"";if(e._url)return e._url;let t=e.abs||(e.rel?"/opt/rcbot/media/"+e.rel:"");return t?"/api/fm/preview?path="+encodeURIComponent(t):""}function us(e){return!e||!e.local?!1:e.exists!==0}function Tr(e){let t=String(e===0?0:e||"").trim();return/^\d+$/.test(t)?"https://qzonestyle.gtimg.cn/qzone/em/e"+t+".gif":""}function Nr(e){return e=Number(e)||0,e>=1073741824?(e/1073741824).toFixed(2)+" GB":e>=1048576?(e/1048576).toFixed(1)+" MB":e>=1024?(e/1024).toFixed(0)+" KB":e+" B"}function ip(e){return e=Number(e)||0,e>=1e8?(e/1e8).toFixed(1)+"\u4EBF":e>=1e4?(e/1e4).toFixed(1)+"\u4E07":String(e)}function sn(e){let t=Array.isArray(e&&e.segs)?e.segs:[],i=[],s="",n=!1;for(let a of t){let l=a&&a.type,o=a&&a.data||{};if(l){if(l==="reply"){s=o.text||"[\u5F15\u7528\u4E86\u4E00\u6761\u6D88\u606F]";continue}switch(l){case"text":o.text&&i.push({t:"text",v:o.text});break;case"at":i.push({t:"at",v:o.qq==="all"?"@\u5168\u4F53\u6210\u5458":"@"+(o.name||o.qq||"\u67D0\u4EBA")});break;case"face":i.push({t:"face",v:o.id});break;case"markdown":i.push({t:"text",v:o.content||"[Markdown \u6D88\u606F]"});break;case"image":case"video":case"record":case"file":case"mface":case"json":case"xml":case"forward":case"node":case"location":case"contact":case"music":case"rps":case"dice":case"shake":case"poke":break;default:i.push({t:"unknown",name:l});break}}}let r=Array.isArray(e&&e.media)?e.media:[];return!i.length&&!r.length&&e&&e.text&&i.push({t:"text",v:e.text}),e&&e.role==="system"&&(n=!0),{quote:s,parts:i,system:n}}function sp(e){let t={image:[],video:[],record:[],file:[],face:[],other:[]};for(let i of e||[]){if(!i||!i.local)continue;let s=i.kind==="mface"?"face":i.kind;(t[s]||t.other).push(i)}return t}function Ar(e){return e<=1?"g1":e===2||e===4?"g2":"g3"}function np(e){let t=Math.max(1,Math.min(60,Number(e)||1));return Math.round(96+t*3.2)}function rp(e){let t=Number(e&&e.bytes||0);return t?Math.max(1,Math.min(60,Math.round(t/3e3))):2}function nn(e){let t=Array.isArray(e&&e.segs)?e.segs:[];for(let i of t)if(i&&i.type==="forward"){let s=(i.data||{}).id;if(s)return String(s)}return""}var hi=null;function qf(e){for(let t of e||[]){let i=t&&t.type,s=t&&t.data||{};if(i==="json")try{let n=JSON.parse(s.data),r=n.meta||{},a=n.prompt||r.detail&&r.detail.title||r.news&&r.news.title||"\u5361\u7247\u6D88\u606F",l=r.detail&&r.detail.desc||r.desc||"",o=r.news&&r.news.jumpUrl||r.detail&&r.detail.qqdocurl||"";return{kind:"card",title:a,desc:l,jump:o}}catch{return{kind:"card",title:"\u5361\u7247\u6D88\u606F",desc:"",jump:""}}if(i==="xml")return{kind:"card",title:"\u5361\u7247\u6D88\u606F",desc:String(s.data||"").slice(0,90),jump:""};if(i==="forward"||i==="node")return{kind:"forward",title:"\u5408\u5E76\u8F6C\u53D1",desc:"\u70B9\u51FB\u67E5\u770B\u5185\u5BB9",jump:""}}return null}var Cf={props:{m:Object,me:Boolean},data(){return{playing:!1}},computed:{sec(){return rp(this.m)},w(){return np(this.sec)},src(){return ps(this.m)},bars(){let e=this.sec,t=Math.max(6,Math.min(22,Math.round(e*1.6))),i=[];for(let s=0;s<t;s++)i.push(6+Math.round(Math.abs(Math.sin(s*1.7+e))*12));return i}},beforeUnmount(){this.stop()},methods:{stop(){if(hi)try{hi.pause()}catch{}this.playing=!1},toggle(){if(this.src){if(this.playing){this.stop();return}if(hi)try{hi.pause()}catch{}hi=new Audio(this.src),hi.onended=()=>{this.playing=!1},hi.onerror=()=>{this.playing=!1},hi.play().then(()=>{this.playing=!0}).catch(()=>{this.playing=!1})}}},template:`
  <div class="im-voice" :style="{ width: w + 'px' }" @click="toggle" :title="playing ? '\u505C\u6B62' : '\u64AD\u653E\u8BED\u97F3'">
    <span class="wave">
      <i v-for="(h,i) in bars" :key="i" :style="{ height: h + 'px', opacity: playing ? .95 : .5 }"></i>
    </span>
    <span class="sec">{{ sec }}"</span>
  </div>`},ap={components:{ImVoice:Cf},props:{m:Object,compact:Boolean,showTime:String},data(){return{viewer:"",badAva:!1}},computed:{me(){return Jd(this.m)},recalled(){return!!this.m.recalled},parsed(){return sn(this.m)},parts(){return this.parsed.parts},quote(){let e=this.m&&this.m.quote;return e&&(e.sender||e.text)?(e.sender?e.sender+"\uFF1A":"")+(e.text||"[\u6D88\u606F]"):this.parsed.quote},media(){return this.m.media||[]},groups(){return sp(this.media)},card(){let e=qf(this.m.segs);return e&&e.kind==="forward"&&this.m._fwdCount&&(e.desc=this.m._fwdCount+" \u6761\u6D88\u606F"),e},forwardId(){return nn(this.m)},hasMedia(){return!!(this.groups.image.length||this.groups.video.length||this.groups.record.length||this.groups.file.length)},mediaOnly(){return!this.quote&&!this.parts.filter(e=>e.t!=="face").length&&this.hasMedia},name(){return this.m.sender_name||this.m.sender_id||"\u672A\u77E5"},avatar(){if(this.m.sender_avatar)return this.m.sender_avatar;let e=String(this.m.sender_id||"");return/^\d{5,12}$/.test(e)?"https://q1.qlogo.cn/g?b=qq&nk="+e+"&s=100":""},time(){return Cr(this.m.created_at)},recalledBy(){let e=String(this.m&&this.m.recalled_by||"");if(!e)return"";let t=Q.msgs.find(i=>String(i.sender_id||"")===e);return t&&t.sender_name||""},recalledTip(){let e=this.recalledBy;return e?"\u7531 "+e+" \u64A4\u56DE":"\u6D88\u606F\u5DF2\u88AB\u64A4\u56DE"},initial(){return String(this.name||"?").trim().slice(0,1)},showAva(){return!!this.avatar&&!this.badAva},canRecall(){return this.me&&!!this.m.msg_id},images(){return this.groups.image.filter(us)},videos(){return this.groups.video.filter(us)},voices(){return this.groups.record.filter(us)},files(){return this.groups.file.filter(us)}},methods:{faceUrl:Tr,mediaUrl:ps,bytes:Nr,gridCls:Ar,mediaAlive:us,openImg(e){this.viewer=ps(e)},faceErr(e){let t=e&&e.target;t&&(t.style.visibility="hidden")}},template:`
  <div>
    <div class="im-time" v-if="showTime">{{ showTime }}</div>
    <div class="im-msg" :class="{ me: me, compact: compact, recalled: recalled }" :data-mid="m.id"
      :data-msgid="m.msg_id || ''"
      @contextmenu.prevent="$emit('ctx', $event, m)">
      <div class="ava" :class="{ ph: compact }">
        <img v-if="showAva && !compact" :src="avatar" alt="" @error="badAva = true" />
        <div v-else-if="!compact" class="ava-t">{{ initial }}</div>
      </div>
      <div class="col">
        <div class="who" v-if="!compact && !me">{{ name }}</div>

        <!-- \u2605 \u64A4\u56DE\u7684\u6D88\u606F\u7167\u5E38\u663E\u793A\u5185\u5BB9\uFF08\u8FD9\u662F"\u5168\u91CF\u6863\u6848"\uFF0C\u539F\u6587\u6C38\u4E45\u4FDD\u7559\uFF09\uFF0C
             \u53EA\u5728\u4E0B\u9762\u6253\u4E00\u4E2A\u300C\u5DF2\u64A4\u56DE\u300D\u6807\u8BB0 \u2014\u2014 \u548C\u300C\u804A\u5929\u8BB0\u5F55\u300D\u9875\u7684\u884C\u4E3A\u4FDD\u6301\u4E00\u81F4\u3002 -->
        <div class="im-bub" :class="{ media: mediaOnly }">
          <div class="im-quote" v-if="quote" :title="quote"
            @click.stop="$emit('jump', m.quote && m.quote.msg_id)">{{ quote }}</div>

          <div v-if="card" class="im-card" :class="{ fwd: card.kind === 'forward' }"
            @click.stop="card.kind === 'forward' && forwardId && $emit('forward', forwardId)">
            <div class="ct">{{ card.title }}</div>
            <div class="cd" v-if="card.desc">{{ card.desc }}</div>
          </div>

          <span v-for="(p,i) in parts" :key="i">
            <span v-if="p.t === 'text'">{{ p.v }}</span>
            <span v-else-if="p.t === 'at'" class="at">{{ p.v }}</span>
            <img v-else-if="p.t === 'face'" class="face" :src="faceUrl(p.v)" alt="[\u8868\u60C5]" @error="faceErr" />
            <span v-else class="im-unk">[{{ p.name }}]</span>
          </span>
        </div>

        <!-- \u5A92\u4F53\u533A\uFF08\u653E\u5728\u6C14\u6CE1\u5916\uFF0C\u907F\u514D\u5706\u89D2\u4E0E\u5185\u8FB9\u8DDD\u6253\u67B6\uFF09 -->
        <div class="im-grid" :class="gridCls(images.length)" v-if="images.length">
          <img v-for="(m,i) in images" :key="i" :src="mediaUrl(m)" loading="lazy"
            @click="openImg(m)" alt="\u56FE\u7247" />
        </div>
        <div class="im-video" v-for="(m,i) in videos" :key="'v'+i">
          <video :src="mediaUrl(m)" controls preload="metadata" playsinline></video>
        </div>
        <div class="im-bub" v-for="(m,i) in voices" :key="'r'+i" style="padding:6px 10px">
          <im-voice :m="m" :me="me" />
        </div>
        <div class="im-bub" v-for="(m,i) in files" :key="'f'+i" style="padding:8px 12px">
          <div class="im-file">
            <div class="fi">{{ (m.name || 'FILE').split('.').pop().slice(0,4).toUpperCase() }}</div>
            <div style="min-width:0">
              <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ m.name || '\u6587\u4EF6' }}</div>
              <div style="font-size:11px;color:var(--im-t3)">{{ bytes(m.bytes) }}</div>
            </div>
            <a :href="mediaUrl(m)" :download="m.name || true" style="margin-left:8px;font-size:12px">\u4E0B\u8F7D</a>
          </div>
        </div>

        <div class="im-ops">
          <button class="im-op" title="\u590D\u5236\u6587\u5B57" @click.stop="$emit('copy', m)">\u590D\u5236</button>
          <button class="im-op" v-if="canRecall" title="\u64A4\u56DE" @click.stop="$emit('recall', m)">\u64A4\u56DE</button>
        </div>

        <div class="im-meta" v-if="!compact">
          <span>{{ time }}</span>
          <span class="im-rec-tag" v-if="recalled" :title="recalledTip">\u5DF2\u64A4\u56DE</span>
        </div>
      </div>
    </div>

    <div class="im-viewer" v-if="viewer" @click.self="viewer = ''">
      <button class="x" @click="viewer = ''">\xD7</button>
      <img :src="viewer" alt="" />
    </div>
  </div>`};var Tf=[{id:"im",title:"\u6D88\u606F",d:"M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-4 4V16H6.5A2.5 2.5 0 014 13.5v-8z"},{id:"contacts",title:"\u8054\u7CFB\u4EBA",d:"M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8a8 8 0 0116 0v1H4v-1z"},{id:"star",title:"\u6536\u85CF",d:"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"}],lp={components:{ImMessageRow:ap},props:{},data(){return{S:Q,rail:"im",railItems:Tf,showJump:!1,dragging:!1,sideWidth:268,badAva:{},menu:null,readAt:0,toastMsg:"",fwd:null,fwdStack:[],sessMenu:null,searchOpen:!1,msgKw:"",rnd:null,rpCfg:{enabled:!0,scope:"enabled_groups"},busy:""}},computed:{cur(){return Wd()},filtered(){let e=(Q.keyword||"").trim().toLowerCase();return e?Q.sessions.filter(t=>(t.display||"").toLowerCase().includes(e)||String(t.target_id||"").includes(e)):Q.sessions},rows(){let e=[],t=0,i="",s=!1;for(let n of Q.msgs){if(!n)continue;let r=String(n.text||""),a=n.role==="system"||!(n.segs||[]).length&&r.indexOf("\u64A4\u56DE")>=0,l=n.created_at-t,o=!t||l>300?tp(n.created_at):"";if(a){let m=(r||"\u6709\u4EBA\u64A4\u56DE\u4E86\u4E00\u6761\u6D88\u606F").replace(/^\[/,"").replace(/\]$/,"");e.push({type:"sys",key:"s"+n.id,text:m}),t=n.created_at,i="";continue}let c=String(n.sender_id||n.role||""),d=!o&&c===i&&l<300,p={type:"msg",key:n.id,m:n,compact:d,showTime:o};!s&&this.readAt&&Number(n.id)>this.readAt&&(p.divider=!0,s=!0),e.push(p),t=n.created_at,i=c}return e},total(){return this.cur&&this.cur.msg_count||Q.msgs.length}},async mounted(){await Qd(),await cs();try{let t=((await at("rcbot.config.get")||{}).features||{}).random_pick||{};this.rpCfg={enabled:t.enabled!==!1,scope:t.scope||"enabled_groups"}}catch{}Q.sid&&(await ds(Q.sid),this.readAt=Sr(Q.sid),this.scheduleRead()),this.$nextTick(()=>this.toBottom(!1)),window.addEventListener("keydown",this.onKey),window.addEventListener("click",this.closeMenu),document.documentElement.style.overflow="hidden"},beforeUnmount(){window.removeEventListener("keydown",this.onKey),window.removeEventListener("click",this.closeMenu),document.documentElement.style.overflow=""},methods:{fmtListTime:ep,fmtNum:ip,partsOf:sn,gridCls:Ar,mediaUrl:ps,faceUrl:Tr,bytes:Nr,forwardIdOf:nn,onKey(e){e.key==="Escape"&&(e.stopPropagation(),this.close())},close(){this.$emit("close")},closeMenu(){this.menu=null,this.sessMenu=null},onKwInput(){clearTimeout(this._kwTimer),this._kwTimer=setTimeout(()=>{cs(Q.keyword)},350)},toggleSearch(){this.searchOpen=!this.searchOpen,!this.searchOpen&&this.msgKw&&this.onSearch(""),this.$nextTick(()=>{let e=this.$refs.msgSearch;e&&this.searchOpen&&e.focus()})},onSearch(e){let t=String(e||"").trim();this.msgKw=t,t!==Q.msgKeyword&&ds(Q.sid,t).then(()=>{this.$nextTick(()=>this.toBottom(!1)),this.schedulePendingRefresh()})},openRandom(){if(!this.rpCfg.enabled){this.toast("\u968F\u673A\u6311\u6D88\u606F\u56DE\u5DF2\u5173\u95ED\uFF08\u8BBE\u7F6E \u2192 \u80FD\u529B\uFF09");return}this.rnd={loading:!1,scope:this.rpCfg.scope,picked:null,reply:"",provider:"",error:""},this.pickRandom()},closeRandom(){this.rnd=null},async pickRandom(){if(this.rnd){this.rnd.loading=!0,this.rnd.error="";try{let e=await at("qqbot.chat.random_reply",{sid:Q.sid||"",scope:this.rnd.scope});this.rnd.picked=e&&e.picked||null,this.rnd.reply=e&&e.reply||"",this.rnd.provider=e&&e.provider||"",this.rnd.token=e&&e.token||"",this.rnd.sent=""}catch(e){this.rnd.error=String(e&&e.message||e),this.rnd.picked=null,this.rnd.reply="",this.rnd.token="",this.rnd.sent=""}finally{this.rnd.loading=!1}}},async sendRandom(){if(!this.rnd||!this.rnd.token)return;let e=this.rnd.picked||{},t=e.title||e.target_id||"";if(confirm("\u628A\u8FD9\u6761\u56DE\u590D\u53D1\u5230\u300C"+t+`\u300D\uFF1F

\u4F1A @ \u4E00\u4E0B\u539F\u8BF4\u8BDD\u4EBA\u3002`)){this.rnd.sending=!0,this.rnd.sent="";try{let i=await at("qqbot.chat.random_reply.send",{token:this.rnd.token});this.rnd.token="",this.rnd.sent="\u5DF2\u53D1\u5230\u300C"+t+"\u300D",this.toast("\u5DF2\u53D1\u9001\u5230 QQ"),tn(!1)}catch(i){this.rnd.sent="\u53D1\u9001\u5931\u8D25\uFF1A"+String(i&&i.message||i)}finally{this.rnd.sending=!1}}},switchScope(){this.rnd&&(this.rnd.scope=this.rnd.scope==="session"?this.rpCfg.scope:"session",this.pickRandom())},scopeLabel(e){return e==="session"?"\u5F53\u524D\u4F1A\u8BDD":e==="all_groups"?"\u6240\u6709\u7FA4\u804A":"\u5DF2\u542F\u7528\u7684\u7FA4\u804A"},async exportSession(e){let t=e&&e.session_id||Q.sid;if(this.sessMenu=null,!!t){this.busy="exp";try{let i=await at("qqbot.chat.export",{session_id:t}),s=new Blob([JSON.stringify(i,null,2)],{type:"application/json"}),n=document.createElement("a");n.href=URL.createObjectURL(s),n.download="chat-"+String(t).replace(/[^\w-]/g,"_")+"-"+Date.now()+".json",n.click(),setTimeout(()=>URL.revokeObjectURL(n.href),3e3),this.toast("\u5DF2\u5BFC\u51FA\u4F1A\u8BDD\u8BB0\u5F55")}catch(i){this.toast(String(i&&i.message||i))}finally{this.busy=""}}},async clearSession(e){let t=e&&e.session_id||Q.sid,i=e?e.display||e.target_id:"\u8FD9\u4E2A\u4F1A\u8BDD";if(this.sessMenu=null,!t||!confirm("\u6E05\u7A7A\u4F1A\u8BDD\u300C"+i+`\u300D\u7684\u5168\u90E8\u804A\u5929\u8BB0\u5F55\uFF1F

\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`))return;let s=confirm(`\u8981\u8FDE\u56FE\u7247/\u89C6\u9891/\u8BED\u97F3\u8FD9\u4E9B\u5A92\u4F53\u6587\u4EF6\u4E00\u8D77\u5220\u6389\u5417\uFF1F

\u786E\u5B9A = \u4E00\u8D77\u5220
\u53D6\u6D88 = \u53EA\u5220\u6587\u5B57\u8BB0\u5F55\uFF08\u5A92\u4F53\u4FDD\u7559\uFF09`);this.busy="clear";try{let n=await at("qqbot.chat.clear_session",{session_id:t,with_media:s,confirm:!0});this.toast("\u5DF2\u6E05\u7A7A "+(n&&n.messages||0)+" \u6761\u6D88\u606F"),await cs(),await ds(Q.sid,Q.msgKeyword)}catch(n){this.toast(String(n&&n.message||n))}finally{this.busy=""}},hasPending(){for(let e of Q.msgs)for(let t of e.media||[])if(t&&t.transcode==="pending")return!0;return!1},schedulePendingRefresh(){clearTimeout(this._pendTimer),this.hasPending()&&(this._pendTimer=setTimeout(async()=>{this._pendTimer=null,await tn(!1),this.schedulePendingRefresh()},6e3))},openSessMenu(e,t){this.sessMenu={x:e.clientX,y:e.clientY,s:t}},async togglePin(e){if(this.sessMenu=null,!!e)try{let t=await at("qqbot.chat.session_ui",{session_id:e.session_id,pinned:!e.pinned});e.pinned=t&&typeof t.pinned<"u"?t.pinned:e.pinned?0:1,this.toast(e.pinned?"\u5DF2\u7F6E\u9876":"\u5DF2\u53D6\u6D88\u7F6E\u9876"),await cs()}catch(t){this.toast(String(t&&t.message||t))}},async toggleMute(e){if(this.sessMenu=null,!!e)try{let t=await at("qqbot.chat.session_ui",{session_id:e.session_id,muted:!e.muted});e.muted=t&&typeof t.muted<"u"?t.muted:e.muted?0:1,this.toast(e.muted?"\u5DF2\u514D\u6253\u6270":"\u5DF2\u53D6\u6D88\u514D\u6253\u6270")}catch(t){this.toast(String(t&&t.message||t))}},markReadNow(e){if(this.sessMenu=null,!e)return;let t=Sr(e.session_id);t&&at("qqbot.chat.session_ui",{session_id:e.session_id,last_read_id:t}).catch(()=>{}),e.unread=0},async openForward(e){if(e){this.fwd&&this.fwdStack.push(this.fwd),this.fwd={id:e,loading:!0,nodes:[],total:0,error:""};try{let t=await at("qqbot.chat.forward",{id:e}),i=t&&t.total||0;this.fwd={id:e,loading:!1,nodes:t&&t.nodes||[],total:i,error:""};for(let s of Q.msgs)if(nn(s)===e){s._fwdCount=i;break}}catch(t){this.fwd={id:e,loading:!1,nodes:[],total:0,error:String(t&&t.message||t)}}}},backForward(){this.fwd=this.fwdStack.pop()||null},closeForward(){this.fwd=null,this.fwdStack=[]},fwdParts(e){return sn({segs:e&&e.segs||[]}).parts},fwdImgs(e){return(e&&e.media||[]).filter(t=>t.kind==="image"&&t.local)},fwdOther(e){return(e&&e.media||[]).filter(t=>t.kind!=="image"&&t.local)},openCtx(e,t){this.menu={x:e.clientX,y:e.clientY,m:t}},canRecall(e){return!!(e&&e.msg_id&&e.role==="assistant"&&!e.recalled)},copyMsg(e){let t=String(e&&(e.text||(e.segs||[]).map(i=>(i.data||{}).text||"").join(""))||"");try{navigator.clipboard.writeText(t),this.toast("\u5DF2\u590D\u5236")}catch{this.toast("\u590D\u5236\u5931\u8D25\uFF08\u6D4F\u89C8\u5668\u4E0D\u5141\u8BB8\uFF09")}this.menu=null},async doRecall(e){if(this.menu=null,!(!e||!e.msg_id))try{await at("qqbot.chat.recall",{msg_id:e.msg_id}),e.recalled=1,this.toast("\u5DF2\u64A4\u56DE")}catch(t){this.toast(String(t&&t.message||t))}},jump(e){let t=String(e||"");if(!t)return;let i=t.replace(/"/g,'\\"'),s=document.querySelector('.rcq-im [data-msgid="'+i+'"]')||document.querySelector('.rcq-im [data-mid="'+i+'"]');if(!s){this.toast("\u88AB\u5F15\u7528\u7684\u6D88\u606F\u4E0D\u5728\u5F53\u524D\u9875");return}s.scrollIntoView({block:"center",behavior:"smooth"}),s.classList.add("im-flash"),setTimeout(()=>s.classList.remove("im-flash"),1200)},toast(e){this.toastMsg=String(e||""),clearTimeout(this._tt),this._tt=setTimeout(()=>{this.toastMsg=""},1800)},scheduleRead(){clearTimeout(this._rt),this._rt=setTimeout(()=>{Q.msgs.length&&Xd(Q.sid,Q.msgs[Q.msgs.length-1].id)},1200)},avatarOf(e){return e&&e.avatar?e.avatar:""},initialOf(e){return String(e&&(e.display||e.target_id)||"?").trim().slice(0,1)},pick(e){!e||e.session_id===Q.sid||(e.unread=0,ds(e.session_id).then(()=>{this.readAt=Sr(e.session_id),this.$nextTick(()=>this.toBottom(!1)),this.scheduleRead(),this.schedulePendingRefresh()}))},toBottom(e=!0){let t=this.$refs.flow;t&&(t.scrollTo({top:t.scrollHeight,behavior:e?"smooth":"auto"}),Q.atBottom=!0,this.showJump=!1)},async onScroll(){let e=this.$refs.flow;if(!e)return;let t=e.scrollHeight-e.scrollTop-e.clientHeight<40;if(Q.atBottom=t,this.showJump=!t,e.scrollTop<160&&Q.hasMore&&!Q.loadingMore){let i=e.scrollHeight,s=e.scrollTop;await tn(!0),this.$nextTick(()=>{let n=this.$refs.flow;n&&(n.scrollTop=n.scrollHeight-i+s)})}},async reload(){await cs(),Q.sid&&(await ds(Q.sid),this.$nextTick(()=>this.toBottom(!1)))}},template:`
  <div class="rcq-im">
    <!-- rail -->
    <div class="im-rail">
      <div class="ava"><img v-if="S.uin" :src="'https://q1.qlogo.cn/g?b=qq&nk=' + S.uin + '&s=100'" alt="" /></div>
      <button v-for="it in railItems" :key="it.id" class="im-nav" :class="{ on: rail === it.id }"
        :title="it.title" @click="rail = it.id">
        <svg viewBox="0 0 24 24"><path :d="it.d" /></svg>
      </button>
      <button class="im-nav" title="\u8FD4\u56DE\u9762\u677F" @click="close">
        <svg viewBox="0 0 24 24"><path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5v-2H6V6h4V4zm4 0v2h4v12h-4v2h5a1 1 0 001-1V5a1 1 0 00-1-1h-5zM11 11h4l-2-2 1.4-1.4L19 12l-4.6 4.4L13 15l2-2h-4v-2z"/></svg>
      </button>
      <div class="sp"></div>
      <button class="im-nav" title="\u8BBE\u7F6E" @click="close">
        <svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4c0-.6-.1-1.2-.2-1.8l2-1.5-2-3.4-2.3 1a8 8 0 00-3-1.7L15 2H9l-.5 2.6a8 8 0 00-3 1.7l-2.3-1-2 3.4 2 1.5a9 9 0 000 3.6l-2 1.5 2 3.4 2.3-1a8 8 0 003 1.7L9 22h6l.5-2.6a8 8 0 003-1.7l2.3 1 2-3.4-2-1.5c.1-.6.2-1.2.2-1.8z"/></svg>
      </button>
    </div>

    <!-- \u4F1A\u8BDD\u5217\u8868 -->
    <div class="im-side" :style="{ width: sideWidth + 'px' }">
      <div class="im-side-h">
        <div class="im-search">
          <svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 014.5 10.1l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input v-model="S.keyword" placeholder="\u641C\u7D22\u4F1A\u8BDD/\u6D88\u606F\u5185\u5BB9" @input="onKwInput" />
        </div>
        <button class="im-ico" title="\u5237\u65B0\u4F1A\u8BDD" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
      </div>
      <div class="im-list">
        <div class="im-row" v-for="s in filtered" :key="s.session_id"
          :class="{ on: s.session_id === S.sid, muted: s.muted }" @click="pick(s)"
          @contextmenu.prevent="openSessMenu($event, s)">
          <div class="ava">
            <img v-if="avatarOf(s) && !badAva[s.session_id]" :src="avatarOf(s)" alt=""
              @error="badAva[s.session_id] = true" />
            <div v-else class="ava-t">{{ initialOf(s) }}</div>
            <span class="pin" v-if="s.pinned" title="\u5DF2\u7F6E\u9876">
              <svg viewBox="0 0 24 24"><path d="M16 9V4h1a1 1 0 000-2H7a1 1 0 000 2h1v5c0 1.66-1.34 3-3 3v2h5v7l1 1 1-1v-7h5v-2c-1.66 0-3-1.34-3-3z"/></svg>
            </span>
          </div>
          <div class="main">
            <div class="top">
              <div class="nm">{{ s.display || s.target_id }}</div>
              <div class="tm">{{ fmtListTime(s.last_at) }}</div>
            </div>
            <div class="pv">
              <template v-if="s.preview">
                <span v-if="s.preview_who" class="pv-who">{{ s.preview_who }}\uFF1A</span>{{ s.preview }}
              </template>
              <template v-else>{{ s.msg_count || 0 }} \u6761\u6D88\u606F</template>
            </div>
          </div>
          <span class="badge" v-if="s.unread && !s.muted">{{ s.unread > 99 ? '99+' : s.unread }}</span>
          <span class="dot" v-else-if="s.unread && s.muted"></span>
        </div>
        <div class="im-empty" v-if="!filtered.length">
          {{ S.keyword ? '\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD' : '\u8FD8\u6CA1\u6709\u804A\u5929\u8BB0\u5F55' }}
        </div>
      </div>
    </div>

    <!-- \u804A\u5929\u533A -->
    <div class="im-chat">
      <div class="im-head">
        <div class="tt">{{ (cur && (cur.display || cur.target_id)) || '\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD' }}</div>
        <div class="sub" v-if="cur">{{ fmtNum(total) }} \u6761</div>
        <div class="sp"></div>
        <div class="im-hsearch" v-if="searchOpen">
          <svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 014.5 10.1l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input ref="msgSearch" :value="msgKw" placeholder="\u641C\u7D22\u672C\u4F1A\u8BDD\u7684\u6D88\u606F"
            @input="onSearch($event.target.value)" />
          <button v-if="msgKw" class="im-hclear" title="\u6E05\u9664" @click="onSearch('')">\xD7</button>
        </div>
        <button class="im-ico" :title="rpCfg.enabled ? '\u968F\u673A\u6311\u4E00\u6761\u7FA4\u91CC\u7684\u6D88\u606F\uFF0C\u8BA9\u673A\u5668\u4EBA\u56DE\u5B83' : '\u968F\u673A\u6311\u6D88\u606F\u56DE\u5DF2\u5173\u95ED\uFF08\u8BBE\u7F6E \u2192 \u80FD\u529B\uFF09'"
          @click="openRandom">
          <svg viewBox="0 0 24 24"><path d="M12 2l2.2 5.6L20 9l-4.6 3.4L16.6 18 12 14.9 7.4 18l1.2-5.6L4 9l5.8-1.4L12 2z"/></svg>
        </button>
        <button class="im-ico" title="\u641C\u7D22\u672C\u4F1A\u8BDD\u6D88\u606F" @click="toggleSearch">
          <svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 014.5 10.1l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z"/></svg>
        </button>
        <button class="im-ico" title="\u5237\u65B0" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
        <button class="im-ico" title="\u5173\u95ED\uFF08Esc\uFF09" @click="close">
          <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
        </button>
      </div>

      <div class="im-flow" ref="flow" @scroll="onScroll">
        <div class="im-srch" v-if="S.msgKeyword">
          \u641C\u7D22\u300C{{ S.msgKeyword }}\u300D\u627E\u5230 {{ S.msgs.length }} \u6761
          <button class="im-hclear" @click="onSearch(''); msgKw = ''">\u6E05\u9664</button>
        </div>
        <div class="im-more" v-if="S.loadingMore">\u52A0\u8F7D\u66F4\u65E9\u7684\u6D88\u606F\u2026</div>
        <div class="im-more" v-else-if="!S.hasMore && S.msgs.length >= 50">\u5DF2\u7ECF\u5230\u6700\u65E9\u4E86</div>
        <div class="im-empty" v-if="!S.msgs.length && !S.loading">
          {{ cur ? '\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u6D88\u606F' : '\u5DE6\u8FB9\u9009\u4E00\u4E2A\u4F1A\u8BDD' }}
        </div>
        <template v-for="r in rows" :key="r.key">
          <div class="im-sys" v-if="r.type === 'sys'"><span>{{ r.text }}</span></div>
          <template v-else>
            <div class="im-divider" v-if="r.divider">\u4EE5\u4E0B\u4E3A\u65B0\u6D88\u606F</div>
            <im-message-row :m="r.m" :compact="r.compact" :show-time="r.showTime"
              @ctx="openCtx" @copy="copyMsg" @recall="doRecall" @jump="jump"
              @forward="openForward" />
          </template>
        </template>
      </div>

      <button class="im-jump" v-if="showJump" title="\u56DE\u5230\u6700\u65B0" @click="toBottom(true)">
        <svg viewBox="0 0 24 24"><path d="M12 16l-6-6 1.4-1.4L12 13.2l4.6-4.6L18 10l-6 6z"/></svg>
      </button>

      <!-- \u5408\u5E76\u8F6C\u53D1\u5C55\u5F00\u62BD\u5C49 -->
      <div class="im-fwd" v-if="fwd">
        <div class="fh">
          <button class="im-ico" v-if="fwdStack.length" title="\u8FD4\u56DE\u4E0A\u4E00\u5C42" @click="backForward">
            <svg viewBox="0 0 24 24"><path d="M15.4 7.4L14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>
          </button>
          <div class="ft">
            \u5408\u5E76\u8F6C\u53D1<template v-if="fwd.total"> \xB7 {{ fwd.total }} \u6761</template>
          </div>
          <button class="im-ico" title="\u5173\u95ED" @click="closeForward">
            <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
          </button>
        </div>
        <div class="fb">
          <div class="im-more" v-if="fwd.loading">\u6B63\u5728\u5C55\u5F00\u2026</div>
          <div class="im-empty" v-else-if="fwd.error">{{ fwd.error }}</div>
          <div class="im-empty" v-else-if="!fwd.nodes.length">\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5185\u5BB9</div>
          <div class="fn" v-for="(n,i) in fwd.nodes" :key="i">
            <div class="fn-h">
              <img class="fava" v-if="n.sender_id"
                :src="'https://q1.qlogo.cn/g?b=qq&nk=' + n.sender_id + '&s=100'" alt="" />
              <span class="fnm">{{ n.sender_name }}</span>
              <span class="ftm">{{ fmtListTime(n.time) }}</span>
            </div>
            <div class="fn-b">
              <span v-for="(p,pi) in fwdParts(n)" :key="pi">
                <span v-if="p.t === 'text'">{{ p.v }}</span>
                <span v-else-if="p.t === 'at'" class="at">{{ p.v }}</span>
                <img v-else-if="p.t === 'face'" class="face" :src="faceUrl(p.v)" alt="[\u8868\u60C5]" />
              </span>
              <div class="im-grid" :class="gridCls(fwdImgs(n).length)" v-if="fwdImgs(n).length">
                <img v-for="(m,mi) in fwdImgs(n)" :key="mi" :src="mediaUrl(m)" loading="lazy" alt="\u56FE\u7247" />
              </div>
              <div class="fn-f" v-for="(m,mi) in fwdOther(n)" :key="'f'+mi">
                {{ m.name || m.kind }} \xB7 {{ bytes(m.bytes) }}
              </div>
              <button class="fn-nested" v-if="n.nested" @click="openForward(n.nested)">
                \uFF08\u8FD9\u6761\u91CC\u8FD8\u5D4C\u5957\u4E86\u4E00\u4E2A\u5408\u5E76\u8F6C\u53D1\uFF0C\u70B9\u51FB\u5C55\u5F00\uFF09
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- \u968F\u673A\u6311\u4E00\u6761\u56DE\u590D -->
      <div class="im-rnd" v-if="rnd">
        <div class="fh">
          <div class="ft">\u968F\u673A\u6311\u4E00\u6761\u56DE\u590D</div>
          <button class="scope" title="\u5207\u6362\u6311\u9009\u8303\u56F4" @click="switchScope">
            {{ scopeLabel(rnd.scope) }}
          </button>
          <button class="im-ico" title="\u5173\u95ED" @click="closeRandom">
            <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
          </button>
        </div>
        <div class="fb">
          <div class="im-more" v-if="rnd.loading">\u6B63\u5728\u6311\u2026</div>
          <div class="im-empty" v-else-if="rnd.error">{{ rnd.error }}</div>
          <template v-else-if="rnd.picked">
            <div class="rnd-hint">\u4ECE\u5DF2\u542F\u7528\u7684\u7FA4\u804A\u91CC\u968F\u673A\u7FFB\u4E86\u4E00\u6761\u51FA\u6765\uFF0C\u8BA9\u673A\u5668\u4EBA\u5BF9\u5B83\u8BF4\u70B9\u4EC0\u4E48\u3002\u6EE1\u610F\u5C31\u70B9\u300C\u53D1\u9001\u5230 QQ\u300D\u3002</div>
            <div class="rnd-pick">
              <div class="rnd-pick-h">
                <span class="rnd-who">{{ rnd.picked.sender_name || rnd.picked.sender_id }}</span>
                <span class="rnd-where">{{ rnd.picked.title || rnd.picked.target_id }}</span>
                <span class="rnd-time">{{ fmtListTime(rnd.picked.created_at) }}</span>
              </div>
              <div class="rnd-text">{{ rnd.picked.text }}</div>
            </div>
            <div class="rnd-arrow">\u2193 \u673A\u5668\u4EBA\u8FD9\u6837\u56DE</div>
            <div class="rnd-reply">{{ rnd.reply }}</div>
            <div class="rnd-foot" v-if="rnd.provider">\u7528 {{ rnd.provider }} \u751F\u6210</div>
            <div class="rnd-sent" v-if="rnd.sent"
              :class="rnd.sent.indexOf('\u5931\u8D25') >= 0 ? 'bad' : 'ok'">{{ rnd.sent }}</div>
          </template>
          <div class="im-empty" v-else>\u6CA1\u6709\u53EF\u6311\u7684\u6D88\u606F</div>
        </div>
        <div class="rf">
          <button class="primary" :disabled="rnd.loading || rnd.sending || !rnd.token"
            @click="sendRandom">{{ rnd.sending ? '\u53D1\u9001\u4E2D\u2026' : '\u53D1\u9001\u5230 QQ' }}</button>
          <button :disabled="rnd.loading" @click="pickRandom">\u6362\u4E00\u4E2A</button>
          <button @click="closeRandom">\u5173\u95ED</button>
        </div>
      </div>

      <!-- \u53EA\u8BFB\u680F\uFF1A\u672C\u9875\u4E0D\u63D0\u4F9B\u901A\u7528\u53D1\u9001\u5165\u53E3\uFF08\u968F\u673A\u6311\u56DE\u590D\u53EF\u5355\u72EC\u53D1\u5230 QQ\uFF09 -->
      <div class="im-readonly">
        <svg viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg>
        <span>\u53EA\u8BFB\u6A21\u5F0F \xB7 \u672C\u9875\u4EC5\u7528\u4E8E\u6D4F\u89C8\u6D88\u606F\uFF1B\u{1F3B2} \u968F\u673A\u6311\u7684\u56DE\u590D\u53EF\u624B\u52A8\u53D1\u5230 QQ</span>
      </div>
    </div>

    <div class="im-menu" v-if="menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop>
      <button @click="copyMsg(menu.m)">\u590D\u5236\u6587\u5B57</button>
      <button v-if="canRecall(menu.m)" @click="doRecall(menu.m)">\u64A4\u56DE</button>
    </div>

    <div class="im-menu" v-if="sessMenu" :style="{ left: sessMenu.x + 'px', top: sessMenu.y + 'px' }"
      @click.stop>
      <button @click="togglePin(sessMenu.s)">{{ sessMenu.s.pinned ? '\u53D6\u6D88\u7F6E\u9876' : '\u7F6E\u9876\u8BE5\u4F1A\u8BDD' }}</button>
      <button @click="toggleMute(sessMenu.s)">{{ sessMenu.s.muted ? '\u53D6\u6D88\u514D\u6253\u6270' : '\u6D88\u606F\u514D\u6253\u6270' }}</button>
      <button @click="markReadNow(sessMenu.s)">\u6807\u8BB0\u4E3A\u5DF2\u8BFB</button>
      <button @click="exportSession(sessMenu.s)">\u5BFC\u51FA\u4F1A\u8BDD JSON</button>
      <button @click="clearSession(sessMenu.s)">\u6E05\u7A7A\u4F1A\u8BDD\u2026</button>
    </div>

    <div class="im-toast" v-if="toastMsg">{{ toastMsg }}</div>
  </div>`};var op="rcq-im-style",Nf=`
.rcq-im{
  --im-bg:var(--bg,#f5f6f7);
  --im-rail:var(--surface-2,#eceef0);
  --im-list:var(--surface,#fff);
  --im-chat:var(--bg,#f5f6f7);
  --im-input:var(--surface,#fff);
  --im-line:var(--border,#e3e5e8);
  --im-t1:var(--text,#1a1a1a);
  --im-t2:var(--text-muted,#6b7280);
  --im-t3:var(--text-faint,#9aa1a9);
  --im-hover:var(--surface-2,#f0f1f3);
  --im-active:var(--surface-3,#e7e9ec);
  --im-self:var(--ac,#0099ff);
  --im-self-t:#fff;
  --im-other:var(--surface,#fff);
  --im-r:12px;
  --im-shadow:0 6px 24px rgba(0,0,0,.14);
  position:fixed;inset:0;z-index:900;display:flex;
  background:var(--im-chat);color:var(--im-t1);
  font-family:system-ui,-apple-system,"Microsoft YaHei UI","PingFang SC","Segoe UI",sans-serif;
  font-size:14px;line-height:1.5;overflow:hidden;
}
.rcq-im *{box-sizing:border-box}
.rcq-im ::-webkit-scrollbar{width:8px;height:8px}
.rcq-im ::-webkit-scrollbar-thumb{background:var(--im-active);border-radius:4px}
.rcq-im ::-webkit-scrollbar-track{background:transparent}

/* ---------------- \u5DE6\u4FA7 rail ---------------- */
.im-rail{width:56px;flex:none;background:var(--im-rail);display:flex;flex-direction:column;
  align-items:center;padding:14px 0 10px;gap:6px;border-right:1px solid var(--im-line)}
.im-rail .ava{width:36px;height:36px;border-radius:8px;overflow:hidden;background:var(--im-active);
  margin-bottom:8px;flex:none}
.im-rail .ava img{width:100%;height:100%;object-fit:cover;display:block}
.im-nav{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  color:var(--im-t2);cursor:pointer;position:relative;border:none;background:none;padding:0}
.im-nav:hover{background:var(--im-hover);color:var(--im-t1)}
.im-nav.on{background:var(--im-active);color:var(--im-self)}
.im-nav.on::before{content:"";position:absolute;left:-8px;top:9px;bottom:9px;width:3px;
  border-radius:0 3px 3px 0;background:var(--im-self)}
.im-nav svg{width:22px;height:22px;fill:currentColor}
.im-rail .sp{flex:1}

/* ---------------- \u4F1A\u8BDD\u5217\u8868 ---------------- */
.im-side{width:268px;flex:none;background:var(--im-list);display:flex;flex-direction:column;
  border-right:1px solid var(--im-line);min-width:0}
.im-side-h{padding:12px 12px 8px;display:flex;gap:8px;align-items:center}
.im-search{flex:1;height:32px;border-radius:8px;background:var(--im-hover);display:flex;
  align-items:center;gap:6px;padding:0 10px;color:var(--im-t3)}
.im-search input{flex:1;border:none;background:none;outline:none;font-size:13px;color:var(--im-t1);
  font-family:inherit;min-width:0}
.im-search svg{width:14px;height:14px;fill:currentColor;flex:none}
.im-list{flex:1;overflow-y:auto;overflow-x:hidden;padding:0 8px 8px}
.im-row{display:flex;gap:10px;padding:10px 8px;border-radius:8px;cursor:pointer;align-items:center;
  margin-bottom:2px}
.im-row:hover{background:var(--im-hover)}
.im-row.on{background:var(--im-active)}
.im-row .ava{width:40px;height:40px;border-radius:8px;background:var(--im-active);flex:none;
  position:relative}
.im-row .ava img{width:100%;height:100%;object-fit:cover;display:block;border-radius:8px}
/* \u7F6E\u9876\u5C0F\u65D7\u6807\uFF08QQ \u5728\u5934\u50CF\u53F3\u4E0A\u89D2\uFF09 */
.im-row .pin{position:absolute;right:-3px;top:-3px;width:15px;height:15px;border-radius:50%;
  background:var(--im-self);display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 0 2px var(--im-list)}
.im-row .pin svg{width:9px;height:9px;fill:#fff}
/* \u672A\u8BFB\uFF1A\u7EA2\u70B9 / \u6570\u5B57\u6C14\u6CE1 */
.im-row .badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#f5534f;
  color:#fff;font-size:11px;line-height:18px;text-align:center;flex:none}
.im-row .dot{width:8px;height:8px;border-radius:50%;background:#f5534f;flex:none}
.im-row.muted .nm{font-weight:400;color:var(--im-t2)}
.ava-t{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
  background:var(--im-active);color:var(--im-t2);font-size:15px;font-weight:600}
.im-row .main{flex:1;min-width:0}
.im-row .top{display:flex;gap:8px;align-items:baseline}
.im-row .nm{flex:1;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.im-row .tm{font-size:11px;color:var(--im-t3);flex:none}
.im-row .pv-who{color:var(--im-t3)}
.im-row .pv{font-size:12.5px;color:var(--im-t2);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;margin-top:2px}
.im-row .bdg{min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#f5534f;color:#fff;
  font-size:11px;line-height:16px;text-align:center;flex:none}
.im-empty{padding:40px 16px;text-align:center;color:var(--im-t3);font-size:12.5px}

/* ---------------- \u804A\u5929\u533A ---------------- */
.im-chat{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--im-chat);position:relative}
.im-head{height:56px;flex:none;display:flex;align-items:center;gap:10px;padding:0 16px;
  border-bottom:1px solid var(--im-line);background:var(--im-list)}
.im-head .tt{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.im-head .sub{font-size:12px;color:var(--im-t3);flex:none}
.im-head .sp{flex:1}
.im-ico{width:30px;height:30px;border-radius:6px;border:none;background:none;color:var(--im-t2);
  cursor:pointer;display:flex;align-items:center;justify-content:center}
.im-ico:hover{background:var(--im-hover);color:var(--im-t1)}
.im-ico svg{width:17px;height:17px;fill:currentColor}

.im-flow{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 20px 8px;scroll-behavior:auto}
.im-flow.pad{padding-bottom:0}
.im-time{text-align:center;margin:12px 0 10px;font-size:12px;color:var(--im-t3)}
.im-sys{text-align:center;margin:8px 0;font-size:12px;color:var(--im-t3)}
.im-sys span{display:inline-block;padding:2px 8px;border-radius:6px;background:var(--im-hover)}

.im-msg{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;position:relative}
.im-msg.compact{margin-top:-4px;margin-bottom:8px}
.im-msg.me{flex-direction:row-reverse}
.im-msg .ava{width:34px;height:34px;border-radius:6px;overflow:hidden;background:var(--im-active);flex:none}
.im-msg .ava img{width:100%;height:100%;object-fit:cover;display:block}
.im-msg .ava.ph{visibility:hidden}
.im-msg .col{max-width:min(70%,560px);min-width:0;display:flex;flex-direction:column}
.im-msg.me .col{align-items:flex-end}
.im-msg .who{font-size:12px;color:var(--im-t3);margin:0 2px 3px}
.im-bub{position:relative;background:var(--im-other);border-radius:var(--im-r);
  padding:8px 12px;color:var(--im-t1);word-break:break-word;white-space:pre-wrap;
  box-shadow:0 1px 2px rgba(0,0,0,.05)}
.im-msg.me .im-bub{background:var(--im-self);color:var(--im-self-t);border-bottom-right-radius:4px}
.im-msg:not(.me) .im-bub{border-bottom-left-radius:4px}
.im-bub.media{padding:4px;background:transparent;box-shadow:none}
.im-msg.me .im-bub.media{background:transparent}
.im-bub .at{color:var(--im-self);font-weight:500}
.im-msg.me .im-bub .at{color:#fff;text-decoration:underline}
.im-bub img.face{width:20px;height:20px;vertical-align:-4px;margin:0 1px}
.im-quote{border-left:3px solid var(--im-active);padding:4px 8px;margin-bottom:6px;
  font-size:12.5px;color:var(--im-t2);background:rgba(0,0,0,.03);border-radius:4px;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.im-msg.me .im-quote{background:rgba(255,255,255,.16);color:rgba(255,255,255,.9);
  border-left-color:rgba(255,255,255,.5)}
.im-recall{font-size:12px;color:var(--im-t3);font-style:italic}
/* \u64A4\u56DE\u6807\u8BB0\uFF1A\u5185\u5BB9\u7167\u5E38\u663E\u793A\uFF0C\u53EA\u662F\u6DE1\u4E00\u70B9 + \u4E00\u4E2A\u89D2\u6807 */
.im-msg.recalled .im-bub{opacity:.62}
.im-msg.recalled .im-grid,.im-msg.recalled .im-video{opacity:.62}
.im-rec-tag{display:inline-block;margin-left:6px;font-size:10.5px;color:#e8a33d;
  border:1px solid #e8a33d;border-radius:999px;padding:0 6px;vertical-align:1px}
.im-meta{font-size:11px;color:var(--im-t3);margin-top:3px;padding:0 2px}

/* \u5A92\u4F53 */
.im-grid{display:grid;gap:4px;max-width:420px}
.im-grid.g1{grid-template-columns:1fr}
.im-grid.g2{grid-template-columns:repeat(2,1fr)}
.im-grid.g3{grid-template-columns:repeat(3,1fr)}
.im-grid img{width:100%;height:100%;object-fit:cover;border-radius:8px;display:block;cursor:zoom-in;
  background:var(--im-active);min-height:60px}
.im-grid.g1 img{max-height:320px;object-fit:contain;background:transparent}
.im-video{position:relative;max-width:420px;border-radius:8px;overflow:hidden;background:#000}
.im-video video{width:100%;max-height:320px;display:block}
.im-voice{display:flex;align-items:center;gap:8px;cursor:pointer;min-width:96px}
.im-voice .wave{display:flex;align-items:center;gap:2px;height:18px}
.im-voice .wave i{width:3px;background:currentColor;border-radius:2px;opacity:.55}
.im-voice .sec{font-size:12px;opacity:.8;flex:none}
.im-file{display:flex;gap:10px;align-items:center;min-width:200px}
.im-file .fi{width:34px;height:34px;border-radius:6px;background:rgba(0,0,0,.08);display:flex;
  align-items:center;justify-content:center;font-size:11px;font-weight:600;flex:none}
.im-card{min-width:220px;max-width:340px}
.im-card .ct{font-size:13.5px;font-weight:600;margin-bottom:2px}
.im-card .cd{font-size:12px;color:var(--im-t2);overflow:hidden;display:-webkit-box;
  -webkit-line-clamp:2;-webkit-box-orient:vertical}
.im-unk{font-size:12.5px;color:var(--im-t2)}
.im-unk .raw{margin-top:6px;font-family:ui-monospace,Menlo,monospace;font-size:11px;
  color:var(--im-t3);white-space:pre-wrap;max-height:120px;overflow:auto}

.im-jump{position:absolute;right:20px;bottom:150px;width:36px;height:36px;border-radius:50%;
  background:var(--im-list);border:1px solid var(--im-line);box-shadow:var(--im-shadow);
  display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--im-t2)}
.im-jump:hover{color:var(--im-t1)}
.im-jump svg{width:18px;height:18px;fill:currentColor}
.im-more{text-align:center;padding:8px;font-size:12px;color:var(--im-t3)}

.im-readonly{flex:none;border-top:1px solid var(--im-line);background:var(--im-input);
  padding:11px 16px;display:flex;align-items:center;justify-content:center;gap:7px;
  font-size:12.5px;color:var(--im-t3);user-select:none}
.im-readonly svg{width:15px;height:15px;fill:currentColor;opacity:.8}

/* \u60AC\u505C\u64CD\u4F5C\u6761 / \u53F3\u952E\u83DC\u5355 / \u9AD8\u4EAE / \u672A\u8BFB\u5206\u5272 / \u5F15\u7528\u6761 / \u8F7B\u63D0\u793A */
.im-ops{position:absolute;top:-10px;right:6px;display:flex;gap:2px;opacity:0;
  transition:opacity .12s;background:var(--im-list);border:1px solid var(--im-line);
  border-radius:6px;padding:2px;box-shadow:0 2px 8px rgba(0,0,0,.08);z-index:2}
.im-msg:hover .im-ops{opacity:1}
.im-msg.me .im-ops{right:auto;left:6px}
.im-op{border:none;background:none;font-size:11px;color:var(--im-t2);cursor:pointer;
  padding:2px 6px;border-radius:4px;font-family:inherit}
.im-op:hover{background:var(--im-hover);color:var(--im-t1)}
.im-menu{position:fixed;z-index:960;background:var(--im-list);border:1px solid var(--im-line);
  border-radius:8px;box-shadow:var(--im-shadow);padding:4px;min-width:120px}
.im-menu button{display:block;width:100%;text-align:left;border:none;background:none;
  font-size:13px;color:var(--im-t1);padding:7px 10px;border-radius:5px;cursor:pointer;
  font-family:inherit}
.im-menu button:hover{background:var(--im-hover)}
.im-flash{animation:imflash 1.1s ease}
@keyframes imflash{0%,100%{background:transparent}30%{background:rgba(0,153,255,.14)}}
.im-divider{text-align:center;font-size:12px;color:var(--im-t3);margin:10px 0}
.im-toast{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);z-index:970;
  background:rgba(0,0,0,.78);color:#fff;font-size:12.5px;padding:6px 14px;border-radius:16px}

/* \u968F\u673A\u6311\u4E00\u6761\u56DE\u590D\u7684\u62BD\u5C49 */
.im-rnd{position:absolute;top:0;right:0;bottom:0;width:390px;max-width:82%;
  background:var(--im-list);border-left:1px solid var(--im-line);z-index:6;
  display:flex;flex-direction:column;box-shadow:-6px 0 20px rgba(0,0,0,.07)}
.im-rnd .fh{flex:none;height:48px;display:flex;align-items:center;gap:8px;
  padding:0 10px 0 16px;border-bottom:1px solid var(--im-line)}
.im-rnd .ft{flex:1;font-size:14px;font-weight:600;color:var(--im-t1)}
.im-rnd .scope{font-size:11.5px;color:var(--im-t2);border:1px solid var(--im-line);
  background:var(--im-hover);border-radius:11px;padding:3px 10px;cursor:pointer;flex:none}
.im-rnd .scope:hover{color:var(--im-t1)}
.im-rnd .fb{flex:1;overflow:auto;padding:12px 14px 18px}
.im-rnd .rnd-hint{font-size:11.5px;color:var(--im-t3);margin-bottom:10px;line-height:1.6}
.im-rnd .rnd-pick{border:1px solid var(--im-line);border-radius:8px;padding:9px 11px;
  background:var(--im-hover)}
.im-rnd .rnd-pick-h{display:flex;align-items:center;gap:7px;margin-bottom:5px}
.im-rnd .rnd-who{font-size:12.5px;font-weight:600;color:var(--im-t1)}
.im-rnd .rnd-where{font-size:11px;color:var(--im-t3);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;flex:1}
.im-rnd .rnd-time{font-size:11px;color:var(--im-t3);flex:none}
.im-rnd .rnd-text{font-size:13.5px;color:var(--im-t1);line-height:1.6;
  white-space:pre-wrap;word-break:break-word}
.im-rnd .rnd-arrow{font-size:11.5px;color:var(--im-t3);margin:14px 0 7px;text-align:center}
.im-rnd .rnd-reply{background:var(--im-self);border-radius:8px;padding:9px 11px;
  font-size:13.5px;line-height:1.6;color:var(--im-self-t);white-space:pre-wrap;word-break:break-word}
.im-rnd .rnd-foot{font-size:11px;color:var(--im-t3);margin-top:8px;text-align:right}
.im-rnd .rnd-sent{font-size:11.5px;margin-top:8px;padding:5px 9px;border-radius:6px;
  background:var(--im-hover);color:var(--im-t2)}
.im-rnd .rnd-sent.ok{color:var(--im-self)}
.im-rnd .rnd-sent.bad{color:#e5484d}
.im-rnd .rf{flex:none;display:flex;gap:8px;padding:10px 14px;
  border-top:1px solid var(--im-line)}
.im-rnd .rf button{flex:1;font-size:12.5px;border:1px solid var(--im-line);
  background:var(--im-hover);color:var(--im-t1);border-radius:6px;padding:7px 0;cursor:pointer}
.im-rnd .rf button:hover{background:var(--im-active)}
.im-rnd .rf button.primary{background:var(--im-self);border-color:var(--im-self);
  color:var(--im-self-t)}
.im-rnd .rf button.primary:hover{opacity:.88;background:var(--im-self)}
.im-rnd .rf button:disabled{opacity:.45;cursor:default}

/* \u5408\u5E76\u8F6C\u53D1\u5C55\u5F00\u62BD\u5C49 */
.im-fwd{position:absolute;top:0;right:0;bottom:0;width:390px;max-width:82%;
  background:var(--im-list);border-left:1px solid var(--im-line);z-index:6;
  display:flex;flex-direction:column;box-shadow:-6px 0 20px rgba(0,0,0,.07)}
.im-fwd .fh{flex:none;height:48px;display:flex;align-items:center;gap:8px;
  padding:0 10px 0 16px;border-bottom:1px solid var(--im-line)}
.im-fwd .ft{flex:1;font-size:14px;font-weight:600;color:var(--im-t1)}
.im-fwd .fb{flex:1;overflow:auto;padding:10px 14px 18px}
.im-fwd .fn{padding:9px 0;border-bottom:1px solid var(--im-line)}
.im-fwd .fn:last-child{border-bottom:none}
.im-fwd .fn-h{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.im-fwd .fava{width:20px;height:20px;border-radius:4px;object-fit:cover;flex:none}
.im-fwd .fnm{font-size:12.5px;color:var(--im-t2);flex:1;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.im-fwd .ftm{font-size:11px;color:var(--im-t3)}
.im-fwd .fn-b{font-size:13.5px;color:var(--im-t1);line-height:1.5;word-break:break-word}
.im-fwd .fn-b .at{color:var(--im-self);font-weight:500}
.im-fwd .fn-b .face{width:18px;height:18px;vertical-align:-3px}
.im-fwd .fn-b .im-grid{margin-top:6px;max-width:100%}
.im-fwd .fn-f{font-size:11.5px;color:var(--im-t3);margin-top:5px}
.im-fwd .fn-nested{display:block;font-size:11.5px;color:var(--im-self);margin-top:5px;
  border:none;background:none;padding:0;cursor:pointer;font-family:inherit;text-align:left}
.im-card.fwd{cursor:pointer;padding:8px 12px;border:1px solid var(--im-line);
  border-radius:10px;background:var(--im-bg);transition:background .12s}
.im-card.fwd:hover{background:var(--im-hover)}

/* \u804A\u5929\u533A\u641C\u7D22\u6846\uFF08\u4F1A\u8BDD\u5185\u641C\u7D22\uFF09 */
.im-hsearch{display:flex;align-items:center;gap:6px;height:28px;padding:0 8px;
  border:1px solid var(--im-line);border-radius:14px;background:var(--im-bg);min-width:200px}
.im-hsearch svg{width:14px;height:14px;fill:var(--im-t3);flex:none}
.im-hsearch input{border:none;outline:none;background:none;font-family:inherit;
  font-size:12.5px;color:var(--im-t1);width:100%;min-width:0}
.im-hclear{border:none;background:none;cursor:pointer;color:var(--im-t3);
  font-size:15px;line-height:1;padding:0 2px;font-family:inherit}
.im-hclear:hover{color:var(--im-t1)}
.im-srch{position:sticky;top:0;z-index:3;background:var(--im-hover);color:var(--im-t2);
  font-size:12px;padding:6px 14px;display:flex;align-items:center;gap:8px;
  border-bottom:1px solid var(--im-line)}

/* \u5927\u56FE\u67E5\u770B */
.im-viewer{position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.82);display:flex;
  align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.im-viewer img{max-width:100%;max-height:100%;border-radius:8px}
.im-viewer .x{position:absolute;top:16px;right:22px;color:#fff;font-size:26px;cursor:pointer;
  line-height:1;background:none;border:none}
`;function cp(){if(typeof document>"u"||document.getElementById(op))return;let e=document.createElement("style");e.id=op,e.textContent=Nf,document.head.appendChild(e)}var Af="qqbot",dp="rcq-style",pp="rcq.tab",Er=null,yt=ui({toast:"",toastKind:"",conn:null}),fl=null;function X(e,t){yt.toast=String(e??""),yt.toastKind=t||"",fl&&clearTimeout(fl),fl=setTimeout(()=>{yt.toast=""},t==="err"?5200:2600)}async function Ue(e,t){if(!Er||!Er.invoke)throw new Error("\u63D2\u4EF6\u8FD0\u884C\u65F6\u672A\u5C31\u7EEA");return await Er.invoke(e,t||{})}async function ue(e,t){let i=await Ue(e,t);return i&&typeof i=="object"&&"data"in i&&i.data!==null&&i.data!==void 0?i.data:i}function le(e){return e?String(e&&e.message||e):"\u672A\u77E5\u9519\u8BEF"}var fi=e=>e<10?"0"+e:""+e;function Ef(e){if(!e)return"\u2014";let t=new Date(e*1e3);return t.getMonth()+1+"-"+fi(t.getDate())+" "+fi(t.getHours())+":"+fi(t.getMinutes())}function hp(e){if(!e)return"\u2014";let t=new Date(e*1e3);return t.getFullYear()+"-"+fi(t.getMonth()+1)+"-"+fi(t.getDate())+" "+fi(t.getHours())+":"+fi(t.getMinutes())+":"+fi(t.getSeconds())}function rn(e){return e==null||e===""||(e=Number(e),isNaN(e))?"\u2014":e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e4?(e/1e4).toFixed(1)+"\u4E07":String(e)}function ml(e){return String(e||"").split(/[,，\s]+/).map(t=>t.trim()).filter(Boolean)}function fp(e){if(!e)return"";let t=e.abs||(e.rel?"/opt/rcbot/media/"+e.rel:"");return t?"/api/fm/preview?path="+encodeURIComponent(t):""}function mp(e){return!e||!e.local?!1:e.exists!==0}var Mf=`
.rcq{--t:var(--text);--m:var(--text-muted);--f:var(--text-faint);--bd:var(--border);
 --bd2:var(--border-strong);--sf:var(--surface);--sf2:var(--surface-2);--sf3:var(--surface-3);
 --ac:var(--accent);--acbg:var(--accent-soft);--ok:var(--success);--warn:var(--warning);
 --bad:var(--danger);--r:var(--radius-md);
 color:var(--t);font-size:13px;line-height:1.6;font-family:var(--font)}
.rcq *{box-sizing:border-box}

/* \u9876\u90E8\u9009\u9879\u5361\uFF08\u63D2\u4EF6\u5185\u552F\u4E00\u5BFC\u822A\uFF09 */
.rcq-bar{position:sticky;top:0;z-index:9;display:flex;align-items:flex-end;gap:2px;
 padding:0 2px;background:var(--bg);border-bottom:1px solid var(--bd);margin-bottom:16px}
.rcq-tab{padding:9px 14px;font-size:13px;color:var(--m);cursor:pointer;user-select:none;
 border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:color .12s}
.rcq-tab:hover{color:var(--t)}
.rcq-tab.on{color:var(--ac);border-bottom-color:var(--ac);font-weight:600}
.rcq-bar-r{margin-left:auto;display:flex;align-items:center;gap:10px;padding:0 4px 7px}
.rcq-lamp{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--m)}
.rcq-lamp b{width:7px;height:7px;border-radius:50%;background:var(--bd2);display:inline-block}
.rcq-lamp b.on{background:var(--ok);box-shadow:0 0 0 3px rgba(63,185,80,.16)}
.rcq-lamp b.off{background:var(--bad)}

/* \u5361\u7247 */
.rcq-pnl{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);
 padding:14px 16px;margin-bottom:12px}
.rcq-pnl.flat{padding:0}
.rcq-ph{display:flex;align-items:center;gap:8px;margin-bottom:12px;min-height:24px;flex-wrap:wrap}
.rcq-ph b{font-size:13px;font-weight:600}
.rcq-ph .sp{margin-left:auto}
.rcq-sec{border-top:1px solid var(--bd);margin:12px -16px;padding:12px 16px 0}
/* .rcq-pnl.flat \u81EA\u8EAB padding \u4E3A 0\uFF0C\u8D1F\u8FB9\u8DDD\u4F1A\u628A\u5185\u5BB9\u9876\u5230\u8FB9\u6846\u4E0A\uFF08\u6982\u89C8\u7684\u300C\u7CFB\u7EDF\u4FE1\u606F\u300D\u5C31\u662F\uFF09\uFF0C
   \u8FD9\u79CD\u5361\u7247\u91CC\u7684\u5206\u9694\u6BB5\u6539\u6210\u6B63\u5E38\u5185\u8FB9\u8DDD\uFF0C\u5206\u9694\u7EBF\u4ECD\u7136\u6A2A\u8D2F\u6574\u5F20\u5361 */
.rcq-pnl.flat > .rcq-sec{margin-left:0;margin-right:0;padding:12px 16px 0}

/* \u952E\u503C */
.rcq-kv{display:grid;grid-template-columns:88px 1fr;gap:7px 12px;font-size:12.5px;align-items:baseline}
.rcq-kv .k{color:var(--m)}
.rcq-kv .v{color:var(--t);font-family:var(--font-mono);word-break:break-all}
.rcq-fld{display:flex;align-items:baseline;gap:7px;font-size:12.5px;min-width:0}
.rcq-fld .k{color:var(--m);flex:none}
.rcq-fld .v{color:var(--t);font-family:var(--font-mono);word-break:break-all}
.rcq-fld.full{grid-column:1/-1}
.rcq-row2{display:grid;grid-template-columns:1fr 1fr;gap:9px 16px;margin-top:9px}
.rcq-row2 > .full{grid-column:1/-1}

/* \u6982\u89C8\u4E09\u680F */
.rcq-ov{display:grid;grid-template-columns:minmax(230px,.95fr) minmax(0,1.5fr) 160px;
 gap:12px;align-items:start}
.rcq-ov > div > .rcq-pnl:last-child{margin-bottom:0}
.rcq-acct{display:flex;align-items:center;gap:12px;padding:16px}
.rcq-ava{width:52px;height:52px;border-radius:50%;object-fit:cover;flex:none;
 background:var(--sf2);border:1px solid var(--bd)}
.rcq-nick{font-size:14px;font-weight:600;display:flex;align-items:center;gap:7px}
.rcq-dot{width:7px;height:7px;border-radius:50%;background:var(--bd2);display:inline-block;flex:none}
.rcq-dot.on{background:var(--ok)}
.rcq-dot.off{background:var(--bad)}
.rcq-uin{font-size:11.5px;color:var(--m);font-family:var(--font-mono);margin-top:2px}

/* \u4EEA\u8868 */
.rcq-gauges{display:flex;flex-direction:column;gap:12px}
.rcq-gauge{position:relative;display:flex;align-items:center;justify-content:center;
 padding:12px 6px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)}
.rcq-gauge svg{width:96px;height:96px;display:block}
.rcq-gauge .lbl{position:absolute;inset:0;display:flex;flex-direction:column;
 align-items:center;justify-content:center;pointer-events:none}
.rcq-gauge .lbl b{font-size:17px;font-weight:700;line-height:1.1}
.rcq-gauge .lbl span{font-size:10px;color:var(--m);margin-top:1px}

/* \u8BA1\u6570\u6761 */
.rcq-counters{display:grid;grid-template-columns:repeat(5,1fr);background:var(--sf);
 border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;margin-bottom:12px}
.rcq-ct{padding:13px 6px;text-align:center;border-left:1px solid var(--bd)}
.rcq-ct:first-child{border-left:0}
.rcq-ct b{display:block;font-size:23px;font-weight:700;line-height:1.2}
.rcq-ct span{font-size:11px;color:var(--m)}

/* \u5217\u8868 */
.rcq-list{display:flex;flex-direction:column}
.rcq-row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid var(--bd);
 cursor:default}
.rcq-row:first-child{border-top:0}
.rcq-row.click{cursor:pointer}
.rcq-row.click:hover,.rcq-row.on{background:var(--sf2)}
.rcq-row .main{flex:1;min-width:0}
.rcq-row .t{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rcq-row .d{font-size:11.5px;color:var(--m);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.rcq-row .acts{display:flex;gap:6px;flex:none;align-items:center}
/* \u4F1A\u8BDD\u5217\u8868\u884C\u5185\u7684\u542F\u7528\u5F00\u5173\uFF1A\u5782\u76F4\u5C45\u4E2D\u3001\u4E0D\u6491\u9AD8\u884C\u9AD8 */
.rcq-row .acts .switch{margin:0;display:inline-flex;align-items:center}
.rcq-row .acts .switch input{width:30px;height:17px}
.rcq-mono{font-family:var(--font-mono);font-size:11.5px}

.rcq-empty{padding:38px 12px;text-align:center;color:var(--f);font-size:12.5px}
.rcq-empty b{display:block;font-size:24px;margin-bottom:6px;opacity:.45;font-weight:400}

/* \u4E8C\u7EF4\u7801 */
.rcq-qr{width:196px;height:196px;background:#fff;border:1px solid var(--bd);
 border-radius:var(--r);padding:9px;display:flex;align-items:center;justify-content:center;flex:none}
.rcq-qr svg{width:100%;height:100%;display:block}
.rcq-qr .ph{color:#999;font-size:12px;text-align:center;padding:0 10px}

/* \u65E5\u5FD7\uFF08SnowLuma \u5BB9\u5668\u65E5\u5FD7\uFF1A\u7EAF\u6587\u672C\u884C\uFF0C\u6309\u7EA7\u522B\u7740\u8272\uFF09 */
.rcq-log{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);
 padding:11px 13px;font-family:var(--font-mono);font-size:11.5px;line-height:1.85;
 max-height:min(64vh,640px);overflow:auto;white-space:pre-wrap;word-break:break-word}
/* \u7EA7\u522B\u7C7B\u540D\u4E00\u5F8B\u52A0 rcq-lv- \u524D\u7F00\uFF1A\u9762\u677F\u5168\u5C40\u6709 .error{padding:24px;text-align:center}\uFF0C
   \u76F4\u63A5\u5199 class="error" \u4F1A\u628A\u65E5\u5FD7\u884C\u641E\u6210\u5C45\u4E2D\u7684\u5927\u5757 */
.rcq-ln{color:var(--t);padding:0;text-align:left}
.rcq-ln .lv{font-weight:700;margin-right:5px}
.rcq-ln.rcq-lv-info .lv{color:var(--m)}
.rcq-ln.rcq-lv-debug{color:var(--f)}
.rcq-ln.rcq-lv-debug .lv{color:var(--f)}
.rcq-ln.rcq-lv-warn{color:var(--warn)}
.rcq-ln.rcq-lv-error{color:var(--bad)}
.rcq-ln.rcq-lv-fatal{color:var(--bad);font-weight:600}
.rcq-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;font-size:11px;
 border:1px solid var(--bd2);border-radius:999px;color:var(--m);white-space:nowrap}
.rcq-pill.ok{color:var(--ok);border-color:var(--ok)}
.rcq-pill.off{color:var(--bad);border-color:var(--bad)}
.rcq-qr-ok{display:flex;flex-direction:column;align-items:center;justify-content:center;
 gap:6px;color:var(--ok);font-size:12.5px;text-align:center;width:100%;height:100%}
.rcq-qr-ok b{font-size:30px;font-weight:400;line-height:1}

/* \u8868\u5355 */
.rcq-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.rcq-fi{display:flex;flex-direction:column;gap:5px;min-width:0}
.rcq-fi > span{font-size:11.5px;color:var(--m)}
.rcq-fi.wide{grid-column:1/-1}
.rcq-fi > .switch{align-self:flex-start;margin-top:3px}
.rcq-fi > .rcq-num{max-width:220px}
.rcq-ta{width:100%;min-height:132px;resize:vertical;padding:9px 11px;font-size:12.5px;
 line-height:1.7;font-family:var(--font-mono);color:var(--t);background:var(--surface);
 border:1px solid var(--bd);border-radius:var(--r)}
.rcq-ta:focus{outline:none;border-color:var(--ac);box-shadow:var(--ring)}
.rcq-note{font-size:11px;color:var(--f);margin-top:4px;line-height:1.55}
/* \u62A5\u9519\u539F\u6587\u53EF\u80FD\u5F88\u957F\uFF08\u6A21\u578B\u8FD4\u56DE\u7684 JSON\uFF09\uFF0C\u4E24\u884C\u622A\u65AD\uFF0C\u60AC\u505C\u770B\u5168\u6587 */
.rcq-err{color:var(--bad);white-space:normal;word-break:break-word;
 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* \u4F1A\u8BDD\u8BE6\u60C5 */
.rcq-msgs{max-height:min(46vh,460px);overflow:auto;padding:2px 0}
.rcq-msg{display:flex;gap:9px;padding:7px 0;border-top:1px dashed var(--bd)}
.rcq-msg:first-child{border-top:0}
.rcq-msg .who{flex:none;width:74px;font-size:11px;color:var(--m);text-align:right;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcq-msg .body{flex:1;min-width:0;font-size:12.5px;white-space:pre-wrap;word-break:break-word}
.rcq-msg.me .who{color:var(--ac)}
.rcq-bar2{height:6px;background:var(--sf3);border-radius:3px;overflow:hidden;margin-top:6px}
.rcq-bar2 i{display:block;height:100%;background:var(--ac);border-radius:3px}
.rcq-bar2 i.hi{background:var(--warn)}
.rcq-bar2 i.max{background:var(--bad)}

.rcq-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:12px;align-items:start}
.rcq-flex{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.rcq-hint{font-size:11.5px;color:var(--m)}
.rcq-warn{border-color:var(--warn);color:var(--warn)}

/* ---- \u591A\u5B9E\u4F8B\uFF08QQ \u8D26\u6237\uFF09 ---- */
.rcq-inst{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.rcq-icard{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:14px 15px}
.rcq-icard.on{border-color:var(--ac)}
.rcq-itop{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.rcq-itop .nm{flex:1;min-width:0}
.rcq-itop .nm b{display:block;font-size:13.5px;font-weight:600;overflow:hidden;
 text-overflow:ellipsis;white-space:nowrap}
.rcq-itop .nm span{font-size:11.5px;color:var(--m);font-family:var(--font-mono)}
.rcq-imeta{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:11.5px;
 margin-bottom:10px}
.rcq-imeta .k{color:var(--m)}
.rcq-imeta .v{font-family:var(--font-mono);word-break:break-all}
.rcq-iacts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}


/* ---- \u5A92\u4F53\u5E93 ---- */
.rcq-mlib{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px}
.rcq-mcard{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);
 overflow:hidden;display:flex;flex-direction:column;position:relative}
.rcq-mcard.on{border-color:var(--ac);box-shadow:0 0 0 1px var(--ac)}
.rcq-mcard.gone{opacity:.55}
.rcq-mcard .ck{position:absolute;top:6px;left:6px;z-index:2;background:rgba(0,0,0,.45);
 border-radius:5px;padding:1px 5px;line-height:1.4}
.rcq-mcard .th{height:118px;background:var(--sf3);display:flex;align-items:center;
 justify-content:center;overflow:hidden;cursor:zoom-in;position:relative}
.rcq-mcard .th img{width:100%;height:100%;object-fit:cover;display:block}
.rcq-mcard .th video{width:100%;height:100%;object-fit:cover;display:block}
.rcq-mcard .th .ph{font-size:30px;opacity:.6}
.rcq-mcard .meta{padding:7px 9px;font-size:11px;color:var(--m);flex:1;min-width:0}
.rcq-mcard .meta .n{font-size:11.5px;color:var(--t);font-weight:600}
.rcq-mcard .meta .s,.rcq-mcard .meta .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcq-mcard .dl{display:block;text-align:center;padding:5px;border-top:1px solid var(--bd);
 font-size:11px;color:var(--ac);text-decoration:none}
.rcq-mcard .dl:hover{background:var(--sf2)}
.rcq-mcard .dl.gone{color:var(--m);cursor:default}
.rcq-badge{display:inline-block;font-size:10px;line-height:1.7;padding:0 6px;border-radius:999px;
 border:1px solid var(--bd);color:var(--m);margin-left:4px;vertical-align:middle}
.rcq-badge.warn{border-color:var(--warn);color:var(--warn)}
.rcq-badge.bad{border-color:var(--bad);color:var(--bad)}
.rcq-badge.plain{border-style:dashed}

/* ---- \u67E5\u8BE2 ---- */
.rcq-qres{display:flex;flex-direction:column;gap:6px}
.rcq-qrow{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:8px 11px}
.rcq-qrow.rec{opacity:.72}
.rcq-qrow .hd{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11.5px;color:var(--m)}
.rcq-qrow .hd .ava{width:18px;height:18px;border-radius:50%;object-fit:cover;flex:none}
.rcq-qrow .hd b{font-size:12px;color:var(--t)}
.rcq-qrow .hd .tt{margin-left:auto}
.rcq-qrow .bd{margin-top:5px;font-size:12.5px;white-space:pre-wrap;word-break:break-word;line-height:1.55}
.rcq-sugg{position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--sf);
 border:1px solid var(--bd);border-radius:var(--r);box-shadow:var(--shadow);margin-top:2px;
 max-height:230px;overflow:auto}
.rcq-sugg-i{display:flex;align-items:center;gap:7px;padding:6px 9px;cursor:pointer;font-size:12px}
.rcq-sugg-i:hover{background:var(--sf2)}
.rcq-sugg-i img{width:20px;height:20px;border-radius:50%;object-fit:cover}
.rcq-sugg-i b{font-weight:600}
.rcq-sugg-i span{color:var(--m);font-size:11px}
.rcq-sugg-i i{margin-left:auto;font-style:normal;color:var(--m);font-size:11px}
.rcq-noplay{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--warn);
 border:1px solid var(--warn);border-radius:7px;padding:4px 9px;margin-top:5px}
.rcq-noplay a{color:var(--ac)}

/* \u5927\u56FE\u67E5\u770B */
.rcq-light{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.82);
 display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.rcq-light img{max-width:100%;max-height:100%;border-radius:8px}
.rcq-light .x{position:absolute;top:16px;right:20px;color:#fff;font-size:24px;
 background:none;border:none;cursor:pointer;line-height:1}

/* \u6C34\u4F4D\u6761 */
.rcq-wl{height:6px;background:var(--sf3);border-radius:3px;overflow:hidden;margin-top:6px}
.rcq-wl i{display:block;height:100%;background:var(--ok);border-radius:3px}
.rcq-wl i.hi{background:var(--warn)}
.rcq-wl i.max{background:var(--bad)}

/* toast */
.rcq-toast{position:fixed;right:24px;bottom:24px;z-index:9999;max-width:420px;
 padding:10px 15px;font-size:12.5px;background:var(--surface-3);color:var(--text);
 border:1px solid var(--border-strong);border-radius:var(--radius-md);box-shadow:var(--shadow)}
.rcq-toast.ok{border-color:var(--success);color:var(--success)}
.rcq-toast.err{border-color:var(--danger);color:var(--danger)}

@media(max-width:1180px){
 .rcq-ov{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}
 .rcq-gauges{grid-column:1/-1;flex-direction:row;justify-content:center;gap:12px}
 .rcq-gauge{flex:1;max-width:240px}
}
@media(max-width:820px){
 .rcq-ov{grid-template-columns:1fr}
 .rcq-split{grid-template-columns:1fr}
 .rcq-counters{grid-template-columns:repeat(3,1fr)}
 .rcq-ct:nth-child(4){border-left:0;border-top:1px solid var(--bd)}
 .rcq-ct:nth-child(5){border-top:1px solid var(--bd)}
}

/* ---- \u89D2\u8272\u5361\u7247 ---- */
/* \u5217\u8868\uFF1A\u5361\u7247\u5899 */
.cd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;padding:12px}
.cd-card{position:relative;border:1px solid var(--bd);border-radius:12px;overflow:hidden;
  background:var(--sf);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease}
.cd-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
.cd-card.on{border-color:var(--ac);box-shadow:0 0 0 1px var(--ac)}
.cdc-cover{position:relative;aspect-ratio:16/10;background:linear-gradient(135deg,var(--sf3),var(--sf2));
  background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center}
.cdc-fallback{font-size:30px;font-weight:600;color:rgba(255,255,255,.92);
  text-shadow:0 2px 8px rgba(0,0,0,.28)}
.cdc-ava{position:absolute;left:10px;bottom:-14px;width:38px;height:38px;border-radius:10px;
  object-fit:cover;border:2px solid var(--sf);background:var(--sf3)}
.cdc-body{padding:18px 10px 10px}
.cdc-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cdc-tag{font-size:11px;color:var(--m);margin-top:2px;line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}
.cdc-badges{margin-top:6px;display:flex;gap:4px;flex-wrap:wrap}
.cd-tag.v{color:var(--f)}

/* \u8BE6\u60C5\uFF1A\u4E00\u5F20\u5B8C\u6574\u7684\u5927\u5361\u7247 */
.cd-hero{position:relative;border:1px solid var(--bd);border-radius:14px;overflow:hidden;
  background:var(--sf);margin:10px 0 14px}
.cdh-cover{position:absolute;left:0;right:0;top:0;height:132px;background-size:cover;
  background-position:center 28%;opacity:.85}
.cdh-cover::after{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.30) 100%)}
.cdh-inner{position:relative;display:flex;align-items:center;gap:13px;padding:18px 18px 14px}
.cd-hero.grad .cdh-name{color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.35)}
.cd-hero.grad .cdh-alias{color:rgba(255,255,255,.82)}
.cd-hero.grad .cdh-tag{color:rgba(255,255,255,.92)}
.cd-hero.grad .cdh-ava{background:rgba(255,255,255,.22);color:#fff;
  border:1px solid rgba(255,255,255,.45)}
.cd-hero.grad .cd-tag{color:#fff;border-color:rgba(255,255,255,.55)}
.cd-hero.grad .cdh-inner::before{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.05));pointer-events:none}
.cdh-ava{width:58px;height:58px;border-radius:15px;overflow:hidden;background:var(--sf3);
  display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:600;color:var(--f);
  box-shadow:0 4px 14px rgba(0,0,0,.20);flex:none}
.cdh-ava img{width:100%;height:100%;object-fit:cover;display:block}
.cdh-title{flex:1;min-width:0}
.cdh-name{font-size:17px;font-weight:700;letter-spacing:.01em}
.cdh-alias{font-size:11.5px;color:var(--m);margin-top:2px}
.cdh-tag{font-size:12.5px;color:var(--m);margin-top:4px}
.cdh-badges{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
.cdh-sections{position:relative;background:var(--sf);border-top:1px solid var(--bd);
  padding:12px 18px 16px;
  display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.cdh-sec{font-size:12.5px;line-height:1.6;min-width:0}
.cdh-sec>b{display:block;font-size:10.5px;color:var(--f);margin-bottom:5px;letter-spacing:.06em}
.cdh-line{margin-bottom:3px}
.cdh-ex{margin-bottom:7px}
.cdh-ex .u{font-size:11.5px;color:var(--m)}
.cdh-ex .a{margin-top:1px}
.cdh-lore{font-size:11.5px;color:var(--m);margin-bottom:6px;line-height:1.5}
.cdh-lore .k{display:inline-block;margin-right:5px;color:var(--ac)}

.cd-tabs{display:flex;gap:4px;margin:10px 0 0;border-bottom:1px solid var(--bd)}
.cd-tabs button{border:none;background:none;padding:7px 12px;font-size:12.5px;color:var(--m);
  cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
.cd-tabs button.on{border-bottom-color:var(--ac);font-weight:600}
.cd-blk{border:1px solid var(--bd);border-radius:8px;padding:9px 11px;margin-top:10px}
.cd-blk-h{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12.5px}
.cd-blk-h .sp{flex:1}
.cd-item{display:flex;gap:6px;align-items:flex-start;margin-bottom:6px}
.cd-item.col{flex-direction:column}
.cd-item .rcq-ta{flex:1;min-height:52px}
.cd-row2{display:flex;gap:6px;align-items:center;width:100%}
.cd-row2 .input{flex:1;min-width:0}
.cd-x{border:none;background:none;color:var(--m);font-size:15px;line-height:1;cursor:pointer;
  padding:2px 5px;border-radius:4px;font-family:inherit}
.cd-x:hover{background:var(--sf3)}
.rcq-ta.tall{min-height:140px}
`;function If(){if(document.getElementById(dp))return;let e=document.createElement("style");e.id=dp,e.textContent=Mf,document.head.appendChild(e)}var Rf={data(){return{S:yt,ov:null,busy:!1,err:"",timer:null}},computed:{acc(){return this.ov&&this.ov.account||{}},ver(){return this.ov&&this.ov.versions||{}},sysinfo(){return this.ov&&this.ov.sys||{}},cpu(){return this.sysinfo.cpu||{}},mem(){return this.sysinfo.memory||{}},cnt(){return this.ov&&this.ov.counters||{}},botst(){return this.ov&&this.ov.bot||null},vers(){let e=this.ver;return[["\u6846\u67B6\u7248\u672C",e.framework],["QQ \u7248\u672C",e.qq],["OneBot \u7248\u672C",e.webui]]},cpuPct(){let e=parseFloat((this.cpu.usage||{}).system);return isNaN(e)?0:Math.min(100,Math.round(e))},memPct(){let e=parseFloat(this.mem.total),t=parseFloat((this.mem.usage||{}).system);return!e||!t?0:Math.min(100,Math.round(t/e*100))},online(){return!!this.acc.login&&!this.acc.offline}},async mounted(){await this.load(),this.timer=setInterval(()=>this.load(!0),5e3)},beforeUnmount(){this.timer&&clearInterval(this.timer)},methods:{fmtNum:rn,async load(e){e||(this.busy=!0);try{this.ov=await Ue("qqbot.overview"),this.err=(this.ov.errors||[]).join("\uFF1B")}catch(t){this.err=le(t)}finally{this.busy=!1}},dash(e){return 264-264*e/100},accAvatar(e){if(e.avatar)return e.avatar;let t=String(e&&e.uin||"");return/^\d{5,12}$/.test(t)?"https://q1.qlogo.cn/g?b=qq&nk="+t+"&s=100":""}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-ov">
      <div>
        <div class="rcq-pnl flat">
          <div class="rcq-acct">
            <img class="rcq-ava" :src="accAvatar(acc)" alt="" v-if="accAvatar(acc)" />
            <div class="rcq-ava" v-else></div>
            <div style="min-width:0">
              <div class="rcq-nick">
                {{ acc.nick || '\u672A\u767B\u5F55' }}
                <span class="rcq-dot" :class="online ? 'on' : 'off'"></span>
              </div>
              <div class="rcq-uin">{{ acc.uin || '\u2014' }}</div>
            </div>
          </div>
          <div class="rcq-sec">
            <div class="rcq-ph" style="margin-bottom:10px"><b>\u7CFB\u7EDF\u4FE1\u606F</b></div>
            <div class="rcq-kv">
              <template v-for="row in vers" :key="row[0]">
                <div class="k">{{ row[0] }}</div><div class="v">{{ row[1] || '\u2014' }}</div>
              </template>
              <div class="k">\u7CFB\u7EDF\u7248\u672C</div><div class="v">{{ sysinfo.arch || '\u2014' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="rcq-pnl">
          <div class="rcq-ph"><b>CPU</b><span class="sp"></span>
            <span class="rcq-hint">{{ busy ? '\u5237\u65B0\u4E2D\u2026' : '' }}</span></div>
          <div class="rcq-fld full"><span class="k">\u578B\u53F7</span><span class="v">{{ cpu.model || '\u2014' }}</span></div>
          <div class="rcq-row2">
            <div class="rcq-fld"><span class="k">\u5185\u6838\u6570</span><span class="v">{{ cpu.core || '\u2014' }}</span></div>
            <div class="rcq-fld"><span class="k">\u4E3B\u9891</span><span class="v">{{ cpu.speed ? cpu.speed + ' GHz' : '\u2014' }}</span></div>
            <div class="rcq-fld"><span class="k">\u4F7F\u7528\u7387</span><span class="v">{{ (cpu.usage||{}).system || '\u2014' }}%</span></div>
            <div class="rcq-fld"><span class="k">QQ\u4E3B\u7EBF\u7A0B</span><span class="v">{{ (cpu.usage||{}).qq || '\u2014' }}%</span></div>
          </div>
          <div class="rcq-sec">
            <div class="rcq-ph" style="margin-bottom:10px"><b>\u5185\u5B58</b></div>
            <div class="rcq-fld full"><span class="k">\u603B\u91CF</span><span class="v">{{ mem.total ? mem.total + ' MB' : '\u2014' }}</span></div>
            <div class="rcq-row2">
              <div class="rcq-fld"><span class="k">\u4F7F\u7528\u91CF</span><span class="v">{{ (mem.usage||{}).system ? (mem.usage||{}).system + ' MB' : '\u2014' }}</span></div>
              <div class="rcq-fld"><span class="k">QQ\u4E3B\u7EBF\u7A0B</span><span class="v">{{ (mem.usage||{}).qq ? (mem.usage||{}).qq + ' MB' : '\u2014' }}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="rcq-gauges">
        <div class="rcq-gauge">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--sf3)" stroke-width="9" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--ac)" stroke-width="9"
              stroke-linecap="round" :stroke-dasharray="264" :stroke-dashoffset="dash(cpuPct)"
              transform="rotate(-90 50 50)" />
          </svg>
          <div class="lbl"><b>{{ cpuPct }}%</b><span>CPU \u5360\u7528</span></div>
        </div>
        <div class="rcq-gauge">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--sf3)" stroke-width="9" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--ac)" stroke-width="9"
              stroke-linecap="round" :stroke-dasharray="264" :stroke-dashoffset="dash(memPct)"
              transform="rotate(-90 50 50)" />
          </svg>
          <div class="lbl"><b>{{ memPct }}%</b><span>\u5185\u5B58\u5360\u7528</span></div>
        </div>
      </div>
    </div>

    <div class="rcq-counters" style="grid-template-columns:repeat(4,1fr)">
      <div class="rcq-ct"><b>{{ cnt.groups || 0 }}</b><span>\u7FA4\u804A</span></div>
      <div class="rcq-ct"><b>{{ cnt.friends || 0 }}</b><span>\u597D\u53CB</span></div>
      <div class="rcq-ct"><b>{{ cnt.sessions || 0 }}</b><span>\u4F1A\u8BDD</span></div>
      <div class="rcq-ct"><b>{{ cnt.messages || 0 }}</b><span>\u6D88\u606F</span></div>
    </div>

    <div class="rcq-pnl">
      <div class="rcq-ph"><b>RainCough Bot</b><span class="sp"></span>
        <span class="rcq-lamp" v-if="botst"><b :class="botst.onebot && botst.onebot.connected ? 'on' : 'off'"></b>
          {{ botst.onebot && botst.onebot.connected ? '\u5DF2\u8FDE SnowLuma' : '\u672A\u8FDE\u63A5' }}</span>
        <span class="rcq-lamp" v-else><b class="off"></b>rcbot \u672A\u8FD0\u884C</span>
      </div>
      <div class="rcq-row2" style="margin-top:0">
        <div class="rcq-fld"><span class="k">\u63D0\u4F9B\u5546</span><span class="v">{{ (botst && botst.provider) || '\u2014' }}</span></div>
        <div class="rcq-fld"><span class="k">\u6A21\u578B</span><span class="v">{{ (botst && botst.provider_model) || '\u2014' }}</span></div>
        <div class="rcq-fld"><span class="k">\u4F1A\u8BDD</span><span class="v">{{ botst && botst.stats ? botst.stats.sessions : '\u2014' }} \u4E2A / \u6D88\u606F {{ botst && botst.stats ? fmtNum(botst.stats.messages) : '\u2014' }} \u6761</span></div>
        <div class="rcq-fld"><span class="k">\u4E0A\u4E0B\u6587</span><span class="v">{{ (botst && botst.context && botst.context.max_tokens) ? (botst.context.max_tokens + ' tokens \u7A97\u53E3') : '\u2014' }}</span></div>
      </div>
      <div class="rcq-fld" style="margin-top:10px" v-if="botst && botst.last_error">
        <span class="k">\u6700\u8FD1\u9519\u8BEF</span>
        <span class="v rcq-err" :title="botst.last_error">{{ botst.last_error }}</span>
      </div>
    </div>
  </div>`},Of={data(){return{S:yt,acc:null,busy:"",err:"",vncBusy:!1,loginOpen:!1,msg:"",vncErr:"",novncUrl:"",novncPw:""}},computed:{login(){return!!(this.acc&&this.acc.login)},ready(){return!!(this.acc&&this.acc.core_ready)},online(){return!!(this.acc&&(this.acc.online||this.acc.connected))},uin(){return this.acc&&this.acc.uin||""},nick(){return this.acc&&this.acc.nick||""},avatar(){if(this.acc&&this.acc.avatar)return this.acc.avatar;let e=this.uin;return/^\d{5,12}$/.test(e)?"https://q1.qlogo.cn/g?b=qq&nk="+e+"&s=100":""},statusText(){if(!this.acc)return"\u672A\u77E5";if(this.online&&this.ready)return"\u5DF2\u767B\u5F55";if(this.acc.login)return"\u5DF2\u767B\u5F55\uFF08\u521D\u59CB\u5316\u4E2D\uFF09";let e=this.acc.state||"";return e==="failed"?"\u542F\u52A8\u5931\u8D25":e==="inactive"||e==="exited"?"\u5DF2\u505C\u6B62":e==="active"||e==="running"?"\u8FD0\u884C\u4E2D\uFF08\u672A\u767B\u5F55\uFF09":e==="absent"?"\u672A\u90E8\u7F72":e||"\u672A\u77E5"},statusCls(){return this.online&&this.ready?"ok":this.acc&&this.acc.state==="failed"?"off":""}},async mounted(){await this.load(),this.timer=setInterval(()=>this.load(!0),5e3)},beforeUnmount(){this.timer&&clearInterval(this.timer)},methods:{async load(e){e||(this.busy="load");try{this.acc=await ue("qqbot.account.info"),this.err=this.acc&&this.acc.error||"",this.loginOpen&&this.acc&&!this.acc.login&&this.pollStatus(0)}catch(t){this.err=le(t)}finally{this.busy=""}},buildNovnc(e){if(!e||!e.novnc_path)return"";let t=location.hostname;return(!t||t==="localhost")&&(t="127.0.0.1"),location.protocol+"//"+t+":"+(e.novnc_port||6081)+e.novnc_path},async showLogin(){this.vncBusy=!0,this.vncErr="",this.msg="",this.novncUrl="",this.loginOpen=!0;try{let e=await ue("qqbot.account.qrcode",{});if(e&&e.login){this.msg="\u5DF2\u7ECF\u767B\u5F55\u4E86\uFF1A"+(e.nick||e.uin),await this.load(!0);return}this.novncUrl=this.buildNovnc(e||{}),this.novncPw=e&&e.novnc_password||"",this.novncUrl||(this.vncErr="\u8FDC\u7A0B\u684C\u9762\u5730\u5740\u6CA1\u62FC\u51FA\u6765\uFF08\u7F3A noVNC \u7AEF\u53E3\u6216\u8DEF\u5F84\uFF09"),this.pollStatus(0)}catch(e){this.vncErr=le(e)}finally{this.vncBusy=!1}},pollStatus(e){e>100||!this.loginOpen||setTimeout(async()=>{if(this.loginOpen){try{let t=await ue("qqbot.account.status",{});if(t&&t.done){this.msg="\u767B\u5F55\u6210\u529F\uFF1A"+(t.nick||t.uin)+"\uFF08"+t.uin+"\uFF09",X("\u5DF2\u767B\u5F55 "+t.uin,"ok"),await this.load(!0),setTimeout(()=>{this.loginOpen=!1},1200);return}t&&t.error?this.msg=t.error:t&&t.phase==="waiting_qrcode"&&(this.msg="\u8BF7\u5728\u8FDC\u7A0B\u684C\u9762\u91CC\u7528\u624B\u673A QQ \u626B\u7801\u2026")}catch(t){this.msg=le(t)}this.pollStatus(e+1)}},3e3)},async act(e){this.busy=e;try{let t={start:"\u5DF2\u542F\u52A8",stop:"\u5DF2\u505C\u6B62",restart:"\u5DF2\u91CD\u542F",logout:"\u5DF2\u9000\u51FA\u767B\u5F55"}[e]||"\u5DF2\u6267\u884C";if(e==="logout"&&!confirm("\u9000\u51FA\u767B\u5F55\u4F1A\u6E05\u6389\u672C\u673A\u7684\u767B\u5F55\u6001\uFF0C\u4E0B\u6B21\u8981\u91CD\u65B0\u626B\u7801\u3002\u786E\u5B9A\uFF1F"))return;await Ue("qqbot.account.action",{action:e}),X(t,"ok"),this.loginOpen=!1,await this.load(!0)}catch(t){X(le(t),"err")}finally{this.busy=""}},closeLogin(){this.loginOpen=!1,this.msg="",this.novncUrl="",this.vncErr=""}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-pnl">
      <div class="rcq-ph">
        <b>QQ \u8D26\u6237</b>
        <span class="rcq-hint">SnowLuma \xB7 \u5355\u8D26\u6237</span>
        <span class="sp"></span>
        <button class="btn btn-sm btn-primary" :disabled="vncBusy" @click="showLogin()">
          {{ vncBusy ? '\u51C6\u5907\u4E2D\u2026' : (login ? '\u91CD\u65B0\u767B\u5F55' : '\u626B\u7801\u767B\u5F55') }}
        </button>
        <button class="btn btn-sm" :disabled="!!busy" @click="load()">\u5237\u65B0</button>
      </div>

      <div class="rcq-acct" style="padding:16px">
        <img class="rcq-ava" :src="avatar" alt="" v-if="avatar" />
        <div class="rcq-ava" v-else></div>
        <div style="min-width:0;flex:1">
          <div class="rcq-nick">
            {{ nick || (uin ? 'QQ ' + uin : '\u672A\u767B\u5F55') }}
            <span class="rcq-pill" :class="statusCls">{{ statusText }}</span>
          </div>
          <div class="rcq-uin">{{ uin || '\u8FD8\u6CA1\u6709\u767B\u5F55 QQ \u8D26\u53F7' }}</div>
        </div>
      </div>

      <div class="rcq-iacts" style="margin-top:12px">
        <button class="btn btn-sm" :disabled="!!busy" @click="act('start')">\u542F\u52A8</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="act('restart')">\u91CD\u542F</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="act('stop')">\u505C\u6B62</button>
        <button class="btn btn-sm" :disabled="!!busy || !login" @click="act('logout')">\u9000\u51FA\u767B\u5F55</button>
      </div>

      <div v-if="loginOpen" class="rcq-scan">
        <div class="rcq-vncbar">
          <b>\u8FDC\u7A0B\u684C\u9762</b>
          <span class="rcq-hint">\u5728\u4E0B\u9762\u7684\u753B\u9762\u91CC\u7528\u624B\u673A QQ \u626B\u7801\u767B\u5F55</span>
          <span class="sp"></span>
          <a v-if="novncUrl" :href="novncUrl" target="_blank" rel="noopener"
            class="btn btn-sm">\u65B0\u7A97\u53E3\u6253\u5F00</a>
          <button class="btn btn-sm" @click="closeLogin()">\u5173\u95ED</button>
        </div>
        <div v-if="novncUrl" class="rcq-vncwrap">
          <iframe :src="novncUrl" class="rcq-vnc" allow="clipboard-read; clipboard-write"
            referrerpolicy="no-referrer"></iframe>
        </div>
        <div v-else class="rcq-empty2">
          {{ vncErr || (vncBusy ? '\u6B63\u5728\u542F\u52A8\u5BB9\u5668\u4E0E\u8FDC\u7A0B\u684C\u9762\u2026' : '\u8FDC\u7A0B\u684C\u9762\u8FD8\u6CA1\u51C6\u5907\u597D') }}
        </div>
        <div class="rcq-note" style="display:block;margin-top:8px">
          \u753B\u9762\u662F SnowLuma \u5BB9\u5668\u91CC\u7684 QQ \u684C\u9762\uFF0C\u53EF\u4EE5\u76F4\u63A5\u7528\u9F20\u6807\u64CD\u4F5C\u3002
          <br />
          <b>\u5982\u679C\u4E8C\u7EF4\u7801\u663E\u793A\u300C\u5DF2\u8FC7\u671F\u300D\uFF0C\u70B9\u753B\u9762\u91CC\u90A3\u4E2A\u300C\u5237\u65B0\u300D\u6309\u94AE</b>\uFF1B
          \u9996\u6B21\u542F\u52A8\u8981\u7B49 10~30 \u79D2\u5BB9\u5668\u8D77\u6765\u3002
          <br />
          \u5982\u679C\u8FD9\u91CC\u662F\u7A7A\u767D\uFF0C\u8BF4\u660E\u6D4F\u89C8\u5668\u4E0D\u5141\u8BB8\u5185\u5D4C \u2014\u2014 \u70B9\u53F3\u4E0A\u89D2\u300C\u65B0\u7A97\u53E3\u6253\u5F00\u300D\u3002
          <template v-if="novncPw">
            <br />\u8FDC\u7A0B\u684C\u9762\u5BC6\u7801\uFF1A<code>{{ novncPw }}</code>\uFF08\u65B0\u7A97\u53E3\u6253\u5F00\u65F6\u53EF\u80FD\u8981\u8F93\uFF09
          </template>
        </div>
        <div v-if="msg" style="margin-top:8px;font-size:12px">{{ msg }}</div>
      </div>

      <div class="rcq-note" style="margin-top:14px">
        \u672C\u63D2\u4EF6\u662F\u5355\u8D26\u6237\u6A21\u5F0F\uFF1A\u53EA\u7BA1\u7406\u4E00\u4E2A QQ \u53F7\u3002
        <br />
        <b>SnowLuma</b> \u628A QQ \u6574\u5305\u8DD1\u5728 Docker \u91CC\uFF0C\u767B\u5F55\u8981\u5728\u5185\u5D4C\u7684\u8FDC\u7A0B\u684C\u9762\u91CC\u626B\u7801
        \uFF08QQ \u5BA2\u6237\u7AEF\u81EA\u5DF1\u753B\u4E8C\u7EF4\u7801\uFF0C\u6CA1\u6709 API \u80FD\u5355\u72EC\u53D6\u51FA\u6765\uFF09\u3002
        <br />
        \u6362\u53F7\u65F6\u70B9\u300C\u9000\u51FA\u767B\u5F55\u300D\u6E05\u6389\u767B\u5F55\u6001\uFF0C\u518D\u91CD\u65B0\u626B\u7801\u5373\u53EF\u3002
      </div>
    </div>
  </div>`},Pf={data(){return{S:yt,items:[],stats:null,kind:"",sender:"",kw:"",limit:60,offset:0,hasMore:!1,busy:"",err:"",light:"",lightKind:"",picked:{}}},computed:{kindStats(){let e={};for(let t of(this.stats||{}).items||[])e[t.kind]=t;return e},totalBytes(){return(this.stats||{}).total_bytes||0},totalFiles(){return(this.stats||{}).total_files||0},pickedIds(){return Object.keys(this.picked).filter(e=>this.picked[e]).map(e=>Number(e))},pendingCount(){return this.items.filter(e=>e.transcode==="pending").length}},async mounted(){await this.load()},methods:{fmtFull:hp,fmtNum:rn,mediaAlive:mp,bytes(e){return e=Number(e)||0,e>=1073741824?(e/1073741824).toFixed(2)+" G":e>=1048576?(e/1048576).toFixed(1)+" M":e>=1024?(e/1024).toFixed(0)+" K":e+" B"},mediaUrl(e){return fp(e)},kindLabel(e){return{image:"\u56FE\u7247",video:"\u89C6\u9891",record:"\u8BED\u97F3",face:"\u8868\u60C5",file:"\u6587\u4EF6"}[e]||e||"\u5176\u5B83"},kindIcon(e){return{image:"\u{1F5BC}",video:"\u{1F3AC}",record:"\u{1F3A4}",face:"\u{1F600}",file:"\u{1F4CE}"}[e]||"\u{1F4C4}"},async load(e){this.busy="load";try{let t=await ue("qqbot.chat.media_list",{kind:this.kind,sender:this.sender,kw:this.kw,limit:this.limit,offset:e?this.offset:0}),i=t&&t.items||[];this.items=e?this.items.concat(i):i,this.stats=t&&t.stats||this.stats,this.offset=this.items.length,this.hasMore=i.length>=this.limit}catch(t){this.err=le(t)}finally{this.busy=""}},async reload(){this.offset=0,this.picked={},await this.load(!1)},async purgeAll(){if(confirm(`\u6E05\u7406\u5A92\u4F53\u526F\u672C\uFF1F

\u53EA\u5220\u56FE\u7247/\u8BED\u97F3/\u89C6\u9891\u8FD9\u4E9B\u5A92\u4F53\u6587\u4EF6\uFF0C\u804A\u5929\u8BB0\u5F55\u6587\u5B57\u4E00\u6761\u4E0D\u5220\u3002`)){this.busy="purge";try{let e=await ue("qqbot.chat.purge_media",{confirm:!0});X("\u5DF2\u6E05\u7406 "+(e&&e.files||0)+" \u4E2A\u6587\u4EF6\uFF0C\u91CA\u653E "+this.bytes(e&&e.bytes||0),"ok"),await this.reload()}catch(e){X(le(e),"err")}finally{this.busy=""}}},async loadMore(){await this.load(!0)},toggle(e){this.picked[e]=!this.picked[e]},pickAll(){let e=this.items.every(i=>this.picked[i.id]),t={};if(!e)for(let i of this.items)t[i.id]=!0;this.picked=t},open(e){this.lightKind=e.kind,this.light=this.mediaUrl(e)},async transcode(){let e=this.pickedIds.length?this.pickedIds:null;if(!(!e&&!confirm(`\u628A\u5A92\u4F53\u5E93\u91CC\u6240\u6709\u300C\u6D4F\u89C8\u5668\u653E\u4E0D\u4E86\u300D\u7684\u89C6\u9891/\u8BED\u97F3\u8F6C\u6210\u53EF\u64AD\u653E\u683C\u5F0F\uFF1F

\u89C6\u9891\u7F16\u7801\u8F6C\u6362\u6BD4\u8F83\u6162\uFF0C\u8BF7\u52FF\u4E2D\u65AD\u9762\u677F\u3002`))){this.busy="transcode";try{let t=await ue("qqbot.chat.media_transcode",e?{ids:e}:{});X("\u8F6C\u7801\u5B8C\u6210\uFF1A\u6210\u529F "+(t.ok||0)+"\uFF0C\u5931\u8D25 "+(t.failed||0),"ok"),await this.reload()}catch(t){X(le(t),"err")}finally{this.busy=""}}},async remove(){let e=this.pickedIds;if(!e.length){X("\u5148\u52FE\u9009\u8981\u5220\u9664\u7684\u5A92\u4F53","err");return}if(confirm("\u5220\u9664\u9009\u4E2D\u7684 "+e.length+` \u4E2A\u5A92\u4F53\u6587\u4EF6\uFF1F

\u78C1\u76D8\u4E0A\u7684\u6587\u4EF6\u4F1A\u771F\u7684\u5220\u6389\uFF0C\u804A\u5929\u8BB0\u5F55\u91CC\u7684\u4F4D\u7F6E\u4F1A\u53D8\u6210\u300C\u5DF2\u5931\u6548\u300D\u3002`)){this.busy="del";try{let t=await ue("qqbot.chat.media_delete",{ids:e,confirm:!0});X("\u5DF2\u5220\u9664 "+(t.files||0)+" \u4E2A\u6587\u4EF6\uFF0C\u91CA\u653E "+this.bytes(t.bytes||0),"ok"),await this.reload()}catch(t){X(le(t),"err")}finally{this.busy=""}}},async reindex(){this.busy="reindex";try{let e=await ue("qqbot.chat.media_reindex",{});X("\u5DF2\u91CD\u5EFA\u7D22\u5F15\uFF1A"+(e.indexed||0)+" \u4E2A\u5A92\u4F53"+(e.cleaned?"\uFF0C\u6E05\u7406\u50F5\u5C38 "+e.cleaned:""),"ok"),await this.reload()}catch(e){X(le(e),"err")}finally{this.busy=""}},async repair(){this.busy="repair";try{let e=await ue("qqbot.chat.media_repair",{});X("\u5DF2\u4FEE\u590D "+(e.fixed||0)+" \u6761\u6D88\u606F\u7684\u5A92\u4F53\u5F15\u7528","ok"),await this.reload()}catch(e){X(le(e),"err")}finally{this.busy=""}}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-pnl">
      <div class="rcq-flex">
        <div class="rcq-fld"><span class="k">\u5A92\u4F53\u603B\u6570</span>
          <span class="v">{{ fmtNum(totalFiles) }} \u4E2A</span></div>
        <div class="rcq-fld"><span class="k">\u5360\u7528\u7A7A\u95F4</span>
          <span class="v">{{ bytes(totalBytes) }}</span></div>
        <div class="rcq-fld" v-for="s in (stats || {}).items || []" :key="s.kind">
          <span class="k">{{ kindLabel(s.kind) }}</span>
          <span class="v">{{ s.count }} \u4E2A \xB7 {{ bytes(s.bytes) }}</span></div>
        <span class="sp" style="margin-left:auto"></span>
        <button class="btn btn-sm" :disabled="!!busy" @click="reindex">\u91CD\u5EFA\u7D22\u5F15</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="repair">\u4FEE\u590D\u5F15\u7528</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="transcode">
          {{ busy === 'transcode' ? '\u8F6C\u7801\u4E2D\u2026' : '\u8F6C\u6210\u53EF\u64AD\u653E\u683C\u5F0F' }}
        </button>
        <button class="btn btn-sm" :disabled="!!busy || !pickedIds.length" @click="remove">
          \u5220\u9664\u9009\u4E2D{{ pickedIds.length ? '\uFF08' + pickedIds.length + '\uFF09' : '' }}
        </button>
        <button class="btn btn-sm" :disabled="!!busy" @click="purgeAll">
          {{ busy === 'purge' ? '\u6E05\u7406\u4E2D\u2026' : '\u6E05\u7406\u5A92\u4F53\u526F\u672C' }}
        </button>
      </div>
      <div class="rcq-note">
        \u5A92\u4F53\u5E93\u91CC\u5B58\u7684\u662F\u804A\u5929\u8BB0\u5F55\u91CC\u7684\u56FE\u7247 / \u89C6\u9891 / \u8BED\u97F3\u526F\u672C\u3002
        QQ \u7684\u89C6\u9891\u591A\u662F HEVC\u3001\u8BED\u97F3\u662F AMR\uFF0C\u6D4F\u89C8\u5668\u653E\u4E0D\u4E86 \u2014\u2014
        \u70B9\u300C\u8F6C\u6210\u53EF\u64AD\u653E\u683C\u5F0F\u300D\u4F1A\u81EA\u52A8\u8F6C\u6210 H.264 \u89C6\u9891\u4E0E mp3 \u8BED\u97F3\u3002
      </div>
    </div>

    <div class="rcq-pnl">
      <div class="rcq-flex">
        <label class="rcq-fi" style="margin:0">
          <span>\u7C7B\u578B</span>
          <select class="input" v-model="kind" @change="reload()">
            <option value="">\u5168\u90E8</option>
            <option value="image">\u56FE\u7247</option>
            <option value="video">\u89C6\u9891</option>
            <option value="record">\u8BED\u97F3</option>
            <option value="face">\u8868\u60C5</option>
            <option value="file">\u6587\u4EF6</option>
          </select>
        </label>
        <label class="rcq-fi" style="margin:0">
          <span>\u53D1\u9001\u8005</span>
          <input class="input" v-model="sender" placeholder="QQ \u53F7\u6216\u6635\u79F0"
            @keyup.enter="reload()" />
        </label>
        <label class="rcq-fi" style="margin:0">
          <span>\u5173\u952E\u8BCD</span>
          <input class="input" v-model="kw" placeholder="\u6587\u4EF6\u540D" @keyup.enter="reload()" />
        </label>
        <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="reload">\u7B5B\u9009</button>
        <button class="btn btn-sm" @click="pickAll()">
          {{ pickedIds.length === items.length && items.length ? '\u53D6\u6D88\u5168\u9009' : '\u5168\u9009\u672C\u9875' }}
        </button>
      </div>
    </div>

    <div v-if="!items.length" class="rcq-empty2">\u8FD8\u6CA1\u6709\u5A92\u4F53\u6587\u4EF6</div>
    <div v-else class="rcq-mlib">
      <div v-for="m in items" :key="m.id" class="rcq-mcard"
        :class="{ on: picked[m.id], gone: !m.exists }">
        <label class="ck" @click.stop>
          <input type="checkbox" :checked="!!picked[m.id]" @change="toggle(m.id)" />
        </label>
        <div class="th" @click="m.exists ? open(m) : null">
          <img v-if="m.exists && (m.kind === 'image' || m.kind === 'face')" :src="mediaUrl(m)"
            loading="lazy" alt="" />
          <!-- preload="metadata"\uFF1A\u53EA\u53D6 moov + \u9996\u5E27\uFF0C\u80FD\u663E\u793A\u7F29\u7565\u56FE\u53C8\u4E0D\u4F1A\u62C9\u6574\u4E2A\u89C6\u9891 -->
          <video v-else-if="m.exists && m.kind === 'video'" :src="mediaUrl(m)" preload="metadata"
            muted playsinline></video>
          <div v-else class="ph">{{ kindIcon(m.kind) }}</div>
          <span v-if="m.transcode === 'pending'" class="rcq-badge warn">\u8F6C\u7801\u4E2D</span>
          <span v-else-if="m.transcode === 'failed'" class="rcq-badge bad">\u683C\u5F0F\u4E0D\u652F\u6301</span>
          <span v-else-if="!m.exists" class="rcq-badge bad">\u5DF2\u4E22\u5931</span>
        </div>
        <div class="meta">
          <div class="n">{{ kindLabel(m.kind) }} \xB7 {{ bytes(m.bytes) }}</div>
          <div class="s">{{ m.sender_name || m.sender_id || '\u672A\u77E5' }}</div>
          <div class="t">{{ fmtFull(m.created_at) }}</div>
        </div>
        <a class="dl" v-if="m.exists" :href="mediaUrl(m)" download>\u4E0B\u8F7D</a>
        <span class="dl gone" v-else>\u6587\u4EF6\u5DF2\u4E22\u5931</span>
      </div>
    </div>
    <div v-if="hasMore" class="rcq-loadmore" @click="loadMore()">\u52A0\u8F7D\u66F4\u591A</div>

    <div v-if="light" class="rcq-light" @click="light = ''">
      <button class="x" @click.stop="light = ''">\xD7</button>
      <img v-if="lightKind === 'image' || lightKind === 'face'" :src="light" alt="" />
      <video v-else-if="lightKind === 'video'" :src="light" controls autoplay
        style="max-width:100%;max-height:100%"></video>
      <audio v-else-if="lightKind === 'record'" :src="light" controls autoplay
        style="width:min(520px,90vw)"></audio>
      <a v-else :href="light" download style="color:#fff">\u4E0B\u8F7D\u6587\u4EF6</a>
    </div>
  </div>`},Lf={data(){return{S:yt,items:[],senders:[],total:0,sender:"",recalled:"",kind:"",kw:"",limit:50,beforeId:0,more:!1,busy:"",err:"",light:"",lightKind:"",showSenders:!1}},computed:{filtersOn(){return!!(this.sender||this.recalled||this.kind||this.kw)},recalledOpts(){return[{v:"",t:"\u5168\u90E8"},{v:"no",t:"\u672A\u64A4\u56DE"},{v:"yes",t:"\u5DF2\u64A4\u56DE"}]},kindOpts(){return[{v:"",t:"\u5168\u90E8"},{v:"text",t:"\u6587\u672C"},{v:"image",t:"\u56FE\u7247"},{v:"video",t:"\u89C6\u9891"},{v:"record",t:"\u8BED\u97F3"},{v:"face",t:"\u8868\u60C5"},{v:"file",t:"\u6587\u4EF6"}]},suggest(){let e=String(this.sender||"").trim().toLowerCase();return e?this.senders.filter(t=>{let i=String(t.sender_id||""),s=String(t.sender_name||"");return i.indexOf(e)>=0||s.toLowerCase().indexOf(e)>=0}).slice(0,8):[]}},async mounted(){await this.loadSenders(),await this.search(!1)},methods:{fmtFull:hp,fmtNum:rn,mediaAlive:mp,bytes(e){return e=Number(e)||0,e>=1048576?(e/1048576).toFixed(1)+" M":e>=1024?(e/1024).toFixed(0)+" K":e+" B"},mediaUrl(e){return fp(e)},kindLabel(e){return{image:"\u56FE\u7247",video:"\u89C6\u9891",record:"\u8BED\u97F3",face:"\u8868\u60C5",file:"\u6587\u4EF6"}[e]||e||"\u5176\u5B83"},async loadSenders(){try{let e=await ue("qqbot.chat.senders",{});this.senders=e&&e.items||[]}catch{}},async search(e){this.busy="search";try{let t=await ue("qqbot.chat.query",{sender:this.sender,recalled:this.recalled,kind:this.kind,kw:this.kw,limit:this.limit,before_id:e?this.beforeId:0}),i=t&&t.items||[];this.items=e?this.items.concat(i):i,this.total=t&&t.total||this.items.length,this.beforeId=i.length?i[i.length-1].id:0,this.more=i.length>=this.limit}catch(t){this.err=le(t)}finally{this.busy=""}},async reload(){this.beforeId=0,await this.search(!1)},async loadMore(){await this.search(!0)},pickSender(e){this.sender=e.sender_id||e.sender_name||"",this.showSenders=!1,this.reload()},clearFilters(){this.sender="",this.recalled="",this.kind="",this.kw="",this.reload()},openMedia(e){this.lightKind=e.kind,this.light=this.mediaUrl(e)},kindsOf(e){let t=[];for(let i of e.media||[]){let s=i.kind||"";s&&t.indexOf(s)<0&&t.push(s)}return t}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-pnl">
      <div class="rcq-flex" style="align-items:flex-end;flex-wrap:wrap;gap:8px">
        <label class="rcq-fi" style="margin:0;position:relative">
          <span>QQ \u7528\u6237</span>
          <input class="input" v-model="sender" placeholder="QQ \u53F7\u6216\u6635\u79F0"
            @focus="showSenders = true" @keyup.enter="reload()" />
          <div v-if="showSenders && suggest.length" class="rcq-sugg">
            <div v-for="x in suggest" :key="x.sender_id" class="rcq-sugg-i"
              @click="pickSender(x)">
              <img v-if="x.avatar" :src="x.avatar" alt="" />
              <b>{{ x.sender_name || x.sender_id }}</b>
              <span>{{ x.sender_id }}</span>
              <i>{{ x.c }} \u6761</i>
            </div>
          </div>
        </label>

        <label class="rcq-fi" style="margin:0">
          <span>\u64A4\u56DE\u72B6\u6001</span>
          <select class="input" v-model="recalled" @change="reload()">
            <option v-for="o in recalledOpts" :key="o.v" :value="o.v">{{ o.t }}</option>
          </select>
        </label>

        <label class="rcq-fi" style="margin:0">
          <span>\u6D88\u606F\u7C7B\u578B</span>
          <select class="input" v-model="kind" @change="reload()">
            <option v-for="o in kindOpts" :key="o.v" :value="o.v">{{ o.t }}</option>
          </select>
        </label>

        <label class="rcq-fi" style="margin:0">
          <span>\u5173\u952E\u8BCD</span>
          <input class="input" v-model="kw" placeholder="\u6D88\u606F\u5185\u5BB9" @keyup.enter="reload()" />
        </label>

        <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="reload">
          {{ busy === 'search' ? '\u67E5\u8BE2\u4E2D\u2026' : '\u67E5\u8BE2' }}
        </button>
        <button class="btn btn-sm" v-if="filtersOn" @click="clearFilters">\u6E05\u7A7A\u6761\u4EF6</button>
      </div>
      <div class="rcq-note">
        \u5404\u4E2A\u6761\u4EF6\u53EF\u4EE5\u53E0\u52A0\u4F7F\u7528 \u2014\u2014 \u6BD4\u5982\u300C\u67E5\u67D0\u4E2A QQ \u53F7\u7684\u3001\u5DF2\u64A4\u56DE\u7684\u89C6\u9891\u300D\u3002
        \u64A4\u56DE\u72B6\u6001\u3001\u6D88\u606F\u7C7B\u578B\u3001QQ \u7528\u6237\u3001\u5173\u952E\u8BCD\u662F\u300C\u4E0E\u300D\u7684\u5173\u7CFB\u3002
      </div>
    </div>

    <div class="rcq-pnl" v-if="items.length">
      <div class="rcq-flex">
        <span class="rcq-hint">\u547D\u4E2D {{ fmtNum(total) }} \u6761</span>
      </div>
    </div>

    <div v-if="!items.length && !busy" class="rcq-empty2">
      \u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u6D88\u606F
    </div>

    <div class="rcq-qres">
      <div v-for="m in items" :key="m.id" class="rcq-qrow"
        :class="{ rec: m.recalled }">
        <div class="hd">
          <img v-if="m.sender_avatar || m.sender_id" class="ava"
            :src="m.sender_avatar || ('https://q1.qlogo.cn/g?b=qq&nk=' + m.sender_id + '&s=100')"
            alt="" />
          <b>{{ m.sender_name || m.sender_id }}</b>
          <span class="tt">{{ fmtFull(m.created_at) }}</span>
          <span class="rcq-badge" v-if="m.recalled">\u5DF2\u64A4\u56DE</span>
          <span class="rcq-badge" v-for="k in kindsOf(m)" :key="k">{{ kindLabel(k) }}</span>
          <span class="rcq-badge plain" v-if="m.kind === 'group'">\u7FA4 {{ m.target_id }}</span>
          <span class="rcq-badge plain" v-else>\u79C1\u804A {{ m.target_id }}</span>
        </div>
        <div class="bd">
          <span v-if="m.text && m.text !== '[\u4E00\u6761\u6D88\u606F\u88AB\u64A4\u56DE]'">{{ m.text }}</span>
          <span v-else-if="m.text" style="color:var(--f);font-style:italic">{{ m.text }}</span>
          <div class="rcq-media">
            <template v-for="md in (m.media || [])" :key="md.seg">
              <img v-if="md.kind === 'image' && mediaAlive(md)" :src="mediaUrl(md)"
                @click="openMedia(md)" style="max-width:150px;max-height:150px" />
              <img v-else-if="md.kind === 'face' && mediaAlive(md)" :src="mediaUrl(md)"
                style="width:26px;height:26px" />
              <video v-else-if="md.kind === 'video' && mediaAlive(md)" controls preload="metadata"
                :src="mediaUrl(md)" style="max-width:240px"></video>
              <audio v-else-if="md.kind === 'record' && mediaAlive(md)" controls
                :src="mediaUrl(md)" style="max-width:240px"></audio>
              <a v-else-if="md.local && md.exists !== 0" class="rcq-file"
                :href="mediaUrl(md)" download>
                {{ md.name || (md.kind + ' \u6587\u4EF6') }}
              </a>
              <span v-else class="rcq-note">[{{ md.kind }} \u5DF2\u5931\u6548]</span>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div v-if="more" class="rcq-loadmore" @click="loadMore()">\u52A0\u8F7D\u66F4\u591A</div>

    <div v-if="light" class="rcq-light" @click="light = ''">
      <button class="x" @click.stop="light = ''">\xD7</button>
      <img v-if="lightKind === 'image' || lightKind === 'face'" :src="light" alt="" />
      <video v-else-if="lightKind === 'video'" :src="light" controls autoplay
        style="max-width:100%;max-height:100%"></video>
      <audio v-else-if="lightKind === 'record'" :src="light" controls autoplay
        style="width:min(520px,90vw)"></audio>
      <a v-else :href="light" download style="color:#fff">\u4E0B\u8F7D\u6587\u4EF6</a>
    </div>
  </div>`},Ff={data(){return{S:yt,list:[],def:"",cur:null,busy:"",err:"",dirty:!1,section:"basic",providers:[]}},computed:{isNew(){return!!(this.cur&&this.cur.__new)},themeColor(){return this.cur&&this.cur.style&&this.cur.style.color||""},provName(e){let t=this.providers.find(i=>i.id===e);return t?t.name||t.id:e||"\uFF08\u8DDF\u968F\u8D26\u53F7\u9ED8\u8BA4\uFF09"}},async mounted(){await this.load();try{let e=await ue("rcbot.providers");this.providers=e&&e.items||[]}catch{}},methods:{fmtNum:rn,cloneDeep(e){return JSON.parse(JSON.stringify(e||{}))},grad(e){let t=String(e||""),i=0;for(let s=0;s<t.length;s++)i=(i*31+t.charCodeAt(s))%360;return"linear-gradient(135deg, hsl("+i+" 58% 56%), hsl("+(i+46)%360+" 52% 42%))"},coverStyle(e){let t=this.assetSrc(e,"cover");return t?{backgroundImage:"url("+t+")"}:{backgroundImage:this.grad((e||{}).name)}},assetSrc(e,t){return e&&(e[t+"_url"]||e[t])||""},async load(){this.busy="load";try{let e=await ue("rcbot.cards");if(this.list=e&&e.items||[],this.def=e&&e.default||"",!this.cur||this.cur.__new)!this.cur&&this.list.length&&this.pick(this.list[0]);else{let t=this.list.find(i=>i.id===this.cur.id);t&&!this.dirty&&this.pick(t)}}catch(e){this.err=le(e)}finally{this.busy=""}},pick(e){this.cur=e?this.cloneDeep(e):null,this.dirty=!1},add(){this.cur={schema:2,id:"",version:1,status:"draft",name:"\u65B0\u89D2\u8272",alias:[],tagline:"",avatar:"",cover:"",portrait:"",prompt:"",greetings:[],examples:[],lorebook:[],taboos:[],style:{temperature:.8,max_tokens:512,max_chars:0,allow_emoji:!1,color:""},model:{provider_id:"",model:""},context:{keep_rounds:20},__new:!0},this.dirty=!0},addGreeting(){this.cur&&(this.cur.greetings=this.cur.greetings||[],this.cur.greetings.push(""))},rmGreeting(e){this.cur&&this.cur.greetings&&this.cur.greetings.splice(e,1)},addExample(){this.cur&&(this.cur.examples=this.cur.examples||[],this.cur.examples.push({user:"",assistant:""}))},rmExample(e){this.cur&&this.cur.examples&&this.cur.examples.splice(e,1)},addLore(){this.cur&&(this.cur.lorebook=this.cur.lorebook||[],this.cur.lorebook.push({keys:[],content:""}))},rmLore(e){this.cur&&this.cur.lorebook&&this.cur.lorebook.splice(e,1)},loreKeys(e){return(e.keys||[]).join("\u3001")},setLoreKeys(e,t){e.keys=String(t||"").split(/[、,，\s]+/).filter(Boolean)},taboosText(){return(this.cur&&this.cur.taboos||[]).join(`
`)},setTaboosText(e){this.cur&&(this.cur.taboos=String(e||"").split(`
`).map(t=>t.trim()).filter(Boolean))},async save(){if(!this.cur)return;let e=this.cloneDeep(this.cur);if(!String(e.name||"").trim()){X("\u89D2\u8272\u540D\u5B57\u4E0D\u80FD\u4E3A\u7A7A","err");return}delete e.__new,this.busy="save";try{let t=await ue("rcbot.card.save",{card:e});X("\u5DF2\u4FDD\u5B58","ok"),this.dirty=!1,this.cur=null,await this.load(),t&&t.id&&this.pick(this.list.find(i=>i.id===t.id)||null)}catch(t){X(le(t),"err")}finally{this.busy=""}},async setDefault(e){this.busy="def"+e.id;try{let t=this.cloneDeep(e);t.status="published",await ue("rcbot.card.save",{card:t,set_default:!0}),X("\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u89D2\u8272","ok"),await this.load()}catch(t){X(le(t),"err")}finally{this.busy=""}},async cloneCard(e){this.busy="clone"+e.id;try{let t=await ue("rcbot.card.clone",{id:e.id});X("\u5DF2\u590D\u5236\u4E00\u4EFD","ok"),await this.load(),t&&t.id&&this.pick(this.list.find(i=>i.id===t.id)||null)}catch(t){X(le(t),"err")}finally{this.busy=""}},async del(e){if(confirm("\u5220\u9664\u89D2\u8272\u5361\u7247\u300C"+(e.name||e.id)+`\u300D\uFF1F

\u7528\u5230\u5B83\u7684\u4F1A\u8BDD\u4F1A\u56DE\u843D\u5230\u9ED8\u8BA4\u89D2\u8272\u3002`)){this.busy="del"+e.id;try{await ue("rcbot.card.delete",{id:e.id}),X("\u5DF2\u5220\u9664","ok"),this.cur&&this.cur.id===e.id&&(this.cur=null),await this.load()}catch(t){X(le(t),"err")}finally{this.busy=""}}},async exportJson(e){try{let t=await ue("rcbot.card.export",{id:e.id}),i=new Blob([t&&t.json||JSON.stringify(e,null,2)],{type:"application/json"}),s=document.createElement("a");s.href=URL.createObjectURL(i),s.download="card-"+String(e.name||e.id).replace(/[^\w一-龥-]/g,"_")+".json",s.click(),setTimeout(()=>URL.revokeObjectURL(s.href),3e3),X("\u5DF2\u5BFC\u51FA\u5361\u7247 JSON","ok")}catch(t){X(le(t),"err")}},importJson(){let e=document.createElement("input");e.type="file",e.accept="application/json,.json",e.onchange=async()=>{let t=e.files&&e.files[0];if(t)try{let i=await t.text(),s=await ue("rcbot.card.import",{json:i});X("\u5DF2\u5BFC\u5165\uFF1A"+(s&&s.name||"\u89D2\u8272\u5361\u7247"),"ok"),await this.load(),s&&s.id&&this.pick(this.list.find(n=>n.id===s.id)||null)}catch(i){X(le(i),"err")}},e.click()}},template:`
  <div class="rcq-split">
    <!-- \u5DE6\uFF1A\u5361\u7247\u5217\u8868 -->
    <div class="rcq-pnl flat">
      <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
        <b>\u89D2\u8272\u5361\u7247</b><span class="sp"></span>
        <button class="btn btn-sm" @click="importJson">\u5BFC\u5165</button>
        <button class="btn btn-sm btn-primary" @click="add">\u65B0\u5EFA</button>
      </div>
      <div class="rcq-list cd-grid">
        <div class="cd-card" v-for="c in list" :key="c.id"
          :class="{ on: cur && cur.id === c.id }" @click="pick(c)">
          <div class="cdc-cover" :style="coverStyle(c)">
            <span class="cdc-fallback" v-if="!assetSrc(c, 'cover')">{{ (c.name || '?').slice(0, 1) }}</span>
          </div>
          <img v-if="assetSrc(c, 'avatar')" class="cdc-ava" :src="assetSrc(c, 'avatar')" alt="" />
          <div class="cdc-body">
            <div class="cdc-name">{{ c.name || '\u672A\u547D\u540D' }}</div>
            <div class="cdc-tag">{{ c.tagline || (c.prompt || '').slice(0, 40) }}</div>
            <div class="cdc-badges">
              <span class="cd-tag" v-if="c.id === def">\u9ED8\u8BA4</span>
              <span class="cd-tag draft" v-if="c.status !== 'published'">\u8349\u7A3F</span>
              <span class="cd-tag v">v{{ c.version || 1 }}</span>
            </div>
          </div>
        </div>
        <div v-if="!list.length" class="rcq-empty" style="grid-column:1/-1">
          <b>\u263A</b>\u8FD8\u6CA1\u6709\u89D2\u8272\u5361\u7247\uFF0C\u70B9\u300C\u65B0\u5EFA\u300D\u52A0\u4E00\u4E2A</div>
      </div>
    </div>

    <!-- \u53F3\uFF1A\u5361\u7247\u7F16\u8F91 -->
    <div class="rcq-pnl" v-if="cur">
      <div class="rcq-ph">
        <b>{{ isNew ? '\u65B0\u5EFA\u89D2\u8272\u5361\u7247' : '\u7F16\u8F91\u89D2\u8272\u5361\u7247' }}</b><span class="sp"></span>
        <span class="rcq-hint" v-if="dirty">\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539</span>
        <button class="btn btn-sm" @click="exportJson(cur)">\u5BFC\u51FA</button>
        <button class="btn btn-sm" @click="cloneCard(cur)">\u590D\u5236\u4E00\u4EFD</button>
        <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="save">
          {{ busy === 'save' ? '\u4FDD\u5B58\u4E2D\u2026' : '\u4FDD\u5B58' }}
        </button>
      </div>

      <!-- \u5361\u7247\u672C\u4F53 -->
      <div class="cd-hero" :class="{ grad: !assetSrc(cur, 'cover') }">
        <div class="cdh-cover" :style="coverStyle(cur)"></div>
        <div class="cdh-inner">
          <div class="cdh-ava">
            <img v-if="assetSrc(cur, 'avatar')" :src="assetSrc(cur, 'avatar')" alt="" />
            <span v-else>{{ (cur.name || '?').slice(0, 1) }}</span>
          </div>
          <div class="cdh-title">
            <div class="cdh-name">{{ cur.name || '\u672A\u547D\u540D' }}</div>
            <div class="cdh-alias" v-if="cur.alias && cur.alias.length">{{ cur.alias.join(' / ') }}</div>
            <div class="cdh-tag">{{ cur.tagline || '\uFF08\u8FD8\u6CA1\u6709\u7B80\u4ECB\uFF09' }}</div>
            <div class="cdh-badges">
              <span class="cd-tag" v-if="cur.id === def">\u9ED8\u8BA4\u89D2\u8272</span>
              <span class="cd-tag draft" v-if="cur.status !== 'published'">\u8349\u7A3F</span>
              <span class="cd-tag v">v{{ cur.version || 1 }}</span>
            </div>
          </div>
        </div>
        <div class="cdh-sections" v-if="(cur.greetings || []).length || (cur.examples || []).length || (cur.lorebook || []).length">
          <div class="cdh-sec" v-if="(cur.greetings || []).length">
            <b>\u5F00\u573A\u767D</b>
            <div class="cdh-line" v-for="(g, i) in cur.greetings" :key="'g' + i">\u300C{{ g }}\u300D</div>
          </div>
          <div class="cdh-sec" v-if="(cur.examples || []).length">
            <b>\u793A\u4F8B\u5BF9\u8BDD</b>
            <div class="cdh-ex" v-for="(ex, i) in cur.examples" :key="'e' + i">
              <div class="u">\u203A {{ ex.user }}</div>
              <div class="a">{{ ex.assistant }}</div>
            </div>
          </div>
          <div class="cdh-sec" v-if="(cur.lorebook || []).length">
            <b>\u4E16\u754C\u4E66</b>
            <div class="cdh-lore" v-for="(l, i) in cur.lorebook" :key="'l' + i">
              <span class="k">{{ (l.keys || []).join('\u3001') }}</span>{{ l.content }}
            </div>
          </div>
        </div>
      </div>

      <div class="cd-tabs">
        <button :class="{ on: section === 'basic' }" @click="section = 'basic'">\u5F62\u8C61</button>
        <button :class="{ on: section === 'content' }" @click="section = 'content'">\u5185\u5BB9</button>
        <button :class="{ on: section === 'behavior' }" @click="section = 'behavior'">\u884C\u4E3A</button>
      </div>

      <!-- \u5F62\u8C61 -->
      <div class="rcq-form" v-if="section === 'basic'">
        <label class="rcq-fi wide"><span>\u540D\u79F0</span>
          <input class="input" v-model="cur.name" @input="dirty = true" placeholder="\u4F8B\u5982\uFF1A\u96E8\u54AF" />
        </label>
        <label class="rcq-fi wide"><span>\u4E00\u53E5\u8BDD\u7B80\u4ECB</span>
          <input class="input" v-model="cur.tagline" @input="dirty = true"
            placeholder="\u5217\u8868\u9875\u663E\u793A\u7684\u90A3\u53E5\u8BDD" />
        </label>
        <label class="rcq-fi wide"><span>\u5C01\u9762\u56FE</span>
          <input class="input" v-model="cur.cover" @input="dirty = true"
            placeholder="https://\u2026 \u6216 cards/<\u5361\u7247ID>/cover.jpg" />
        </label>
        <label class="rcq-fi wide"><span>\u5934\u50CF</span>
          <input class="input" v-model="cur.avatar" @input="dirty = true"
            placeholder="https://\u2026 \u6216 cards/<\u5361\u7247ID>/avatar.png" />
        </label>
        <label class="rcq-fi wide"><span>\u7ACB\u7ED8</span>
          <input class="input" v-model="cur.portrait" @input="dirty = true"
            placeholder="https://\u2026 \u6216 cards/<\u5361\u7247ID>/portrait.png" />
        </label>
        <div class="rcq-hint wide" style="width:100%;margin:-4px 0 6px">
          \u586B\u76F8\u5BF9\u5A92\u4F53\u76EE\u5F55\u7684\u8DEF\u5F84\uFF08\u5982 cards/&lt;\u5361\u7247ID&gt;/cover.jpg\uFF09\uFF1D \u56FE\u7247\u7531\u9762\u677F\u672C\u673A\u6258\u7BA1\uFF0C\u6C38\u4E0D\u5931\u6548\uFF1B
          \u586B http(s) \u5916\u94FE\u5219\u6BCF\u6B21\u90FD\u53BB\u7F51\u4E0A\u53D6\u3002\u4FDD\u5B58\u540E\u53EF\u5728\u4E0A\u9762\u9884\u89C8\u3002
        </div>
        <label class="rcq-fi"><span>\u72B6\u6001</span>
          <select class="input" v-model="cur.status" @change="dirty = true">
            <option value="draft">\u8349\u7A3F</option>
            <option value="published">\u5DF2\u53D1\u5E03</option>
          </select>
        </label>
        <label class="rcq-fi"><span>\u7248\u672C</span>
          <input class="input" v-model.number="cur.version" @input="dirty = true" type="number" min="1" />
        </label>
      </div>

      <!-- \u5185\u5BB9 -->
      <div class="rcq-form" v-if="section === 'content'">
        <label class="rcq-fi wide"><span>\u7CFB\u7EDF\u63D0\u793A\u8BCD</span>
          <textarea class="rcq-ta tall" v-model="cur.prompt" @input="dirty = true"
            placeholder="\u63CF\u8FF0\u5B83\u7684\u8EAB\u4EFD\u3001\u8BED\u6C14\u3001\u8FB9\u754C\u3002\u4F8B\u5982\uFF1A\u4F60\u53EB\u5C0F\u96E8\uFF0C\u8BF4\u8BDD\u7B80\u77ED\u81EA\u7136\uFF0C\u4E0D\u7528\u656C\u8BED\uFF0C\u4E0D\u4E3B\u52A8\u63D0\u81EA\u5DF1\u662F AI\u3002"></textarea>
        </label>

        <div class="cd-blk">
          <div class="cd-blk-h"><b>\u5F00\u573A\u767D</b>
            <button class="btn btn-sm" @click="addGreeting">\u6DFB\u52A0\u4E00\u6761</button></div>
          <div class="cd-item" v-for="(g, i) in cur.greetings" :key="'g' + i">
            <textarea class="rcq-ta" v-model="cur.greetings[i]" @input="dirty = true"
              placeholder="\u8FDB\u5165\u4F1A\u8BDD\u65F6\u968F\u673A\u8BF4\u7684\u4E00\u53E5\u8BDD"></textarea>
            <button class="cd-x" title="\u5220\u9664" @click="rmGreeting(i)">\xD7</button>
          </div>
          <div class="rcq-hint" v-if="!(cur.greetings || []).length">\u8FD8\u6CA1\u6709\u5F00\u573A\u767D</div>
        </div>

        <div class="cd-blk">
          <div class="cd-blk-h"><b>\u793A\u4F8B\u5BF9\u8BDD</b>
            <button class="btn btn-sm" @click="addExample">\u6DFB\u52A0\u4E00\u7EC4</button></div>
          <div class="cd-item col" v-for="(ex, i) in cur.examples" :key="'e' + i">
            <div class="cd-row2">
              <input class="input" v-model="cur.examples[i].user" @input="dirty = true" placeholder="\u7528\u6237\u8BF4" />
              <input class="input" v-model="cur.examples[i].assistant" @input="dirty = true" placeholder="\u89D2\u8272\u56DE" />
              <button class="cd-x" title="\u5220\u9664" @click="rmExample(i)">\xD7</button>
            </div>
          </div>
          <div class="rcq-hint" v-if="!(cur.examples || []).length">\u8FD8\u6CA1\u6709\u793A\u4F8B</div>
        </div>

        <div class="cd-blk">
          <div class="cd-blk-h"><b>\u4E16\u754C\u4E66</b>
            <button class="btn btn-sm" @click="addLore">\u6DFB\u52A0\u4E00\u6761</button></div>
          <div class="cd-item col" v-for="(l, i) in cur.lorebook" :key="'l' + i">
            <div class="cd-row2">
              <input class="input" :value="loreKeys(l)" @input="setLoreKeys(l, $event.target.value); dirty = true"
                placeholder="\u89E6\u53D1\u5173\u952E\u8BCD\uFF08\u987F\u53F7\u5206\u9694\uFF09" />
              <button class="cd-x" title="\u5220\u9664" @click="rmLore(i)">\xD7</button>
            </div>
            <textarea class="rcq-ta" v-model="cur.lorebook[i].content" @input="dirty = true"
              placeholder="\u8FD9\u6761\u80CC\u666F\u8BBE\u5B9A"></textarea>
          </div>
          <div class="rcq-hint" v-if="!(cur.lorebook || []).length">\u8FD8\u6CA1\u6709\u4E16\u754C\u4E66\u6761\u76EE</div>
        </div>

        <label class="rcq-fi wide"><span>\u7981\u5219\uFF08\u6BCF\u884C\u4E00\u6761\uFF09</span>
          <textarea class="rcq-ta" :value="taboosText()" @input="setTaboosText($event.target.value); dirty = true"
            placeholder="\u4E0D\u8981\u8BF4\u7684\u8BDD\u3001 \u4E0D\u8981\u505A\u7684\u4E8B"></textarea>
        </label>
      </div>

      <!-- \u884C\u4E3A -->
      <div class="rcq-form" v-if="section === 'behavior'">
        <label class="rcq-fi wide"><span>\u6A21\u578B\u63D0\u4F9B\u5546</span>
          <select class="input" v-model="cur.model.provider_id" @change="dirty = true">
            <option value="">\uFF08\u8DDF\u968F\u8D26\u53F7\u9ED8\u8BA4\uFF09</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name || p.id }}</option>
          </select>
        </label>
        <label class="rcq-fi wide"><span>\u6A21\u578B\u540D</span>
          <input class="input" v-model="cur.model.model" @input="dirty = true" placeholder="\u7559\u7A7A = \u7528\u63D0\u4F9B\u5546\u7684\u9ED8\u8BA4\u6A21\u578B" />
        </label>
        <label class="rcq-fi"><span>\u6E29\u5EA6</span>
          <input class="input" type="number" step="0.1" min="0" max="2"
            v-model.number="cur.style.temperature" @input="dirty = true" />
        </label>
        <label class="rcq-fi"><span>\u6700\u5927 tokens</span>
          <input class="input" type="number" step="64" min="64"
            v-model.number="cur.style.max_tokens" @input="dirty = true" />
        </label>
        <label class="rcq-fi"><span>\u6700\u591A\u5B57\u6570</span>
          <input class="input" type="number" step="10" min="0" placeholder="\u4E0D\u9650"
            v-model.number="cur.style.max_chars" @input="dirty = true" />
        </label>
        <label class="rcq-fi"><span>\u5141\u8BB8 emoji</span>
          <label class="switch">
            <input type="checkbox" :checked="!!cur.style.allow_emoji"
              @change="cur.style.allow_emoji = $event.target.checked; dirty = true" />
            <span class="slider"></span>
          </label>
        </label>
        <label class="rcq-fi"><span>\u4E0A\u4E0B\u6587\u8F6E\u6570</span>
          <input class="input" type="number" min="1"
            v-model.number="cur.context.keep_rounds" @input="dirty = true" />
        </label>
        <label class="rcq-fi"><span>\u6C14\u6CE1\u8272</span>
          <input class="input" v-model="cur.style.color" @input="dirty = true" placeholder="#12b7f5" />
        </label>
      </div>

      <div class="rcq-flex" style="margin-top:12px">
        <button class="btn btn-sm" @click="setDefault(cur)">\u8BBE\u4E3A\u9ED8\u8BA4\u89D2\u8272</button>
        <button class="btn btn-sm" style="color:var(--err,#f5534f)"
          :disabled="busy === 'del' + cur.id" @click="del(cur)">\u5220\u9664</button>
        <span class="rcq-hint" style="margin-left:auto">\u5361\u7247 v{{ cur.version || 1 }} \xB7 {{ cur.status === 'published' ? '\u5DF2\u53D1\u5E03' : '\u8349\u7A3F' }}</span>
      </div>
      <div class="rcq-note">
        \u89D2\u8272\u5361\u7247\u662F\u300C\u5B9A\u4E49\u300D\uFF0C\u8D26\u53F7\u548C\u4F1A\u8BDD\u53EA\u5F15\u7528\u5B83 \u2014\u2014 \u6539\u5361\u7247\u4E0D\u4F1A\u5F71\u54CD\u5DF2\u7ECF\u4EA7\u751F\u7684\u5386\u53F2\u4F1A\u8BDD\u3002
        \u60F3\u7ED9\u522B\u7684\u673A\u5668\u4EBA\u7528\uFF0C\u76F4\u63A5\u300C\u5BFC\u51FA\u300D\u6210 JSON \u53D1\u8FC7\u53BB\uFF0C\u5BF9\u65B9\u300C\u5BFC\u5165\u300D\u5373\u53EF\u3002
      </div>
    </div>

    <div class="rcq-pnl" v-else>
      <div class="rcq-empty"><b>\u263A</b>\u5DE6\u8FB9\u9009\u4E00\u5F20\u5361\u7247\uFF0C\u6216\u8005\u65B0\u5EFA\u4E00\u5F20</div>
    </div>
  </div>`},zf={data(){return{S:yt,list:[],stats:{},defPersona:"",defProvider:"",personas:[],providers:[],cur:null,detail:null,ctx:null,filter:"all",kw:"",busy:"",err:"",limit:60}},computed:{shown(){let e=this.kw.trim().toLowerCase();return this.list.filter(t=>this.filter==="group"&&t.kind!=="group"||this.filter==="private"&&t.kind==="group"||this.filter==="off"&&t.enabled!==0||this.filter==="on"&&t.enabled===0?!1:e?((t.display||"")+" "+(t.id||"")+" "+(t.target_id||"")).toLowerCase().indexOf(e)>=0:!0)},enabledCount(){return this.list.filter(e=>e.enabled!==0).length},usedPct(){let e=this.ctx;return!e||!e.budget?0:Math.min(100,Math.round(e.est_tokens/e.budget*100))},barClass(){return this.usedPct>=90?"max":this.usedPct>=70?"hi":""}},async mounted(){await this.load()},methods:{fmtTime:Ef,fmtNum:rn,async load(){this.busy="load";try{let e=await ue("rcbot.sessions");this.list=e&&e.items||[],this.stats=e&&e.stats||{},this.defPersona=e&&e.default_persona||"",this.defProvider=e&&e.default_provider||"";let t=await ue("rcbot.personas");this.personas=t&&t.items||[];let i=await ue("rcbot.providers");if(this.providers=i&&i.items||[],this.cur){let s=this.list.find(n=>n.id===this.cur.id);s&&(this.cur=s)}}catch(e){this.err=le(e)}finally{this.busy=""}},async open(e){this.cur=e,this.busy="open";try{this.detail=await ue("rcbot.session.get",{id:e.id,limit:this.limit}),this.ctx=await ue("rcbot.context",{id:e.id})}catch(t){X(le(t),"err")}finally{this.busy=""}},async syncCatalog(){if(confirm(`\u4ECE QQ \u62C9\u53D6\u5168\u90E8\u7FA4\u804A\u4E0E\u597D\u53CB\uFF1F

\u62C9\u5230\u7684\u4F1A\u8BDD\u9ED8\u8BA4\u90FD\u662F\u300C\u4E0D\u542F\u7528\u300D\uFF0C\u9700\u8981\u4F60\u81EA\u5DF1\u6253\u5F00\u5F00\u5173\u3002`)){this.busy="sync";try{let e=await ue("rcbot.session.catalog",{});X("\u5DF2\u62C9\u53D6\uFF1A\u7FA4 "+(e.groups||0)+" \u4E2A\u3001\u597D\u53CB "+(e.friends||0)+" \u4E2A\uFF0C\u65B0\u589E\u4F1A\u8BDD "+(e.new||0)+" \u4E2A","ok"),await this.load()}catch(e){X(le(e),"err")}finally{this.busy=""}}},async toggle(e,t){let i=e.enabled;e.enabled=t?1:0;try{await Ue("rcbot.session.save",{id:e.id,enabled:t?1:0})}catch(s){e.enabled=i,X(le(s),"err")}},async bulk(e){if(!(e&&!confirm(`\u542F\u7528\u5168\u90E8\u4F1A\u8BDD\uFF1F

\u673A\u5668\u4EBA\u4F1A\u5728\u8FD9\u4E9B\u7FA4\u91CC\u81EA\u52A8\u56DE\u590D\uFF08\u7FA4\u91CC\u4ECD\u9700 @ \u6216\u5524\u9192\u524D\u7F00\uFF09\u3002`))&&!(!e&&!confirm("\u505C\u7528\u5168\u90E8\u4F1A\u8BDD\uFF1F\u673A\u5668\u4EBA\u5C06\u4E0D\u518D\u81EA\u52A8\u56DE\u590D\u3002"))){this.busy="bulk";try{let t=await ue("rcbot.session.bulk",{enabled:e?1:0});X((e?"\u5DF2\u542F\u7528 ":"\u5DF2\u505C\u7528 ")+(t.changed||0)+" \u4E2A\u4F1A\u8BDD","ok"),await this.load()}catch(t){X(le(t),"err")}finally{this.busy=""}}},async reloadDetail(){if(this.cur)try{this.detail=await ue("rcbot.session.get",{id:this.cur.id,limit:this.limit}),this.ctx=await ue("rcbot.context",{id:this.cur.id})}catch(e){X(le(e),"err")}},async patch(e,t){if(this.cur){this.busy="p"+e;try{let i={id:this.cur.id};i[e]=t,await Ue("rcbot.session.save",i),X("\u5DF2\u66F4\u65B0","ok"),await this.load(),await this.reloadDetail()}catch(i){X(le(i),"err")}finally{this.busy=""}}},async clear(){if(this.cur&&confirm("\u6E05\u7A7A\u300C"+(this.cur.display||this.cur.id)+"\u300D\u7684\u4E0A\u4E0B\u6587\uFF1F\u6D88\u606F\u4F1A\u5220\u6389\uFF0C\u4F1A\u8BDD\u4FDD\u7559\u3002")){this.busy="clear";try{await Ue("rcbot.session.clear",{id:this.cur.id}),X("\u4E0A\u4E0B\u6587\u5DF2\u6E05\u7A7A","ok"),await this.load(),await this.reloadDetail()}catch(e){X(le(e),"err")}finally{this.busy=""}}},async del(){if(this.cur&&confirm("\u5220\u9664\u4F1A\u8BDD\u300C"+(this.cur.display||this.cur.id)+"\u300D\uFF1F\u6D88\u606F\u548C\u6458\u8981\u4E00\u8D77\u5220\u3002")){this.busy="del";try{await Ue("rcbot.session.delete",{id:this.cur.id}),X("\u5DF2\u5220\u9664","ok"),this.cur=null,this.detail=null,this.ctx=null,await this.load()}catch(e){X(le(e),"err")}finally{this.busy=""}}},personaName(e){if(!e)return"\u9ED8\u8BA4";let t=this.personas.find(i=>i.id===e);return t?t.name:e},providerName(e){if(!e)return"\u9ED8\u8BA4";let t=this.providers.find(i=>i.id===e);return t?t.label||t.id:e}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-split">
      <div class="rcq-pnl flat">
        <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
          <b>\u4F1A\u8BDD</b>
          <span class="rcq-hint">{{ stats.sessions || 0 }} \u4E2A \xB7 \u6D88\u606F {{ fmtNum(stats.messages || 0) }}</span>
          <span class="sp"></span>
          <button class="btn btn-sm" :disabled="!!busy" @click="syncCatalog">
            {{ busy === 'sync' ? '\u62C9\u53D6\u4E2D\u2026' : '\u62C9\u53D6\u7FA4\u804A/\u79C1\u804A' }}</button>
          <button class="btn btn-sm" :disabled="!!busy" @click="load">\u5237\u65B0</button>
        </div>
        <div class="rcq-flex" style="padding:0 16px 8px">
          <button class="btn btn-sm" :class="filter === 'all' ? 'btn-primary' : ''" @click="filter = 'all'">\u5168\u90E8</button>
          <button class="btn btn-sm" :class="filter === 'group' ? 'btn-primary' : ''" @click="filter = 'group'">\u7FA4\u804A</button>
          <button class="btn btn-sm" :class="filter === 'private' ? 'btn-primary' : ''" @click="filter = 'private'">\u79C1\u804A</button>
          <button class="btn btn-sm" :class="filter === 'on' ? 'btn-primary' : ''" @click="filter = 'on'">\u5DF2\u542F\u7528</button>
          <button class="btn btn-sm" :class="filter === 'off' ? 'btn-primary' : ''" @click="filter = 'off'">\u5DF2\u505C\u7528</button>
          <input class="input" style="flex:1;min-width:90px;padding:4px 10px;font-size:12px"
            v-model="kw" placeholder="\u641C\u4F1A\u8BDD" />
        </div>
        <div class="rcq-flex" style="padding:0 16px 8px;font-size:11.5px;color:var(--m)">
          <span>\u5DF2\u542F\u7528 <b>{{ enabledCount }}</b> / {{ list.length }}</span>
          <span class="sp"></span>
          <button class="btn btn-sm" :disabled="!!busy" @click="bulk(true)">\u5168\u90E8\u542F\u7528</button>
          <button class="btn btn-sm" :disabled="!!busy" @click="bulk(false)">\u5168\u90E8\u505C\u7528</button>
        </div>
        <div class="rcq-list">
          <div class="rcq-row click" v-for="s in shown" :key="s.id"
            :class="{ on: cur && cur.id === s.id }" @click="open(s)">
            <div class="main">
              <div class="t">
                <span class="tag-chip tag-chip-sm">{{ s.kind === 'group' ? '\u7FA4' : '\u79C1' }}</span>
                {{ s.display || s.target_id || s.id }}
                <span class="tag-chip tag-chip-sm" v-if="!s.talked">\u672A\u804A\u8FC7</span>
                <span class="tag-chip tag-chip-sm" v-if="s.enabled === 0">\u5DF2\u505C\u7528</span>
              </div>
              <div class="d">
                {{ s.msg_count || 0 }} \u6761 \xB7 {{ s.mode_label || '' }}
                <template v-if="s.persona_id"> \xB7 {{ personaName(s.persona_id) }}</template>
                \xB7 {{ fmtTime(s.last_at || s.updated_at) }}
              </div>
            </div>
            <div class="acts" @click.stop>
              <label class="switch" :title="s.enabled === 0 ? '\u542F\u7528\u8FD9\u4E2A\u4F1A\u8BDD' : '\u505C\u7528\u8FD9\u4E2A\u4F1A\u8BDD'">
                <input type="checkbox" :checked="s.enabled !== 0" :disabled="!!busy"
                  @change="toggle(s, $event.target.checked)" />
                <span class="slider"></span>
              </label>
            </div>
          </div>
          <div v-if="!shown.length" class="rcq-empty"><b>\u25A4</b>\u6CA1\u6709\u4F1A\u8BDD</div>
        </div>
      </div>

      <div v-if="cur">
        <div class="rcq-pnl">
          <div class="rcq-ph">
            <b>{{ cur.display || cur.target_id }}</b>
            <span class="tag-chip tag-chip-sm">{{ cur.kind === 'group' ? '\u7FA4\u804A' : '\u79C1\u804A' }}</span>
            <span class="tag-chip tag-chip-sm">{{ cur.mode_label || '' }}</span>
            <span class="sp"></span>
            <button class="btn btn-sm" :disabled="!!busy" @click="reloadDetail">\u5237\u65B0</button>
          </div>

          <div class="rcq-form">
            <label class="rcq-fi"><span>\u89D2\u8272\u5361\u7247</span>
              <select class="select" :value="cur.persona_id || ''" :disabled="!!busy"
                @change="patch('persona_id', $event.target.value)">
                <option value="">\u8DDF\u968F\u9ED8\u8BA4\uFF08{{ personaName(defPersona) }}\uFF09</option>
                <option v-for="p in personas" :key="p.id" :value="p.id">{{ p.name || p.id }}</option>
              </select>
            </label>
            <label class="rcq-fi"><span>\u6A21\u578B\u63D0\u4F9B\u5546</span>
              <select class="select" :value="cur.provider_id || ''" :disabled="!!busy"
                @change="patch('provider_id', $event.target.value)">
                <option value="">\u8DDF\u968F\u9ED8\u8BA4\uFF08{{ providerName(defProvider) }}\uFF09</option>
                <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.label || p.id }}</option>
              </select>
            </label>
            <div class="rcq-fi"><span>\u542F\u7528</span>
              <label class="switch">
                <input type="checkbox" :checked="cur.enabled !== 0" :disabled="!!busy"
                  @change="patch('enabled', $event.target.checked)" />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <div class="rcq-sec" v-if="ctx">
            <div class="rcq-flex" style="margin-bottom:4px">
              <span class="rcq-hint">\u4E0A\u4E0B\u6587\u5360\u7528</span>
              <span class="sp" style="margin-left:auto"></span>
              <span class="rcq-mono">{{ ctx.est_tokens }} / {{ ctx.budget }} tokens\uFF08{{ usedPct }}%\uFF09</span>
            </div>
            <div class="rcq-bar2"><i :class="barClass" :style="{ width: usedPct + '%' }"></i></div>
            <div class="rcq-note">
              \u9884\u7B97 = \u4E0A\u4E0B\u6587\u7A97\u53E3 \u2212 \u6700\u5927\u8F93\u51FA \u2212 \u7CFB\u7EDF\u63D0\u793A\u3002\u8D85\u4E86\u5C31\u6309\u300C\u4FDD\u7559\u6700\u8FD1\u6BD4\u4F8B\u300D\u538B\u7F29\u6210\u6458\u8981\u3002
            </div>
            <div class="rcq-flex" style="margin-top:10px">
              <button class="btn btn-sm" :disabled="!!busy" @click="clear">\u6E05\u7A7A\u4E0A\u4E0B\u6587</button>
              <button class="btn btn-sm btn-danger" :disabled="!!busy" @click="del">\u5220\u9664\u4F1A\u8BDD</button>
            </div>
          </div>
        </div>

        <div class="rcq-pnl" v-if="detail">
          <div class="rcq-ph"><b>\u6D88\u606F\u8BB0\u5F55</b><span class="sp"></span>
            <span class="rcq-hint">\u6700\u8FD1 {{ (detail.messages || []).length }} / \u5171 {{ detail.msg_count || 0 }} \u6761</span></div>

          <div v-if="detail.summary" class="rcq-pnl" style="background:var(--sf2);margin-bottom:12px">
            <div class="rcq-ph" style="margin-bottom:6px"><b>\u538B\u7F29\u6458\u8981</b>
              <span class="rcq-hint">\u65E7\u5BF9\u8BDD\u88AB\u538B\u6210\u4E86\u8FD9\u6BB5</span></div>
            <div style="font-size:12.5px;white-space:pre-wrap">{{ detail.summary }}</div>
          </div>

          <div class="rcq-msgs">
            <div class="rcq-msg" v-for="m in (detail.messages || [])" :key="m.id"
              :class="{ me: m.role === 'assistant' }">
              <div class="who">{{ m.role === 'assistant' ? '\u52A9\u624B' : (m.name || '\u7528\u6237') }}</div>
              <div class="body">{{ m.content }}</div>
            </div>
            <div v-if="!(detail.messages || []).length" class="rcq-empty"><b>\u25A4</b>\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u6D88\u606F</div>
          </div>
        </div>
      </div>

      <div class="rcq-pnl" v-else>
        <div class="rcq-empty"><b>\u25A4</b>\u5DE6\u8FB9\u70B9\u4E00\u4E2A\u4F1A\u8BDD\u770B\u8BE6\u60C5</div>
      </div>
    </div>
  </div>`},Bf={data(){return{S:yt,list:[],def:"",cur:null,busy:"",err:"",dirty:!1,test:null,models:[],showKey:!1}},computed:{isNew(){return!!(this.cur&&this.cur.__new)}},async mounted(){await this.load()},methods:{async load(){try{let e=await ue("rcbot.providers");if(this.list=e&&e.items||[],this.def=e&&e.default||"",!this.cur)this.pick(this.list[0]||null);else if(!this.cur.__new&&!this.dirty){let t=this.list.find(i=>i.id===this.cur.id);t&&this.pick(t)}}catch(e){this.err=le(e)}},pick(e){this.cur=e?Object.assign({type:"openai",timeout:120,enable:!0},e):null,this.dirty=!1,this.test=null,this.models=[]},add(){this.cur={id:"",label:"",type:"openai",api_base:"https://api.openai.com/v1",api_key:"",model:"",timeout:120,enable:!0,__new:!0},this.dirty=!0,this.test=null,this.models=[]},async save(){let e=this.cur;if(e){if(!String(e.label||"").trim()){X("\u7ED9\u63D0\u4F9B\u5546\u8D77\u4E2A\u540D\u5B57","err");return}if(!String(e.api_base||"").trim()){X("api_base \u4E0D\u80FD\u4E3A\u7A7A","err");return}this.busy="save";try{await Ue("rcbot.provider.save",{id:e.__new?"":e.id,label:e.label,type:e.type,api_base:e.api_base,api_key:e.api_key,model:e.model,timeout:Number(e.timeout)||120,enable:!!e.enable}),X("\u5DF2\u4FDD\u5B58","ok"),this.dirty=!1,this.cur=null,await this.load()}catch(t){X(le(t),"err")}finally{this.busy=""}}},async setDefault(e){this.busy="def"+e.id;try{await Ue("rcbot.provider.save",{id:e.id,label:e.label,type:e.type,api_base:e.api_base,api_key:e.api_key,model:e.model,timeout:e.timeout,enable:e.enable,set_default:!0}),X("\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u63D0\u4F9B\u5546","ok"),await this.load()}catch(t){X(le(t),"err")}finally{this.busy=""}},async del(e){if(confirm("\u5220\u9664\u63D0\u4F9B\u5546\u300C"+(e.label||e.id)+"\u300D\uFF1F")){this.busy="del"+e.id;try{await Ue("rcbot.provider.delete",{id:e.id}),X("\u5DF2\u5220\u9664","ok"),this.cur=null,await this.load()}catch(t){X(le(t),"err")}finally{this.busy=""}}},async doTest(e){this.busy="test"+e.id,this.test=null;try{let t=await ue("rcbot.provider.test",{id:e.id});this.test=Object.assign({id:e.id},t||{}),X(t.ok?"\u901A\u4E86\uFF0C"+t.ms+"ms":"\u4E0D\u901A\uFF1A"+(t.error||""),t.ok?"ok":"err")}catch(t){X(le(t),"err")}finally{this.busy=""}},async fetchModels(){let e=this.cur;if(!e||e.__new){X("\u5148\u4FDD\u5B58\u518D\u62C9\u6A21\u578B\u5217\u8868","err");return}this.busy="models";try{let t=await ue("rcbot.provider.models",{id:e.id});this.models=t&&(t.items||t.models)||[],this.models.length||X("\u6CA1\u62C9\u5230\u6A21\u578B","err")}catch(t){X(le(t),"err")}finally{this.busy=""}}},template:`
  <div class="rcq-split">
    <div class="rcq-pnl flat">
      <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
        <b>\u6A21\u578B\u63D0\u4F9B\u5546</b><span class="sp"></span>
        <button class="btn btn-sm btn-primary" @click="add">\u65B0\u589E</button>
      </div>
      <div class="rcq-list">
        <div class="rcq-row click" v-for="p in list" :key="p.id"
          :class="{ on: cur && cur.id === p.id }" @click="pick(p)">
          <div class="main">
            <div class="t">{{ p.label || p.id }}
              <span class="tag-chip tag-chip-sm" v-if="p.id === def">\u9ED8\u8BA4</span>
              <span class="tag-chip tag-chip-sm" v-if="p.enable === false">\u505C\u7528</span>
            </div>
            <div class="d">{{ p.model || '\u672A\u9009\u6A21\u578B' }} \xB7 {{ p.api_base }}</div>
          </div>
        </div>
        <div v-if="!list.length" class="rcq-empty"><b>\u2726</b>\u8FD8\u6CA1\u6709\u63D0\u4F9B\u5546\uFF0C\u70B9\u300C\u65B0\u589E\u300D</div>
      </div>
    </div>

    <div class="rcq-pnl" v-if="cur">
      <div class="rcq-ph"><b>{{ isNew ? '\u65B0\u589E\u63D0\u4F9B\u5546' : (cur.label || cur.id) }}</b><span class="sp"></span>
        <span class="tag-chip tag-chip-sm" v-if="cur.id && cur.id === def">\u9ED8\u8BA4</span>
      </div>
      <div class="rcq-form">
        <label class="rcq-fi"><span>\u540D\u79F0</span>
          <input class="input" v-model="cur.label" @input="dirty = true" placeholder="DeepSeek" /></label>
        <label class="rcq-fi"><span>\u534F\u8BAE</span>
          <select class="select" v-model="cur.type" @change="dirty = true">
            <option value="openai">OpenAI \u517C\u5BB9</option>
            <option value="anthropic">Anthropic</option>
          </select></label>
        <label class="rcq-fi wide"><span>API \u5730\u5740</span>
          <input class="input" v-model="cur.api_base" @input="dirty = true"
            placeholder="https://api.deepseek.com/v1" /></label>
        <label class="rcq-fi wide"><span>API Key</span>
          <div style="display:flex;gap:6px">
            <input class="input" style="flex:1" v-model="cur.api_key" @input="dirty = true"
              :type="showKey ? 'text' : 'password'" placeholder="sk-..." />
            <button class="btn btn-sm" @click="showKey = !showKey">{{ showKey ? '\u9690\u85CF' : '\u663E\u793A' }}</button>
          </div>
        </label>
        <label class="rcq-fi"><span>\u6A21\u578B</span>
          <div style="display:flex;gap:6px">
            <input class="input" style="flex:1" v-model="cur.model" @input="dirty = true"
              placeholder="deepseek-flash" />
            <button class="btn btn-sm" :disabled="!!busy || isNew" @click="fetchModels">\u62C9\u5217\u8868</button>
          </div>
        </label>
        <label class="rcq-fi"><span>\u8D85\u65F6\uFF08\u79D2\uFF09</span>
          <input class="input" type="number" min="10" max="600" v-model="cur.timeout" @input="dirty = true" /></label>
        <div class="rcq-fi" v-if="models.length"><span>\u4ECE\u5217\u8868\u9009\uFF08{{ models.length }}\uFF09</span>
          <select class="select" :value="cur.model" @change="cur.model = $event.target.value; dirty = true">
            <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="rcq-flex" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="save">\u4FDD\u5B58</button>
        <button class="btn btn-sm" v-if="cur.id && cur.id !== def" :disabled="!!busy"
          @click="setDefault(cur)">\u8BBE\u4E3A\u9ED8\u8BA4</button>
        <button class="btn btn-sm" v-if="cur.id && !isNew" :disabled="!!busy" @click="doTest(cur)">\u6D4B\u8BD5\u8FDE\u901A</button>
        <button class="btn btn-sm btn-danger" v-if="cur.id && !isNew" :disabled="!!busy"
          @click="del(cur)">\u5220\u9664</button>
        <span class="rcq-hint" v-if="dirty">\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539</span>
      </div>
      <div class="rcq-note" v-if="test">
        <span :style="{ color: test.ok ? 'var(--success)' : 'var(--danger)' }">
          {{ test.ok ? ('\u8FDE\u901A ' + test.ms + 'ms \xB7 \u56DE\u590D\uFF1A' + (test.reply || '')) : ('\u5931\u8D25\uFF1A' + (test.error || '')) }}
        </span>
      </div>
      <div class="rcq-note">
        \u63A8\u7406\u6A21\u578B\uFF08deepseek-flash \u7B49\uFF09\u4F1A\u5148\u82B1 token \u5728\u601D\u8003\u4E0A\uFF0C\u6D4B\u8FDE\u901A\u81F3\u5C11\u7ED9 256 \u4E2A\u8F93\u51FA token\uFF0C
        \u6240\u4EE5\u300C\u6D4B\u8BD5\u8FDE\u901A\u300D\u5076\u5C14\u6162\u4E00\u70B9\u662F\u6B63\u5E38\u7684\u3002
      </div>
    </div>

    <div class="rcq-pnl" v-else>
      <div class="rcq-empty"><b>\u2726</b>\u5DE6\u8FB9\u9009\u4E00\u4E2A\uFF0C\u6216\u8005\u65B0\u589E</div>
    </div>
  </div>`},jf={data(){return{S:yt,items:[],mode:"live",level:"",lines:400,follow:!0,source:"",connected:!1,hint:"",busy:!1,timer:null,err:""}},computed:{filtered(){return this.items}},async mounted(){await this.load(),this.tick()},beforeUnmount(){this.timer&&clearTimeout(this.timer)},methods:{tick(){this.timer&&clearTimeout(this.timer),this.mode==="live"&&this.follow&&(this.timer=setTimeout(async()=>{await this.load(!0),this.tick()},2e3))},async load(e){e||(this.busy=!0);try{let t=await Ue("qqbot.account.logs",{mode:this.mode,level:this.level,lines:Number(this.lines)||400}),i=t.items.length!==this.items.length;this.items=t.items||[],this.source=t.source,this.connected=!!t.connected,this.hint=t.hint||"",this.err="",i&&this.follow&&this.$nextTick(this.scrollBottom)}catch(t){this.err=le(t)}finally{this.busy=!1}},scrollBottom(){let e=this.$refs.box;e&&(e.scrollTop=e.scrollHeight)},async switchMode(e){this.mode=e,this.items=[],await this.load(),this.tick()},async setLevel(e){this.level=this.level===e?"":e,await this.load()},async clear(){try{await Ue("qqbot.account.logs.clear"),this.items=[],X("\u5DF2\u6E05\u7A7A\u5F53\u524D\u89C6\u56FE\uFF08\u5BB9\u5668\u65E5\u5FD7\u7531 Docker \u7BA1\u7406\uFF09","ok")}catch(e){X(le(e),"err")}},download(){let e=this.items.map(s=>"["+String(s.level).toUpperCase()+"] "+s.text).join(`
`),t=new Blob([e],{type:"text/plain;charset=utf-8"}),i=document.createElement("a");i.href=URL.createObjectURL(t),i.download="snowluma-"+Date.now()+".log",i.click(),setTimeout(()=>URL.revokeObjectURL(i.href),3e3)},lineClass(e){return"rcq-ln rcq-lv-"+(e.level||"info")},lvText(e){return"["+String(e.level||"info").toUpperCase()+"]"}},template:`
  <div>
    <div class="rcq-pnl">
      <div class="rcq-ph">
        <button class="btn btn-sm" :class="mode === 'live' ? 'btn-primary' : ''" @click="switchMode('live')">\u5B9E\u65F6\u65E5\u5FD7</button>
        <button class="btn btn-sm" :class="mode === 'history' ? 'btn-primary' : ''" @click="switchMode('history')">\u5386\u53F2\u65E5\u5FD7</button>
        <span class="sp"></span>
        <span class="rcq-lamp"><b :class="connected ? 'on' : 'off'"></b>
          {{ connected ? '\u5BB9\u5668\u5728\u7EBF' : '\u5BB9\u5668\u79BB\u7EBF' }} \xB7 docker logs</span>
      </div>
      <div class="rcq-flex">
        <span class="rcq-hint">\u65E5\u5FD7\u7EA7\u522B</span>
        <button class="btn btn-sm" :class="level === 'debug' ? 'btn-primary' : ''" @click="setLevel('debug')">Debug</button>
        <button class="btn btn-sm" :class="level === 'info' ? 'btn-primary' : ''" @click="setLevel('info')">Info</button>
        <button class="btn btn-sm" :class="level === 'warn' ? 'btn-primary' : ''" @click="setLevel('warn')">Warn</button>
        <button class="btn btn-sm" :class="level === 'error' ? 'btn-primary' : ''" @click="setLevel('error')">Error</button>
        <span style="width:10px"></span>
        <select class="select" style="padding:4px 8px;font-size:12px" v-model.number="lines" @change="load()">
          <option :value="200">200 \u884C</option>
          <option :value="400">400 \u884C</option>
          <option :value="1000">1000 \u884C</option>
          <option :value="2000">2000 \u884C</option>
        </select>
        <label class="switch" title="\u81EA\u52A8\u8DDF\u968F">
          <input type="checkbox" v-model="follow" @change="tick" />
          <span class="slider"></span>
        </label>
        <span class="rcq-hint">\u8DDF\u968F</span>
        <span class="sp" style="margin-left:auto"></span>
        <button class="btn btn-sm" :disabled="busy" @click="load()">\u5237\u65B0</button>
        <button class="btn btn-sm" @click="download">\u4E0B\u8F7D</button>
        <button class="btn btn-sm" v-if="mode === 'live'" @click="clear">\u6E05\u7A7A</button>
      </div>
    </div>

    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-log" ref="box">
      <div v-for="(x, i) in items" :key="i" :class="lineClass(x)">
        <span class="lv">{{ lvText(x) }}</span>{{ x.text }}
      </div>
      <div v-if="!items.length" style="color:var(--f)">
        {{ hint || '\u8FD8\u6CA1\u6709\u65E5\u5FD7' }}
      </div>
    </div>
    <div class="rcq-note">
      \u65E5\u5FD7\u6765\u81EA <code>docker logs snowluma</code>\uFF08\u5BB9\u5668\u65E5\u5FD7\u672C\u8EAB\u5E26\u5386\u53F2\uFF0C\u6BCF 2 \u79D2\u5237\u65B0\u4E00\u6B21\uFF09\u3002
      \u5BB9\u5668\u6CA1\u8D77\u6765\u65F6\u8FD9\u91CC\u4F1A\u662F\u7A7A\u7684\u3002
    </div>
  </div>`},Df={data(){return{S:yt,cfg:null,conn:null,busy:"",err:"",searchQ:"",searchOut:null,tab:"ctx"}},computed:{ctx(){return this.cfg&&this.cfg.context||{}},bot(){return this.cfg&&this.cfg.bot||{}},feats(){return this.cfg&&this.cfg.features||{}},ws(){return this.feats.web_search||{}},vis(){return this.feats.vision||{}},rp(){return this.feats.random_pick||{}},sl(){return this.feats.sl_status||{}}},async mounted(){await this.load()},methods:{async load(){this.busy="load";try{this.cfg=await ue("rcbot.config.get"),this.conn=await Ue("qqbot.conn.get"),this.err=""}catch(e){this.err=le(e)}finally{this.busy=""}},async saveCtx(){this.busy="ctx";try{await Ue("rcbot.config.save",{context:{max_tokens:Number(this.ctx.max_tokens)||128e3,max_output_tokens:Number(this.ctx.max_output_tokens)||4096,keep_recent_ratio:Number(this.ctx.keep_recent_ratio)||.15,max_history_messages:Number(this.ctx.max_history_messages)||200,compress_enabled:!!this.ctx.compress_enabled,compress_provider:this.ctx.compress_provider||""}}),X("\u4E0A\u4E0B\u6587\u8BBE\u7F6E\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){X(le(e),"err")}finally{this.busy=""}},async saveBot(){this.busy="bot";try{await Ue("rcbot.config.save",{bot:{enabled:!!this.bot.enabled,group_need_at:!!this.bot.group_need_at,private_always_reply:!!this.bot.private_always_reply,reply_with_mention:!!this.bot.reply_with_mention,wake_prefix:ml(this.bot.__prefixText!=null?this.bot.__prefixText:(this.bot.wake_prefix||[]).join(",")),allowed_groups:ml(this.bot.__allowText!=null?this.bot.__allowText:(this.bot.allowed_groups||[]).join(",")),blocked_groups:ml(this.bot.__blockText!=null?this.bot.__blockText:(this.bot.blocked_groups||[]).join(",")),rate_limit:{window:Number((this.bot.rate_limit||{}).window)||60,max:Number((this.bot.rate_limit||{}).max)||30}}}),X("\u89E6\u53D1\u89C4\u5219\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){X(le(e),"err")}finally{this.busy=""}},async saveFeat(){this.busy="feat";try{await Ue("rcbot.config.save",{features:{web_search:{enabled:!!this.ws.enabled,max_results:Number(this.ws.max_results)||5},vision:{enabled:!!this.vis.enabled,max_images:Number(this.vis.max_images)||3},random_pick:{enabled:this.rp.enabled!==!1,scope:this.rp.scope||"enabled_groups"},sl_status:{enabled:this.sl.enabled!==!1,keyword:String(this.sl.keyword||"#sl").trim()||"#sl",cooldown:Math.max(1,Number(this.sl.cooldown)||10)}}}),X("\u80FD\u529B\u5F00\u5173\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){X(le(e),"err")}finally{this.busy=""}},async saveConn(){this.busy="conn";try{await Ue("qqbot.conn.save",{config:{api:this.conn.config.api,timeout:Number(this.conn.config.timeout)||90}}),X("\u8FDE\u63A5\u8BBE\u7F6E\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){X(le(e),"err")}finally{this.busy=""}},async testSearch(){let e=this.searchQ.trim();if(e){this.busy="search",this.searchOut=null;try{let t=await ue("rcbot.tools.search",{q:e});this.searchOut=t||{}}catch(t){X(le(t),"err")}finally{this.busy=""}}}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>
    <div class="rcq-pnl" v-if="!cfg"><div class="rcq-empty">\u8BFB\u53D6\u914D\u7F6E\u4E2D\u2026</div></div>

    <div class="rcq-pnl" v-if="cfg">
      <div class="rcq-ph">
        <button class="btn btn-sm" :class="tab === 'ctx' ? 'btn-primary' : ''" @click="tab = 'ctx'">\u4E0A\u4E0B\u6587\u4E0E\u89E6\u53D1</button>
        <button class="btn btn-sm" :class="tab === 'cap' ? 'btn-primary' : ''" @click="tab = 'cap'">\u80FD\u529B</button>
        <button class="btn btn-sm" :class="tab === 'conn' ? 'btn-primary' : ''" @click="tab = 'conn'">\u8FDE\u63A5</button>
        <span class="sp"></span>
        <button class="btn btn-sm" :disabled="!!busy" @click="load">\u91CD\u65B0\u8BFB\u53D6</button>
      </div>

      <!-- \u4E0A\u4E0B\u6587\u4E0E\u89E6\u53D1 -->
      <div v-if="tab === 'ctx'">
        <div class="rcq-ph" style="margin-bottom:10px"><b>\u4E0A\u4E0B\u6587</b>
          <span class="rcq-hint">\u51B3\u5B9A\u5B83\u8BB0\u5F97\u591A\u5C11\u3001\u4EC0\u4E48\u65F6\u5019\u538B\u7F29</span></div>
        <div class="rcq-form">
          <label class="rcq-fi"><span>\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF08tokens\uFF09</span>
            <input class="input" type="number" v-model="ctx.max_tokens" /></label>
          <label class="rcq-fi"><span>\u6700\u5927\u8F93\u51FA\uFF08tokens\uFF09</span>
            <input class="input" type="number" v-model="ctx.max_output_tokens" /></label>
          <label class="rcq-fi"><span>\u4FDD\u7559\u6700\u8FD1\u6BD4\u4F8B</span>
            <input class="input" type="number" step="0.05" min="0.05" max="0.9" v-model="ctx.keep_recent_ratio" /></label>
          <label class="rcq-fi"><span>\u6700\u591A\u5E26\u591A\u5C11\u6761\u5386\u53F2</span>
            <input class="input" type="number" v-model="ctx.max_history_messages" /></label>
        </div>
        <div class="switch-row">
          <label>\u542F\u7528\u4E0A\u4E0B\u6587\u538B\u7F29\uFF08\u8D85\u9884\u7B97\u65F6\u628A\u65E7\u5BF9\u8BDD\u538B\u6210\u6458\u8981\uFF09</label>
          <label class="switch"><input type="checkbox" v-model="ctx.compress_enabled" /><span class="slider"></span></label>
        </div>
        <div class="rcq-note">
          \u9884\u7B97 = \u4E0A\u4E0B\u6587\u7A97\u53E3 \u2212 \u6700\u5927\u8F93\u51FA \u2212 \u7CFB\u7EDF\u63D0\u793A\u3002\u8D85\u4E86\u5C31\u4FDD\u7559\u6700\u8FD1 {{ Math.round((ctx.keep_recent_ratio || 0) * 100) }}%\uFF0C
          \u66F4\u65E7\u7684\u4EA4\u7ED9\u6A21\u578B\u538B\u6210\u6458\u8981\u3002\u63A8\u7406\u6A21\u578B\u5EFA\u8BAE\u300C\u6700\u5927\u8F93\u51FA\u300D\u2265 4096\uFF0C\u5426\u5219\u601D\u8003\u5C31\u628A\u9884\u7B97\u5403\u5149\u4E86\u3002
        </div>
        <div class="rcq-flex" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveCtx">\u4FDD\u5B58</button>
        </div>

        <div class="rcq-sec">
          <div class="rcq-ph" style="margin-bottom:10px"><b>\u89E6\u53D1\u89C4\u5219</b>
            <span class="rcq-hint">\u4EC0\u4E48\u6D88\u606F\u624D\u56DE</span></div>
          <div class="switch-row">
            <label>\u673A\u5668\u4EBA\u603B\u5F00\u5173</label>
            <label class="switch"><input type="checkbox" v-model="bot.enabled" /><span class="slider"></span></label>
          </div>
          <div class="switch-row">
            <label>\u7FA4\u91CC\u5FC5\u987B @ \u624D\u56DE\u590D</label>
            <label class="switch"><input type="checkbox" v-model="bot.group_need_at" /><span class="slider"></span></label>
          </div>
          <div class="switch-row">
            <label>\u79C1\u804A\u5168\u90E8\u56DE\u590D</label>
            <label class="switch"><input type="checkbox" v-model="bot.private_always_reply" /><span class="slider"></span></label>
          </div>
          <div class="switch-row">
            <label>\u56DE\u590D\u65F6 @ \u5BF9\u65B9</label>
            <label class="switch"><input type="checkbox" v-model="bot.reply_with_mention" /><span class="slider"></span></label>
          </div>
          <div class="rcq-form" style="margin-top:8px">
            <label class="rcq-fi"><span>\u5524\u9192\u524D\u7F00\uFF08\u9017\u53F7\u5206\u9694\uFF0C\u4E0D\u7528 @\uFF09</span>
              <input class="input" :value="(bot.wake_prefix || []).join(',')"
                @input="bot.__prefixText = $event.target.value" placeholder="/" /></label>
            <label class="rcq-fi"><span>\u9650\u6D41\uFF1A\u7A97\u53E3\uFF08\u79D2\uFF09</span>
              <input class="input" type="number" v-model="bot.rate_limit.window" /></label>
            <label class="rcq-fi"><span>\u9650\u6D41\uFF1A\u7A97\u53E3\u5185\u6700\u591A\u56DE\u590D</span>
              <input class="input" type="number" v-model="bot.rate_limit.max" /></label>
            <label class="rcq-fi"><span>\u53EA\u56DE\u8FD9\u4E9B\u7FA4\uFF08\u7559\u7A7A = \u4E0D\u9650\uFF09</span>
              <input class="input" :value="(bot.allowed_groups || []).join(',')"
                @input="bot.__allowText = $event.target.value" placeholder="\u7FA4\u53F7\uFF0C\u9017\u53F7\u5206\u9694" /></label>
            <label class="rcq-fi"><span>\u5C4F\u853D\u8FD9\u4E9B\u7FA4</span>
              <input class="input" :value="(bot.blocked_groups || []).join(',')"
                @input="bot.__blockText = $event.target.value" placeholder="\u7FA4\u53F7\uFF0C\u9017\u53F7\u5206\u9694" /></label>
          </div>
          <div class="rcq-flex" style="margin-top:12px">
            <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveBot">\u4FDD\u5B58</button>
          </div>
        </div>
      </div>

      <!-- \u80FD\u529B -->
      <div v-if="tab === 'cap'">
        <div class="switch-row">
          <label>\u5141\u8BB8\u8054\u7F51\u641C\u7D22
            <div class="rcq-note">\u6A21\u578B\u9047\u5230\u65F6\u6548\u6027\u95EE\u9898\u4F1A\u8C03\u7528 <code>web_search</code>\uFF0C\u8D70 Bing \u6293\u7ED3\u679C\u3002</div>
          </label>
          <label class="switch"><input type="checkbox" v-model="ws.enabled" /><span class="slider"></span></label>
        </div>
        <div class="rcq-form" style="margin-top:6px">
          <label class="rcq-fi"><span>\u6BCF\u6B21\u641C\u7D22\u53D6\u51E0\u6761</span>
            <input class="input rcq-num" type="number" min="1" max="10" v-model="ws.max_results" /></label>
        </div>

        <div class="rcq-sec">
          <div class="switch-row">
            <label>\u5141\u8BB8\u8BC6\u56FE
              <div class="rcq-note">\u6D88\u606F\u91CC\u6709\u56FE\u7247\u65F6\uFF0C\u628A\u56FE\u8F6C\u6210 base64 \u76F4\u63A5\u5582\u7ED9\u6A21\u578B\uFF08\u4E0D\u7528\u53E6\u914D\u89C6\u89C9\u6A21\u578B\uFF09\u3002</div>
            </label>
            <label class="switch"><input type="checkbox" v-model="vis.enabled" /><span class="slider"></span></label>
          </div>
          <div class="rcq-form" style="margin-top:6px">
            <label class="rcq-fi"><span>\u5355\u6761\u6D88\u606F\u6700\u591A\u770B\u51E0\u5F20</span>
              <input class="input rcq-num" type="number" min="1" max="6" v-model="vis.max_images" /></label>
          </div>
<div class="rcq-note">
          \u53EA\u6709\u300C\u5F53\u524D\u8FD9\u8F6E\u300D\u4F1A\u5E26\u56FE\uFF0C\u5386\u53F2\u91CC\u53EA\u7559 [\u56FE\u7247] \u6587\u672C \u2014\u2014 \u4E0D\u7136\u6BCF\u8F6E\u90FD\u8981\u91CD\u4F20\u56FE\u7247\uFF0Ctoken \u4F1A\u7206\u3002
          </div>
        </div>

        <div class="rcq-sec">
          <div class="switch-row">
            <label>\u5141\u8BB8\u968F\u673A\u6311\u6D88\u606F\u56DE
              <div class="rcq-note">
                \u6D88\u606F\u9875\u7684 \u{1F3B2}\uFF1A\u4ECE\u7FA4\u804A\u91CC\u968F\u673A\u7FFB\u4E00\u6761\u522B\u4EBA\u8BF4\u8FC7\u7684\u8BDD\uFF0C\u8BA9\u673A\u5668\u4EBA\u5BF9\u5B83\u56DE\u4E00\u53E5\u3002
                \u70B9\u300C\u53D1\u9001\u5230 QQ\u300D\u4F1A\u771F\u7684\u53D1\u5230\u90A3\u4E2A\u7FA4\u91CC\uFF08\u5E76 @ \u539F\u8BF4\u8BDD\u4EBA\uFF09\u3002
              </div>
            </label>
            <label class="switch"><input type="checkbox" v-model="rp.enabled" /><span class="slider"></span></label>
          </div>
          <div class="rcq-form" style="margin-top:6px">
            <label class="rcq-fi"><span>\u4ECE\u54EA\u91CC\u6311</span>
              <select class="input" v-model="rp.scope">
                <option value="enabled_groups">\u5DF2\u542F\u7528\u7684\u7FA4\u804A\uFF08\u63A8\u8350\uFF09</option>
                <option value="all_groups">\u6240\u6709\u7FA4\u804A</option>
              </select>
            </label>
          </div>
          <div class="rcq-note">
            \u300C\u5DF2\u542F\u7528\u7684\u7FA4\u804A\u300D= \u5728\u300C\u4F1A\u8BDD\u7BA1\u7406\u300D\u91CC\u6253\u5F00\u5F00\u5173\u7684\u90A3\u4E9B\u7FA4\u3002\u8FD8\u6CA1\u542F\u7528\u7684\u7FA4\u4E0D\u53C2\u4E0E\u6311\u9009\u3002
          </div>
        </div>

        <div class="rcq-sec">
          <div class="switch-row">
            <label>\u5141\u8BB8 #sl \u72B6\u6001\u6307\u4EE4
              <div class="rcq-note">
                \u4EFB\u610F\u7FA4\u804A / \u79C1\u804A\u91CC\u53D1 <b>#sl</b>\uFF0C\u673A\u5668\u4EBA\u56DE\u4E00\u6761 SnowLuma \u72B6\u6001
                \uFF08\u5BB9\u5668\u3001QQ \u767B\u5F55\u3001OneBot \u8FDE\u63A5\u3001\u6D88\u606F\u6863\u6848\u6761\u6570\uFF09\u3002
                \u5173\u6389\u540E #sl \u53EA\u662F\u666E\u901A\u6D88\u606F\uFF0C\u8D70\u6B63\u5E38\u7684 @ / \u5524\u9192\u89C4\u5219\u3002
              </div>
            </label>
            <label class="switch"><input type="checkbox" v-model="sl.enabled" /><span class="slider"></span></label>
          </div>
          <div class="rcq-form" style="margin-top:6px">
            <label class="rcq-fi"><span>\u89E6\u53D1\u5173\u952E\u8BCD</span>
              <input class="input" v-model="sl.keyword" placeholder="#sl" /></label>
            <label class="rcq-fi"><span>\u51B7\u5374\uFF08\u79D2\uFF09</span>
              <input class="input rcq-num" type="number" min="1" max="600" v-model="sl.cooldown" /></label>
          </div>
          <div class="rcq-note">\u540C\u4E00\u4F1A\u8BDD\u5728\u51B7\u5374\u65F6\u95F4\u5185\u53EA\u56DE\u4E00\u6B21\uFF0C\u907F\u514D\u7FA4\u91CC\u5237\u5C4F\u3002</div>
        </div>

        <div class="rcq-flex" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveFeat">\u4FDD\u5B58</button>
        </div>

        <div class="rcq-sec">
          <div class="rcq-ph" style="margin-bottom:10px"><b>\u8BD5\u4E00\u4E0B\u641C\u7D22</b>
            <span class="rcq-hint">\u9A8C\u8BC1 Bing \u901A\u9053\u901A\u4E0D\u901A</span></div>
          <div class="rcq-flex">
            <input class="input" style="flex:1;min-width:160px" v-model="searchQ"
              @keyup.enter="testSearch" placeholder="\u4F8B\u5982\uFF1A\u676D\u5DDE\u5929\u6C14" />
            <button class="btn btn-sm" :disabled="busy === 'search'" @click="testSearch">\u641C\u7D22</button>
          </div>
          <div v-if="searchOut" style="margin-top:10px">
            <div class="rcq-list">
              <div class="rcq-row" v-for="(r, i) in (searchOut.results || [])" :key="i">
                <div class="main">
                  <div class="t">{{ r.title }}</div>
                  <div class="d" style="white-space:normal">{{ r.snippet }}</div>
                  <div class="d rcq-mono">{{ r.url }}</div>
                </div>
              </div>
              <div v-if="!(searchOut.results || []).length" class="rcq-empty">\u6CA1\u6709\u7ED3\u679C</div>
            </div>
          </div>
        </div>
      </div>

      <!-- \u8FDE\u63A5 -->
      <div v-if="tab === 'conn' && conn">
        <div class="rcq-ph" style="margin-bottom:10px"><b>SnowLuma\uFF08\u534F\u8BAE\u7AEF\uFF09</b><span class="sp"></span>
          <span class="rcq-lamp"><b :class="conn.snowluma && conn.snowluma.ok ? 'on' : 'off'"></b>
            {{ conn.snowluma && conn.snowluma.ok ? '\u5BB9\u5668\u5728\u8FD0\u884C' : '\u5BB9\u5668\u672A\u8FD0\u884C' }}</span></div>
        <div class="rcq-note" v-if="conn.snowluma && conn.snowluma.error">{{ conn.snowluma.error }}</div>
        <div class="rcq-note">
          QQ \u8DD1\u5728 Docker \u5BB9\u5668 <code>snowluma</code> \u91CC\uFF08OneBot WS 3001 / HTTP 3000 / noVNC 6081\uFF09\u3002
          \u5BB9\u5668\u6CA1\u8D77\u5C31\u53BB\u300CQQ \u8D26\u6237\u300D\u70B9\u300C\u542F\u52A8\u300D\u6216\u300C\u626B\u7801\u767B\u5F55\u300D\u3002
        </div>

        <div class="rcq-sec">
          <div class="rcq-ph" style="margin-bottom:10px"><b>rcbot\uFF08\u673A\u5668\u4EBA\uFF09</b><span class="sp"></span>
            <span class="rcq-lamp"><b :class="conn.rcbot && conn.rcbot.ok ? 'on' : 'off'"></b>
              {{ conn.rcbot && conn.rcbot.ok ? '\u5DF2\u8FDE\u901A' : '\u8FDE\u4E0D\u4E0A' }}</span></div>
          <div class="rcq-form">
            <label class="rcq-fi wide"><span>HTTP \u5730\u5740</span>
              <input class="input" v-model="conn.config.api" placeholder="http://127.0.0.1:6710" /></label>
            <label class="rcq-fi"><span>\u8BF7\u6C42\u8D85\u65F6\uFF08\u79D2\uFF09</span>
              <input class="input" type="number" v-model="conn.config.timeout" /></label>
          </div>
          <div class="rcq-note" v-if="conn.rcbot && conn.rcbot.error">{{ conn.rcbot.error }}</div>
        </div>

        <div class="rcq-flex" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveConn">\u4FDD\u5B58</button>
          <span class="rcq-hint">\u63D2\u4EF6\u7248\u672C v{{ conn.version }}</span>
        </div>
      </div>
    </div>
  </div>`},up=[{id:"im",label:"\u6D88\u606F",comp:lp,fullscreen:!0},{id:"overview",label:"\u6982\u89C8",comp:Rf},{id:"account",label:"QQ \u8D26\u6237",comp:Of},{id:"query",label:"\u67E5\u8BE2",comp:Lf},{id:"media",label:"\u5A92\u4F53\u5E93",comp:Pf},{id:"cards",label:"\u89D2\u8272\u5361\u7247",comp:Ff},{id:"sessions",label:"\u4F1A\u8BDD\u7BA1\u7406",comp:zf},{id:"providers",label:"\u6A21\u578B\u63D0\u4F9B\u5546",comp:Bf},{id:"logs",label:"\u8FD0\u884C\u65E5\u5FD7",comp:jf},{id:"settings",label:"\u8BBE\u7F6E",comp:Df}],$f={data(){let e="overview";try{let t=localStorage.getItem(pp);t&&up.some(i=>i.id===t)&&(e=t)}catch{}return{S:yt,tab:e,TABS:up,conn:null,key:0}},computed:{cur(){return(this.TABS.find(e=>e.id===this.tab)||this.TABS[0]).comp},isFull(){let e=this.TABS.find(t=>t.id===this.tab);return!!(e&&e.fullscreen)},slOn(){return!!(this.conn&&this.conn.snowluma&&this.conn.snowluma.ok)},rbOn(){return!!(this.conn&&this.conn.rcbot&&this.conn.rcbot.ok)}},async mounted(){await this.check()},methods:{async check(){try{this.conn=await Ue("qqbot.conn.get")}catch{}},go(e){this.tab=e;try{localStorage.setItem(pp,e)}catch{}this.check()},onImClose(){this.go("overview")},refresh(){this.key++,this.check()}},template:`
  <div class="rcq">
    <div class="rcq-bar" v-if="!isFull">
      <div class="rcq-tab" v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }"
        @click="go(t.id)">{{ t.label }}</div>
      <div class="rcq-bar-r">
        <span class="rcq-lamp"><b :class="slOn ? 'on' : 'off'"></b>SnowLuma</span>
        <span class="rcq-lamp"><b :class="rbOn ? 'on' : 'off'"></b>Bot</span>
        <button class="btn btn-sm" @click="refresh">\u5237\u65B0</button>
      </div>
    </div>

    <component :is="cur" :key="tab + '-' + key" @close="onImClose" />

    <div class="rcq-toast" v-if="S.toast" :class="S.toastKind">{{ S.toast }}</div>
  </div>`};function Uf(e,t){If(),cp(),Er=t,Kd(t);let i=js($f),s=()=>{try{i.unmount()}catch{}};return i.mount(e),s}function Vf(e){e.__rcPluginV4__=e.__rcPluginV4__||{},e.__rcPluginV4__[Af]={pages:[{path:"",title:"QQ Bot"}],mount:Uf}}typeof window<"u"&&Vf(window);})();
