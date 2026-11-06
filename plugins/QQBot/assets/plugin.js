(()=>{var So,De,Se,Cn,Tn,As,Ji,Ns,Wr,Ci,Ui,oi,Jr;function yt(e){let t=Object.create(null);for(let i of e.split(","))t[i]=1;return i=>i in t}var de={},Gi=[],He=()=>{},Hi=()=>!1,Li=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&(e.charCodeAt(2)>122||97>e.charCodeAt(2)),ar=e=>e.startsWith("onUpdate:"),ce=Object.assign,Na=(e,t)=>{let i=e.indexOf(t);i>-1&&e.splice(i,1)},Mp=Object.prototype.hasOwnProperty,ge=(e,t)=>Mp.call(e,t),J=Array.isArray,te=e=>typeof e=="function",ne=e=>typeof e=="string",Ze=e=>typeof e=="symbol",he=e=>e!==null&&typeof e=="object",Ea=e=>(he(e)||te(e))&&te(e.then)&&te(e.catch),Ne=Object.prototype.toString,or=e=>ne(e)&&e!=="NaN"&&e[0]!=="-"&&""+parseInt(e,10)===e,Ht=yt(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"),Ip=yt("bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"),lr=e=>{let t=Object.create(null);return i=>t[i]||(t[i]=e(i))},Rp=/-\w/g,we=lr(e=>e.replace(Rp,t=>t.slice(1).toUpperCase())),Op=/\B([A-Z])/g,dt=lr(e=>e.replace(Op,"-$1").toLowerCase()),Di=lr(e=>e.charAt(0).toUpperCase()+e.slice(1)),Yi=lr(e=>e?`on${Di(e)}`:""),$e=(e,t)=>!Object.is(e,t),Xi=(e,...t)=>{for(let i=0;i<e.length;i++)e[i](...t)},Ol=(e,t,i,n=!1)=>{Object.defineProperty(e,t,{configurable:!0,enumerable:!1,writable:n,value:i})},cr=e=>{let t=parseFloat(e);return isNaN(t)?e:t},Zi=e=>{let t=ne(e)?Number(e):NaN;return isNaN(t)?e:t},dr=()=>So||(So="u">typeof globalThis?globalThis:"u">typeof self?self:"u">typeof window?window:"u">typeof global?global:{}),Pp=yt("Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol");function Qn(e){if(J(e)){let t={};for(let i=0;i<e.length;i++){let n=e[i],s=ne(n)?Pl(n):Qn(n);if(s)for(let r in s)t[r]=s[r]}return t}if(ne(e)||he(e))return e}var Bp=/;(?![^(]*\))/g,Lp=/:([^]+)/,Dp=/\/\*[^]*?\*\//g;function Pl(e){let t={};return e.replace(Dp,"").split(Bp).forEach(i=>{if(i){let n=i.split(Lp);n.length>1&&(t[n[0].trim()]=n[1].trim())}}),t}function Wn(e){let t="";if(ne(e))t=e;else if(J(e))for(let i=0;i<e.length;i++){let n=Wn(e[i]);n&&(t+=n+" ")}else if(he(e))for(let i in e)e[i]&&(t+=i+" ");return t.trim()}function Fp(e){if(!e)return null;let{class:t,style:i}=e;return t&&!ne(t)&&(e.class=Wn(t)),i&&(e.style=Qn(i)),e}var jp=yt("html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot"),Up=yt("svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view"),$p=yt("annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics"),zp=yt("area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr"),Vp=yt("itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly");function Gt(e,t){let i,n;if(e===t)return!0;let s=(i=e,Ne.call(i)==="[object Date]"),r=(n=t,Ne.call(n)==="[object Date]");if(s||r)return!!s&&!!r&&e.getTime()===t.getTime();if(s=Ze(e),r=Ze(t),s||r)return e===t;if(s=J(e),r=J(t),s||r)return!!s&&!!r&&function(a,o){if(a.length!==o.length)return!1;let l=!0;for(let c=0;l&&c<a.length;c++)l=Gt(a[c],o[c]);return l}(e,t);if(s=he(e),r=he(t),s||r){if(!s||!r||Object.keys(e).length!==Object.keys(t).length)return!1;for(let a in e){let o=e.hasOwnProperty(a),l=t.hasOwnProperty(a);if(o&&!l||!o&&l||!Gt(e[a],t[a]))return!1}}return String(e)===String(t)}function pr(e,t){return e.findIndex(i=>Gt(i,t))}var Bl=e=>!!(e&&e.__v_isRef===!0),Ll=e=>ne(e)?e:e==null?"":J(e)||he(e)&&(e.toString===Ne||!te(e.toString))?Bl(e)?Ll(e.value):JSON.stringify(e,Dl,2):String(e),Dl=(e,t)=>{let i;if(Bl(t))return Dl(e,t.value);if(i=t,Ne.call(i)==="[object Map]")return{[`Map(${t.size})`]:[...t.entries()].reduce((n,[s,r],a)=>(n[Mr(s,a)+" =>"]=r,n),{})};{let n;if(n=t,Ne.call(n)==="[object Set]")return{[`Set(${t.size})`]:[...t.values()].map(s=>Mr(s))};{if(Ze(t))return Mr(t);let s;if(he(t)&&!J(t)&&(s=t,Ne.call(s)!=="[object Object]"))return String(t)}}return t},Mr=(e,t="")=>{var i;return Ze(e)?`Symbol(${(i=e.description)!=null?i:t})`:e},On=class{constructor(t=!1){this.detached=t,this._active=!0,this._on=0,this.effects=[],this.cleanups=[],this._isPaused=!1,this._warnOnRun=!0,this.__v_skip=!0,!t&&De&&(De.active?(this.parent=De,this.index=(De.scopes||(De.scopes=[])).push(this)-1):(this._active=!1,this._warnOnRun=!1))}get active(){return this._active}pause(){if(this._active){let t,i;if(this._isPaused=!0,this.scopes){let n=this.scopes.slice();for(t=0,i=n.length;t<i;t++)n[t].pause()}for(t=0,i=this.effects.length;t<i;t++)this.effects[t].pause()}}resume(){if(this._active&&this._isPaused){let t,i;if(this._isPaused=!1,this.scopes){let s=this.scopes.slice();for(t=0,i=s.length;t<i;t++)s[t].resume()}let n=this.effects.slice();for(t=0,i=n.length;t<i;t++)n[t].resume()}}run(t){if(this._active){let i=De;try{return De=this,t()}finally{De=i}}}on(){++this._on==1&&(this.prevScope=De,De=this)}off(){if(this._on>0&&--this._on==0){if(De===this)De=this.prevScope;else{let t=De;for(;t;){if(t.prevScope===this){t.prevScope=this.prevScope;break}t=t.prevScope}}this.prevScope=void 0}}stop(t){if(this._active){let i,n;for(this._active=!1,i=0,n=this.effects.length;i<n;i++)this.effects[i].stop();for(this.effects.length=0,i=0,n=this.cleanups.length;i<n;i++)this.cleanups[i]();if(this.cleanups.length=0,this.scopes){let s=this.scopes.slice();for(i=0,n=s.length;i<n;i++)s[i].stop(!0);this.scopes.length=0}if(!this.detached&&this.parent&&!t){let s=this.parent.scopes.pop();s&&s!==this&&(this.parent.scopes[this.index]=s,s.index=this.index)}this.parent=void 0}}};function Hp(e){return new On(e)}function Fl(){return De}function Kp(e,t=!1){De&&De.cleanups.push(e)}var Ir=new WeakSet,Mi=class{constructor(t){this.fn=t,this.deps=void 0,this.depsTail=void 0,this.flags=5,this.next=void 0,this.cleanup=void 0,this.scheduler=void 0,De&&(De.active?De.effects.push(this):this.flags&=-2)}pause(){this.flags|=64}resume(){64&this.flags&&(this.flags&=-65,Ir.has(this)&&(Ir.delete(this),this.trigger()))}notify(){(!(2&this.flags)||32&this.flags)&&(8&this.flags||jl(this))}run(){if(!(1&this.flags))return this.fn();this.flags|=2,qo(this),Ul(this);let t=Se,i=Tt;Se=this,Tt=!0;try{return this.fn()}finally{$l(this),Se=t,Tt=i,this.flags&=-3}}stop(){if(1&this.flags){for(let t=this.deps;t;t=t.nextDep)Ia(t);this.deps=this.depsTail=void 0,qo(this),this.onStop&&this.onStop(),this.flags&=-2}}trigger(){64&this.flags?Ir.add(this):this.scheduler?this.scheduler():this.runIfDirty()}runIfDirty(){Gr(this)&&this.run()}get dirty(){return Gr(this)}},ur=0;function jl(e,t=!1){if(e.flags|=8,t){e.next=Tn,Tn=e;return}e.next=Cn,Cn=e}function Ma(){let e;if(!(--ur>0)){if(Tn){let t=Tn;for(Tn=void 0;t;){let i=t.next;t.next=void 0,t.flags&=-9,t=i}}for(;Cn;){let t=Cn;for(Cn=void 0;t;){let i=t.next;if(t.next=void 0,t.flags&=-9,1&t.flags)try{t.trigger()}catch(n){e||(e=n)}t=i}}if(e)throw e}}function Ul(e){for(let t=e.deps;t;t=t.nextDep)t.version=-1,t.prevActiveLink=t.dep.activeLink,t.dep.activeLink=t}function $l(e){let t,i=e.depsTail,n=i;for(;n;){let s=n.prevDep;n.version===-1?(n===i&&(i=s),Ia(n),function(r){let{prevDep:a,nextDep:o}=r;a&&(a.nextDep=o,r.prevDep=void 0),o&&(o.prevDep=a,r.nextDep=void 0)}(n)):t=n,n.dep.activeLink=n.prevActiveLink,n.prevActiveLink=void 0,n=s}e.deps=t,e.depsTail=i}function Gr(e){for(let t=e.deps;t;t=t.nextDep)if(t.dep.version!==t.version||t.dep.computed&&(zl(t.dep.computed)||t.dep.version!==t.version))return!0;return!!e._dirty}function zl(e){if(4&e.flags&&!(16&e.flags)||(e.flags&=-17,e.globalVersion===Pn)||(e.globalVersion=Pn,!e.isSSR&&128&e.flags&&(!e.deps&&!e._dirty||!Gr(e))))return;e.flags|=2;let t=e.dep,i=Se,n=Tt;Se=e,Tt=!0;try{Ul(e);let s=e.fn(e._value);(t.version===0||$e(s,e._value))&&(e.flags|=128,e._value=s,t.version++)}catch(s){throw t.version++,s}finally{Se=i,Tt=n,$l(e),e.flags&=-3}}function Ia(e,t=!1){let{dep:i,prevSub:n,nextSub:s}=e;if(n&&(n.nextSub=s,e.prevSub=void 0),s&&(s.prevSub=n,e.nextSub=void 0),i.subs===e&&(i.subs=n,!n&&i.computed)){i.computed.flags&=-5;for(let r=i.computed.deps;r;r=r.nextDep)Ia(r,!0)}t||--i.sc||!i.map||i.map.delete(i.key)}function Qp(e,t){e.effect instanceof Mi&&(e=e.effect.fn);let i=new Mi(e);t&&ce(i,t);try{i.run()}catch(s){throw i.stop(),s}let n=i.run.bind(i);return n.effect=i,n}function Wp(e){e.effect.stop()}var Tt=!0,Vl=[];function Yt(){Vl.push(Tt),Tt=!1}function Xt(){let e=Vl.pop();Tt=e===void 0||e}function qo(e){let{cleanup:t}=e;if(e.cleanup=void 0,t){let i=Se;Se=void 0;try{t()}finally{Se=i}}}var Pn=0,Yr=class{constructor(t,i){this.sub=t,this.dep=i,this.version=i.version,this.nextDep=this.prevDep=this.nextSub=this.prevSub=this.prevActiveLink=void 0}},rn=class{constructor(t){this.computed=t,this.version=0,this.activeLink=void 0,this.subs=void 0,this.map=void 0,this.key=void 0,this.sc=0,this.__v_skip=!0}track(t){if(!Se||!Tt||Se===this.computed)return;let i=this.activeLink;if(i===void 0||i.sub!==Se)i=this.activeLink=new Yr(Se,this),Se.deps?(i.prevDep=Se.depsTail,Se.depsTail.nextDep=i,Se.depsTail=i):Se.deps=Se.depsTail=i,function n(s){if(s.dep.sc++,4&s.sub.flags){let r=s.dep.computed;if(r&&!s.dep.subs){r.flags|=20;for(let o=r.deps;o;o=o.nextDep)n(o)}let a=s.dep.subs;a!==s&&(s.prevSub=a,a&&(a.nextSub=s)),s.dep.subs=s}}(i);else if(i.version===-1&&(i.version=this.version,i.nextDep)){let n=i.nextDep;n.prevDep=i.prevDep,i.prevDep&&(i.prevDep.nextDep=n),i.prevDep=Se.depsTail,i.nextDep=void 0,Se.depsTail.nextDep=i,Se.depsTail=i,Se.deps===i&&(Se.deps=n)}return i}trigger(t){this.version++,Pn++,this.notify(t)}notify(t){ur++;try{for(let i=this.subs;i;i=i.prevSub)i.sub.notify()&&i.sub.dep.notify()}finally{Ma()}}},Es=new WeakMap,Ti=Symbol(""),Xr=Symbol(""),Bn=Symbol("");function Ye(e,t,i){if(Tt&&Se){let n=Es.get(e);n||Es.set(e,n=new Map);let s=n.get(i);s||(n.set(i,s=new rn),s.map=n,s.key=i),s.track()}}function $t(e,t,i,n,s,r){let a=Es.get(e);if(!a)return void Pn++;let o=l=>{l&&l.trigger()};if(ur++,t==="clear")a.forEach(o);else{let l=J(e),c=l&&or(i);if(l&&i==="length"){let d=Number(n);a.forEach((p,u)=>{(u==="length"||u===Bn||!Ze(u)&&u>=d)&&o(p)})}else switch((i!==void 0||a.has(void 0))&&o(a.get(i)),c&&o(a.get(Bn)),t){case"add":if(l)c&&o(a.get("length"));else{let p;o(a.get(Ti)),p=e,Ne.call(p)==="[object Map]"&&o(a.get(Xr))}break;case"delete":if(!l){let p;o(a.get(Ti)),p=e,Ne.call(p)==="[object Map]"&&o(a.get(Xr))}break;case"set":let d;d=e,Ne.call(d)==="[object Map]"&&o(a.get(Ti))}}Ma()}function $i(e){let t=ue(e);return t===e?t:(Ye(t,"iterate",Bn),ut(e)?t:t.map(At))}function fr(e){return Ye(e=ue(e),"iterate",Bn),e}function Ot(e,t){return Pt(e)?Kt(e)?en(At(t)):en(t):At(t)}var Jp={__proto__:null,[Symbol.iterator](){return Rr(this,Symbol.iterator,e=>Ot(this,e))},concat(...e){return $i(this).concat(...e.map(t=>J(t)?$i(t):t))},entries(){return Rr(this,"entries",e=>(e[1]=Ot(this,e[1]),e))},every(e,t){return Dt(this,"every",e,t,void 0,arguments)},filter(e,t){return Dt(this,"filter",e,t,i=>i.map(n=>Ot(this,n)),arguments)},find(e,t){return Dt(this,"find",e,t,i=>Ot(this,i),arguments)},findIndex(e,t){return Dt(this,"findIndex",e,t,void 0,arguments)},findLast(e,t){return Dt(this,"findLast",e,t,i=>Ot(this,i),arguments)},findLastIndex(e,t){return Dt(this,"findLastIndex",e,t,void 0,arguments)},forEach(e,t){return Dt(this,"forEach",e,t,void 0,arguments)},includes(...e){return Or(this,"includes",e)},indexOf(...e){return Or(this,"indexOf",e)},join(e){return $i(this).join(e)},lastIndexOf(...e){return Or(this,"lastIndexOf",e)},map(e,t){return Dt(this,"map",e,t,void 0,arguments)},pop(){return vn(this,"pop")},push(...e){return vn(this,"push",e)},reduce(e,...t){return Co(this,"reduce",e,t)},reduceRight(e,...t){return Co(this,"reduceRight",e,t)},shift(){return vn(this,"shift")},some(e,t){return Dt(this,"some",e,t,void 0,arguments)},splice(...e){return vn(this,"splice",e)},toReversed(){return $i(this).toReversed()},toSorted(e){return $i(this).toSorted(e)},toSpliced(...e){return $i(this).toSpliced(...e)},unshift(...e){return vn(this,"unshift",e)},values(){return Rr(this,"values",e=>Ot(this,e))}};function Rr(e,t,i){let n=fr(e),s=n[t]();return n===e||ut(e)||(s._next=s.next,s.next=()=>{let r=s._next();return r.done||(r.value=i(r.value)),r}),s}var Gp=Array.prototype;function Dt(e,t,i,n,s,r){let a=fr(e),o=a!==e&&!ut(e),l=a[t];if(l!==Gp[t]){let p=l.apply(e,r);return o?At(p):p}let c=i;a!==e&&(o?c=function(p,u){return i.call(this,Ot(e,p),u,e)}:i.length>2&&(c=function(p,u){return i.call(this,p,u,e)}));let d=l.call(a,c,n);return o&&s?s(d):d}function Co(e,t,i,n){let s=fr(e),r=s!==e&&!ut(e),a=i,o=!1;s!==e&&(r?(o=n.length===0,a=function(c,d,p){return o&&(o=!1,c=Ot(e,c)),i.call(this,c,Ot(e,d),p,e)}):i.length>3&&(a=function(c,d,p){return i.call(this,c,d,p,e)}));let l=s[t](a,...n);return o?Ot(e,l):l}function Or(e,t,i){let n=ue(e);Ye(n,"iterate",Bn);let s=n[t](...i);return(s===-1||s===!1)&&Jn(i[0])?(i[0]=ue(i[0]),n[t](...i)):s}function vn(e,t,i=[]){Yt(),ur++;let n=ue(e)[t].apply(e,i);return Ma(),Xt(),n}var Yp=yt("__proto__,__v_isRef,__isVue"),Hl=new Set(Object.getOwnPropertyNames(Symbol).filter(e=>e!=="arguments"&&e!=="caller").map(e=>Symbol[e]).filter(Ze));function Xp(e){Ze(e)||(e=String(e));let t=ue(this);return Ye(t,"has",e),t.hasOwnProperty(e)}var Ms=class{constructor(t=!1,i=!1){this._isReadonly=t,this._isShallow=i}get(t,i,n){if(i==="__v_skip")return t.__v_skip;let s=this._isReadonly,r=this._isShallow;if(i==="__v_isReactive")return!s;if(i==="__v_isReadonly")return s;if(i==="__v_isShallow")return r;if(i==="__v_raw")return n===(s?r?Jl:Wl:r?Ql:Kl).get(t)||Object.getPrototypeOf(t)===Object.getPrototypeOf(n)?t:void 0;let a=J(t);if(!s){let l;if(a&&(l=Jp[i]))return l;if(i==="hasOwnProperty")return Xp}let o=Reflect.get(t,i,Le(t)?t:n);if((Ze(i)?Hl.has(i):Yp(i))||(s||Ye(t,"get",i),r))return o;if(Le(o)){let l=a&&or(i)?o:o.value;return s&&he(l)?Os(l):l}return he(o)?s?Os(o):fi(o):o}},Is=class extends Ms{constructor(t=!1){super(!1,t)}set(t,i,n,s){let r=t[i],a=J(t)&&or(i);if(!this._isShallow){let c=Pt(r);if(ut(n)||Pt(n)||(r=ue(r),n=ue(n)),!a&&Le(r)&&!Le(n))return c||(r.value=n),!0}let o=a?Number(i)<t.length:ge(t,i),l=Reflect.set(t,i,n,Le(t)?t:s);return t===ue(s)&&l&&(o?$e(n,r)&&$t(t,"set",i,n):$t(t,"add",i,n)),l}deleteProperty(t,i){let n=ge(t,i);t[i];let s=Reflect.deleteProperty(t,i);return s&&n&&$t(t,"delete",i,void 0),s}has(t,i){let n=Reflect.has(t,i);return Ze(i)&&Hl.has(i)||Ye(t,"has",i),n}ownKeys(t){return Ye(t,"iterate",J(t)?"length":Ti),Reflect.ownKeys(t)}},Rs=class extends Ms{constructor(t=!1){super(!0,t)}set(t,i){return!0}deleteProperty(t,i){return!0}},Zp=new Is,eu=new Rs,tu=new Is(!0),iu=new Rs(!0),Pr=e=>e;function ds(e){return function(){return e!=="delete"&&(e==="clear"?void 0:this)}}function hr(e,t){let i,n=(ce(i={get(s){let r=this.__v_raw,a=ue(r),o=ue(s);e||($e(s,o)&&Ye(a,"get",s),Ye(a,"get",o));let{has:l}=Reflect.getPrototypeOf(a),c=t?Pr:e?en:At;return l.call(a,s)?c(r.get(s)):l.call(a,o)?c(r.get(o)):void(r!==a&&r.get(s))},get size(){let s=this.__v_raw;return e||Ye(ue(s),"iterate",Ti),s.size},has(s){let r=this.__v_raw,a=ue(r),o=ue(s);return e||($e(s,o)&&Ye(a,"has",s),Ye(a,"has",o)),s===o?r.has(s):r.has(s)||r.has(o)},forEach(s,r){let a=this,o=a.__v_raw,l=ue(o),c=t?Pr:e?en:At;return e||Ye(l,"iterate",Ti),o.forEach((d,p)=>s.call(r,c(d),c(p),a))}},e?{add:ds("add"),set:ds("set"),delete:ds("delete"),clear:ds("clear")}:{add(s){let r=ue(this),a=Reflect.getPrototypeOf(r),o=ue(s),l=t||ut(s)||Pt(s)?s:o;return a.has.call(r,l)||$e(s,l)&&a.has.call(r,s)||$e(o,l)&&a.has.call(r,o)||(r.add(l),$t(r,"add",l,l)),this},set(s,r){t||ut(r)||Pt(r)||(r=ue(r));let a=ue(this),{has:o,get:l}=Reflect.getPrototypeOf(a),c=o.call(a,s);c||(s=ue(s),c=o.call(a,s));let d=l.call(a,s);return a.set(s,r),c?$e(r,d)&&$t(a,"set",s,r):$t(a,"add",s,r),this},delete(s){let r=ue(this),{has:a,get:o}=Reflect.getPrototypeOf(r),l=a.call(r,s);l||(s=ue(s),l=a.call(r,s)),o&&o.call(r,s);let c=r.delete(s);return l&&$t(r,"delete",s,void 0),c},clear(){let s=ue(this),r=s.size!==0,a=s.clear();return r&&$t(s,"clear",void 0,void 0),a}}),["keys","values","entries",Symbol.iterator].forEach(s=>{i[s]=function(...r){let a,o=this.__v_raw,l=ue(o),c=(a=l,Ne.call(a)==="[object Map]"),d=s==="entries"||s===Symbol.iterator&&c,p=o[s](...r),u=t?Pr:e?en:At;return e||Ye(l,"iterate",s==="keys"&&c?Xr:Ti),ce(Object.create(p),{next(){let{value:w,done:g}=p.next();return g?{value:w,done:g}:{value:d?[u(w[0]),u(w[1])]:u(w),done:g}}})}}),i);return(s,r,a)=>r==="__v_isReactive"?!e:r==="__v_isReadonly"?e:r==="__v_raw"?s:Reflect.get(ge(n,r)&&r in s?n:s,r,a)}var nu={get:hr(!1,!1)},su={get:hr(!1,!0)},ru={get:hr(!0,!1)},au={get:hr(!0,!0)},Kl=new WeakMap,Ql=new WeakMap,Wl=new WeakMap,Jl=new WeakMap;function fi(e){return Pt(e)?e:mr(e,!1,Zp,nu,Kl)}function Gl(e){return mr(e,!1,tu,su,Ql)}function Os(e){return mr(e,!0,eu,ru,Wl)}function ou(e){return mr(e,!0,iu,au,Jl)}function mr(e,t,i,n,s){let r;if(!he(e)||e.__v_raw&&!(t&&e.__v_isReactive)||e.__v_skip||!Object.isExtensible(e))return e;let a=s.get(e);if(a)return a;let o=function(c){switch(c){case"Object":case"Array":return 1;case"Map":case"Set":case"WeakMap":case"WeakSet":return 2;default:return 0}}((r=e,Ne.call(r)).slice(8,-1));if(o===0)return e;let l=new Proxy(e,o===2?n:i);return s.set(e,l),l}function Kt(e){return Pt(e)?Kt(e.__v_raw):!!(e&&e.__v_isReactive)}function Pt(e){return!!(e&&e.__v_isReadonly)}function ut(e){return!!(e&&e.__v_isShallow)}function Jn(e){return!!e&&!!e.__v_raw}function ue(e){let t=e&&e.__v_raw;return t?ue(t):e}function Yl(e){return!ge(e,"__v_skip")&&Object.isExtensible(e)&&Ol(e,"__v_skip",!0),e}var At=e=>he(e)?fi(e):e,en=e=>he(e)?Os(e):e;function Le(e){return!!e&&e.__v_isRef===!0}function An(e){return Zl(e,!1)}function Xl(e){return Zl(e,!0)}function Zl(e,t){return Le(e)?e:new Zr(e,t)}var Zr=class{constructor(t,i){this.dep=new rn,this.__v_isRef=!0,this.__v_isShallow=!1,this._rawValue=i?t:ue(t),this._value=i?t:At(t),this.__v_isShallow=i}get value(){return this.dep.track(),this._value}set value(t){let i=this._rawValue,n=this.__v_isShallow||ut(t)||Pt(t);$e(t=n?t:ue(t),i)&&(this._rawValue=t,this._value=n?t:At(t),this.dep.trigger())}};function lu(e){e.dep&&e.dep.trigger()}function Gn(e){return Le(e)?e.value:e}function cu(e){return te(e)?e():Gn(e)}var du={get:(e,t,i)=>t==="__v_raw"?e:Gn(Reflect.get(e,t,i)),set:(e,t,i,n)=>{let s=e[t];return Le(s)&&!Le(i)?(s.value=i,!0):Reflect.set(e,t,i,n)}};function Ra(e){return Kt(e)?e:new Proxy(e,du)}var ea=class{constructor(t){this.__v_isRef=!0,this._value=void 0;let i=this.dep=new rn,{get:n,set:s}=t(i.track.bind(i),i.trigger.bind(i));this._get=n,this._set=s}get value(){return this._value=this._get()}set value(t){this._set(t)}};function ec(e){return new ea(e)}function pu(e){let t=J(e)?Array(e.length):{};for(let i in e)t[i]=new Ps(e,i,void 0);return t}var Ps=class{constructor(t,i,n){this._object=t,this._defaultValue=n,this.__v_isRef=!0,this._value=void 0,this._key=Ze(i)?i:String(i),this._raw=ue(t);let s=!0,r=t;if(!J(t)||Ze(this._key)||!or(this._key))do s=!Jn(r)||ut(r);while(s&&(r=r.__v_raw));this._shallow=s}get value(){let t=this._object[this._key];return this._shallow&&(t=Gn(t)),this._value=t===void 0?this._defaultValue:t}set value(t){if(this._shallow&&Le(this._raw[this._key])){let i=this._object[this._key];if(Le(i)){i.value=t;return}}this._object[this._key]=t}get dep(){var t,i;let n;return t=this._raw,i=this._key,(n=Es.get(t))&&n.get(i)}},ta=class{constructor(t){this._getter=t,this.__v_isRef=!0,this.__v_isReadonly=!0,this._value=void 0}get value(){return this._value=this._getter()}};function uu(e,t,i){return Le(e)?e:te(e)?new ta(e):!he(e)||!(arguments.length>1)?An(e):new Ps(e,t,i)}var ia=class{constructor(t,i,n){this.fn=t,this.setter=i,this._value=void 0,this.dep=new rn(this),this.__v_isRef=!0,this.deps=void 0,this.depsTail=void 0,this.flags=16,this.globalVersion=Pn-1,this.next=void 0,this.effect=this,this.__v_isReadonly=!i,this.isSSR=n}notify(){if(this.flags|=16,!(8&this.flags)&&Se!==this)return jl(this,!0),!0}get value(){let t=this.dep.track();return zl(this),t&&(t.version=this.dep.version),this._value}set value(t){this.setter&&this.setter(t)}},fu={GET:"get",HAS:"has",ITERATE:"iterate"},hu={SET:"set",ADD:"add",DELETE:"delete",CLEAR:"clear"},ps={},Bs=new WeakMap;function mu(){return oi}function tc(e,t=!1,i=oi){if(i){let n=Bs.get(i);n||Bs.set(i,n=[]),n.push(e)}}function zt(e,t=1/0,i){if(t<=0||!he(e)||e.__v_skip||((i=i||new Map).get(e)||0)>=t)return e;if(i.set(e,t),t--,Le(e))zt(e.value,t,i);else if(J(e))for(let n=0;n<e.length;n++)zt(e[n],t,i);else{let n,s;if(n=e,Ne.call(n)==="[object Set]"||(s=e,Ne.call(s)==="[object Map]"))e.forEach(r=>{zt(r,t,i)});else{let r;if(r=e,Ne.call(r)==="[object Object]"){for(let a in e)zt(e[a],t,i);for(let a of Object.getOwnPropertySymbols(e))Object.prototype.propertyIsEnumerable.call(e,a)&&zt(e[a],t,i)}}}return e}function gu(e,t){}var vu={SETUP_FUNCTION:0,0:"SETUP_FUNCTION",RENDER_FUNCTION:1,1:"RENDER_FUNCTION",NATIVE_EVENT_HANDLER:5,5:"NATIVE_EVENT_HANDLER",COMPONENT_EVENT_HANDLER:6,6:"COMPONENT_EVENT_HANDLER",VNODE_HOOK:7,7:"VNODE_HOOK",DIRECTIVE_HOOK:8,8:"DIRECTIVE_HOOK",TRANSITION_HOOK:9,9:"TRANSITION_HOOK",APP_ERROR_HANDLER:10,10:"APP_ERROR_HANDLER",APP_WARN_HANDLER:11,11:"APP_WARN_HANDLER",FUNCTION_REF:12,12:"FUNCTION_REF",ASYNC_COMPONENT_LOADER:13,13:"ASYNC_COMPONENT_LOADER",SCHEDULER:14,14:"SCHEDULER",COMPONENT_UPDATE:15,15:"COMPONENT_UPDATE",APP_UNMOUNT_CLEANUP:16,16:"APP_UNMOUNT_CLEANUP"};function pn(e,t,i,n){try{return n?e(...n):e()}catch(s){Fi(s,t,i)}}function vt(e,t,i,n){if(te(e)){let s=pn(e,t,i,n);return s&&Ea(s)&&s.catch(r=>{Fi(r,t,i)}),s}if(J(e)){let s=[];for(let r=0;r<e.length;r++)s.push(vt(e[r],t,i,n));return s}}function Fi(e,t,i,n=!0){let s=t?t.vnode:null,{errorHandler:r,throwUnhandledErrorInProduction:a}=t&&t.appContext.config||de;if(t){let o=t.parent,l=t.proxy,c=`https://vuejs.org/error-reference/#runtime-${i}`;for(;o;){let d=o.ec;if(d){for(let p=0;p<d.length;p++)if(d[p](e,l,c)===!1)return}o=o.parent}if(r){Yt(),pn(r,null,10,[e,l,c]),Xt();return}}(function(o,l=!0,c=!1){if(c)throw o;console.error(o)})(e,n,a)}var rt=[],It=-1,tn=[],li=null,Vi=0,ic=Promise.resolve(),Ss=null;function gr(e){let t=Ss||ic;return e?t.then(this?e.bind(this):e):t}function Oa(e){if(!(1&e.flags)){let t=Nn(e),i=rt[rt.length-1];!i||!(2&e.flags)&&t>=Nn(i)?rt.push(e):rt.splice(function(n){let s=It+1,r=rt.length;for(;s<r;){let a=s+r>>>1,o=rt[a],l=Nn(o);l<n||l===n&&2&o.flags?s=a+1:r=a}return s}(t),0,e),e.flags|=1,nc()}}function nc(){Ss||(Ss=ic.then(function e(t){try{for(It=0;It<rt.length;It++){let i=rt[It];i&&!(8&i.flags)&&(4&i.flags&&(i.flags&=-2),pn(i,i.i,i.i?15:14),4&i.flags||(i.flags&=-2))}}finally{for(;It<rt.length;It++){let i=rt[It];i&&(i.flags&=-2)}It=-1,rt.length=0,Ls(),Ss=null,(rt.length||tn.length)&&e()}}))}function Ln(e){J(e)?tn.push(...e):li&&e.id===-1?li.splice(Vi+1,0,e):1&e.flags||(tn.push(e),e.flags|=1),nc()}function To(e,t,i=It+1){for(;i<rt.length;i++){let n=rt[i];if(n&&2&n.flags){if(e&&n.id!==e.uid)continue;rt.splice(i,1),i--,4&n.flags&&(n.flags&=-2),n(),4&n.flags||(n.flags&=-2)}}}function Ls(e){if(tn.length){let t=[...new Set(tn)].sort((i,n)=>Nn(i)-Nn(n));if(tn.length=0,li)return void li.push(...t);for(li=t,Vi=0;Vi<li.length;Vi++){let i=li[Vi];4&i.flags&&(i.flags&=-2),8&i.flags||i(),i.flags&=-2}li=null,Vi=0}}var Nn=e=>e.id==null?2&e.flags?-1:1/0:e.id,Qe=null,vr=null;function Dn(e){let t=Qe;return Qe=e,vr=e&&e.type.__scopeId||null,t}function bu(e){vr=e}function yu(){vr=null}var xu=e=>Pa;function Pa(e,t=Qe,i){if(!t||e._n)return e;let n=(...s)=>{let r;n._d&&Un(-1);let a=Dn(t),o=Wt.length;try{r=e(...s)}finally{for(let l=Wt.length;l>o;l--)kr();Dn(a),n._d&&Un(1)}return r};return n._n=!0,n._c=!0,n._d=!0,n}function wu(e,t){if(Qe===null)return e;let i=ts(Qe),n=e.dirs||(e.dirs=[]);for(let s=0;s<t.length;s++){let[r,a,o,l=de]=t[s];r&&(te(r)&&(r={mounted:r,updated:r}),r.deep&&zt(a),n.push({dir:r,instance:i,value:a,oldValue:void 0,arg:o,modifiers:l}))}return e}function Rt(e,t,i,n){let s=e.dirs,r=t&&t.dirs;for(let a=0;a<s.length;a++){let o=s[a];r&&(o.oldValue=r[a].value);let l=o.dir[n];l&&(Yt(),vt(l,i,8,[e.el,o,e,t]),Xt())}}function sc(e,t){if(Ke){let i=Ke.provides,n=Ke.parent&&Ke.parent.provides;n===i&&(i=Ke.provides=Object.create(n)),i[e]=t}}function En(e,t,i=!1){let n=at();if(n||Ai){let s=Ai?Ai._context.provides:n?n.parent==null||n.ce?n.vnode.appContext&&n.vnode.appContext.provides:n.parent.provides:void 0;if(s&&e in s)return s[e];if(arguments.length>1)return i&&te(t)?t.call(n&&n.proxy):t}}function ku(){return!!(at()||Ai)}var rc=Symbol.for("v-scx"),ac=()=>En(rc);function _u(e,t){return Yn(e,null,t)}function Su(e,t){return Yn(e,null,{flush:"post"})}function oc(e,t){return Yn(e,null,{flush:"sync"})}function nn(e,t,i){return Yn(e,t,i)}function Yn(e,t,i=de){let n,{immediate:s,flush:r}=i,a=ce({},i),o=t&&s||!t&&r!=="post";if(Ri){if(r==="sync"){let p=ac();n=p.__watcherHandles||(p.__watcherHandles=[])}else if(!o){let p=()=>{};return p.stop=He,p.resume=He,p.pause=He,p}}let l=Ke;a.call=(p,u,w)=>vt(p,l,u,w);let c=!1;r==="post"?a.scheduler=p=>{Pe(p,l&&l.suspense)}:r!=="sync"&&(c=!0,a.scheduler=(p,u)=>{u?p():Oa(p)}),a.augmentJob=p=>{t&&(p.flags|=4),c&&(p.flags|=2,l&&(p.id=l.uid,p.i=l))};let d=function(p,u,w=de){let g,_,A,E,{immediate:h,deep:m,once:q,scheduler:T,augmentJob:N,call:f}=w,y=M=>m?M:ut(M)||m===!1||m===0?zt(M,1):zt(M),v=!1,k=!1;if(Le(p)?(_=()=>p.value,v=ut(p)):Kt(p)?(_=()=>y(p),v=!0):J(p)?(k=!0,v=p.some(M=>Kt(M)||ut(M)),_=()=>p.map(M=>Le(M)?M.value:Kt(M)?y(M):te(M)?f?f(M,2):M():void 0)):_=te(p)?u?f?()=>f(p,2):p:()=>{if(A){Yt();try{A()}finally{Xt()}}let M=oi;oi=g;try{return f?f(p,3,[E]):p(E)}finally{oi=M}}:He,u&&m){let M=_,z=m===!0?1/0:m;_=()=>zt(M(),z)}let S=Fl(),x=()=>{g.stop(),S&&S.active&&Na(S.effects,g)};if(q&&u){let M=u;u=(...z)=>{let B=M(...z);return x(),B}}let I=k?Array(p.length).fill(ps):ps,R=M=>{if(1&g.flags&&(g.dirty||M))if(u){let z=g.run();if(M||m||v||(k?z.some((B,V)=>$e(B,I[V])):$e(z,I))){A&&A();let B=oi;oi=g;try{let V=[z,I===ps?void 0:k&&I[0]===ps?[]:I,E];I=z,f?f(u,3,V):u(...V)}finally{oi=B}}}else g.run()};return N&&N(R),(g=new Mi(_)).scheduler=T?()=>T(R,!1):R,E=M=>tc(M,!1,g),A=g.onStop=()=>{let M=Bs.get(g);if(M){if(f)f(M,4);else for(let z of M)z();Bs.delete(g)}},u?h?R(!0):I=g.run():T?T(R.bind(null,!0),!0):g.run(),x.pause=g.pause.bind(g),x.resume=g.resume.bind(g),x.stop=x,x}(e,t,a);return Ri&&(n?n.push(d):o&&d()),d}function qu(e,t,i){let n,s=this.proxy,r=ne(e)?e.includes(".")?lc(s,e):()=>s[e]:e.bind(s,s);te(t)?n=t:(n=t.handler,i=t);let a=un(this),o=Yn(r,n.bind(s),i);return a(),o}function lc(e,t){let i=t.split(".");return()=>{let n=e;for(let s=0;s<i.length&&n;s++)n=n[i[s]];return n}}var ri=new WeakMap,cc=Symbol("_vte"),ki=e=>e&&(e.disabled||e.disabled===""),Ao=e=>"u">typeof SVGElement&&e instanceof SVGElement,No=e=>typeof MathMLElement=="function"&&e instanceof MathMLElement,Br=(e,t)=>{let i=e&&e.to;return ne(i)?t?t(i):null:i};function us(e,t,i,{o:{insert:n},m:s},r=2){r===0&&n(e.targetAnchor,t,i);let{el:a,anchor:o,shapeFlag:l,children:c,props:d}=e,p=r===2;if(p&&n(a,t,i),!ri.has(e)&&(!p||ki(d))&&16&l)for(let u=0;u<c.length;u++)s(c[u],t,i,2);p&&n(o,t,i)}var Cu={name:"Teleport",__isTeleport:!0,process(e,t,i,n,s,r,a,o,l,c){let{mc:d,pc:p,pbc:u,o:{insert:w,querySelector:g,createText:_,parentNode:A}}=c,E=ki(t.props),{dynamicChildren:h}=t,m=(N,f,y)=>{16&N.shapeFlag&&d(N.children,f,y,s,r,a,o,l)},q=(N=t)=>{let f=ki(N.props),y=N.target=Br(N.props,g),v=Lr(y,N,_,w);y&&(a!=="svg"&&Ao(y)?a="svg":a!=="mathml"&&No(y)&&(a="mathml"),s&&s.isCE&&(s.ce._teleportTargets||(s.ce._teleportTargets=new Set)).add(y),f||(m(N,y,v),bn(N,!1)))},T=N=>{let f=()=>{if(ri.get(N)===f){if(ri.delete(N),ki(N.props)){let y=A(N.el)||i;m(N,y,N.anchor),bn(N,!0)}q(N)}};ri.set(N,f),Pe(f,r)};if(e==null){let N,f=t.el=_(""),y=t.anchor=_("");if(w(f,i,n),w(y,i,n),(N=t.props)&&(N.defer||N.defer==="")||r&&r.pendingBranch)return void T(t);E&&(m(t,i,y),bn(t,!0)),q()}else{t.el=e.el;let N=t.anchor=e.anchor,f=ri.get(e);if(f){f.flags|=8,ri.delete(e),T(t);return}t.targetStart=e.targetStart;let y=t.target=e.target,v=t.targetAnchor=e.targetAnchor,k=ki(e.props),S=k?i:y,x=k?N:v;if(a==="svg"||Ao(y)?a="svg":(a==="mathml"||No(y))&&(a="mathml"),h?(u(e.dynamicChildren,h,S,s,r,a,o),Qa(e,t,!0)):l||p(e,t,S,x,s,r,a,o,!1),E)k?t.props&&e.props&&t.props.to!==e.props.to&&(t.props.to=e.props.to):us(t,i,N,c,1);else if((t.props&&t.props.to)!==(e.props&&e.props.to)){let I=Br(t.props,g);I&&(t.target=I,us(t,I,null,c,0))}else k&&us(t,y,v,c,1);bn(t,E)}},remove(e,t,i,{um:n,o:{remove:s}},r){let{shapeFlag:a,children:o,anchor:l,targetStart:c,targetAnchor:d,target:p,props:u}=e,w=ki(u),g=r||!w,_=ri.get(e);if(_&&(_.flags|=8,ri.delete(e)),p&&(s(c),s(d)),r&&s(l),!_&&(w||p)&&16&a)for(let A=0;A<o.length;A++){let E=o[A];n(E,t,i,g,!!E.dynamicChildren)}},move:us,hydrate:function(e,t,i,n,s,r,{o:{nextSibling:a,parentNode:o,querySelector:l,insert:c,createText:d}},p){function u(A,E){let h=E;for(;h;){if(h&&h.nodeType===8){if(h.data==="teleport start anchor")t.targetStart=h;else if(h.data==="teleport anchor"){t.targetAnchor=h,A._lpa=t.targetAnchor&&a(t.targetAnchor);break}}h=a(h)}}function w(A,E){E.anchor=p(a(A),E,o(A),i,n,s,r)}let g=t.target=Br(t.props,l),_=ki(t.props);if(g){let A=g._lpa||g.firstChild;16&t.shapeFlag&&(_?(w(e,t),u(g,A),t.targetAnchor||Lr(g,t,d,c,o(e)===g?e:null)):(t.anchor=a(e),u(g,A),t.targetAnchor||Lr(g,t,d,c),p(A&&a(A),t,g,i,n,s,r))),bn(t,_)}else _&&16&t.shapeFlag&&(w(e,t),t.targetStart=e,t.targetAnchor=a(e));return t.anchor&&a(t.anchor)}};function bn(e,t){let i=e.ctx;if(i&&i.ut){let n,s;for(t?(n=e.el,s=e.anchor):(n=e.targetStart,s=e.targetAnchor);n&&n!==s;)n.nodeType===1&&n.setAttribute("data-v-owner",i.uid),n=n.nextSibling;i.ut()}}function Lr(e,t,i,n,s=null){let r=t.targetStart=i(""),a=t.targetAnchor=i("");return r[cc]=a,e&&(n(r,e,s),n(a,e,s)),a}var kt=Symbol("_leaveCb"),yn=Symbol("_enterCb");function Ba(){let e={isMounted:!1,isLeaving:!1,isUnmounting:!1,leavingVNodes:new Map};return Zn(()=>{e.isMounted=!0}),xr(()=>{e.isUnmounting=!0}),e}var wt=[Function,Array],La={mode:String,appear:Boolean,persisted:Boolean,onBeforeEnter:wt,onEnter:wt,onAfterEnter:wt,onEnterCancelled:wt,onBeforeLeave:wt,onLeave:wt,onAfterLeave:wt,onLeaveCancelled:wt,onBeforeAppear:wt,onAppear:wt,onAfterAppear:wt,onAppearCancelled:wt},dc=e=>{let t=e.subTree;return t.component?dc(t.component):t};function pc(e){let t=e[0];if(e.length>1){for(let i of e)if(i.type!==Oe){t=i;break}}return t}var uc={name:"BaseTransition",props:La,setup(e,{slots:t}){let i=at(),n=Ba();return()=>{let s=t.default&&br(t.default(),!0),r=s&&s.length?pc(s):i.subTree?Fc():void 0;if(!r)return;let a=ue(e),{mode:o}=a;if(n.isLeaving)return Dr(r);let l=Eo(r);if(!l)return Dr(r);let c=an(l,a,n,i,p=>c=p);l.type!==Oe&&Zt(l,c);let d=i.subTree&&Eo(i.subTree);if(d&&d.type!==Oe&&!Ct(d,l)&&dc(i).type!==Oe){let p=an(d,a,n,i);if(Zt(d,p),o==="out-in"&&l.type!==Oe)return n.isLeaving=!0,p.afterLeave=()=>{n.isLeaving=!1,8&i.job.flags||i.update(),delete p.afterLeave,d=void 0},Dr(r);o==="in-out"&&l.type!==Oe?p.delayLeave=(u,w,g)=>{fc(n,d)[String(d.key)]=d,u[kt]=()=>{w(),u[kt]=void 0,delete c.delayedLeave,d=void 0},c.delayedLeave=()=>{g(),delete c.delayedLeave,d=void 0}}:d=void 0}else d&&(d=void 0);return r}}};function fc(e,t){let{leavingVNodes:i}=e,n=i.get(t.type);return n||(n=Object.create(null),i.set(t.type,n)),n}function an(e,t,i,n,s){let{appear:r,mode:a,persisted:o=!1,onBeforeEnter:l,onEnter:c,onAfterEnter:d,onEnterCancelled:p,onBeforeLeave:u,onLeave:w,onAfterLeave:g,onLeaveCancelled:_,onBeforeAppear:A,onAppear:E,onAfterAppear:h,onAppearCancelled:m}=t,q=String(e.key),T=fc(i,e),N=(v,k)=>{v&&vt(v,n,9,k)},f=(v,k)=>{let S=k[1];N(v,k),J(v)?v.every(x=>x.length<=1)&&S():v.length<=1&&S()},y={mode:a,persisted:o,beforeEnter(v){let k=l;if(!i.isMounted)if(r)k=A||l;else return;v[kt]&&v[kt](!0);let S=T[q];S&&Ct(e,S)&&S.el[kt]&&S.el[kt](),N(k,[v])},enter(v){if(T[q]===e)return;let k=c,S=d,x=p;if(!i.isMounted)if(r)k=E||c,S=h||d,x=m||p;else return;let I=!1;v[yn]=M=>{I||(I=!0,M?N(x,[v]):N(S,[v]),y.delayedLeave&&y.delayedLeave(),v[yn]=void 0)};let R=v[yn].bind(null,!1);k?f(k,[v,R]):R()},leave(v,k){let S=String(e.key);if(v[yn]&&v[yn](!0),i.isUnmounting)return k();N(u,[v]);let x=!1;v[kt]=R=>{x||(x=!0,k(),R?N(_,[v]):N(g,[v]),v[kt]=void 0,T[S]===e&&delete T[S])};let I=v[kt].bind(null,!1);T[S]=e,w?f(w,[v,I]):I()},clone(v){let k=an(v,t,i,n,s);return s&&s(k),k}};return y}function Dr(e){if(Xn(e))return(e=Bt(e)).children=null,e}function Eo(e){if(!Xn(e))return e.type.__isTeleport&&e.children?pc(e.children):e;if(e.component)return e.component.subTree;let{shapeFlag:t,children:i}=e;if(i){if(16&t)return i[0];if(32&t&&te(i.default))return i.default()}}function Zt(e,t){6&e.shapeFlag&&e.component?(e.transition=t,Zt(e.component.subTree,t)):128&e.shapeFlag?(e.ssContent.transition=t.clone(e.ssContent),e.ssFallback.transition=t.clone(e.ssFallback)):e.transition=t}function br(e,t=!1,i){let n=[],s=0;for(let r=0;r<e.length;r++){let a=e[r],o=i==null?a.key:String(i)+String(a.key!=null?a.key:r);a.type===ze?(128&a.patchFlag&&s++,n=n.concat(br(a.children,t,o))):(t||a.type!==Oe)&&n.push(o!=null?Bt(a,{key:o}):a)}if(s>1)for(let r=0;r<n.length;r++)n[r].patchFlag=-2;return n}function Da(e,t){return te(e)?ce({name:e.name},t,{setup:e}):e}function Tu(){let e=at();return e?(e.appContext.config.idPrefix||"v")+"-"+e.ids[0]+e.ids[1]++:""}function Fa(e){e.ids=[e.ids[0]+e.ids[2]+++"-",0,0]}function Au(e){let t=at(),i=Xl(null);return t&&Object.defineProperty(t.refs===de?t.refs={}:t.refs,e,{enumerable:!0,get:()=>i.value,set:n=>i.value=n}),i}function Mo(e,t){let i;return!!((i=Object.getOwnPropertyDescriptor(e,t))&&!i.configurable)}var Ds=new WeakMap;function sn(e,t,i,n,s=!1){if(J(e))return void e.forEach((_,A)=>sn(_,t&&(J(t)?t[A]:t),i,n,s));if(Qt(n)&&!s){512&n.shapeFlag&&n.type.__asyncResolved&&n.component.subTree.component&&sn(e,t,i,n.component.subTree);return}let r=4&n.shapeFlag?ts(n.component):n.el,a=s?null:r,{i:o,r:l}=e,c=t&&t.r,d=o.refs===de?o.refs={}:o.refs,p=o.setupState,u=ue(p),w=p===de?Hi:_=>!Mo(d,_)&&ge(u,_),g=(_,A)=>!(A&&Mo(d,A));if(c!=null&&c!==l&&(Io(t),ne(c)?(d[c]=null,w(c)&&(p[c]=null)):Le(c)&&(g(c,t.k)&&(c.value=null),t.k&&(d[t.k]=null))),te(l))pn(l,o,12,[a,d]);else{let _=ne(l),A=Le(l);if(_||A){let E=()=>{if(e.f){let h=_?w(l)?p[l]:d[l]:g()||!e.k?l.value:d[e.k];if(s)J(h)&&Na(h,r);else if(J(h))h.includes(r)||h.push(r);else if(_)d[l]=[r],w(l)&&(p[l]=d[l]);else{let m=[r];g(l,e.k)&&(l.value=m),e.k&&(d[e.k]=m)}}else _?(d[l]=a,w(l)&&(p[l]=a)):A&&(g(l,e.k)&&(l.value=a),e.k&&(d[e.k]=a))};if(a){let h=()=>{E(),Ds.delete(e)};h.id=-1,Ds.set(e,h),Pe(h,i)}else Io(e),E()}}}function Io(e){let t=Ds.get(e);t&&(t.flags|=8,Ds.delete(e))}var Ro=!1,zi=()=>{Ro||(console.error("Hydration completed but contains mismatches."),Ro=!0)},fs=e=>{if(e.nodeType===1){if(e.namespaceURI.includes("svg")&&e.tagName!=="foreignObject")return"svg";if(e.namespaceURI.includes("MathML"))return"mathml"}},Ki=e=>e.nodeType===8;function Nu(e){let{mt:t,p:i,o:{patchProp:n,createText:s,nextSibling:r,parentNode:a,remove:o,insert:l,createComment:c}}=e,d=(h,m,q,T,N,f=!1)=>{f=f||!!m.dynamicChildren;let y=Ki(h)&&h.data==="[",v=()=>g(h,m,q,T,N,y),{type:k,ref:S,shapeFlag:x,patchFlag:I}=m,R=h.nodeType;m.el=h,I===-2&&(f=!1,m.dynamicChildren=null);let M=null;switch(k){case ci:R!==3?m.children===""?(l(m.el=s(""),a(h),h),M=h):M=v():(h.data!==m.children&&(zi(),h.data=m.children),M=r(h));break;case Oe:E(h)?(M=r(h),A(m.el=h.content.firstChild,h,q)):M=R!==8||y?v():r(h);break;case Ni:if(y&&(R=(h=r(h)).nodeType),R===1||R===3){M=h;let z=!m.children.length;for(let B=0;B<m.staticCount;B++)z&&(m.children+=M.nodeType===1?M.outerHTML:M.data),B===m.staticCount-1&&(m.anchor=M),M=r(M);return y?r(M):M}v();break;case ze:M=y?w(h,m,q,T,N,f):v();break;default:if(1&x)M=R===1&&m.type.toLowerCase()===h.tagName.toLowerCase()||E(h)?p(h,m,q,T,N,f):v();else if(6&x){m.slotScopeIds=N;let z=a(h);if(M=y?_(h):Ki(h)&&h.data==="teleport start"?_(h,h.data,"teleport end"):r(h),t(m,z,null,q,T,fs(z),f),Qt(m)&&!m.type.__asyncResolved){let B;y?(B=Te(ze)).anchor=M?M.previousSibling:z.lastChild:B=h.nodeType===3?Ja(""):Te("div"),B.el=h,m.component.subTree=B}}else 64&x?M=R!==8?v():m.type.hydrate(h,m,q,T,N,f,e,u):128&x&&(M=m.type.hydrate(h,m,q,T,fs(a(h)),N,f,e,d))}return S!=null&&sn(S,null,T,m),M},p=(h,m,q,T,N,f)=>{f=f||!!m.dynamicChildren;let{type:y,dynamicProps:v,props:k,patchFlag:S,shapeFlag:x,dirs:I,transition:R}=m,M=y==="input"||y==="option",z=!!v;if(M||z||S!==-1){let B;I&&Rt(m,null,q,"created");let V=!1;if(E(h)){V=Oc(null,R)&&q&&q.vnode.props&&q.vnode.props.appear;let H=h.content.firstChild;if(V){let X=H.getAttribute("class");X&&(H.$cls=X),R.beforeEnter(H)}A(H,h,q),m.el=h=H}if(16&x&&!(k&&(k.innerHTML||k.textContent))){let H=u(h.firstChild,m,h,q,T,N,f);for(H&&!hs(h,1)&&zi();H;){let X=H;H=H.nextSibling,o(X)}}else if(8&x){let H=m.children;H[0]===`
`&&(h.tagName==="PRE"||h.tagName==="TEXTAREA")&&(H=H.slice(1));let{textContent:X}=h;X!==H&&X!==H.replace(/\r\n|\r/g,`
`)&&(hs(h,0)||zi(),h.textContent=m.children)}if(k){if(M||z||!f||48&S){let H=h.tagName.includes("-"),X=h.namespaceURI.includes("svg")?"svg":h.namespaceURI.includes("MathML")?"mathml":void 0;for(let ie in k)(M&&(ie.endsWith("value")||ie==="indeterminate")||Li(ie)&&!Ht(ie)||ie[0]==="."||H&&!Ht(ie)||v&&v.includes(ie))&&n(h,ie,null,k[ie],X,q)}else if(k.onClick)n(h,"onClick",null,k.onClick,void 0,q);else if(4&S&&Kt(k.style))for(let H in k.style)k.style[H]}(B=k&&k.onVnodeBeforeMount)&&lt(B,q,m),I&&Rt(m,null,q,"beforeMount"),((B=k&&k.onVnodeMounted)||I||V)&&Pc(()=>{B&&lt(B,q,m),V&&R.enter(h),I&&Rt(m,null,q,"mounted")},T)}return h.nextSibling},u=(h,m,q,T,N,f,y)=>{y=y||!!m.dynamicChildren;let v=m.children,k=v.length,S=!1;for(let x=0;x<k;x++){let I=y?v[x]:v[x]=ct(v[x]),R=I.type===ci;h?(R&&!y&&x+1<k&&ct(v[x+1]).type===ci&&(l(s(h.data.slice(I.children.length)),q,r(h)),h.data=I.children),h=d(h,I,T,N,f,y)):R&&!I.children?l(I.el=s(""),q):(!S&&(S=!0,hs(q,1)||zi()),i(null,I,q,null,T,N,fs(q),f))}return h},w=(h,m,q,T,N,f)=>{let{slotScopeIds:y}=m;y&&(N=N?N.concat(y):y);let v=a(h),k=u(r(h),m,v,q,T,N,f);return k&&Ki(k)&&k.data==="]"?r(m.anchor=k):(zi(),l(m.anchor=c("]"),v,k),k)},g=(h,m,q,T,N,f)=>{var y,v,k;if(y=h,v=m,hs(y.parentElement,1)||(k=y).nodeType===1&&na(k.getAttribute(Fs),1)||function({props:I}){let R=I&&I[Fs];return typeof R=="string"&&na(R,1)}(v)||zi(),m.el=null,f){let I=_(h);for(;;){let R=r(h);if(R&&R!==I)o(R);else break}}let S=r(h),x=a(h);return o(h),i(null,m,x,S,q,T,fs(x),N),q&&(q.vnode.el=m.el,wr(q,m.el)),S},_=(h,m="[",q="]")=>{let T=0;for(;h;)if((h=r(h))&&Ki(h)&&(h.data===m&&T++,h.data===q)){if(T===0)return r(h);T--}return h},A=(h,m,q)=>{let T=m.parentNode;T&&T.replaceChild(h,m);let N=q;for(;N;)N.vnode.el===m&&(N.vnode.el=N.subTree.el=h),N=N.parent},E=h=>h.nodeType===1&&h.tagName==="TEMPLATE";return[(h,m)=>{if(!m.hasChildNodes()){i(null,h,m),Ls(),m._vnode=h;return}d(m.firstChild,h,null,null,null),Ls(),m._vnode=h},d]}var Fs="data-allow-mismatch",Eu={0:"text",1:"children",2:"class",3:"style",4:"attribute"};function hs(e,t){if(t===0||t===1)for(;e&&!e.hasAttribute(Fs);)e=e.parentElement;return na(e&&e.getAttribute(Fs),t)}function na(e,t){if(e==null)return!1;{if(e==="")return!0;let i=e.split(",");return!!(t===0&&i.includes("children"))||i.includes(Eu[t])}}var Mu=dr().requestIdleCallback||(e=>setTimeout(e,1)),Iu=dr().cancelIdleCallback||(e=>clearTimeout(e)),Ru=(e=1e4)=>t=>{let i=Mu(t,{timeout:e});return()=>Iu(i)},Ou=e=>(t,i)=>{let n=new IntersectionObserver(s=>{for(let r of s)if(r.isIntersecting){n.disconnect(),t();break}},e);return i(s=>{if(s instanceof Element){if(function(r){let{top:a,left:o,bottom:l,right:c}=r.getBoundingClientRect(),{innerHeight:d,innerWidth:p}=window;return(a>0&&a<d||l>0&&l<d)&&(o>0&&o<p||c>0&&c<p)}(s))return t(),n.disconnect(),!1;n.observe(s)}}),()=>n.disconnect()},Pu=e=>t=>{if(e){let i=matchMedia(e);if(!i.matches)return i.addEventListener("change",t,{once:!0}),()=>i.removeEventListener("change",t);t()}},Bu=(e=[])=>(t,i)=>{ne(e)&&(e=[e]);let n=!1,s=a=>{n||(n=!0,r(),t(),a.target.dispatchEvent(new a.constructor(a.type,a)))},r=()=>{i(a=>{for(let o of e)a.removeEventListener(o,s)})};return i(a=>{for(let o of e)a.addEventListener(o,s,{once:!0})}),r},Qt=e=>!!e.type.__asyncLoader;function Lu(e){let t;te(e)&&(e={loader:e});let{loader:i,loadingComponent:n,errorComponent:s,delay:r=200,hydrate:a,timeout:o,suspensible:l=!0,onError:c}=e,d=null,p=0,u=()=>{let w;return d||(w=d=i().catch(g=>{if(g=g instanceof Error?g:Error(String(g)),c)return new Promise((_,A)=>{c(g,()=>_((p++,d=null,u())),()=>A(g),p+1)});throw g}).then(g=>w!==d&&d?d:(g&&(g.__esModule||g[Symbol.toStringTag]==="Module")&&(g=g.default),t=g,g)))};return Da({name:"AsyncComponentWrapper",__asyncLoader:u,__asyncHydrate(w,g,_){let A=w.isConnected,E=!1;(g.bu||(g.bu=[])).push(()=>E=!0);let h=()=>{E||w.parentNode&&(!A||w.isConnected)&&_()},m=a?()=>{let q=a(h,T=>function(N,f){if(Ki(N)&&N.data==="["){let y=1,v=N.nextSibling;for(;v;){if(v.nodeType===1){if(f(v)===!1)break}else if(Ki(v))if(v.data==="]"){if(--y==0)break}else v.data==="["&&y++;v=v.nextSibling}}else f(N)}(w,T));q&&(g.bum||(g.bum=[])).push(q)}:h;t?m():u().then(()=>!g.isUnmounted&&m())},get __asyncResolved(){return t},setup(){let w,g,_=Ke;if(Fa(_),t)return()=>ms(t,_);let A=q=>{d=null,Fi(q,_,13,!s)};if(l&&_.suspense||Ri)return u().then(q=>()=>ms(q,_)).catch(q=>(A(q),()=>s?Te(s,{error:q}):null));let E=An(!1),h=An(),m=An(!!r);return es(()=>{w!=null&&clearTimeout(w),g!=null&&clearTimeout(g)}),r&&(g=setTimeout(()=>{_.isUnmounted||(m.value=!1)},r)),o!=null&&(w=setTimeout(()=>{if(!_.isUnmounted&&!E.value&&!h.value){let q=Error(`Async component timed out after ${o}ms.`);A(q),h.value=q}},o)),u().then(()=>{!_.isUnmounted&&(E.value=!0,_.parent&&Xn(_.parent.vnode)&&_.parent.update())}).catch(q=>{if(_.isUnmounted){d=null;return}A(q),h.value=q}),()=>E.value&&t?ms(t,_):h.value&&s?Te(s,{error:h.value}):n&&!m.value?ms(n,_):void 0}})}function ms(e,t){let{ref:i,props:n,children:s,ce:r}=t.vnode,a=Te(e,n,s);return a.ref=i,a.ce=r,delete t.vnode.ce,a}var Xn=e=>e.type.__isKeepAlive,Du={name:"KeepAlive",__isKeepAlive:!0,props:{include:[String,RegExp,Array],exclude:[String,RegExp,Array],max:[String,Number]},setup(e,{slots:t}){let i=at(),n=i.ctx;if(!n.renderer)return()=>{let h=t.default&&t.default();return h&&h.length===1?h[0]:h};let s=new Map,r=new Set,a=null,o=i.suspense,{renderer:{p:l,m:c,um:d,o:{createElement:p}}}=n,u=p("div");function w(h){Fr(h),d(h,i,o,!0)}function g(h){s.forEach((m,q)=>{let T=fa(Qt(m)?m.type.__asyncResolved||{}:m.type);T&&!h(T)&&_(q)})}function _(h){let m=s.get(h);!m||a&&Ct(m,a)?a&&Fr(a):w(m),s.delete(h),r.delete(h)}n.activate=(h,m,q,T,N)=>{let f=h.component;c(h,m,q,0,o),l(f.vnode,h,m,q,f,o,T,h.slotScopeIds,N),Pe(()=>{f.isDeactivated=!1,f.a&&Xi(f.a);let y=h.props&&h.props.onVnodeMounted;y&&lt(y,f.parent,h)},o)},n.deactivate=h=>{let m=h.component;zs(m.m),zs(m.a),c(h,u,null,1,o),Pe(()=>{m.da&&Xi(m.da);let q=h.props&&h.props.onVnodeUnmounted;q&&lt(q,m.parent,h),m.isDeactivated=!0},o)},nn(()=>[e.include,e.exclude],([h,m])=>{h&&g(q=>_n(h,q)),m&&g(q=>!_n(m,q))},{flush:"post",deep:!0});let A=null,E=()=>{A!=null&&(Vs(i.subTree.type)?Pe(()=>{s.set(A,gs(i.subTree))},i.subTree.suspense):s.set(A,gs(i.subTree)))};return Zn(E),yr(E),xr(()=>{s.forEach(h=>{let{subTree:m,suspense:q}=i,T=gs(m);if(h.type===T.type&&h.key===T.key){Fr(T);let N=T.component.da;N&&Pe(N,q);return}w(h)})}),()=>{if(A=null,!t.default)return a=null;let h=t.default(),m=h[0];if(h.length>1)return a=null,h;if(!ei(m)||!(4&m.shapeFlag)&&!(128&m.shapeFlag))return a=null,m;let q=gs(m);if(q.type===Oe)return a=null,q;let T=q.type,N=fa(Qt(q)?q.type.__asyncResolved||{}:T),{include:f,exclude:y,max:v}=e;if(f&&(!N||!_n(f,N))||y&&N&&_n(y,N))return q.shapeFlag&=-257,a=q,m;let k=q.key==null?T:q.key,S=s.get(k);return q.el&&(q=Bt(q),128&m.shapeFlag&&(m.ssContent=q)),A=k,S?(q.el=S.el,q.component=S.component,q.transition&&Zt(q,q.transition),q.shapeFlag|=512,r.delete(k),r.add(k)):(r.add(k),v&&r.size>parseInt(v,10)&&_(r.values().next().value)),q.shapeFlag|=256,a=q,Vs(m.type)?m:q}}};function _n(e,t){let i;return J(e)?e.some(n=>_n(n,t)):ne(e)?e.split(",").includes(t):(i=e,Ne.call(i)==="[object RegExp]"&&(e.lastIndex=0,e.test(t)))}function hc(e,t){gc(e,"a",t)}function mc(e,t){gc(e,"da",t)}function gc(e,t,i=Ke){let n=e.__wdc||(e.__wdc=()=>{let s=i;for(;s;){if(s.isDeactivated)return;s=s.parent}return e()});if(js(t,n,i),i){let s=i.parent;for(;s&&s.parent;)Xn(s.parent.vnode)&&function(r,a,o,l){let c=js(a,r,l,!0);es(()=>{Na(l[a],c)},o)}(n,t,i,s),s=s.parent}}function Fr(e){e.shapeFlag&=-257,e.shapeFlag&=-513}function gs(e){return 128&e.shapeFlag?e.ssContent:e}function js(e,t,i=Ke,n=!1){if(i){let s=i[e]||(i[e]=[]),r=t.__weh||(t.__weh=(...a)=>{Yt();let o=un(i),l=vt(t,i,e,a);return o(),Xt(),l});return n?s.unshift(r):s.push(r),r}}var ti=e=>(t,i=Ke)=>{Ri&&e!=="sp"||js(e,(...n)=>t(...n),i)},vc=ti("bm"),Zn=ti("m"),ja=ti("bu"),yr=ti("u"),xr=ti("bum"),es=ti("um"),bc=ti("sp"),yc=ti("rtg"),xc=ti("rtc");function wc(e,t=Ke){js("ec",e,t)}var Ua="components";function Fu(e,t){return $a(Ua,e,!0,t)||e}var kc=Symbol.for("v-ndc");function ju(e){return ne(e)?$a(Ua,e,!1)||e:e||kc}function Uu(e){return $a("directives",e)}function $a(e,t,i=!0,n=!1){let s=Qe||Ke;if(s){let r=s.type;if(e===Ua){let o=fa(r,!1);if(o&&(o===t||o===we(t)||o===Di(we(t))))return r}let a=Oo(s[e]||r[e],t)||Oo(s.appContext[e],t);return!a&&n?r:a}}function Oo(e,t){return e&&(e[t]||e[we(t)]||e[Di(we(t))])}function $u(e,t,i,n){let s,r=i&&i[n],a=J(e);if(a||ne(e)){let o=a&&Kt(e),l=!1,c=!1;o&&(l=!ut(e),c=Pt(e),e=fr(e)),s=Array(e.length);for(let d=0,p=e.length;d<p;d++)s[d]=t(l?c?en(At(e[d])):At(e[d]):e[d],d,void 0,r&&r[d])}else if(typeof e=="number"){s=Array(e);for(let o=0;o<e;o++)s[o]=t(o+1,o,void 0,r&&r[o])}else if(he(e))if(e[Symbol.iterator])s=Array.from(e,(o,l)=>t(o,l,void 0,r&&r[l]));else{let o=Object.keys(e);s=Array(o.length);for(let l=0,c=o.length;l<c;l++){let d=o[l];s[l]=t(e[d],d,l,r&&r[l])}}else s=[];return i&&(i[n]=s),s}function zu(e,t){for(let i=0;i<t.length;i++){let n=t[i];if(J(n))for(let s=0;s<n.length;s++)e[n[s].name]=n[s].fn;else n&&(e[n.name]=n.key?(...s)=>{let r=n.fn(...s);return r&&(r.key=n.key),r}:n.fn)}return e}function Vu(e,t,i={},n,s,r){let a;if(Qe.ce||Qe.parent&&Qt(Qe.parent)&&Qe.parent.ce){let c=r!=null&&i.key==null?ce({},i,{key:r}):i,d=Object.keys(c).length>0;return t!=="default"&&(c.name=t),jn(),Hs(ze,null,[Te("slot",c,n&&n())],d?-2:64)}let o=e[t];o&&o._c&&(o._d=!1);let l=Wt.length;jn();try{let c=o&&za(o(i)),d=i.key||r||c&&c.key;a=Hs(ze,{key:(d&&!Ze(d)?d:`_${t}`)+(!c&&n?"_fb":"")},c||(n?n():[]),c&&e._===1?64:-2)}catch(c){for(let d=Wt.length;d>l;d--)kr();throw c}finally{o&&o._c&&(o._d=!0)}return!s&&a.scopeId&&(a.slotScopeIds=[a.scopeId+"-s"]),a}function za(e){return e.some(t=>!ei(t)||t.type!==Oe&&(t.type!==ze||!!za(t.children)))?e:null}function Hu(e,t){let i={};for(let n in e)i[t&&/[A-Z]/.test(n)?`on:${n}`:Yi(n)]=e[n];return i}var sa=e=>e?$c(e)?ts(e):sa(e.parent):null,Mn=ce(Object.create(null),{$:e=>e,$el:e=>e.vnode.el,$data:e=>e.data,$props:e=>e.props,$attrs:e=>e.attrs,$slots:e=>e.slots,$refs:e=>e.refs,$parent:e=>sa(e.parent),$root:e=>sa(e.root),$host:e=>e.ce,$emit:e=>e.emit,$options:e=>oa(e),$forceUpdate:e=>e.f||(e.f=()=>{Oa(e.update)}),$nextTick:e=>e.n||(e.n=gr.bind(e.proxy)),$watch:e=>qu.bind(e)}),jr=(e,t)=>e!==de&&!e.__isScriptSetup&&ge(e,t),ra={get({_:e},t){let i,n;if(t==="__v_skip")return!0;let{ctx:s,setupState:r,data:a,props:o,accessCache:l,type:c,appContext:d}=e;if(t[0]!=="$"){let u=l[t];if(u!==void 0)switch(u){case 1:return r[t];case 2:return a[t];case 4:return s[t];case 3:return o[t]}else{if(jr(r,t))return l[t]=1,r[t];if(a!==de&&ge(a,t))return l[t]=2,a[t];if(ge(o,t))return l[t]=3,o[t];if(s!==de&&ge(s,t))return l[t]=4,s[t];aa&&(l[t]=0)}}let p=Mn[t];return p?(t==="$attrs"&&Ye(e.attrs,"get",""),p(e)):(i=c.__cssModules)&&(i=i[t])?i:s!==de&&ge(s,t)?(l[t]=4,s[t]):ge(n=d.config.globalProperties,t)?n[t]:void 0},set({_:e},t,i){let{data:n,setupState:s,ctx:r}=e;return jr(s,t)?(s[t]=i,!0):n!==de&&ge(n,t)?(n[t]=i,!0):!ge(e.props,t)&&!(t[0]==="$"&&t.slice(1)in e)&&(r[t]=i,!0)},has({_:{data:e,setupState:t,accessCache:i,ctx:n,appContext:s,props:r,type:a}},o){let l;return!!(i[o]||e!==de&&o[0]!=="$"&&ge(e,o)||jr(t,o)||ge(r,o)||ge(n,o)||ge(Mn,o)||ge(s.config.globalProperties,o)||(l=a.__cssModules)&&l[o])},defineProperty(e,t,i){return i.get!=null?e._.accessCache[t]=0:ge(i,"value")&&this.set(e,t,i.value,null),Reflect.defineProperty(e,t,i)}},Ku=ce({},ra,{get(e,t){if(t!==Symbol.unscopables)return ra.get(e,t,e)},has:(e,t)=>t[0]!=="_"&&!Pp(t)});function Qu(){return null}function Wu(){return null}function Ju(e){}function Gu(e){}function Yu(){return null}function Xu(){}function Zu(e,t){return null}function ef(){return _c().slots}function tf(){return _c().attrs}function _c(e){let t=at();return t.setupContext||(t.setupContext=Kc(t))}function Fn(e){return J(e)?e.reduce((t,i)=>(t[i]=null,t),{}):e}function nf(e,t){let i=Fn(e);for(let n in t){if(n.startsWith("__skip"))continue;let s=i[n];s?J(s)||te(s)?s=i[n]={type:s,default:t[n]}:s.default=t[n]:s===null&&(s=i[n]={default:t[n]}),s&&t[`__skip_${n}`]&&(s.skipFactory=!0)}return i}function sf(e,t){return e&&t?J(e)&&J(t)?e.concat(t):ce({},Fn(e),Fn(t)):e||t}function rf(e,t){let i={};for(let n in e)t.includes(n)||Object.defineProperty(i,n,{enumerable:!0,get:()=>e[n]});return i}function af(e){let t=at(),i=Ri,n=e();$n(),i&&Ji(!1);let s=()=>{un(t),i&&Ji(!0)},r=()=>{at()!==t&&t.scope.off(),$n(),i&&Ji(!1)};return Ea(n)&&(n=n.catch(a=>{throw s(),Promise.resolve().then(()=>Promise.resolve().then(r)),a})),[n,()=>{s(),Promise.resolve().then(r)}]}var aa=!0;function Po(e,t,i){vt(J(e)?e.map(n=>n.bind(t.proxy)):e.bind(t.proxy),t,i)}function oa(e){let t,i=e.type,{mixins:n,extends:s}=i,{mixins:r,optionsCache:a,config:{optionMergeStrategies:o}}=e.appContext,l=a.get(i);return l?t=l:r.length||n||s?(t={},r.length&&r.forEach(c=>Us(t,c,o,!0)),Us(t,i,o)):t=i,he(i)&&a.set(i,t),t}function Us(e,t,i,n=!1){let{mixins:s,extends:r}=t;for(let a in r&&Us(e,r,i,!0),s&&s.forEach(o=>Us(e,o,i,!0)),t)if(!(n&&a==="expose")){let o=of[a]||i&&i[a];e[a]=o?o(e[a],t[a]):t[a]}return e}var of={data:Bo,props:Lo,emits:Lo,methods:xn,computed:xn,beforeCreate:nt,created:nt,beforeMount:nt,mounted:nt,beforeUpdate:nt,updated:nt,beforeDestroy:nt,beforeUnmount:nt,destroyed:nt,unmounted:nt,activated:nt,deactivated:nt,errorCaptured:nt,serverPrefetch:nt,components:xn,directives:xn,watch:function(e,t){if(!e)return t;if(!t)return e;let i=ce(Object.create(null),e);for(let n in t)i[n]=nt(e[n],t[n]);return i},provide:Bo,inject:function(e,t){return xn(la(e),la(t))}};function Bo(e,t){return t?e?function(){return ce(te(e)?e.call(this,this):e,te(t)?t.call(this,this):t)}:t:e}function la(e){if(J(e)){let t={};for(let i=0;i<e.length;i++)t[e[i]]=e[i];return t}return e}function nt(e,t){return e?[...new Set([].concat(e,t))]:t}function xn(e,t){return e?ce(Object.create(null),e,t):t}function Lo(e,t){return e?J(e)&&J(t)?[...new Set([...e,...t])]:ce(Object.create(null),Fn(e),Fn(t??{})):t}function Sc(){return{app:null,config:{isNativeTag:Hi,performance:!1,globalProperties:{},optionMergeStrategies:{},errorHandler:void 0,warnHandler:void 0,compilerOptions:{}},mixins:[],components:{},directives:{},provides:Object.create(null),optionsCache:new WeakMap,propsCache:new WeakMap,emitsCache:new WeakMap}}var lf=0,Ai=null;function cf(e,t,i=de){let n=at(),s=we(t),r=dt(t),a=qc(e,s),o=ec((l,c)=>{let d,p,u=de;return oc(()=>{let w=e[s];$e(d,w)&&(d=w,c())}),{get:()=>(l(),i.get?i.get(d):d),set(w){let g=i.set?i.set(w):w;if(!$e(g,d)&&!(u!==de&&$e(w,u)))return;let _=n.vnode.props,A=!!(_&&(t in _||s in _||r in _)&&(`onUpdate:${t}`in _||`onUpdate:${s}`in _||`onUpdate:${r}`in _));A||(d=w,c()),n.emit(`update:${t}`,g),$e(w,u)&&($e(w,g)&&!$e(g,p)||A&&u!==de&&!$e(g,d))&&c(),u=w,p=g}}});return o[Symbol.iterator]=()=>{let l=0;return{next:()=>l<2?{value:l++?a||de:o,done:!1}:{done:!0}}},o}var qc=(e,t)=>t==="modelValue"||t==="model-value"?e.modelModifiers:e[`${t}Modifiers`]||e[`${we(t)}Modifiers`]||e[`${dt(t)}Modifiers`];function df(e,t,...i){let n;if(e.isUnmounted)return;let s=e.vnode.props||de,r=i,a=t.startsWith("update:"),o=a&&qc(s,t.slice(7));o&&(o.trim&&(r=i.map(d=>ne(d)?d.trim():d)),o.number&&(r=i.map(cr)));let l=s[n=Yi(t)]||s[n=Yi(we(t))];!l&&a&&(l=s[n=Yi(dt(t))]),l&&vt(l,e,6,r);let c=s[n+"Once"];if(c){if(e.emitted){if(e.emitted[n])return}else e.emitted={};e.emitted[n]=!0,vt(c,e,6,r)}}var pf=new WeakMap;function $s(e,t){return!!e&&!!Li(t)&&(ge(e,(t=(t=t.slice(2))==="Once"?t:t.replace(/Once$/,""))[0].toLowerCase()+t.slice(1))||ge(e,dt(t))||ge(e,t))}function qs(e){let t,i,{type:n,vnode:s,proxy:r,withProxy:a,propsOptions:[o],slots:l,attrs:c,emit:d,render:p,renderCache:u,props:w,data:g,setupState:_,ctx:A,inheritAttrs:E}=e,h=Dn(e);try{if(4&s.shapeFlag){let q=a||r;t=ct(p.call(q,q,u,w,_,g,A)),i=c}else t=ct(n.length>1?n(w,{attrs:c,slots:l,emit:d}):n(w,null)),i=n.props?c:uf(c)}catch(q){Wt.length=0,Fi(q,e,1),t=Te(Oe)}let m=t;if(i&&E!==!1){let q=Object.keys(i),{shapeFlag:T}=m;q.length&&7&T&&(o&&q.some(ar)&&(i=ff(i,o)),m=Bt(m,i,!1,!0))}return s.dirs&&((m=Bt(m,null,!1,!0)).dirs=m.dirs?m.dirs.concat(s.dirs):s.dirs),s.transition&&Zt(m,s.transition),t=m,Dn(h),t}var uf=e=>{let t;for(let i in e)(i==="class"||i==="style"||Li(i))&&((t||(t={}))[i]=e[i]);return t},ff=(e,t)=>{let i={};for(let n in e)ar(n)&&n.slice(9)in t||(i[n]=e[n]);return i};function Do(e,t,i){let n=Object.keys(t);if(n.length!==Object.keys(e).length)return!0;for(let s=0;s<n.length;s++){let r=n[s];if(Cc(t,e,r)&&!$s(i,r))return!0}return!1}function Cc(e,t,i){let n=e[i],s=t[i];return i==="style"&&he(n)&&he(s)?!Gt(n,s):n!==s}function wr({vnode:e,parent:t,suspense:i},n){for(;t;){let s=t.subTree;if(s.suspense&&s.suspense.activeBranch===e&&(s.suspense.vnode.el=s.el=n,e=s),s===e)(e=t.vnode).el=n,t=t.parent;else break}i&&i.activeBranch===e&&(i.vnode.el=n)}var ca={},Tc=e=>Object.getPrototypeOf(e)===ca;function Ac(e,t,i,n){let s,[r,a]=e.propsOptions,o=!1;if(t)for(let l in t){let c;if(Ht(l))continue;let d=t[l];r&&ge(r,c=we(l))?a&&a.includes(c)?(s||(s={}))[c]=d:i[c]=d:$s(e.emitsOptions,l)||l in n&&d===n[l]||(n[l]=d,o=!0)}if(a){let l=ue(i),c=s||de;for(let d=0;d<a.length;d++){let p=a[d];i[p]=da(r,l,p,c[p],e,!ge(c,p))}}return o}function da(e,t,i,n,s,r){let a=e[i];if(a!=null){let o=ge(a,"default");if(o&&n===void 0){let l=a.default;if(a.type!==Function&&!a.skipFactory&&te(l)){let{propsDefaults:c}=s;if(i in c)n=c[i];else{let d=un(s);n=c[i]=l.call(null,t),d()}}else n=l;s.ce&&s.ce._setProp(i,n)}a[0]&&(r&&!o?n=!1:a[1]&&(n===""||n===dt(i))&&(n=!0))}return n}var hf=new WeakMap;function Fo(e){return!(e[0]==="$"||Ht(e))}var Va=e=>e==="_"||e==="_ctx"||e==="$stable",Ha=e=>J(e)?e.map(ct):[ct(e)],mf=(e,t,i)=>{if(t._n)return t;let n=Pa((...s)=>Ha(t(...s)),i);return n._c=!1,n},Nc=(e,t,i)=>{let n=e._ctx;for(let s in e){if(Va(s))continue;let r=e[s];if(te(r))t[s]=mf(s,r,n);else if(r!=null){let a=Ha(r);t[s]=()=>a}}},Ec=(e,t)=>{let i=Ha(t);e.slots.default=()=>i},Mc=(e,t,i)=>{for(let n in t)(i||!Va(n))&&(e[n]=t[n])},Pe=Pc;function Ka(e){return Rc(e)}function Ic(e){return Rc(e,Nu)}function Rc(e,t){var i;let n,s;dr().__VUE__=!0;let{insert:r,remove:a,patchProp:o,createElement:l,createText:c,createComment:d,setText:p,setElementText:u,parentNode:w,nextSibling:g,setScopeId:_=He,insertStaticContent:A}=e,E=(b,C,O,$=null,F=null,P=null,U,D=null,j=!!C.dynamicChildren)=>{if(b===C)return;b&&!Ct(b,C)&&($=le(b),pe(b,F,P,!0),b=null),C.patchFlag===-2&&(j=!1,C.dynamicChildren=null);let{type:L,ref:K,shapeFlag:Q}=C;switch(L){case ci:h(b,C,O,$);break;case Oe:m(b,C,O,$);break;case Ni:b==null&&q(C,O,$,U);break;case ze:x(b,C,O,$,F,P,U,D,j);break;default:1&Q?T(b,C,O,$,F,P,U,D,j):6&Q?I(b,C,O,$,F,P,U,D,j):(64&Q||128&Q)&&L.process(b,C,O,$,F,P,U,D,j,qe)}K!=null&&F?sn(K,b&&b.ref,P,C||b,!C):K==null&&b&&b.ref!=null&&sn(b.ref,null,P,b,!0)},h=(b,C,O,$)=>{if(b==null)r(C.el=c(C.children),O,$);else{let F=C.el=b.el;C.children!==b.children&&p(F,C.children)}},m=(b,C,O,$)=>{b==null?r(C.el=d(C.children||""),O,$):C.el=b.el},q=(b,C,O,$)=>{[b.el,b.anchor]=A(b.children,C,O,$,b.el,b.anchor)},T=(b,C,O,$,F,P,U,D,j)=>{if(C.type==="svg"?U="svg":C.type==="math"&&(U="mathml"),b==null)N(C,O,$,F,P,U,D,j);else{let L=b.el&&b.el._isVueCE?b.el:null;try{L&&L._beginPatch(),v(b,C,F,P,U,D,j)}finally{L&&L._endPatch()}}},N=(b,C,O,$,F,P,U,D)=>{let j,L,{props:K,shapeFlag:Q,transition:Y,dirs:G}=b;if(j=b.el=l(b.type,P,K&&K.is,K),8&Q?u(j,b.children):16&Q&&y(b.children,j,null,$,F,Ur(b,P),U,D),G&&Rt(b,null,$,"created"),f(j,b,b.scopeId,U,$),K){for(let ee in K)ee==="value"||Ht(ee)||o(j,ee,null,K[ee],P,$);"value"in K&&o(j,"value",null,K.value,P),(L=K.onVnodeBeforeMount)&&lt(L,$,b)}G&&Rt(b,null,$,"beforeMount");let re=Oc(F,Y);re&&Y.beforeEnter(j),r(j,C,O),((L=K&&K.onVnodeMounted)||re||G)&&Pe(()=>{L&&lt(L,$,b),re&&Y.enter(j),G&&Rt(b,null,$,"mounted")},F)},f=(b,C,O,$,F)=>{if(O&&_(b,O),$)for(let P=0;P<$.length;P++)_(b,$[P]);if(F){let P=F.subTree;if(C===P||Vs(P.type)&&(P.ssContent===C||P.ssFallback===C)){let U=F.vnode;f(b,U,U.scopeId,U.slotScopeIds,F.parent)}}},y=(b,C,O,$,F,P,U,D,j=0)=>{for(let L=j;L<b.length;L++)E(null,b[L]=D?Ut(b[L]):ct(b[L]),C,O,$,F,P,U,D)},v=(b,C,O,$,F,P,U)=>{let D,j=C.el=b.el,{patchFlag:L,dynamicChildren:K,dirs:Q}=C;L|=16&b.patchFlag;let Y=b.props||de,G=C.props||de;if(O&&xi(O,!1),(D=G.onVnodeBeforeUpdate)&&lt(D,O,C,b),Q&&Rt(C,b,O,"beforeUpdate"),O&&xi(O,!0),K&&(!b.dynamicChildren||b.dynamicChildren.length!==K.length)&&(L=0,U=!1,K=null),(Y.innerHTML&&G.innerHTML==null||Y.textContent&&G.textContent==null)&&u(j,""),K?k(b.dynamicChildren,K,j,O,$,Ur(C,F),P):U||V(b,C,j,null,O,$,Ur(C,F),P,!1),L>0){if(16&L)S(j,Y,G,O,F);else if(2&L&&Y.class!==G.class&&o(j,"class",null,G.class,F),4&L&&o(j,"style",Y.style,G.style,F),8&L){let re=C.dynamicProps;for(let ee=0;ee<re.length;ee++){let be=re[ee],Ae=Y[be],Ee=G[be];(Ee!==Ae||be==="value")&&o(j,be,Ae,Ee,F,O)}}1&L&&b.children!==C.children&&u(j,C.children)}else U||K!=null||S(j,Y,G,O,F);((D=G.onVnodeUpdated)||Q)&&Pe(()=>{D&&lt(D,O,C,b),Q&&Rt(C,b,O,"updated")},$)},k=(b,C,O,$,F,P,U)=>{for(let D=0;D<C.length;D++){let j=b[D],L=C[D],K=j.el&&(j.type===ze||!Ct(j,L)||198&j.shapeFlag)?w(j.el):O;E(j,L,K,null,$,F,P,U,!0)}},S=(b,C,O,$,F)=>{if(C!==O){if(C!==de)for(let P in C)Ht(P)||P in O||o(b,P,C[P],null,F,$);for(let P in O){if(Ht(P))continue;let U=O[P],D=C[P];U!==D&&P!=="value"&&o(b,P,D,U,F,$)}"value"in O&&o(b,"value",C.value,O.value,F)}},x=(b,C,O,$,F,P,U,D,j)=>{let L=C.el=b?b.el:c(""),K=C.anchor=b?b.anchor:c(""),{patchFlag:Q,dynamicChildren:Y,slotScopeIds:G}=C;G&&(D=D?D.concat(G):G),b==null?(r(L,O,$),r(K,O,$),y(C.children||[],O,K,F,P,U,D,j)):Q>0&&64&Q&&Y&&b.dynamicChildren&&b.dynamicChildren.length===Y.length?(k(b.dynamicChildren,Y,O,F,P,U,D),(C.key!=null||F&&C===F.subTree)&&Qa(b,C,!0)):V(b,C,O,K,F,P,U,D,j)},I=(b,C,O,$,F,P,U,D,j)=>{C.slotScopeIds=D,b==null?512&C.shapeFlag?F.ctx.activate(C,O,$,U,j):R(C,O,$,F,P,U,j):M(b,C,j)},R=(b,C,O,$,F,P,U)=>{let D=b.component=Uc(b,$,F);if(Xn(b)&&(D.ctx.renderer=qe),zc(D,!1,U),D.asyncDep){if(F&&F.registerDep(D,z,U),!b.el){let j=D.subTree=Te(Oe);m(null,j,C,O),b.placeholder=j.el}}else z(D,b,C,O,F,P,U)},M=(b,C,O)=>{let $=C.component=b.component;if(function(F,P,U){let{props:D,children:j,component:L}=F,{props:K,children:Q,patchFlag:Y}=P,G=L.emitsOptions;if(P.dirs||P.transition)return!0;if(!U||!(Y>=0))return(!!j||!!Q)&&(!Q||!Q.$stable)||D!==K&&(D?!K||Do(D,K,G):!!K);if(1024&Y)return!0;if(16&Y)return D?Do(D,K,G):!!K;if(8&Y){let re=P.dynamicProps;for(let ee=0;ee<re.length;ee++){let be=re[ee];if(Cc(K,D,be)&&!$s(G,be))return!0}}return!1}(b,C,O)){if($.asyncDep&&!$.asyncResolved)return void B($,C,O);$.next=C,$.update()}else C.el=b.el,$.vnode=C},z=(b,C,O,$,F,P,U)=>{b.scope.on();let D=b.effect=new Mi(()=>{if(b.isMounted){let K,{next:Q,bu:Y,u:G,parent:re,vnode:ee}=b;{let ot=function ls(bi){let ii=bi.subTree.component;if(ii)return ii.asyncDep&&!ii.asyncResolved?ii:ls(ii)}(b);if(ot){Q&&(Q.el=ee.el,B(b,Q,U)),ot.asyncDep.then(()=>{Pe(()=>{b.isUnmounted||j()},F)});return}}let be=Q;xi(b,!1),Q?(Q.el=ee.el,B(b,Q,U)):Q=ee,Y&&Xi(Y),(K=Q.props&&Q.props.onVnodeBeforeUpdate)&&lt(K,re,Q,ee),xi(b,!0);let Ae=qs(b),Ee=b.subTree;b.subTree=Ae,E(Ee,Ae,w(Ee.el),le(Ee),b,F,P),Q.el=Ae.el,be===null&&wr(b,Ae.el),G&&Pe(G,F),(K=Q.props&&Q.props.onVnodeUpdated)&&Pe(()=>lt(K,re,Q,ee),F)}else{let K,{el:Q,props:Y}=C,{bm:G,m:re,parent:ee,root:be,type:Ae}=b,Ee=Qt(C);if(xi(b,!1),G&&Xi(G),!Ee&&(K=Y&&Y.onVnodeBeforeMount)&&lt(K,ee,C),xi(b,!0),Q&&s){let ot=()=>{b.subTree=qs(b),s(Q,b.subTree,b,F,null)};Ee&&Ae.__asyncHydrate?Ae.__asyncHydrate(Q,b,ot):ot()}else{be.ce&&be.ce._hasShadowRoot()&&be.ce._injectChildStyle(Ae,b.parent?b.parent.type:void 0);let ot=b.subTree=qs(b);E(null,ot,O,$,b,F,P),C.el=ot.el}if(re&&Pe(re,F),!Ee&&(K=Y&&Y.onVnodeMounted)){let ot=C;Pe(()=>lt(K,ee,ot),F)}(256&C.shapeFlag||ee&&Qt(ee.vnode)&&256&ee.vnode.shapeFlag)&&b.a&&Pe(b.a,F),b.isMounted=!0,C=O=$=null}});b.scope.off();let j=b.update=D.run.bind(D),L=b.job=D.runIfDirty.bind(D);L.i=b,L.id=b.uid,D.scheduler=()=>Oa(L),xi(b,!0),j()},B=(b,C,O)=>{C.component=b;let $=b.vnode.props;b.vnode=C,b.next=null,function(F,P,U,D){let{props:j,attrs:L,vnode:{patchFlag:K}}=F,Q=ue(j),[Y]=F.propsOptions,G=!1;if((D||K>0)&&!(16&K)){if(8&K){let re=F.vnode.dynamicProps;for(let ee=0;ee<re.length;ee++){let be=re[ee];if($s(F.emitsOptions,be))continue;let Ae=P[be];if(Y)if(ge(L,be))Ae!==L[be]&&(L[be]=Ae,G=!0);else{let Ee=we(be);j[Ee]=da(Y,Q,Ee,Ae,F,!1)}else Ae!==L[be]&&(L[be]=Ae,G=!0)}}}else{let re;for(let ee in Ac(F,P,j,L)&&(G=!0),Q)P&&(ge(P,ee)||(re=dt(ee))!==ee&&ge(P,re))||(Y?U&&(U[ee]!==void 0||U[re]!==void 0)&&(j[ee]=da(Y,Q,ee,void 0,F,!0)):delete j[ee]);if(L!==Q)for(let ee in L)P&&ge(P,ee)||(delete L[ee],G=!0)}G&&$t(F.attrs,"set","")}(b,C.props,$,O),((F,P,U)=>{let{vnode:D,slots:j}=F,L=!0,K=de;if(32&D.shapeFlag){let Q=P._;Q?U&&Q===1?L=!1:Mc(j,P,U):(L=!P.$stable,Nc(P,j)),K=P}else P&&(Ec(F,P),K={default:1});if(L)for(let Q in j)Va(Q)||K[Q]!=null||delete j[Q]})(b,C.children,O),Yt(),To(b),Xt()},V=(b,C,O,$,F,P,U,D,j=!1)=>{let L=b&&b.children,K=b?b.shapeFlag:0,Q=C.children,{patchFlag:Y,shapeFlag:G}=C;if(Y>0){if(128&Y)return void X(L,Q,O,$,F,P,U,D,j);if(256&Y)return void H(L,Q,O,$,F,P,U,D,j)}8&G?(16&K&&tt(L,F,P),Q!==L&&u(O,Q)):16&K?16&G?X(L,Q,O,$,F,P,U,D,j):tt(L,F,P,!0):(8&K&&u(O,""),16&G&&y(Q,O,$,F,P,U,D,j))},H=(b,C,O,$,F,P,U,D,j)=>{let L;b=b||Gi,C=C||Gi;let K=b.length,Q=C.length,Y=Math.min(K,Q);for(L=0;L<Y;L++){let G=C[L]=j?Ut(C[L]):ct(C[L]);E(b[L],G,O,null,F,P,U,D,j)}K>Q?tt(b,F,P,!0,!1,Y):y(C,O,$,F,P,U,D,j,Y)},X=(b,C,O,$,F,P,U,D,j)=>{let L=0,K=C.length,Q=b.length-1,Y=K-1;for(;L<=Q&&L<=Y;){let G=b[L],re=C[L]=j?Ut(C[L]):ct(C[L]);if(Ct(G,re))E(G,re,O,null,F,P,U,D,j);else break;L++}for(;L<=Q&&L<=Y;){let G=b[Q],re=C[Y]=j?Ut(C[Y]):ct(C[Y]);if(Ct(G,re))E(G,re,O,null,F,P,U,D,j);else break;Q--,Y--}if(L>Q){if(L<=Y){let G=Y+1,re=G<K?C[G].el:$;for(;L<=Y;)E(null,C[L]=j?Ut(C[L]):ct(C[L]),O,re,F,P,U,D,j),L++}}else if(L>Y)for(;L<=Q;)pe(b[L],F,P,!0),L++;else{let G,re=L,ee=L,be=new Map;for(L=ee;L<=Y;L++){let Me=C[L]=j?Ut(C[L]):ct(C[L]);Me.key!=null&&be.set(Me.key,L)}let Ae=0,Ee=Y-ee+1,ot=!1,ls=0,bi=Array(Ee);for(L=0;L<Ee;L++)bi[L]=0;for(L=re;L<=Q;L++){let Me,Ue=b[L];if(Ae>=Ee){pe(Ue,F,P,!0);continue}if(Ue.key!=null)Me=be.get(Ue.key);else for(G=ee;G<=Y;G++)if(bi[G-ee]===0&&Ct(Ue,C[G])){Me=G;break}Me===void 0?pe(Ue,F,P,!0):(bi[Me-ee]=L+1,Me>=ls?ls=Me:ot=!0,E(Ue,C[Me],O,null,F,P,U,D,j),Ae++)}let ii=ot?function(Me){let Ue,gn,it,Et,yi,ji=Me.slice(),xt=[0],Ep=Me.length;for(Ue=0;Ue<Ep;Ue++){let cs=Me[Ue];if(cs!==0){if(Me[gn=xt[xt.length-1]]<cs){ji[Ue]=gn,xt.push(Ue);continue}for(it=0,Et=xt.length-1;it<Et;)Me[xt[yi=it+Et>>1]]<cs?it=yi+1:Et=yi;cs<Me[xt[it]]&&(it>0&&(ji[Ue]=xt[it-1]),xt[it]=Ue)}}for(it=xt.length,Et=xt[it-1];it-- >0;)xt[it]=Et,Et=ji[Et];return xt}(bi):Gi;for(G=ii.length-1,L=Ee-1;L>=0;L--){let Me=ee+L,Ue=C[Me],gn=C[Me+1],it=Me+1<K?gn.el||function Et(yi){if(yi.placeholder)return yi.placeholder;let ji=yi.component;return ji?Et(ji.subTree):null}(gn):$;bi[L]===0?E(null,Ue,O,it,F,P,U,D,j):ot&&(G<0||L!==ii[G]?ie(Ue,O,it,2):G--)}}},ie=(b,C,O,$,F=null)=>{let{el:P,type:U,transition:D,children:j,shapeFlag:L}=b;if(6&L)return void ie(b.component.subTree,C,O,$);if(128&L)return void b.suspense.move(C,O,$);if(64&L)return void U.move(b,C,O,qe);if(U===ze){r(P,C,O);for(let K=0;K<j.length;K++)ie(j[K],C,O,$);r(b.anchor,C,O);return}if(U===Ni)return void(({el:K,anchor:Q},Y,G)=>{let re;for(;K&&K!==Q;)re=g(K),r(K,Y,G),K=re;r(Q,Y,G)})(b,C,O);if($!==2&&1&L&&D)if($===0)D.persisted&&!P[kt]?r(P,C,O):(D.beforeEnter(P),r(P,C,O),Pe(()=>D.enter(P),F));else{let{leave:K,delayLeave:Q,afterLeave:Y}=D,G=()=>{b.ctx.isUnmounted?a(P):r(P,C,O)},re=()=>{let ee=P._isLeaving||!!P[kt];P._isLeaving&&P[kt](!0),D.persisted&&!ee?G():K(P,()=>{G(),Y&&Y()})};Q?Q(P,G,re):re()}else r(P,C,O)},pe=(b,C,O,$=!1,F=!1)=>{let P,{type:U,props:D,ref:j,children:L,dynamicChildren:K,shapeFlag:Q,patchFlag:Y,dirs:G,cacheIndex:re,memo:ee}=b;if(Y===-2&&(F=!1),j!=null&&(Yt(),sn(j,null,O,b,!0),Xt()),re!=null&&(C.renderCache[re]=void 0),256&Q)return void C.ctx.deactivate(b);let be=1&Q&&G,Ae=!Qt(b);if(Ae&&(P=D&&D.onVnodeBeforeUnmount)&&lt(P,C,b),6&Q)Ve(b.component,O,$);else{if(128&Q)return void b.suspense.unmount(O,$);be&&Rt(b,null,C,"beforeUnmount"),64&Q?b.type.remove(b,C,O,qe,$):K&&!K.hasOnce&&(U!==ze||Y>0&&64&Y)?tt(K,C,O,!1,!0):(U===ze&&384&Y||!F&&16&Q)&&tt(L,C,O),$&&me(b)}let Ee=ee!=null&&re==null;(Ae&&(P=D&&D.onVnodeUnmounted)||be||Ee)&&Pe(()=>{P&&lt(P,C,b),be&&Rt(b,null,C,"unmounted"),Ee&&(b.el=null)},O)},me=b=>{let{type:C,el:O,anchor:$,transition:F}=b;if(C===ze)return void xe(O,$);if(C===Ni)return void(({el:U,anchor:D})=>{let j;for(;U&&U!==D;)j=g(U),a(U),U=j;a(D)})(b);let P=()=>{a(O),F&&!F.persisted&&F.afterLeave&&F.afterLeave()};if(1&b.shapeFlag&&F&&!F.persisted){let{leave:U,delayLeave:D}=F,j=()=>U(O,P);D?D(b.el,P,j):j()}else P()},xe=(b,C)=>{let O;for(;b!==C;)O=g(b),a(b),b=O;a(C)},Ve=(b,C,O)=>{let{bum:$,scope:F,job:P,subTree:U,um:D,m:j,a:L}=b;zs(j),zs(L),$&&Xi($),F.stop(),P&&(P.flags|=8,pe(U,b,C,O)),D&&Pe(D,C),Pe(()=>{b.isUnmounted=!0},C)},tt=(b,C,O,$=!1,F=!1,P=0)=>{for(let U=P;U<b.length;U++)pe(b[U],C,O,$,F)},le=b=>{if(6&b.shapeFlag)return le(b.component.subTree);if(128&b.shapeFlag)return b.suspense.next();let C=g(b.anchor||b.el),O=C&&C[cc];return O?g(O):C},se=!1,ke=(b,C,O)=>{let $;b==null?C._vnode&&(pe(C._vnode,null,null,!0),$=C._vnode.component):E(C._vnode||null,b,C,null,null,null,O),C._vnode=b,se||(se=!0,To($),Ls(),se=!1)},qe={p:E,um:pe,m:ie,r:me,mt:R,mc:y,pc:V,pbc:k,n:le,o:e};return t&&([n,s]=t(qe)),{render:ke,hydrate:n,createApp:(i=n,function(b,C=null){te(b)||(b=ce({},b)),C==null||he(C)||(C=null);let O=Sc(),$=new WeakSet,F=[],P=!1,U=O.app={_uid:lf++,_component:b,_props:C,_container:null,_context:O,_instance:null,version:Gc,get config(){return O.config},set config(D){},use:(D,...j)=>($.has(D)||(D&&te(D.install)?($.add(D),D.install(U,...j)):te(D)&&($.add(D),D(U,...j))),U),mixin:D=>(O.mixins.includes(D)||O.mixins.push(D),U),component:(D,j)=>j?(O.components[D]=j,U):O.components[D],directive:(D,j)=>j?(O.directives[D]=j,U):O.directives[D],mount(D,j,L){if(!P){let K=U._ceVNode||Te(b,C);return K.appContext=O,L===!0?L="svg":L===!1&&(L=void 0),j&&i?i(K,D):ke(K,D,L),P=!0,U._container=D,D.__vue_app__=U,ts(K.component)}},onUnmount(D){F.push(D)},unmount(){P&&(vt(F,U._instance,16),ke(null,U._container),delete U._container.__vue_app__)},provide:(D,j)=>(O.provides[D]=j,U),runWithContext(D){let j=Ai;Ai=U;try{return D()}finally{Ai=j}}};return U})}}function Ur({type:e,props:t},i){return i==="svg"&&e==="foreignObject"||i==="mathml"&&e==="annotation-xml"&&t&&t.encoding&&t.encoding.includes("html")?void 0:i}function xi({effect:e,job:t},i){i?(e.flags|=32,t.flags|=4):(e.flags&=-33,t.flags&=-5)}function Oc(e,t){return(!e||e&&!e.pendingBranch)&&t&&!t.persisted}function Qa(e,t,i=!1){let n=e.children,s=t.children;if(J(n)&&J(s))for(let r=0;r<n.length;r++){let a=n[r],o=s[r];1&o.shapeFlag&&!o.dynamicChildren&&((o.patchFlag<=0||o.patchFlag===32)&&((o=s[r]=Ut(s[r])).el=a.el),i||o.patchFlag===-2||Qa(a,o)),o.type===ci&&(o.patchFlag===-1&&(o=s[r]=Ut(o)),o.el=a.el),o.type!==Oe||o.el||(o.el=a.el)}}function zs(e){if(e)for(let t=0;t<e.length;t++)e[t].flags|=8}var Vs=e=>e.__isSuspense,pa=0,gf={name:"Suspense",__isSuspense:!0,process(e,t,i,n,s,r,a,o,l,c){if(e==null)(function(d,p,u,w,g,_,A,E,h){let{p:m,o:{createElement:q}}=h,T=q("div"),N=d.suspense=jo(d,g,w,p,T,u,_,A,E,h);m(null,N.pendingBranch=d.ssContent,T,null,w,N,_,A),N.deps>0?(In(d,"onPending"),In(d,"onFallback"),m(null,d.ssFallback,p,u,w,null,_,A),Qi(N,d.ssFallback)):N.resolve(!1,!0)})(t,i,n,s,r,a,o,l,c);else{if(r&&r.deps>0&&!e.suspense.isInFallback){t.suspense=e.suspense,t.suspense.vnode=t,t.el=e.el;return}(function(d,p,u,w,g,_,A,E,{p:h,um:m,o:{createElement:q}}){let T=p.suspense=d.suspense;T.vnode=p,p.el=d.el;let N=p.ssContent,f=p.ssFallback,{activeBranch:y,pendingBranch:v,isInFallback:k,isHydrating:S}=T;if(v)T.pendingBranch=N,Ct(v,N)?(h(v,N,T.hiddenContainer,null,g,T,_,A,E),T.deps<=0?T.resolve():k&&!S&&(h(y,f,u,w,g,null,_,A,E),Qi(T,f))):(T.pendingId=pa++,S?(T.isHydrating=!1,T.activeBranch=v):m(v,g,T),T.deps=0,T.effects.length=0,T.hiddenContainer=q("div"),k?(h(null,N,T.hiddenContainer,null,g,T,_,A,E),T.deps<=0?T.resolve():(h(y,f,u,w,g,null,_,A,E),Qi(T,f))):y&&Ct(y,N)?(h(y,N,u,w,g,T,_,A,E),T.resolve(!0)):(h(null,N,T.hiddenContainer,null,g,T,_,A,E),T.deps<=0&&T.resolve()));else if(y&&Ct(y,N))h(y,N,u,w,g,T,_,A,E),Qi(T,N);else if(In(p,"onPending"),T.pendingBranch=N,512&N.shapeFlag?T.pendingId=N.component.suspenseId:T.pendingId=pa++,h(null,N,T.hiddenContainer,null,g,T,_,A,E),T.deps<=0)T.resolve();else{let{timeout:x,pendingId:I}=T;x>0?setTimeout(()=>{T.pendingId===I&&T.fallback(f)},x):x===0&&T.fallback(f)}})(e,t,i,n,s,a,o,l,c)}},hydrate:function(e,t,i,n,s,r,a,o,l){let c=t.suspense=jo(t,n,i,e.parentNode,document.createElement("div"),null,s,r,a,o,!0),d=l(e,c.pendingBranch=t.ssContent,i,c,r,a);return c.deps===0&&c.resolve(!1,!0),d},normalize:function(e){let{shapeFlag:t,children:i}=e,n=32&t;e.ssContent=Uo(n?i.default:i),e.ssFallback=n?Uo(i.fallback):Te(Oe)}};function In(e,t){let i=e.props&&e.props[t];te(i)&&i()}function jo(e,t,i,n,s,r,a,o,l,c,d=!1){var p;let u,w,{p:g,m:_,um:A,n:E,o:{parentNode:h,remove:m}}=c,q=(u=(p=e).props&&p.props.suspensible)!=null&&u!==!1;q&&t&&t.pendingBranch&&(w=t.pendingId,t.deps++);let T=e.props?Zi(e.props.timeout):void 0,N=r,f={vnode:e,parent:t,parentComponent:i,namespace:a,container:n,hiddenContainer:s,deps:0,pendingId:pa++,timeout:typeof T=="number"?T:-1,activeBranch:null,isFallbackMountPending:!1,pendingBranch:null,isInFallback:!d,isHydrating:d,isUnmounted:!1,effects:[],resolve(y=!1,v=!1){let{vnode:k,activeBranch:S,pendingBranch:x,pendingId:I,effects:R,parentComponent:M,container:z,isInFallback:B}=f,V=!1;if(f.isHydrating)f.isHydrating=!1;else if(!y){V=S&&x.transition&&x.transition.mode==="out-in";let ie=!1;V&&(S.transition.afterLeave=()=>{I===f.pendingId&&(_(x,z,r!==N||ie?r:E(S),0),Ln(R),B&&k.ssFallback&&(k.ssFallback.el=null))}),S&&!f.isFallbackMountPending&&(h(S.el)===z&&(r=E(S),ie=!0),A(S,M,f,!0),!V&&B&&k.ssFallback&&Pe(()=>k.ssFallback.el=null,f)),V||_(x,z,r,0)}f.isFallbackMountPending=!1,Qi(f,x),f.pendingBranch=null,f.isInFallback=!1;let H=f.parent,X=!1;for(;H;){if(H.pendingBranch){H.effects.push(...R),X=!0;break}H=H.parent}X||V||Ln(R),f.effects=[],q&&t&&t.pendingBranch&&w===t.pendingId&&(t.deps--,t.deps!==0||v||t.resolve()),In(k,"onResolve")},fallback(y){if(!f.pendingBranch)return;let{vnode:v,activeBranch:k,parentComponent:S,container:x,namespace:I}=f;In(v,"onFallback");let R=E(k),M=()=>{f.isFallbackMountPending=!1,f.isInFallback&&(g(null,y,x,R,S,null,I,o,l),Qi(f,y))},z=y.transition&&y.transition.mode==="out-in";z&&(f.isFallbackMountPending=!0,k.transition.afterLeave=M),f.isInFallback=!0,A(k,S,null,!0),z||M()},move(y,v,k){f.activeBranch&&_(f.activeBranch,y,v,k),f.container=y},next:()=>f.activeBranch&&E(f.activeBranch),registerDep(y,v,k){let S=!!f.pendingBranch;S&&f.deps++;let x=y.vnode.el;y.asyncDep.catch(I=>{Fi(I,y,0)}).then(I=>{if(y.isUnmounted||f.isUnmounted||f.pendingId!==y.suspenseId)return;$n(),y.asyncResolved=!0;let{vnode:R}=y;ua(y,I,!1),x&&(R.el=x);let M=!x&&y.subTree.el;v(y,R,h(x||y.subTree.el),x?null:E(y.subTree),f,a,k),M&&(R.placeholder=null,m(M)),wr(y,R.el),S&&--f.deps==0&&f.resolve()})},unmount(y,v){f.isUnmounted=!0,f.activeBranch&&A(f.activeBranch,i,y,v),f.pendingBranch&&A(f.pendingBranch,i,y,v)}};return f}function Uo(e){let t;if(te(e)){let i=Ii&&e._c;i&&(e._d=!1,jn()),e=e(),i&&(e._d=!0,t=Xe,kr())}return J(e)&&(e=function(i){let n;for(let s=0;s<i.length;s++){let r=i[s];if(!ei(r))return;if(r.type!==Oe||r.children==="v-if"){if(n)return;n=r}}return n}(e)),e=ct(e),t&&!e.dynamicChildren&&(e.dynamicChildren=t.filter(i=>i!==e)),e}function Pc(e,t){t&&t.pendingBranch?J(e)?t.effects.push(...e):t.effects.push(e):Ln(e)}function Qi(e,t){e.activeBranch=t;let{vnode:i,parentComponent:n}=e,s=t.el;for(;!s&&t.component;)s=(t=t.component.subTree).el;i.el=s,n&&n.subTree===i&&(n.vnode.el=s,wr(n,s))}var ze=Symbol.for("v-fgt"),ci=Symbol.for("v-txt"),Oe=Symbol.for("v-cmt"),Ni=Symbol.for("v-stc"),Wt=[],Xe=null;function jn(e=!1){Wt.push(Xe=e?null:[])}function kr(){Wt.pop(),Xe=Wt[Wt.length-1]||null}var Ii=1;function Un(e,t=!1){Ii+=e,e<0&&Xe&&t&&(Xe.hasOnce=!0)}function Bc(e){return e.dynamicChildren=Ii>0?Xe||Gi:null,kr(),Ii>0&&Xe&&Xe.push(e),e}function vf(e,t,i,n,s,r){return Bc(Wa(e,t,i,n,s,r,!0))}function Hs(e,t,i,n,s){return Bc(Te(e,t,i,n,s,!0))}function ei(e){return!!e&&e.__v_isVNode===!0}function Ct(e,t){return e.type===t.type&&e.key===t.key}function bf(e){}var Lc=({key:e})=>e??null,Cs=({ref:e,ref_key:t,ref_for:i})=>(typeof e=="number"&&(e=""+e),e!=null?ne(e)||Le(e)||te(e)?{i:Qe,r:e,k:t,f:!!i}:e:null);function Wa(e,t=null,i=null,n=0,s=null,r=+(e!==ze),a=!1,o=!1){let l={__v_isVNode:!0,__v_skip:!0,type:e,props:t,key:t&&Lc(t),ref:t&&Cs(t),scopeId:vr,slotScopeIds:null,children:i,component:null,suspense:null,ssContent:null,ssFallback:null,dirs:null,transition:null,el:null,anchor:null,target:null,targetStart:null,targetAnchor:null,staticCount:0,shapeFlag:r,patchFlag:n,dynamicProps:s,dynamicChildren:null,appContext:null,ctx:Qe};return o?(Ks(l,i),128&r&&e.normalize(l)):i&&(l.shapeFlag|=ne(i)?8:16),Ii>0&&!a&&Xe&&(l.patchFlag>0||6&r)&&l.patchFlag!==32&&Xe.push(l),l}var Te=function(e,t=null,i=null,n=0,s=null,r=!1){var a;if(e&&e!==kc||(e=Oe),ei(e)){let l=Bt(e,t,!0);return i&&Ks(l,i),Ii>0&&!r&&Xe&&(6&l.shapeFlag?Xe[Xe.indexOf(e)]=l:Xe.push(l)),l.patchFlag=-2,l}if(te(a=e)&&"__vccOpts"in a&&(e=e.__vccOpts),t){let{class:l,style:c}=t=Dc(t);l&&!ne(l)&&(t.class=Wn(l)),he(c)&&(Jn(c)&&!J(c)&&(c=ce({},c)),t.style=Qn(c))}let o=ne(e)?1:Vs(e)?128:e.__isTeleport?64:he(e)?4:2*!!te(e);return Wa(e,t,i,n,s,o,r,!0)};function Dc(e){return e?Jn(e)||Tc(e)?ce({},e):e:null}function Bt(e,t,i=!1,n=!1){let{props:s,ref:r,patchFlag:a,children:o,transition:l}=e,c=t?jc(s||{},t):s,d={__v_isVNode:!0,__v_skip:!0,type:e.type,props:c,key:c&&Lc(c),ref:t&&t.ref?i&&r?J(r)?r.concat(Cs(t)):[r,Cs(t)]:Cs(t):r,scopeId:e.scopeId,slotScopeIds:e.slotScopeIds,children:o,target:e.target,targetStart:e.targetStart,targetAnchor:e.targetAnchor,staticCount:e.staticCount,shapeFlag:e.shapeFlag,patchFlag:t&&e.type!==ze?a===-1?16:16|a:a,dynamicProps:e.dynamicProps,dynamicChildren:e.dynamicChildren,appContext:e.appContext,dirs:e.dirs,transition:l,component:e.component,suspense:e.suspense,ssContent:e.ssContent&&Bt(e.ssContent),ssFallback:e.ssFallback&&Bt(e.ssFallback),placeholder:e.placeholder,el:e.el,anchor:e.anchor,ctx:e.ctx,ce:e.ce};return l&&n&&Zt(d,l.clone(d)),d}function Ja(e=" ",t=0){return Te(ci,null,e,t)}function yf(e,t){let i=Te(Ni,null,e);return i.staticCount=t,i}function Fc(e="",t=!1){return t?(jn(),Hs(Oe,null,e)):Te(Oe,null,e)}function ct(e){return e==null||typeof e=="boolean"?Te(Oe):J(e)?Te(ze,null,e.slice()):ei(e)?Ut(e):Te(ci,null,String(e))}function Ut(e){return e.el===null&&e.patchFlag!==-1||e.memo?e:Bt(e)}function Ks(e,t){let i=0,{shapeFlag:n}=e;if(t==null)t=null;else if(J(t))i=16;else if(typeof t=="object")if(65&n){let s=t.default;s&&(s._c&&(s._d=!1),Ks(e,s()),s._c&&(s._d=!0));return}else{i=32;let s=t._;s||Tc(t)?s===3&&Qe&&(Qe.slots._===1?t._=1:(t._=2,e.patchFlag|=1024)):t._ctx=Qe}else if(te(t)){if(65&n)return void Ks(e,{default:t});t={default:t,_ctx:Qe},i=32}else t=String(t),64&n?(i=16,t=[Ja(t)]):i=8;e.children=t,e.shapeFlag|=i}function jc(...e){let t={};for(let i=0;i<e.length;i++){let n=e[i];for(let s in n)if(s==="class")t.class!==n.class&&(t.class=Wn([t.class,n.class]));else if(s==="style")t.style=Qn([t.style,n.style]);else if(Li(s)){let r=t[s],a=n[s];a&&r!==a&&!(J(r)&&r.includes(a))?t[s]=r?[].concat(r,a):a:a!=null||r!=null||ar(s)||(t[s]=a)}else s!==""&&(t[s]=n[s])}return t}function lt(e,t,i,n=null){vt(e,t,7,[i,n])}var xf=Sc(),wf=0;function Uc(e,t,i){let n=e.type,s=(t?t.appContext:e.appContext)||xf,r={uid:wf++,vnode:e,type:n,parent:t,appContext:s,root:null,next:null,subTree:null,effect:null,update:null,job:null,scope:new On(!0),render:null,proxy:null,exposed:null,exposeProxy:null,withProxy:null,provides:t?t.provides:Object.create(s.provides),ids:t?t.ids:["",0,0],accessCache:null,renderCache:[],components:null,directives:null,propsOptions:function a(o,l,c=!1){let d=c?hf:l.propsCache,p=d.get(o);if(p)return p;let u=o.props,w={},g=[],_=!1;if(!te(o)){let E=h=>{_=!0;let[m,q]=a(h,l,!0);ce(w,m),q&&g.push(...q)};!c&&l.mixins.length&&l.mixins.forEach(E),o.extends&&E(o.extends),o.mixins&&o.mixins.forEach(E)}if(!u&&!_)return he(o)&&d.set(o,Gi),Gi;if(J(u))for(let E=0;E<u.length;E++){let h=we(u[E]);Fo(h)&&(w[h]=de)}else if(u)for(let E in u){let h=we(E);if(Fo(h)){let m=u[E],q=w[h]=J(m)||te(m)?{type:m}:ce({},m),T=q.type,N=!1,f=!0;if(J(T))for(let y=0;y<T.length;++y){let v=T[y],k=te(v)&&v.name;if(k==="Boolean"){N=!0;break}k==="String"&&(f=!1)}else N=te(T)&&T.name==="Boolean";q[0]=N,q[1]=f,(N||ge(q,"default"))&&g.push(h)}}let A=[w,g];return he(o)&&d.set(o,A),A}(n,s),emitsOptions:function a(o,l,c=!1){let d=c?pf:l.emitsCache,p=d.get(o);if(p!==void 0)return p;let u=o.emits,w={},g=!1;if(!te(o)){let _=A=>{let E=a(A,l,!0);E&&(g=!0,ce(w,E))};!c&&l.mixins.length&&l.mixins.forEach(_),o.extends&&_(o.extends),o.mixins&&o.mixins.forEach(_)}return u||g?(J(u)?u.forEach(_=>w[_]=null):ce(w,u),he(o)&&d.set(o,w),w):(he(o)&&d.set(o,null),null)}(n,s),emit:null,emitted:null,propsDefaults:de,inheritAttrs:n.inheritAttrs,ctx:de,data:de,props:de,attrs:de,slots:de,refs:de,setupState:de,setupContext:null,suspense:i,suspenseId:i?i.pendingId:0,asyncDep:null,asyncResolved:!1,isMounted:!1,isUnmounted:!1,isDeactivated:!1,bc:null,c:null,bm:null,m:null,bu:null,u:null,um:null,bum:null,da:null,a:null,rtg:null,rtc:null,ec:null,sp:null};return r.ctx={_:r},r.root=t?t.root:r,r.emit=df.bind(null,r),e.ce&&e.ce(r),r}var Ke=null,at=()=>Ke||Qe;{let e=dr(),t=(i,n)=>{let s;return(s=e[i])||(s=e[i]=[]),s.push(n),r=>{s.length>1?s.forEach(a=>a(r)):s[0](r)}};As=t("__VUE_INSTANCE_SETTERS__",i=>Ke=i),Ji=t("__VUE_SSR_SETTERS__",i=>Ri=i)}var un=e=>{let t=Ke;return As(e),e.scope.on(),()=>{e.scope.off(),As(t)}},$n=()=>{Ke&&Ke.scope.off(),As(null)};function $c(e){return 4&e.vnode.shapeFlag}var Ri=!1;function zc(e,t=!1,i=!1){t&&Ji(t);let{props:n,children:s}=e.vnode,r=$c(e);(function(c,d,p,u=!1){let w={},g=Object.create(ca);for(let _ in c.propsDefaults=Object.create(null),Ac(c,d,w,g),c.propsOptions[0])_ in w||(w[_]=void 0);p?c.props=u?w:Gl(w):c.type.props?c.props=w:c.props=g,c.attrs=g})(e,n,r,t);var a=i||t;let o=e.slots=Object.create(ca);if(32&e.vnode.shapeFlag){let c=s._;c?(Mc(o,s,a),a&&Ol(o,"_",c,!0)):Nc(s,o)}else s&&Ec(e,s);let l=r?function(c,d){let p=c.type;c.accessCache=Object.create(null),c.proxy=new Proxy(c.ctx,ra);let{setup:u}=p;if(u){Yt();let w=c.setupContext=u.length>1?Kc(c):null,g=un(c),_=pn(u,c,0,[c.props,w]),A=Ea(_);if(Xt(),g(),(A||c.sp)&&!Qt(c)&&Fa(c),A){if(_.then($n,$n),d)return _.then(E=>{ua(c,E,d)}).catch(E=>{Fi(E,c,0)});c.asyncDep=_}else ua(c,_,d)}else Hc(c,d)}(e,t):void 0;return t&&Ji(!1),l}function ua(e,t,i){te(t)?e.type.__ssrInlineRender?e.ssrRender=t:e.render=t:he(t)&&(e.setupState=Ra(t)),Hc(e,i)}function Vc(e){Ns=e,Wr=t=>{t.render._rc&&(t.withProxy=new Proxy(t.ctx,Ku))}}var kf=()=>!Ns;function Hc(e,t,i){let n=e.type;if(!e.render){if(!t&&Ns&&!n.render){let s=n.template||oa(e).template;if(s){let{isCustomElement:r,compilerOptions:a}=e.appContext.config,{delimiters:o,compilerOptions:l}=n,c=ce(ce({isCustomElement:r,delimiters:o},a),l);n.render=Ns(s,c)}}e.render=n.render||He,Wr&&Wr(e)}{let s=un(e);Yt();try{(function(r){let a=oa(r),o=r.proxy,l=r.ctx;aa=!1,a.beforeCreate&&Po(a.beforeCreate,r,"bc");let{data:c,computed:d,methods:p,watch:u,provide:w,inject:g,created:_,beforeMount:A,mounted:E,beforeUpdate:h,updated:m,activated:q,deactivated:T,beforeUnmount:N,unmounted:f,render:y,renderTracked:v,renderTriggered:k,errorCaptured:S,serverPrefetch:x,expose:I,inheritAttrs:R,components:M,directives:z}=a;if(g&&function(V,H){for(let X in J(V)&&(V=la(V)),V){let ie,pe=V[X];Le(ie=he(pe)?"default"in pe?En(pe.from||X,pe.default,!0):En(pe.from||X):En(pe))?Object.defineProperty(H,X,{enumerable:!0,configurable:!0,get:()=>ie.value,set:me=>ie.value=me}):H[X]=ie}}(g,l),p)for(let V in p){let H=p[V];te(H)&&(l[V]=H.bind(o))}if(c){let V=c.call(o,o);he(V)&&(r.data=fi(V))}if(aa=!0,d)for(let V in d){let H=d[V],X=te(H)?H.bind(o,o):te(H.get)?H.get.bind(o,o):He,ie=Qc({get:X,set:!te(H)&&te(H.set)?H.set.bind(o):He});Object.defineProperty(l,V,{enumerable:!0,configurable:!0,get:()=>ie.value,set:pe=>ie.value=pe})}if(u)for(let V in u)(function H(X,ie,pe,me){let xe=me.includes(".")?lc(pe,me):()=>pe[me];if(ne(X)){let Ve=ie[X];te(Ve)&&nn(xe,Ve)}else if(te(X))nn(xe,X.bind(pe));else if(he(X))if(J(X))X.forEach(Ve=>H(Ve,ie,pe,me));else{let Ve=te(X.handler)?X.handler.bind(pe):ie[X.handler];te(Ve)&&nn(xe,Ve,X)}})(u[V],l,o,V);if(w){let V=te(w)?w.call(o):w;Reflect.ownKeys(V).forEach(H=>{sc(H,V[H])})}function B(V,H){J(H)?H.forEach(X=>V(X.bind(o))):H&&V(H.bind(o))}if(_&&Po(_,r,"c"),B(vc,A),B(Zn,E),B(ja,h),B(yr,m),B(hc,q),B(mc,T),B(wc,S),B(xc,v),B(yc,k),B(xr,N),B(es,f),B(bc,x),J(I))if(I.length){let V=r.exposed||(r.exposed={});I.forEach(H=>{Object.defineProperty(V,H,{get:()=>o[H],set:X=>o[H]=X,enumerable:!0})})}else r.exposed||(r.exposed={});y&&r.render===He&&(r.render=y),R!=null&&(r.inheritAttrs=R),M&&(r.components=M),z&&(r.directives=z),x&&Fa(r)})(e)}finally{Xt(),s()}}}var _f={get:(e,t)=>(Ye(e,"get",""),e[t])};function Kc(e){return{attrs:new Proxy(e.attrs,_f),slots:e.slots,emit:e.emit,expose:t=>{e.exposed=t||{}}}}function ts(e){return e.exposed?e.exposeProxy||(e.exposeProxy=new Proxy(Ra(Yl(e.exposed)),{get:(t,i)=>i in t?t[i]:i in Mn?Mn[i](e):void 0,has:(t,i)=>i in t||i in Mn})):e.proxy}function fa(e,t=!0){return te(e)?e.displayName||e.name:e.name||t&&e.__name}var Qc=(e,t)=>function(i,n=!1){let s,r;return te(i)?s=i:(s=i.get,r=i.set),new ia(s,r,n)}(e,Ri);function Wc(e,t,i){try{Un(-1);let n=arguments.length;return n!==2?(n>3?i=Array.prototype.slice.call(arguments,2):n===3&&ei(i)&&(i=[i]),Te(e,t,i)):!he(t)||J(t)?Te(e,null,t):ei(t)?Te(e,null,[t]):Te(e,t)}finally{Un(1)}}function Sf(){}function qf(e,t,i,n){let s=i[n];if(s&&Jc(s,e))return s;let r=t();return r.memo=e.slice(),r.cacheIndex=n,i[n]=r}function Jc(e,t){let i=e.memo;if(i.length!=t.length)return!1;for(let n=0;n<i.length;n++)if($e(i[n],t[n]))return!1;return Ii>0&&Xe&&Xe.push(e),!0}var Gc="3.5.40",Cf=He,Tf=null,Af,Nf=He,Ef={createComponentInstance:Uc,setupComponent:zc,renderComponentRoot:qs,setCurrentRenderingInstance:Dn,isVNode:ei,normalizeVNode:ct,getComponentPublicInstance:ts,ensureValidVNode:za,pushWarningContext:function(e){},popWarningContext:function(){}},Mf=null,If=null,Rf=null,$o="u">typeof window&&window.trustedTypes;if($o)try{Jr=$o.createPolicy("vue",{createHTML:e=>e})}catch{}var Yc=Jr?e=>Jr.createHTML(e):e=>e,jt="u">typeof document?document:null,zo=jt&&jt.createElement("template"),Xc={insert:(e,t,i)=>{t.insertBefore(e,i||null)},remove:e=>{let t=e.parentNode;t&&t.removeChild(e)},createElement:(e,t,i,n)=>{let s=t==="svg"?jt.createElementNS("http://www.w3.org/2000/svg",e):t==="mathml"?jt.createElementNS("http://www.w3.org/1998/Math/MathML",e):i?jt.createElement(e,{is:i}):jt.createElement(e);return e==="select"&&n&&n.multiple!=null&&s.setAttribute("multiple",n.multiple),s},createText:e=>jt.createTextNode(e),createComment:e=>jt.createComment(e),setText:(e,t)=>{e.nodeValue=t},setElementText:(e,t)=>{e.textContent=t},parentNode:e=>e.parentNode,nextSibling:e=>e.nextSibling,querySelector:e=>jt.querySelector(e),setScopeId(e,t){e.setAttribute(t,"")},insertStaticContent(e,t,i,n,s,r){let a=i?i.previousSibling:t.lastChild;if(s&&(s===r||s.nextSibling))for(;t.insertBefore(s.cloneNode(!0),i),s!==r&&(s=s.nextSibling););else{zo.innerHTML=Yc(n==="svg"?`<svg>${e}</svg>`:n==="mathml"?`<math>${e}</math>`:e);let o=zo.content;if(n==="svg"||n==="mathml"){let l=o.firstChild;for(;l.firstChild;)o.appendChild(l.firstChild);o.removeChild(l)}t.insertBefore(o,i)}return[a?a.nextSibling:t.firstChild,i?i.previousSibling:t.lastChild]}},ni="transition",wn="animation",on=Symbol("_vtc"),Zc={name:String,type:String,css:{type:Boolean,default:!0},duration:[String,Number,Object],enterFromClass:String,enterActiveClass:String,enterToClass:String,appearFromClass:String,appearActiveClass:String,appearToClass:String,leaveFromClass:String,leaveActiveClass:String,leaveToClass:String},ed=ce({},La,Zc),Of=((Vr=(e,{slots:t})=>Wc(uc,td(e),t)).displayName="Transition",Vr.props=ed,Vr),wi=(e,t=[])=>{J(e)?e.forEach(i=>i(...t)):e&&e(...t)},Vo=e=>!!e&&(J(e)?e.some(t=>t.length>1):e.length>1);function td(e){let t={};for(let x in e)x in Zc||(t[x]=e[x]);if(e.css===!1)return t;let{name:i="v",type:n,duration:s,enterFromClass:r=`${i}-enter-from`,enterActiveClass:a=`${i}-enter-active`,enterToClass:o=`${i}-enter-to`,appearFromClass:l=r,appearActiveClass:c=a,appearToClass:d=o,leaveFromClass:p=`${i}-leave-from`,leaveActiveClass:u=`${i}-leave-active`,leaveToClass:w=`${i}-leave-to`}=e,g=function(x){if(x==null)return null;{if(he(x))return[function(R){return Zi(R)}(x.enter),function(R){return Zi(R)}(x.leave)];let I=function(R){return Zi(R)}(x);return[I,I]}}(s),_=g&&g[0],A=g&&g[1],{onBeforeEnter:E,onEnter:h,onEnterCancelled:m,onLeave:q,onLeaveCancelled:T,onBeforeAppear:N=E,onAppear:f=h,onAppearCancelled:y=m}=t,v=(x,I,R,M)=>{x._enterCancelled=M,ai(x,I?d:o),ai(x,I?c:a),R&&R()},k=(x,I)=>{x._isLeaving=!1,ai(x,p),ai(x,w),ai(x,u),I&&I()},S=x=>(I,R)=>{let M=x?f:h,z=()=>v(I,x,R);wi(M,[I,z]),Ho(()=>{ai(I,x?l:r),Mt(I,x?d:o),Vo(M)||Ko(I,n,_,z)})};return ce(t,{onBeforeEnter(x){wi(E,[x]),Mt(x,r),Mt(x,a)},onBeforeAppear(x){wi(N,[x]),Mt(x,l),Mt(x,c)},onEnter:S(!1),onAppear:S(!0),onLeave(x,I){x._isLeaving=!0;let R=()=>k(x,I);Mt(x,p),x._enterCancelled?(Mt(x,u),ha(x)):(ha(x),Mt(x,u)),Ho(()=>{x._isLeaving&&(ai(x,p),Mt(x,w),Vo(q)||Ko(x,n,A,R))}),wi(q,[x,R])},onEnterCancelled(x){v(x,!1,void 0,!0),wi(m,[x])},onAppearCancelled(x){v(x,!0,void 0,!0),wi(y,[x])},onLeaveCancelled(x){k(x),wi(T,[x])}})}function Mt(e,t){t.split(/\s+/).forEach(i=>i&&e.classList.add(i)),(e[on]||(e[on]=new Set)).add(t)}function ai(e,t){t.split(/\s+/).forEach(n=>n&&e.classList.remove(n));let i=e[on];i&&(i.delete(t),i.size||(e[on]=void 0))}function Ho(e){requestAnimationFrame(()=>{requestAnimationFrame(e)})}var Pf=0;function Ko(e,t,i,n){let s=e._endId=++Pf,r=()=>{s===e._endId&&n()};if(i!=null)return setTimeout(r,i);let{type:a,timeout:o,propCount:l}=id(e,t);if(!a)return n();let c=a+"end",d=0,p=()=>{e.removeEventListener(c,u),r()},u=w=>{w.target===e&&++d>=l&&p()};setTimeout(()=>{d<l&&p()},o+1),e.addEventListener(c,u)}function id(e,t){let i=window.getComputedStyle(e),n=g=>(i[g]||"").split(", "),s=n(`${ni}Delay`),r=n(`${ni}Duration`),a=Qo(s,r),o=n(`${wn}Delay`),l=n(`${wn}Duration`),c=Qo(o,l),d=null,p=0,u=0;t===ni?a>0&&(d=ni,p=a,u=r.length):t===wn?c>0&&(d=wn,p=c,u=l.length):u=(d=(p=Math.max(a,c))>0?a>c?ni:wn:null)?d===ni?r.length:l.length:0;let w=d===ni&&/\b(?:transform|all)(?:,|$)/.test(n(`${ni}Property`).toString());return{type:d,timeout:p,propCount:u,hasTransform:w}}function Qo(e,t){for(;e.length<t.length;)e=e.concat(e);return Math.max(...t.map((i,n)=>Wo(i)+Wo(e[n])))}function Wo(e){return e==="auto"?0:1e3*Number(e.slice(0,-1).replace(",","."))}function ha(e){return(e?e.ownerDocument:document).body.offsetHeight}var Qs=Symbol("_vod"),Ga=Symbol("_vsh"),nd={name:"show",beforeMount(e,{value:t},{transition:i}){e[Qs]=e.style.display==="none"?"":e.style.display,i&&t?i.beforeEnter(e):kn(e,t)},mounted(e,{value:t},{transition:i}){i&&t&&i.enter(e)},updated(e,{value:t,oldValue:i},{transition:n}){!t!=!i&&(n?t?(n.beforeEnter(e),kn(e,!0),n.enter(e)):n.leave(e,()=>{kn(e,!1)}):kn(e,t))},beforeUnmount(e,{value:t}){kn(e,t)}};function kn(e,t){e.style.display=t?e[Qs]:"none",e[Ga]=!t}var sd=Symbol("");function Bf(e){let t=at();if(!t)return;let i=t.ut=(s=e(t.proxy))=>{Array.from(document.querySelectorAll(`[data-v-owner="${t.uid}"]`)).forEach(r=>vs(r,s))},n=()=>{let s=e(t.proxy);t.ce?vs(t.ce,s):function r(a,o){if(128&a.shapeFlag){let l=a.suspense;a=l.activeBranch,l.pendingBranch&&!l.isHydrating&&l.effects.push(()=>{r(l.activeBranch,o)})}for(;a.component;)a=a.component.subTree;if(1&a.shapeFlag&&a.el)vs(a.el,o);else if(a.type===ze)a.children.forEach(l=>r(l,o));else if(a.type===Ni){let{el:l,anchor:c}=a;for(;l&&(vs(l,o),l!==c);)l=l.nextSibling}}(t.subTree,s),i(s)};ja(()=>{Ln(n)}),Zn(()=>{nn(n,He,{flush:"post"});let s=new MutationObserver(n);s.observe(t.subTree.el.parentNode,{childList:!0}),es(()=>s.disconnect())})}function vs(e,t){if(e.nodeType===1){let n=e.style,s="";for(let r in t){var i;let a=(i=t[r])==null?"initial":typeof i=="string"?i===""?" ":i:String(i);n.setProperty(`--${r}`,a),s+=`--${r}: ${a};`}n[sd]=s}}var Lf=/(?:^|;)\s*display\s*:/,Jo=/\s*!important$/;function Sn(e,t,i){if(J(i))i.forEach(n=>Sn(e,t,n));else if(i==null&&(i=""),t.startsWith("--"))e.setProperty(t,i);else{let n=function(s,r){let a=$r[r];if(a)return a;let o=we(r);if(o!=="filter"&&o in s)return $r[r]=o;o=Di(o);for(let l=0;l<Go.length;l++){let c=Go[l]+o;if(c in s)return $r[r]=c}return r}(e,t);Jo.test(i)?e.setProperty(dt(n),i.replace(Jo,""),"important"):e[n]=i}}var Go=["Webkit","Moz","ms"],$r={},Yo="http://www.w3.org/1999/xlink";function Xo(e,t,i,n,s,r=Vp(t)){n&&t.startsWith("xlink:")?i==null?e.removeAttributeNS(Yo,t.slice(6,t.length)):e.setAttributeNS(Yo,t,i):i==null||r&&!(i||i==="")?e.removeAttribute(t):e.setAttribute(t,r?"":Ze(i)?String(i):i)}function Zo(e,t,i,n,s){if(t==="innerHTML"||t==="textContent"){i!=null&&(e[t]=t==="innerHTML"?Yc(i):i);return}let r=e.tagName;if(t==="value"&&r!=="PROGRESS"&&!r.includes("-")){let l=r==="OPTION"?e.getAttribute("value")||"":e.value,c=i==null?e.type==="checkbox"?"on":"":String(i);l===c&&"_value"in e||(e.value=c),i==null&&e.removeAttribute(t),e._value=i;return}let a=!1;if(i===""||i==null){let l=typeof e[t];if(l==="boolean"){var o;i=!!(o=i)||o===""}else i==null&&l==="string"?(i="",a=!0):l==="number"&&(i=0,a=!0)}try{e[t]=i}catch{}a&&e.removeAttribute(s||t)}function Vt(e,t,i,n){e.addEventListener(t,i,n)}var el=Symbol("_vei"),Df=/(Once|Passive|Capture)$/,Ff=/^on:?(?:Once|Passive|Capture)$/,zr=0,jf=Promise.resolve(),tl=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&e.charCodeAt(2)>96&&123>e.charCodeAt(2),rd=(e,t,i,n,s,r)=>{let a=s==="svg";if(t==="class"){var o;let l;o=n,(l=e[on])&&(o=(o?[o,...l]:[...l]).join(" ")),o==null?e.removeAttribute("class"):a?e.setAttribute("class",o):e.className=o}else t==="style"?function(l,c,d){let p=l.style,u=ne(d),w=!1;if(d&&!u){if(c)if(ne(c))for(let h of c.split(";")){let m=h.slice(0,h.indexOf(":")).trim();d[m]==null&&Sn(p,m,"")}else for(let h in c)d[h]==null&&Sn(p,h,"");for(let h in d){var g,_,A,E;h==="display"&&(w=!0);let m=d[h];m!=null?(g=l,_=h,A=!ne(c)&&c?c[h]:void 0,E=m,g.tagName==="TEXTAREA"&&(_==="width"||_==="height")&&ne(E)&&A===E||Sn(p,h,m)):Sn(p,h,"")}}else if(u){if(c!==d){let h=p[sd];h&&(d+=";"+h),p.cssText=d,w=Lf.test(d)}}else c&&l.removeAttribute("style");Qs in l&&(l[Qs]=w?p.display:"",l[Ga]&&(p.display="none"))}(e,i,n):Li(t)?ar(t)||function(l,c,d,p=null){let u=l[el]||(l[el]={}),w=u[c];if(d&&w)w.value=d;else{let[A,E]=function(h){let m,q;for(;(q=h.match(Df))&&!Ff.test(h);)m||(m={}),h=h.slice(0,h.length-q[1].length),m[q[1].toLowerCase()]=!0;return[h[2]===":"?h.slice(3):dt(h.slice(2)),m]}(c);if(d){var g,_;let h;Vt(l,A,u[c]=(g=d,_=p,(h=m=>{if(m._vts){if(m._vts<=h.attached)return}else m._vts=Date.now();let q=h.value;if(J(q)){let T=m.stopImmediatePropagation;m.stopImmediatePropagation=()=>{T.call(m),m._stopped=!0};let N=q.slice(),f=[m];for(let y=0;y<N.length&&!m._stopped;y++){let v=N[y];v&&vt(v,_,5,f)}}else vt(q,_,5,[m])}).value=g,h.attached=zr||(jf.then(()=>zr=0),zr=Date.now()),h),E)}else w&&(l.removeEventListener(A,w,E),u[c]=void 0)}}(e,t,n,r):(t[0]==="."?(t=t.slice(1),0):t[0]==="^"?(t=t.slice(1),1):!function(l,c,d,p){if(p)return!!(c==="innerHTML"||c==="textContent"||c in l&&tl(c)&&te(d));if(c==="spellcheck"||c==="draggable"||c==="translate"||c==="autocorrect"||c==="sandbox"&&l.tagName==="IFRAME"||c==="form"||c==="list"&&l.tagName==="INPUT"||c==="type"&&l.tagName==="TEXTAREA")return!1;if(c==="width"||c==="height"){let u=l.tagName;if(u==="IMG"||u==="VIDEO"||u==="CANVAS"||u==="SOURCE")return!1}return!(tl(c)&&ne(d))&&c in l}(e,t,n,a))?e._isVueCE&&(function(l,c){let d=l._def.props;if(!d)return!1;let p=we(c);return Array.isArray(d)?d.some(u=>we(u)===p):Object.keys(d).some(u=>we(u)===p)}(e,t)||e._def.__asyncLoader&&(/[A-Z]/.test(t)||!ne(n)))?Zo(e,we(t),n,r,t):(t==="true-value"?e._trueValue=n:t==="false-value"&&(e._falseValue=n),Xo(e,t,n,a)):(Zo(e,t,n),e.tagName.includes("-")||t!=="value"&&t!=="checked"&&t!=="selected"||Xo(e,t,n,a,r,t!=="value"))},il={};function ad(e,t,i){let n,s=Da(e,t);n=s,Ne.call(n)==="[object Object]"&&(s=ce({},s,t));class r extends Ws{constructor(o){super(s,o,i)}}return r.def=s,r}var Uf=(e,t)=>ad(e,t,vd),$f="u">typeof HTMLElement?HTMLElement:class{},Ws=class e extends $f{constructor(t,i={},n=zn){super(),this._def=t,this._props=i,this._createApp=n,this._isVueCE=!0,this._instance=null,this._app=null,this._nonce=this._def.nonce,this._connected=!1,this._resolved=!1,this._patching=!1,this._dirty=!1,this._numberProps=null,this._styleChildren=new WeakSet,this._styleAnchors=new WeakMap,this._ob=null,this.shadowRoot&&n!==zn?this._root=this.shadowRoot:t.shadowRoot!==!1?(this.attachShadow(ce({},t.shadowRootOptions,{mode:"open"})),this._root=this.shadowRoot):this._root=this}connectedCallback(){if(!this.isConnected)return;this.shadowRoot||this._resolved||this._parseSlots(),this._connected=!0;let t=this;for(;t=t&&(t.assignedSlot||t.parentNode||t.host);)if(t instanceof e){this._parent=t;break}this._instance||(this._resolved?this._mount(this._def):t&&t._pendingResolve?this._pendingResolve=t._pendingResolve.then(()=>{this._pendingResolve=void 0,this._resolveDef()}):this._resolveDef())}_setParent(t=this._parent){t&&(this._instance.parent=t._instance,this._inheritParentContext(t))}_inheritParentContext(t=this._parent){t&&this._app&&Object.setPrototypeOf(this._app._context.provides,t._instance.provides)}disconnectedCallback(){this._connected=!1,gr(()=>{!this._connected&&(this._ob&&(this._ob.disconnect(),this._ob=null),this._app&&this._app.unmount(),this._instance&&(this._instance.ce=void 0),this._app=this._instance=null,this._teleportTargets&&(this._teleportTargets.clear(),this._teleportTargets=void 0))})}_processMutations(t){for(let i of t)this._setAttr(i.attributeName)}_resolveDef(){if(this._pendingResolve)return;for(let n=0;n<this.attributes.length;n++)this._setAttr(this.attributes[n].name);this._ob=new MutationObserver(this._processMutations.bind(this)),this._ob.observe(this,{attributes:!0});let t=(n,s=!1)=>{let r;this._resolved=!0,this._pendingResolve=void 0;let{props:a,styles:o}=n;if(a&&!J(a))for(let l in a){let c=a[l];(c===Number||c&&c.type===Number)&&(l in this._props&&(this._props[l]=Zi(this._props[l])),(r||(r=Object.create(null)))[we(l)]=!0)}this._numberProps=r,this._resolveProps(n),this.shadowRoot&&this._applyStyles(o),this._mount(n)},i=this._def.__asyncLoader;i?this._pendingResolve=i().then(n=>{n.configureApp=this._def.configureApp,t(this._def=n,!0)}):t(this._def)}_mount(t){this._app=this._createApp(t),this._inheritParentContext(),t.configureApp&&t.configureApp(this._app),this._app._ceVNode=this._createVNode(),this._app.mount(this._root);let i=this._instance&&this._instance.exposed;if(i)for(let n in i)ge(this,n)||Object.defineProperty(this,n,{get:()=>Gn(i[n])})}_resolveProps(t){let{props:i}=t,n=J(i)?i:Object.keys(i||{});for(let s of Object.keys(this))s[0]!=="_"&&n.includes(s)&&this._setProp(s,this[s]);for(let s of n.map(we))Object.defineProperty(this,s,{get(){return this._getProp(s)},set(r){this._setProp(s,r,!0,!this._patching)}})}_setAttr(t){if(t.startsWith("data-v-"))return;let i=this.hasAttribute(t),n=i?this.getAttribute(t):il,s=we(t);i&&this._numberProps&&this._numberProps[s]&&(n=Zi(n)),this._setProp(s,n,!1,!0)}_getProp(t){return this._props[t]}_setProp(t,i,n=!0,s=!1){if(i!==this._props[t]&&(this._dirty=!0,i===il?delete this._props[t]:(this._props[t]=i,t==="key"&&this._app&&(this._app._ceVNode.key=i)),s&&this._instance&&this._update(),n)){let r=this._ob;r&&(this._processMutations(r.takeRecords()),r.disconnect()),i===!0?this.setAttribute(dt(t),""):typeof i=="string"||typeof i=="number"?this.setAttribute(dt(t),i+""):i||this.removeAttribute(dt(t)),r&&r.observe(this,{attributes:!0})}}_update(){let t=this._createVNode();this._app&&(t.appContext=this._app._context),gd(t,this._root)}_createVNode(){let t={};this.shadowRoot||(t.onVnodeMounted=t.onVnodeUpdated=this._renderSlots.bind(this));let i=Te(this._def,ce(t,this._props));return this._instance||(i.ce=n=>{this._instance=n,n.ce=this,n.isCE=!0;let s=(r,a)=>{let o;this.dispatchEvent(new CustomEvent(r,(o=a[0],Ne.call(o)==="[object Object]"?ce({detail:a},a[0]):{detail:a})))};n.emit=(r,...a)=>{s(r,a),dt(r)!==r&&s(dt(r),a)},this._setParent()}),i}_applyStyles(t,i,n){if(!t)return;if(i){if(i===this._def||this._styleChildren.has(i))return;this._styleChildren.add(i)}let s=this._nonce,r=this.shadowRoot,a=n?this._getStyleAnchor(n)||this._getStyleAnchor(this._def):this._getRootStyleInsertionAnchor(r),o=null;for(let l=t.length-1;l>=0;l--){let c=document.createElement("style");s&&c.setAttribute("nonce",s),c.textContent=t[l],r.insertBefore(c,o||a),o=c,l===0&&(n||this._styleAnchors.set(this._def,c),i&&this._styleAnchors.set(i,c))}}_getStyleAnchor(t){if(!t)return null;let i=this._styleAnchors.get(t);return i&&i.parentNode===this.shadowRoot?i:(i&&this._styleAnchors.delete(t),null)}_getRootStyleInsertionAnchor(t){for(let i=0;i<t.childNodes.length;i++){let n=t.childNodes[i];if(!(n instanceof HTMLStyleElement))return n}return null}_parseSlots(){let t,i=this._slots={};for(;t=this.firstChild;){let n=t.nodeType===1&&t.getAttribute("slot")||"default";(i[n]||(i[n]=[])).push(t),this.removeChild(t)}}_renderSlots(){let t=this._getSlots(),i=this._instance.type.__scopeId;for(let n=0;n<t.length;n++){let s=t[n],r=s.getAttribute("name")||"default",a=this._slots[r],o=s.parentNode;if(a)for(let l of a){if(i&&l.nodeType===1){let c,d=i+"-s",p=document.createTreeWalker(l,1);for(l.setAttribute(d,"");c=p.nextNode();)c.setAttribute(d,"")}o.insertBefore(l,s)}else for(;s.firstChild;)o.insertBefore(s.firstChild,s);o.removeChild(s)}}_getSlots(){let t=[this];this._teleportTargets&&t.push(...this._teleportTargets);let i=new Set;for(let n of t){let s=n.querySelectorAll("slot");for(let r=0;r<s.length;r++)i.add(s[r])}return Array.from(i)}_injectChildStyle(t,i){this._applyStyles(t.styles,t,i)}_beginPatch(){this._patching=!0,this._dirty=!1}_endPatch(){this._patching=!1,this._dirty&&this._instance&&this._update()}_hasShadowRoot(){return this._def.shadowRoot!==!1}_removeChildStyle(t){}};function od(e){let t=at();return t&&t.ce||null}function zf(){let e=od();return e&&e.shadowRoot}function Vf(e="$style"){{let t=at();if(!t)return de;let i=t.type.__cssModules;return i&&i[e]||de}}var ld=new WeakMap,cd=new WeakMap,Js=Symbol("_moveCb"),nl=Symbol("_enterCb"),Hf=(Hr={name:"TransitionGroup",props:ce({},ed,{tag:String,moveClass:String}),setup(e,{slots:t}){let i,n,s=at(),r=Ba();return yr(()=>{if(!i.length)return;let a=e.moveClass||`${e.name||"v"}-move`;if(!function(l,c,d){let p=l.cloneNode(),u=l[on];u&&u.forEach(_=>{_.split(/\s+/).forEach(A=>A&&p.classList.remove(A))}),d.split(/\s+/).forEach(_=>_&&p.classList.add(_)),p.style.display="none";let w=c.nodeType===1?c:c.parentNode;w.appendChild(p);let{hasTransform:g}=id(p);return w.removeChild(p),g}(i[0].el,s.vnode.el,a)){i=[];return}i.forEach(Kf),i.forEach(Qf);let o=i.filter(Wf);ha(s.vnode.el),o.forEach(l=>{let c=l.el,d=c.style;Mt(c,a),d.transform=d.webkitTransform=d.transitionDuration="";let p=c[Js]=u=>{(!u||u.target===c)&&(!u||u.propertyName.endsWith("transform"))&&(c.removeEventListener("transitionend",p),c[Js]=null,ai(c,a))};c.addEventListener("transitionend",p)}),i=[]}),()=>{let a=ue(e),o=td(a),l=a.tag||ze;if(i=[],n)for(let c=0;c<n.length;c++){let d=n[c];d.el&&d.el instanceof Element&&!d.el[Ga]&&(i.push(d),Zt(d,an(d,o,r,s)),ld.set(d,dd(d.el)))}n=t.default?br(t.default()):[];for(let c=0;c<n.length;c++){let d=n[c];d.key!=null&&Zt(d,an(d,o,r,s))}return Te(l,null,n)}}},delete Hr.props.mode,Hr);function Kf(e){let t=e.el;t[Js]&&t[Js](),t[nl]&&t[nl]()}function Qf(e){cd.set(e,dd(e.el))}function Wf(e){let t=ld.get(e),i=cd.get(e),n=t.left-i.left,s=t.top-i.top;if(n||s){let r=e.el,a=r.style,o=r.getBoundingClientRect(),l=1,c=1;return r.offsetWidth&&(l=o.width/r.offsetWidth),r.offsetHeight&&(c=o.height/r.offsetHeight),Number.isFinite(l)&&l!==0||(l=1),Number.isFinite(c)&&c!==0||(c=1),.01>Math.abs(l-1)&&(l=1),.01>Math.abs(c-1)&&(c=1),a.transform=a.webkitTransform=`translate(${n/l}px,${s/c}px)`,a.transitionDuration="0s",e}}function dd(e){let t=e.getBoundingClientRect();return{left:t.left,top:t.top}}var di=e=>{let t=e.props["onUpdate:modelValue"]||!1;return J(t)?i=>Xi(t,i):t};function Jf(e){e.target.composing=!0}function sl(e){let t=e.target;t.composing&&(t.composing=!1,t.dispatchEvent(new Event("input")))}var qt=Symbol("_assign");function rl(e,t,i){return t&&(e=e.trim()),i&&(e=cr(e)),e}var Gs={created(e,{modifiers:{lazy:t,trim:i,number:n}},s){e[qt]=di(s);let r=n||s.props&&s.props.type==="number";Vt(e,t?"change":"input",a=>{a.target.composing||e[qt](rl(e.value,i,r))}),(i||r)&&Vt(e,"change",()=>{e.value=rl(e.value,i,r)}),t||(Vt(e,"compositionstart",Jf),Vt(e,"compositionend",sl),Vt(e,"change",sl))},mounted(e,{value:t}){e.value=t??""},beforeUpdate(e,{value:t,oldValue:i,modifiers:{lazy:n,trim:s,number:r}},a){if(e[qt]=di(a),e.composing)return;let o=(r||e.type==="number")&&!/^0\d/.test(e.value)?cr(e.value):e.value,l=t??"";if(o===l)return;let c=e.getRootNode();(c instanceof Document||c instanceof ShadowRoot)&&c.activeElement===e&&e.type!=="range"&&(n&&t===i||s&&e.value.trim()===l)||(e.value=l)}},Ya={deep:!0,created(e,t,i){e[qt]=di(i),Vt(e,"change",()=>{let n=e._modelValue,s=ln(e),r=e.checked,a=e[qt];if(J(n)){let o=pr(n,s),l=o!==-1;if(r&&!l)a(n.concat(s));else if(!r&&l){let c=[...n];c.splice(o,1),a(c)}}else{let o;if(o=n,Ne.call(o)==="[object Set]"){let l=new Set(n);r?l.add(s):l.delete(s),a(l)}else a(ud(e,r))}})},mounted:al,beforeUpdate(e,t,i){e[qt]=di(i),al(e,t,i)}};function al(e,{value:t,oldValue:i},n){let s;if(e._modelValue=t,J(t))s=pr(t,n.props.value)>-1;else{let r;if(r=t,Ne.call(r)==="[object Set]")s=t.has(n.props.value);else{if(t===i)return;s=Gt(t,ud(e,!0))}}e.checked!==s&&(e.checked=s)}var Xa={created(e,{value:t},i){e.checked=Gt(t,i.props.value),e[qt]=di(i),Vt(e,"change",()=>{e[qt](ln(e))})},beforeUpdate(e,{value:t,oldValue:i},n){e[qt]=di(n),t!==i&&(e.checked=Gt(t,n.props.value))}},pd={deep:!0,created(e,{value:t,modifiers:{number:i}},n){e._modelValue=t,Vt(e,"change",()=>{let s,r=Array.prototype.filter.call(e.options,a=>a.selected).map(a=>i?cr(ln(a)):ln(a));e[qt](e.multiple?(s=e._modelValue,Ne.call(s)==="[object Set]"?new Set(r):r):r[0]),e._assigning=!0,gr(()=>{e._assigning=!1})}),e[qt]=di(n)},mounted(e,{value:t}){ol(e,t)},beforeUpdate(e,{value:t},i){e._modelValue=t,e[qt]=di(i)},updated(e,{value:t}){e._assigning||ol(e,t)}};function ol(e,t){let i,n=e.multiple,s=J(t);if(!n||s||(i=t,Ne.call(i)==="[object Set]")){for(let r=0,a=e.options.length;r<a;r++){let o=e.options[r],l=ln(o);if(n)if(s){let c=typeof l;c==="string"||c==="number"?o.selected=t.some(d=>String(d)===String(l)):o.selected=pr(t,l)>-1}else o.selected=t.has(l);else if(Gt(ln(o),t)){e.selectedIndex!==r&&(e.selectedIndex=r);return}}n||e.selectedIndex===-1||(e.selectedIndex=-1)}}function ln(e){return"_value"in e?e._value:e.value}function ud(e,t){let i=t?"_trueValue":"_falseValue";return i in e?e[i]:t}var fd={created(e,t,i){bs(e,t,i,null,"created")},mounted(e,t,i){bs(e,t,i,null,"mounted")},beforeUpdate(e,t,i,n){bs(e,t,i,n,"beforeUpdate")},updated(e,t,i,n){bs(e,t,i,n,"updated")}};function hd(e,t){switch(e){case"SELECT":return pd;case"TEXTAREA":return Gs;default:switch(t){case"checkbox":return Ya;case"radio":return Xa;default:return Gs}}}function bs(e,t,i,n,s){let r=hd(e.tagName,i.props&&i.props.type)[s];r&&r(e,t,i,n)}var Gf=["ctrl","shift","alt","meta"],Yf={stop:e=>e.stopPropagation(),prevent:e=>e.preventDefault(),self:e=>e.target!==e.currentTarget,ctrl:e=>!e.ctrlKey,shift:e=>!e.shiftKey,alt:e=>!e.altKey,meta:e=>!e.metaKey,left:e=>"button"in e&&e.button!==0,middle:e=>"button"in e&&e.button!==1,right:e=>"button"in e&&e.button!==2,exact:(e,t)=>Gf.some(i=>e[`${i}Key`]&&!t.includes(i))},Xf=(e,t)=>{if(!e)return e;let i=e._withMods||(e._withMods={}),n=t.join(".");return i[n]||(i[n]=(s,...r)=>{for(let a=0;a<t.length;a++){let o=Yf[t[a]];if(o&&o(s,t))return}return e(s,...r)})},Zf={esc:"escape",space:" ",up:"arrow-up",left:"arrow-left",right:"arrow-right",down:"arrow-down",delete:"backspace"},eh=(e,t)=>{let i=e._withKeys||(e._withKeys={}),n=t.join(".");return i[n]||(i[n]=s=>{if(!("key"in s))return;let r=dt(s.key);if(t.some(a=>a===r||Zf[a]===r))return e(s)})},Za=ce({patchProp:rd},Xc),ll=!1;function md(){return Ci=ll?Ci:Ic(Za),ll=!0,Ci}var gd=(...e)=>{(Ci||(Ci=Ka(Za))).render(...e)},th=(...e)=>{md().hydrate(...e)},zn=(...e)=>{let t=(Ci||(Ci=Ka(Za))).createApp(...e),{mount:i}=t;return t.mount=n=>{let s=yd(n);if(!s)return;let r=t._component;te(r)||r.render||r.template||(r.template=s.innerHTML),s.nodeType===1&&(s.textContent="");let a=i(s,!1,bd(s));return s instanceof Element&&(s.removeAttribute("v-cloak"),s.setAttribute("data-v-app","")),a},t},vd=(...e)=>{let t=md().createApp(...e),{mount:i}=t;return t.mount=n=>{let s=yd(n);if(s)return i(s,!0,bd(s))},t};function bd(e){return e instanceof SVGElement?"svg":typeof MathMLElement=="function"&&e instanceof MathMLElement?"mathml":void 0}function yd(e){return ne(e)?document.querySelector(e):e}var cl=!1,ih=()=>{cl||(cl=!0,Gs.getSSRProps=({value:e})=>({value:e}),Xa.getSSRProps=({value:e},t)=>{if(t.props&&Gt(t.props.value,e))return{checked:!0}},Ya.getSSRProps=({value:e},t)=>{if(J(e)){if(t.props&&pr(e,t.props.value)>-1)return{checked:!0}}else{let i;if(i=e,Ne.call(i)==="[object Set]"){if(t.props&&e.has(t.props.value))return{checked:!0}}else if(e)return{checked:!0}}},fd.getSSRProps=(e,t)=>{if(typeof t.type!="string")return;let i=hd(t.type.toUpperCase(),t.props&&t.props.type);if(i.getSSRProps)return i.getSSRProps(e,t)},nd.getSSRProps=({value:e})=>{if(!e)return{style:{display:"none"}}})},Vr,Hr,dl,nh=Object.freeze({__proto__:null,BaseTransition:uc,BaseTransitionPropsValidators:La,Comment:Oe,DeprecationTypes:Rf,EffectScope:On,ErrorCodes:vu,ErrorTypeStrings:Tf,Fragment:ze,KeepAlive:Du,ReactiveEffect:Mi,Static:Ni,Suspense:gf,Teleport:Cu,Text:ci,TrackOpTypes:fu,Transition:Of,TransitionGroup:Hf,TriggerOpTypes:hu,VueElement:Ws,assertNumber:gu,callWithAsyncErrorHandling:vt,callWithErrorHandling:pn,camelize:we,capitalize:Di,cloneVNode:Bt,compatUtils:If,computed:Qc,createApp:zn,createBlock:Hs,createCommentVNode:Fc,createElementBlock:vf,createElementVNode:Wa,createHydrationRenderer:Ic,createPropsRestProxy:rf,createRenderer:Ka,createSSRApp:vd,createSlots:zu,createStaticVNode:yf,createTextVNode:Ja,createVNode:Te,customRef:ec,defineAsyncComponent:Lu,defineComponent:Da,defineCustomElement:ad,defineEmits:Wu,defineExpose:Ju,defineModel:Xu,defineOptions:Gu,defineProps:Qu,defineSSRCustomElement:Uf,defineSlots:Yu,devtools:Af,effect:Qp,effectScope:Hp,getCurrentInstance:at,getCurrentScope:Fl,getCurrentWatcher:mu,getTransitionRawChildren:br,guardReactiveProps:Dc,h:Wc,handleError:Fi,hasInjectionContext:ku,hydrate:th,hydrateOnIdle:Ru,hydrateOnInteraction:Bu,hydrateOnMediaQuery:Pu,hydrateOnVisible:Ou,initCustomFormatter:Sf,initDirectivesForSSR:ih,inject:En,isMemoSame:Jc,isProxy:Jn,isReactive:Kt,isReadonly:Pt,isRef:Le,isRuntimeOnly:kf,isShallow:ut,isVNode:ei,markRaw:Yl,mergeDefaults:nf,mergeModels:sf,mergeProps:jc,nextTick:gr,nodeOps:Xc,normalizeClass:Wn,normalizeProps:Fp,normalizeStyle:Qn,onActivated:hc,onBeforeMount:vc,onBeforeUnmount:xr,onBeforeUpdate:ja,onDeactivated:mc,onErrorCaptured:wc,onMounted:Zn,onRenderTracked:xc,onRenderTriggered:yc,onScopeDispose:Kp,onServerPrefetch:bc,onUnmounted:es,onUpdated:yr,onWatcherCleanup:tc,openBlock:jn,patchProp:rd,popScopeId:yu,provide:sc,proxyRefs:Ra,pushScopeId:bu,queuePostFlushCb:Ln,reactive:fi,readonly:Os,ref:An,registerRuntimeCompiler:Vc,render:gd,renderList:$u,renderSlot:Vu,resolveComponent:Fu,resolveDirective:Uu,resolveDynamicComponent:ju,resolveFilter:Mf,resolveTransitionHooks:an,setBlockTracking:Un,setDevtoolsHook:Nf,setTransitionHooks:Zt,shallowReactive:Gl,shallowReadonly:ou,shallowRef:Xl,ssrContextKey:rc,ssrUtils:Ef,stop:Wp,toDisplayString:Ll,toHandlerKey:Yi,toHandlers:Hu,toRaw:ue,toRef:uu,toRefs:pu,toValue:cu,transformVNodeArgs:bf,triggerRef:lu,unref:Gn,useAttrs:tf,useCssModule:Vf,useCssVars:Bf,useHost:od,useId:Tu,useModel:cf,useSSRContext:ac,useShadowRoot:zf,useSlots:ef,useTemplateRef:Au,useTransitionState:Ba,vModelCheckbox:Ya,vModelDynamic:fd,vModelRadio:Xa,vModelSelect:pd,vModelText:Gs,vShow:nd,version:Gc,warn:Cf,watch:nn,watchEffect:_u,watchPostEffect:Su,watchSyncEffect:oc,withAsyncContext:af,withCtx:Pa,withDefaults:Zu,withDirectives:wu,withKeys:eh,withMemo:qf,withModifiers:Xf,withScopeId:xu}),Vn=Symbol(""),Rn=Symbol(""),eo=Symbol(""),Ys=Symbol(""),xd=Symbol(""),Oi=Symbol(""),Pi=Symbol(""),Bi=Symbol(""),pi=Symbol(""),ui=Symbol(""),is=Symbol(""),to=Symbol(""),wd=Symbol(""),io=Symbol(""),ma=Symbol(""),no=Symbol(""),sh=Symbol(""),so=Symbol(""),ro=Symbol(""),kd=Symbol(""),_d=Symbol(""),_r=Symbol(""),Xs=Symbol(""),ao=Symbol(""),oo=Symbol(""),Hn=Symbol(""),ns=Symbol(""),lo=Symbol(""),ga=Symbol(""),rh=Symbol(""),va=Symbol(""),Zs=Symbol(""),ah=Symbol(""),oh=Symbol(""),co=Symbol(""),lh=Symbol(""),ch=Symbol(""),po=Symbol(""),Sd=Symbol(""),cn={[Vn]:"Fragment",[Rn]:"Teleport",[eo]:"Suspense",[Ys]:"KeepAlive",[xd]:"BaseTransition",[Oi]:"openBlock",[Pi]:"createBlock",[Bi]:"createElementBlock",[pi]:"createVNode",[ui]:"createElementVNode",[is]:"createCommentVNode",[to]:"createTextVNode",[wd]:"createStaticVNode",[io]:"resolveComponent",[ma]:"resolveDynamicComponent",[no]:"resolveDirective",[sh]:"resolveFilter",[so]:"withDirectives",[ro]:"renderList",[kd]:"renderSlot",[_d]:"createSlots",[_r]:"toDisplayString",[Xs]:"mergeProps",[ao]:"normalizeClass",[oo]:"normalizeStyle",[Hn]:"normalizeProps",[ns]:"guardReactiveProps",[lo]:"toHandlers",[ga]:"camelize",[rh]:"capitalize",[va]:"toHandlerKey",[Zs]:"setBlockTracking",[ah]:"pushScopeId",[oh]:"popScopeId",[co]:"withCtx",[lh]:"unref",[ch]:"isRef",[po]:"withMemo",[Sd]:"isMemoSame"},bt={start:{line:1,column:1,offset:0},end:{line:1,column:1,offset:0},source:""};function Kn(e,t,i,n,s,r,a,o=!1,l=!1,c=!1,d=bt){var p,u,w,g;return e&&(o?(e.helper(Oi),e.helper((p=e.inSSR,u=c,p||u?Pi:Bi))):e.helper((w=e.inSSR,g=c,w||g?pi:ui)),a&&e.helper(so)),{type:13,tag:t,props:i,children:n,patchFlag:s,dynamicProps:r,directives:a,isBlock:o,disableTracking:l,isComponent:c,loc:d}}function Ei(e,t=bt){return{type:17,loc:t,elements:e}}function St(e,t=bt){return{type:15,loc:t,properties:e}}function Be(e,t){return{type:16,loc:bt,key:ne(e)?ae(e,!0):e,value:t}}function ae(e,t=!1,i=bt,n=0){return{type:4,loc:i,content:e,isStatic:t,constType:t?3:n}}function Nt(e,t=bt){return{type:8,loc:t,children:e}}function Fe(e,t=[],i=bt){return{type:14,loc:i,callee:e,arguments:t}}function dn(e,t,i=!1,n=!1,s=bt){return{type:18,params:e,returns:t,newline:i,isSlot:n,loc:s}}function ba(e,t,i,n=!0){return{type:19,test:e,consequent:t,alternate:i,newline:n,loc:bt}}function uo(e,{helper:t,removeHelper:i,inSSR:n}){if(!e.isBlock){var s,r;e.isBlock=!0,i((s=e.isComponent,n||s?pi:ui)),t(Oi),t((r=e.isComponent,n||r?Pi:Bi))}}var pl=new Uint8Array([123,123]),ul=new Uint8Array([125,125]);function fl(e){return e>=97&&e<=122||e>=65&&e<=90}function mt(e){return e===32||e===10||e===9||e===12||e===13}function si(e){return e===47||e===62||mt(e)}function er(e){let t=new Uint8Array(e.length);for(let i=0;i<e.length;i++)t[i]=e.charCodeAt(i);return t}var We={Cdata:new Uint8Array([67,68,65,84,65,91]),CdataEnd:new Uint8Array([93,93,62]),CommentEnd:new Uint8Array([45,45,62]),ScriptEnd:new Uint8Array([60,47,115,99,114,105,112,116]),StyleEnd:new Uint8Array([60,47,115,116,121,108,101]),TitleEnd:new Uint8Array([60,47,116,105,116,108,101]),TextareaEnd:new Uint8Array([60,47,116,101,120,116,97,114,101,97])};function ya(e){throw e}function qd(e){}function ye(e,t,i,n){let s=SyntaxError(`https://vuejs.org/error-reference/#compiler-${e}`);return s.code=e,s.loc=t,s}var pt=e=>e.type===4&&e.isStatic;function Cd(e){switch(e){case"Teleport":case"teleport":return Rn;case"Suspense":case"suspense":return eo;case"KeepAlive":case"keep-alive":return Ys;case"BaseTransition":case"base-transition":return xd}}var xa=/^$|^\d|[^\$\w\xA0-\uFFFF]/,Td=/[A-Za-z_$\xA0-\uFFFF]/,dh=/[\.\?\w$\xA0-\uFFFF]/,ph=/\s+[.[]\s*|\s*[.[]\s+/g,Ad=e=>e.type===4?e.content:e.loc.source,Nd=e=>{let t=Ad(e).trim().replace(ph,o=>o.trim()),i=0,n=[],s=0,r=0,a=null;for(let o=0;o<t.length;o++){let l=t.charAt(o);switch(i){case 0:if(l==="[")n.push(i),i=1,s++;else if(l==="(")n.push(i),i=2,r++;else if(!(o===0?Td:dh).test(l))return!1;break;case 1:l==="'"||l==='"'||l==="`"?(n.push(i),i=3,a=l):l==="["?s++:l!=="]"||--s||(i=n.pop());break;case 2:if(l==="'"||l==='"'||l==="`")n.push(i),i=3,a=l;else if(l==="(")r++;else if(l===")"){if(o===t.length-1)return!1;--r||(i=n.pop())}break;case 3:l===a&&(i=n.pop(),a=null)}}return!s&&!r},uh=/^\s*(?:async\s*)?(?:\([^)]*?\)|[\w$_]+)\s*(?::[^=]+)?=>|^\s*(?:async\s+)?function(?:\s+[\w$]+)?\s*\(/;function _t(e,t,i=!1){for(let n=0;n<e.props.length;n++){let s=e.props[n];if(s.type===7&&(i||s.exp)&&(ne(t)?s.name===t:t.test(s.name)))return s}}function Sr(e,t,i=!1,n=!1){for(let s=0;s<e.props.length;s++){let r=e.props[s];if(r.type===6){if(i)continue;if(r.name===t&&(r.value||n))return r}else if(r.name==="bind"&&(r.exp||n)&&Wi(r.arg,t))return r}}function Wi(e,t){return!!(e&&pt(e)&&e.content===t)}function Kr(e){return e.type===5||e.type===2}function hl(e){return e.type===7&&e.name==="pre"}function fh(e){return e.type===7&&e.name==="slot"}function tr(e){return e.type===1&&e.tagType===3}function ir(e){return e.type===1&&e.tagType===2}var hh=new Set([Hn,ns]);function wa(e,t=[]){if(e&&!ne(e)&&e.type===14){let i=e.callee;if(!ne(i)&&hh.has(i))return wa(e.arguments[0],t.concat(e))}return[e,t]}function nr(e,t,i){let n,s;if(e.type!==13&&function(o,l){var c,d,p;if(l.key.type!==4||l.key.content!=="key")return!1;let u=o.arguments[2];if(u&&!ne(u)){let[w]=wa(u);if(w&&!ne(w)&&w.type===15&&Qr(l,w))return!0}return(c=o.arguments)[2]||(c[2]="{}"),(d=o.arguments)[3]||(d[3]="undefined"),(p=o.arguments)[4]||(p[4]="undefined"),o.arguments[5]=l.value,!0}(e,t))return;let r=e.type===13?e.props:e.arguments[2],a=[];if(r&&!ne(r)&&r.type===14){let o=wa(r);r=o[0],s=(a=o[1])[a.length-1]}if(r==null||ne(r))n=St([t]);else if(r.type===14){let o=r.arguments[0];ne(o)||o.type!==15?r.callee===lo?n=Fe(i.helper(Xs),[St([t]),r]):r.arguments.unshift(St([t])):Qr(t,o)||o.properties.unshift(t),n||(n=r)}else r.type===15?(Qr(t,r)||r.properties.unshift(t),n=r):(n=Fe(i.helper(Xs),[St([t]),r]),s&&s.callee===ns&&(s=a[a.length-2]));e.type===13?s?s.arguments[0]=n:e.props=n:s?s.arguments[0]=n:e.arguments[2]=n}function Qr(e,t){let i=!1;if(e.key.type===4){let n=e.key.content;i=t.properties.some(s=>s.key.type===4&&s.key.content===n)}return i}function ka(e,t){return`_${t}_${e.replace(/[^\w]/g,(i,n)=>i==="-"?"_":e.charCodeAt(n).toString())}`}var mh=/([\s\S]*?)\s+(?:in|of)\s+(\S[\s\S]*)/;function Ed(e){for(let t=0;t<e.length;t++)if(!mt(e.charCodeAt(t)))return!1;return!0}function fo(e){return e.type===2&&Ed(e.content)||e.type===12&&fo(e.content)}function Md(e){return e.type===3||fo(e)}var Id={parseMode:"base",ns:0,delimiters:["{{","}}"],getNamespace:()=>0,isVoidTag:Hi,isPreTag:Hi,isIgnoreNewlineTag:Hi,isCustomElement:Hi,onError:ya,onWarn:qd,comments:!1,prefixIdentifiers:!1},_e=Id,sr=null,Jt="",Ge=null,ve=null,ht="",Ft=-1,_i=-1,ho=0,Si=!1,_a=null,Ce=[],Re=new class{constructor(e,t){this.stack=e,this.cbs=t,this.state=1,this.buffer="",this.sectionStart=0,this.index=0,this.entityStart=0,this.baseState=1,this.inRCDATA=!1,this.inXML=!1,this.inVPre=!1,this.newlines=[],this.mode=0,this.delimiterOpen=pl,this.delimiterClose=ul,this.delimiterIndex=-1,this.currentSequence=void 0,this.sequenceIndex=0}get inSFCRoot(){return this.mode===2&&this.stack.length===0}reset(){this.state=1,this.mode=0,this.buffer="",this.sectionStart=0,this.index=0,this.baseState=1,this.inRCDATA=!1,this.currentSequence=void 0,this.newlines.length=0,this.delimiterOpen=pl,this.delimiterClose=ul}getPos(e){let t=1,i=e+1,n=this.newlines.length,s=-1;if(n>100){let r=-1,a=n;for(;r+1<a;){let o=r+a>>>1;this.newlines[o]<e?r=o:a=o}s=r}else for(let r=n-1;r>=0;r--)if(e>this.newlines[r]){s=r;break}return s>=0&&(t=s+2,i=e-this.newlines[s]),{column:i,line:t,offset:e}}peek(){return this.buffer.charCodeAt(this.index+1)}stateText(e){e===60?(this.index>this.sectionStart&&this.cbs.ontext(this.sectionStart,this.index),this.state=5,this.sectionStart=this.index):this.inVPre||e!==this.delimiterOpen[0]||(this.state=2,this.delimiterIndex=0,this.stateInterpolationOpen(e))}stateInterpolationOpen(e){if(e===this.delimiterOpen[this.delimiterIndex])if(this.delimiterIndex===this.delimiterOpen.length-1){let t=this.index+1-this.delimiterOpen.length;t>this.sectionStart&&this.cbs.ontext(this.sectionStart,t),this.state=3,this.sectionStart=t}else this.delimiterIndex++;else this.inRCDATA?(this.state=32,this.stateInRCDATA(e)):(this.state=1,this.stateText(e))}stateInterpolation(e){e===this.delimiterClose[0]&&(this.state=4,this.delimiterIndex=0,this.stateInterpolationClose(e))}stateInterpolationClose(e){e===this.delimiterClose[this.delimiterIndex]?this.delimiterIndex===this.delimiterClose.length-1?(this.cbs.oninterpolation(this.sectionStart,this.index+1),this.inRCDATA?this.state=32:this.state=1,this.sectionStart=this.index+1):this.delimiterIndex++:(this.state=3,this.stateInterpolation(e))}stateSpecialStartSequence(e){let t=this.sequenceIndex===this.currentSequence.length;if(t?si(e):(32|e)===this.currentSequence[this.sequenceIndex]){if(!t)return void this.sequenceIndex++}else this.inRCDATA=!1;this.sequenceIndex=0,this.state=6,this.stateInTagName(e)}stateInRCDATA(e){if(this.sequenceIndex===this.currentSequence.length){if(e===62||mt(e)){let t=this.index-this.currentSequence.length;if(this.sectionStart<t){let i=this.index;this.index=t,this.cbs.ontext(this.sectionStart,t),this.index=i}this.sectionStart=t+2,this.stateInClosingTagName(e),this.inRCDATA=!1;return}this.sequenceIndex=0}(32|e)===this.currentSequence[this.sequenceIndex]?this.sequenceIndex+=1:this.sequenceIndex===0?this.currentSequence!==We.TitleEnd&&(this.currentSequence!==We.TextareaEnd||this.inSFCRoot)?this.fastForwardTo(60)&&(this.sequenceIndex=1):this.inVPre||e!==this.delimiterOpen[0]||(this.state=2,this.delimiterIndex=0,this.stateInterpolationOpen(e)):this.sequenceIndex=+(e===60)}stateCDATASequence(e){e===We.Cdata[this.sequenceIndex]?++this.sequenceIndex===We.Cdata.length&&(this.state=28,this.currentSequence=We.CdataEnd,this.sequenceIndex=0,this.sectionStart=this.index+1):(this.sequenceIndex=0,this.state=23,this.stateInDeclaration(e))}fastForwardTo(e){for(;++this.index<this.buffer.length;){let t=this.buffer.charCodeAt(this.index);if(t===10&&this.newlines.push(this.index),t===e)return!0}return this.index=this.buffer.length-1,!1}stateInCommentLike(e){e===this.currentSequence[this.sequenceIndex]?++this.sequenceIndex===this.currentSequence.length&&(this.currentSequence===We.CdataEnd?this.cbs.oncdata(this.sectionStart,this.index-2):this.cbs.oncomment(this.sectionStart,this.index-2),this.sequenceIndex=0,this.sectionStart=this.index+1,this.state=1):this.sequenceIndex===0?this.fastForwardTo(this.currentSequence[0])&&(this.sequenceIndex=1):e!==this.currentSequence[this.sequenceIndex-1]&&(this.sequenceIndex=0)}startSpecial(e,t){this.enterRCDATA(e,t),this.state=31}enterRCDATA(e,t){this.inRCDATA=!0,this.currentSequence=e,this.sequenceIndex=t}stateBeforeTagName(e){e===33?(this.state=22,this.sectionStart=this.index+1):e===63?(this.state=24,this.sectionStart=this.index+1):fl(e)?(this.sectionStart=this.index,this.mode===0?this.state=6:this.inSFCRoot?this.state=34:this.inXML?this.state=6:e===116?this.state=30:this.state=e===115?29:6):e===47?this.state=8:(this.state=1,this.stateText(e))}stateInTagName(e){si(e)&&this.handleTagName(e)}stateInSFCRootTagName(e){if(si(e)){let t=this.buffer.slice(this.sectionStart,this.index);t!=="template"&&this.enterRCDATA(er("</"+t),0),this.handleTagName(e)}}handleTagName(e){this.cbs.onopentagname(this.sectionStart,this.index),this.sectionStart=-1,this.state=11,this.stateBeforeAttrName(e)}stateBeforeClosingTagName(e){mt(e)||(e===62?(this.state=1,this.sectionStart=this.index+1):(this.state=fl(e)?9:27,this.sectionStart=this.index))}stateInClosingTagName(e){(e===62||mt(e))&&(this.cbs.onclosetag(this.sectionStart,this.index),this.sectionStart=-1,this.state=10,this.stateAfterClosingTagName(e))}stateAfterClosingTagName(e){e===62&&(this.state=1,this.sectionStart=this.index+1)}stateBeforeAttrName(e){e===62?(this.cbs.onopentagend(this.index),this.inRCDATA?this.state=32:this.state=1,this.sectionStart=this.index+1):e===47?this.state=7:e===60&&this.peek()===47?(this.cbs.onopentagend(this.index),this.state=5,this.sectionStart=this.index):mt(e)||this.handleAttrStart(e)}handleAttrStart(e){e===118&&this.peek()===45?(this.state=13,this.sectionStart=this.index):e===46||e===58||e===64||e===35?(this.cbs.ondirname(this.index,this.index+1),this.state=14,this.sectionStart=this.index+1):(this.state=12,this.sectionStart=this.index)}stateInSelfClosingTag(e){e===62?(this.cbs.onselfclosingtag(this.index),this.state=1,this.sectionStart=this.index+1,this.inRCDATA=!1):mt(e)||(this.state=11,this.stateBeforeAttrName(e))}stateInAttrName(e){(e===61||si(e))&&(this.cbs.onattribname(this.sectionStart,this.index),this.handleAttrNameEnd(e))}stateInDirName(e){e===61||si(e)?(this.cbs.ondirname(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===58?(this.cbs.ondirname(this.sectionStart,this.index),this.state=14,this.sectionStart=this.index+1):e===46&&(this.cbs.ondirname(this.sectionStart,this.index),this.state=16,this.sectionStart=this.index+1)}stateInDirArg(e){e===61||si(e)?(this.cbs.ondirarg(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===91?this.state=15:e===46&&(this.cbs.ondirarg(this.sectionStart,this.index),this.state=16,this.sectionStart=this.index+1)}stateInDynamicDirArg(e){e===93?this.state=14:(e===61||si(e))&&(this.cbs.ondirarg(this.sectionStart,this.index+1),this.handleAttrNameEnd(e))}stateInDirModifier(e){e===61||si(e)?(this.cbs.ondirmodifier(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===46&&(this.cbs.ondirmodifier(this.sectionStart,this.index),this.sectionStart=this.index+1)}handleAttrNameEnd(e){this.sectionStart=this.index,this.state=17,this.cbs.onattribnameend(this.index),this.stateAfterAttrName(e)}stateAfterAttrName(e){e===61?this.state=18:e===47||e===62?(this.cbs.onattribend(0,this.sectionStart),this.sectionStart=-1,this.state=11,this.stateBeforeAttrName(e)):mt(e)||(this.cbs.onattribend(0,this.sectionStart),this.handleAttrStart(e))}stateBeforeAttrValue(e){e===34?(this.state=19,this.sectionStart=this.index+1):e===39?(this.state=20,this.sectionStart=this.index+1):mt(e)||(this.sectionStart=this.index,this.state=21,this.stateInAttrValueNoQuotes(e))}handleInAttrValue(e,t){(e===t||this.fastForwardTo(t))&&(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=-1,this.cbs.onattribend(t===34?3:2,this.index+1),this.state=11)}stateInAttrValueDoubleQuotes(e){this.handleInAttrValue(e,34)}stateInAttrValueSingleQuotes(e){this.handleInAttrValue(e,39)}stateInAttrValueNoQuotes(e){mt(e)||e===62?(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=-1,this.cbs.onattribend(1,this.index),this.state=11,this.stateBeforeAttrName(e)):(e===39||e===60||e===61||e===96)&&this.cbs.onerr(18,this.index)}stateBeforeDeclaration(e){e===91?(this.state=26,this.sequenceIndex=0):this.state=e===45?25:23}stateInDeclaration(e){(e===62||this.fastForwardTo(62))&&(this.state=1,this.sectionStart=this.index+1)}stateInProcessingInstruction(e){(e===62||this.fastForwardTo(62))&&(this.cbs.onprocessinginstruction(this.sectionStart,this.index),this.state=1,this.sectionStart=this.index+1)}stateBeforeComment(e){e===45?(this.state=28,this.currentSequence=We.CommentEnd,this.sequenceIndex=2,this.sectionStart=this.index+1):this.state=23}stateInSpecialComment(e){(e===62||this.fastForwardTo(62))&&(this.cbs.oncomment(this.sectionStart,this.index),this.state=1,this.sectionStart=this.index+1)}stateBeforeSpecialS(e){e===We.ScriptEnd[3]?this.startSpecial(We.ScriptEnd,4):e===We.StyleEnd[3]?this.startSpecial(We.StyleEnd,4):(this.state=6,this.stateInTagName(e))}stateBeforeSpecialT(e){e===We.TitleEnd[3]?this.startSpecial(We.TitleEnd,4):e===We.TextareaEnd[3]?this.startSpecial(We.TextareaEnd,4):(this.state=6,this.stateInTagName(e))}startEntity(){}stateInEntity(){}parse(e){for(this.buffer=e;this.index<this.buffer.length;){let t=this.buffer.charCodeAt(this.index);switch(t===10&&this.state!==33&&this.newlines.push(this.index),this.state){case 1:this.stateText(t);break;case 2:this.stateInterpolationOpen(t);break;case 3:this.stateInterpolation(t);break;case 4:this.stateInterpolationClose(t);break;case 31:this.stateSpecialStartSequence(t);break;case 32:this.stateInRCDATA(t);break;case 26:this.stateCDATASequence(t);break;case 19:this.stateInAttrValueDoubleQuotes(t);break;case 12:this.stateInAttrName(t);break;case 13:this.stateInDirName(t);break;case 14:this.stateInDirArg(t);break;case 15:this.stateInDynamicDirArg(t);break;case 16:this.stateInDirModifier(t);break;case 28:this.stateInCommentLike(t);break;case 27:this.stateInSpecialComment(t);break;case 11:this.stateBeforeAttrName(t);break;case 6:this.stateInTagName(t);break;case 34:this.stateInSFCRootTagName(t);break;case 9:this.stateInClosingTagName(t);break;case 5:this.stateBeforeTagName(t);break;case 17:this.stateAfterAttrName(t);break;case 20:this.stateInAttrValueSingleQuotes(t);break;case 18:this.stateBeforeAttrValue(t);break;case 8:this.stateBeforeClosingTagName(t);break;case 10:this.stateAfterClosingTagName(t);break;case 29:this.stateBeforeSpecialS(t);break;case 30:this.stateBeforeSpecialT(t);break;case 21:this.stateInAttrValueNoQuotes(t);break;case 7:this.stateInSelfClosingTag(t);break;case 23:this.stateInDeclaration(t);break;case 22:this.stateBeforeDeclaration(t);break;case 25:this.stateBeforeComment(t);break;case 24:this.stateInProcessingInstruction(t);break;case 33:this.stateInEntity()}this.index++}this.cleanup(),this.finish()}cleanup(){this.sectionStart!==this.index&&(this.state===1||this.state===32&&this.sequenceIndex===0?(this.cbs.ontext(this.sectionStart,this.index),this.sectionStart=this.index):(this.state===19||this.state===20||this.state===21)&&(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=this.index))}finish(){this.handleTrailingData(),this.cbs.onend()}handleTrailingData(){let e=this.buffer.length;this.sectionStart>=e||(this.state===28?this.currentSequence===We.CdataEnd?this.cbs.oncdata(this.sectionStart,e):this.cbs.oncomment(this.sectionStart,e):this.state===6||this.state===11||this.state===18||this.state===17||this.state===12||this.state===13||this.state===14||this.state===15||this.state===16||this.state===20||this.state===19||this.state===21||this.state===9||this.cbs.ontext(this.sectionStart,e))}emitCodePoint(e,t){}}(Ce,{onerr:vl,ontext(e,t){ys(Je(e,t),e,t)},ontextentity(e,t,i){ys(e,t,i)},oninterpolation(e,t){if(Si)return ys(Je(e,t),e,t);let i=e+Re.delimiterOpen.length,n=t-Re.delimiterClose.length;for(;mt(Jt.charCodeAt(i));)i++;for(;mt(Jt.charCodeAt(n-1));)n--;let s=Je(i,n);s.includes("&")&&(s=_e.decodeEntities(s,!1)),Sa({type:5,content:xs(s,!1,Ie(i,n)),loc:Ie(e,t)})},onopentagname(e,t){let i=Je(e,t);Ge={type:1,tag:i,ns:_e.getNamespace(i,Ce[0],_e.ns),tagType:0,props:[],children:[],loc:Ie(e-1,t),codegenNode:void 0}},onopentagend(e){gl(e)},onclosetag(e,t){let i=Je(e,t);if(!_e.isVoidTag(i)){let n=!1;for(let s=0;s<Ce.length;s++)if(Ce[s].tag.toLowerCase()===i.toLowerCase()){n=!0,s>0&&Ce[0].loc.start.offset;for(let r=0;r<=s;r++)Ts(Ce.shift(),t,r<s);break}n||Rd(e,60)}},onselfclosingtag(e){let t=Ge.tag;Ge.isSelfClosing=!0,gl(e),Ce[0]&&Ce[0].tag===t&&Ts(Ce.shift(),e)},onattribname(e,t){ve={type:6,name:Je(e,t),nameLoc:Ie(e,t),value:void 0,loc:Ie(e)}},ondirname(e,t){let i=Je(e,t),n=i==="."||i===":"?"bind":i==="@"?"on":i==="#"?"slot":i.slice(2);if(Si||n==="")ve={type:6,name:i,nameLoc:Ie(e,t),value:void 0,loc:Ie(e)};else if(ve={type:7,name:n,rawName:i,exp:void 0,arg:void 0,modifiers:i==="."?[ae("prop")]:[],loc:Ie(e)},n==="pre"){Si=Re.inVPre=!0,_a=Ge;let s=Ge.props;for(let r=0;r<s.length;r++)s[r].type===7&&(s[r]=function(a){let o={type:6,name:a.rawName,nameLoc:Ie(a.loc.start.offset,a.loc.start.offset+a.rawName.length),value:void 0,loc:a.loc};if(a.exp){let l=a.exp.loc;l.end.offset<a.loc.end.offset&&(l.start.offset--,l.start.column--,l.end.offset++,l.end.column++),o.value={type:2,content:a.exp.content,loc:l}}return o}(s[r]))}},ondirarg(e,t){if(e===t)return;let i=Je(e,t);if(Si&&!hl(ve))ve.name+=i,qi(ve.nameLoc,t);else{let n=i[0]!=="[";ve.arg=xs(n?i:i.slice(1,-1),n,Ie(e,t),3*!!n)}},ondirmodifier(e,t){let i=Je(e,t);if(Si&&!hl(ve))ve.name+="."+i,qi(ve.nameLoc,t);else if(ve.name==="slot"){let n=ve.arg;n&&(n.content+="."+i,qi(n.loc,t))}else{let n=ae(i,!0,Ie(e,t));ve.modifiers.push(n)}},onattribdata(e,t){ht+=Je(e,t),Ft<0&&(Ft=e),_i=t},onattribentity(e,t,i){ht+=e,Ft<0&&(Ft=t),_i=i},onattribnameend(e){let t=Je(ve.loc.start.offset,e);ve.type===7&&(ve.rawName=t),Ge.props.some(i=>(i.type===7?i.rawName:i.name)===t)},onattribend(e,t){Ge&&ve&&(qi(ve.loc,t),e!==0&&(ht.includes("&")&&(ht=_e.decodeEntities(ht,!0)),ve.type===6?(ve.name==="class"&&(ht=Pd(ht).trim()),ve.value={type:2,content:ht,loc:e===1?Ie(Ft,_i):Ie(Ft-1,_i+1)},Re.inSFCRoot&&Ge.tag==="template"&&ve.name==="lang"&&ht&&ht!=="html"&&Re.enterRCDATA(er("</template"),0)):(ve.exp=xs(ht,!1,Ie(Ft,_i),0,0),ve.name==="for"&&(ve.forParseResult=function(i){let n=i.loc,s=i.content,r=s.match(mh);if(!r)return;let[,a,o]=r,l=(w,g,_=!1)=>{let A=n.start.offset+g,E=A+w.length;return xs(w,!1,Ie(A,E),0,+!!_)},c={source:l(o.trim(),s.indexOf(o,a.length)),value:void 0,key:void 0,index:void 0,finalized:!1},d=a.trim().replace(gh,"").trim(),p=a.indexOf(d),u=d.match(ml);if(u){let w;d=d.replace(ml,"").trim();let g=u[1].trim();if(g&&(w=s.indexOf(g,p+d.length),c.key=l(g,w,!0)),u[2]){let _=u[2].trim();_&&(c.index=l(_,s.indexOf(_,c.key?w+g.length:p+d.length),!0))}}return d&&(c.value=l(d,p,!0)),c}(ve.exp)))),(ve.type!==7||ve.name!=="pre")&&Ge.props.push(ve)),ht="",Ft=_i=-1},oncomment(e,t){_e.comments&&Sa({type:3,content:Je(e,t),loc:Ie(e-4,t+3)})},onend(){let e=Jt.length;for(let t=0;t<Ce.length;t++)Ts(Ce[t],e-1),Ce[t].loc.start.offset},oncdata(e,t){(Ce[0]?Ce[0].ns:_e.ns)!==0&&ys(Je(e,t),e,t)},onprocessinginstruction(e){(Ce[0]?Ce[0].ns:_e.ns)===0&&vl(21,e-1)}}),ml=/,([^,\}\]]*)(?:,([^,\}\]]*))?$/,gh=/^\(|\)$/g;function Je(e,t){return Jt.slice(e,t)}function gl(e){Re.inSFCRoot&&(Ge.innerLoc=Ie(e+1,e+1)),Sa(Ge);let{tag:t,ns:i}=Ge;i===0&&_e.isPreTag(t)&&ho++,_e.isVoidTag(t)?Ts(Ge,e):(Ce.unshift(Ge),(i===1||i===2)&&(Re.inXML=!0)),Ge=null}function ys(e,t,i){{let r=Ce[0]&&Ce[0].tag;r!=="script"&&r!=="style"&&e.includes("&")&&(e=_e.decodeEntities(e,!1))}let n=Ce[0]||sr,s=n.children[n.children.length-1];s&&s.type===2?(s.content+=e,qi(s.loc,i)):n.children.push({type:2,content:e,loc:Ie(t,i)})}function Ts(e,t,i=!1){i?qi(e.loc,Rd(t,60)):qi(e.loc,function(a){let o=a;for(;Jt.charCodeAt(o)!==62&&o<Jt.length-1;)o++;return o}(t)+1),Re.inSFCRoot&&(e.children.length?e.innerLoc.end=ce({},e.children[e.children.length-1].loc.end):e.innerLoc.end=ce({},e.innerLoc.start),e.innerLoc.source=Je(e.innerLoc.start.offset,e.innerLoc.end.offset));let{tag:n,ns:s,children:r}=e;if(!Si&&(n==="slot"?e.tagType=2:function({tag:a,props:o}){if(a==="template"){for(let l=0;l<o.length;l++)if(o[l].type===7&&vh.has(o[l].name))return!0}return!1}(e)?e.tagType=3:function({tag:a,props:o}){var l;if(_e.isCustomElement(a))return!1;if(a==="component"||(l=a.charCodeAt(0))>64&&l<91||Cd(a)||_e.isBuiltInComponent&&_e.isBuiltInComponent(a)||_e.isNativeTag&&!_e.isNativeTag(a))return!0;for(let c=0;c<o.length;c++){let d=o[c];if(d.type===6&&d.name==="is"&&d.value&&d.value.content.startsWith("vue:"))return!0}return!1}(e)&&(e.tagType=1)),Re.inRCDATA||(e.children=Od(r)),s===0&&_e.isIgnoreNewlineTag(n)){let a=r[0];a&&a.type===2&&(a.content=a.content.replace(/^\r?\n/,""))}s===0&&_e.isPreTag(n)&&ho--,_a===e&&(Si=Re.inVPre=!1,_a=null),Re.inXML&&(Ce[0]?Ce[0].ns:_e.ns)===0&&(Re.inXML=!1)}function Rd(e,t){let i=e;for(;Jt.charCodeAt(i)!==t&&i>=0;)i--;return i}var vh=new Set(["if","else","else-if","for","slot"]),bh=/\r\n/g;function Od(e){let t=_e.whitespace!=="preserve",i=!1;for(let n=0;n<e.length;n++){let s=e[n];if(s.type===2)if(ho)s.content=s.content.replace(bh,`
`);else if(Ed(s.content)){let r=e[n-1]&&e[n-1].type,a=e[n+1]&&e[n+1].type;!r||!a||t&&(r===3&&(a===3||a===1)||r===1&&(a===3||a===1&&function(o){for(let l=0;l<o.length;l++){let c=o.charCodeAt(l);if(c===10||c===13)return!0}return!1}(s.content)))?(i=!0,e[n]=null):s.content=" "}else t&&(s.content=Pd(s.content))}return i?e.filter(Boolean):e}function Pd(e){let t="",i=!1;for(let n=0;n<e.length;n++)mt(e.charCodeAt(n))?i||(t+=" ",i=!0):(t+=e[n],i=!1);return t}function Sa(e){(Ce[0]||sr).children.push(e)}function Ie(e,t){return{start:Re.getPos(e),end:t==null?t:Re.getPos(t),source:t==null?t:Je(e,t)}}function qi(e,t){e.end=Re.getPos(t),e.source=Je(e.start.offset,t)}function xs(e,t=!1,i,n=0,s=0){return ae(e,t,i,n)}function vl(e,t,i){_e.onError(ye(e,Ie(t,t)))}function bl(e){let t=e.children.filter(i=>i.type!==3);return t.length!==1||t[0].type!==1||ir(t[0])?null:t[0]}function gt(e,t){let{constantCache:i}=t;switch(e.type){case 1:if(e.tagType!==0)return 0;let o=i.get(e);if(o!==void 0)return o;let l=e.codegenNode;if(l.type!==13||l.isBlock&&e.tag!=="svg"&&e.tag!=="foreignObject"&&e.tag!=="math")return 0;if(l.patchFlag!==void 0)return i.set(e,0),0;{let d=3,p=Bd(e,t);if(p===0)return i.set(e,0),0;p<d&&(d=p);for(let u=0;u<e.children.length;u++){let w=gt(e.children[u],t);if(w===0)return i.set(e,0),0;w<d&&(d=w)}if(d>1)for(let u=0;u<e.props.length;u++){let w=e.props[u];if(w.type===7&&w.name==="bind"&&w.exp){let g=gt(w.exp,t);if(g===0)return i.set(e,0),0;g<d&&(d=g)}}if(l.isBlock){var n,s,r,a;for(let u=0;u<e.props.length;u++)if(e.props[u].type===7)return i.set(e,0),0;t.removeHelper(Oi),t.removeHelper((n=t.inSSR,s=l.isComponent,n||s?Pi:Bi)),l.isBlock=!1,t.helper((r=t.inSSR,a=l.isComponent,r||a?pi:ui))}return i.set(e,d),d}case 2:case 3:return 3;case 9:case 11:case 10:default:return 0;case 5:case 12:return gt(e.content,t);case 4:return e.constType;case 8:let c=3;for(let d=0;d<e.children.length;d++){let p=e.children[d];if(ne(p)||Ze(p))continue;let u=gt(p,t);if(u===0)return 0;u<c&&(c=u)}return c;case 20:return 2}}var yh=new Set([ao,oo,Hn,ns]);function Bd(e,t){let i=3,n=Ld(e);if(n&&n.type===15){let{properties:s}=n;for(let r=0;r<s.length;r++){let a,{key:o,value:l}=s[r],c=gt(o,t);if(c===0)return c;if(c<i&&(i=c),(a=l.type===4?gt(l,t):l.type===14?function d(p,u){if(p.type===14&&!ne(p.callee)&&yh.has(p.callee)){let w=p.arguments[0];if(w.type===4)return gt(w,u);if(w.type===14)return d(w,u)}return 0}(l,t):0)===0)return a;a<i&&(i=a)}}return i}function Ld(e){let t=e.codegenNode;if(t.type===13)return t.props}function rr(e,t){t.currentNode=e;let{nodeTransforms:i}=t,n=[];for(let a=0;a<i.length;a++){let o=i[a](e,t);if(o&&(J(o)?n.push(...o):n.push(o)),!t.currentNode)return;e=t.currentNode}switch(e.type){case 3:t.ssr||t.helper(is);break;case 5:t.ssr||t.helper(_r);break;case 9:for(let l=0;l<e.branches.length;l++)rr(e.branches[l],t);break;case 10:case 11:case 1:case 0:var s=e;let a=0,o=()=>{a--};for(;a<s.children.length;a++){let l=s.children[a];ne(l)||(t.grandParent=t.parent,t.parent=s,t.childIndex=a,t.onNodeRemoved=o,rr(l,t))}}t.currentNode=e;let r=n.length;for(;r--;)n[r]()}function Dd(e,t){let i=ne(e)?n=>n===e:n=>e.test(n);return(n,s)=>{if(n.type===1){let{props:r}=n;if(n.tagType===3&&r.some(fh))return;let a=[];for(let o=0;o<r.length;o++){let l=r[o];if(l.type===7&&i(l.name)){r.splice(o,1),o--;let c=t(n,l,s);c&&a.push(c)}}return a}}}var ws="/*@__PURE__*/",yl=e=>`${cn[e]}: _${cn[e]}`;function xl(e,t,{helper:i,push:n,newline:s,isTS:r}){let a=i(t==="component"?io:no);for(let o=0;o<e.length;o++){let l=e[o],c=l.endsWith("__self");c&&(l=l.slice(0,-6)),n(`const ${ka(l,t)} = ${a}(${JSON.stringify(l)}${c?", true":""})${r?"!":""}`),o<e.length-1&&s()}}function qa(e,t){let i=e.length>3;t.push("["),i&&t.indent(),qn(e,t,i),i&&t.deindent(),t.push("]")}function qn(e,t,i=!1,n=!0){let{push:s,newline:r}=t;for(let a=0;a<e.length;a++){let o=e[a];ne(o)?s(o,-3):J(o)?qa(o,t):st(o,t),a<e.length-1&&(i?(n&&s(","),r()):n&&s(", "))}}function st(e,t){var i,n,s;if(ne(e))return void t.push(e,-3);if(Ze(e))return void t.push(t.helper(e));switch(e.type){case 1:case 9:case 11:case 12:st(e.codegenNode,t);break;case 2:i=e,t.push(JSON.stringify(i.content),-3,i);break;case 4:wl(e,t);break;case 5:(function(r,a){let{push:o,helper:l,pure:c}=a;c&&o(ws),o(`${l(_r)}(`),st(r.content,a),o(")")})(e,t);break;case 8:kl(e,t);break;case 3:(function(r,a){let{push:o,helper:l,pure:c}=a;c&&o(ws),o(`${l(is)}(${JSON.stringify(r.content)})`,-3,r)})(e,t);break;case 13:(function(r,a){var o,l;let c,{push:d,helper:p,pure:u}=a,{tag:w,props:g,children:_,patchFlag:A,dynamicProps:E,directives:h,isBlock:m,disableTracking:q,isComponent:T}=r;A&&(c=String(A)),h&&d(p(so)+"("),m&&d(`(${p(Oi)}(${q?"true":""}), `),u&&d(ws),d(p(m?(o=a.inSSR,o||T?Pi:Bi):(l=a.inSSR,l||T?pi:ui))+"(",-2,r),qn(function(N){let f=N.length;for(;f--&&N[f]==null;);return N.slice(0,f+1).map(y=>y||"null")}([w,g,_,c,E]),a),d(")"),m&&d(")"),h&&(d(", "),st(h,a),d(")"))})(e,t);break;case 14:(function(r,a){let{push:o,helper:l,pure:c}=a,d=ne(r.callee)?r.callee:l(r.callee);c&&o(ws),o(d+"(",-2,r),qn(r.arguments,a),o(")")})(e,t);break;case 15:(function(r,a){let{push:o,indent:l,deindent:c,newline:d}=a,{properties:p}=r;if(!p.length)return o("{}",-2,r);let u=p.length>1;o(u?"{":"{ "),u&&l();for(let w=0;w<p.length;w++){let{key:g,value:_}=p[w];(function(A,E){let{push:h}=E;if(A.type===8)h("["),kl(A,E),h("]");else if(A.isStatic){let m;h((m=A.content,xa.test(m)?JSON.stringify(A.content):A.content),-2,A)}else h(`[${A.content}]`,-3,A)})(g,a),o(": "),st(_,a),w<p.length-1&&(o(","),d())}u&&c(),o(u?"}":" }")})(e,t);break;case 17:n=e,s=t,qa(n.elements,s);break;case 18:(function(r,a){let{push:o,indent:l,deindent:c}=a,{params:d,returns:p,body:u,newline:w,isSlot:g}=r;g&&o(`_${cn[co]}(`),o("(",-2,r),J(d)?qn(d,a):d&&st(d,a),o(") => "),(w||u)&&(o("{"),l()),p?(w&&o("return "),J(p)?qa(p,a):st(p,a)):u&&st(u,a),(w||u)&&(c(),o("}")),g&&o(")")})(e,t);break;case 19:(function(r,a){let{test:o,consequent:l,alternate:c,newline:d}=r,{push:p,indent:u,deindent:w,newline:g}=a;if(o.type===4){let A,E=(A=o.content,!!xa.test(A));E&&p("("),wl(o,a),E&&p(")")}else p("("),st(o,a),p(")");d&&u(),a.indentLevel++,d||p(" "),p("? "),st(l,a),a.indentLevel--,d&&g(),d||p(" "),p(": ");let _=c.type===19;!_&&a.indentLevel++,st(c,a),!_&&a.indentLevel--,d&&w(!0)})(e,t);break;case 20:(function(r,a){let{push:o,helper:l,indent:c,deindent:d,newline:p}=a,{needPauseTracking:u,needArraySpread:w}=r;w&&o("[...("),o(`_cache[${r.index}] || (`),u&&(c(),o(`${l(Zs)}(-1`),r.inVOnce&&o(", true"),o("),"),p(),o("(")),o(`_cache[${r.index}] = `),st(r.value,a),u&&(o(`).cacheIndex = ${r.index},`),p(),o(`${l(Zs)}(1),`),p(),o(`_cache[${r.index}]`),d()),o(")"),w&&o(")]")})(e,t);break;case 21:qn(e.body,t,!0,!1)}}function wl(e,t){let{content:i,isStatic:n}=e;t.push(n?JSON.stringify(i):i,-3,e)}function kl(e,t){for(let i=0;i<e.children.length;i++){let n=e.children[i];ne(n)?t.push(n,-3):st(n,t)}}var xh=Dd(/^(?:if|else|else-if)$/,(e,t,i)=>function(n,s,r,a){if(s.name!=="else"&&(!s.exp||!s.exp.content.trim())){let l=s.exp?s.exp.loc:n.loc;r.onError(ye(28,s.loc)),s.exp=ae("true",!1,l)}if(s.name==="if"){var o;let l=_l(n,s),c={type:9,loc:Ie((o=n.loc).start.offset,o.end.offset),branches:[l]};if(r.replaceNode(c),a)return a(c,l,!0)}else{let l=r.parent.children,c=l.indexOf(n);for(;c-->=-1;){let d=l[c];if(d&&Md(d)){r.removeNode(d);continue}if(d&&d.type===9){(s.name==="else-if"||s.name==="else")&&d.branches[d.branches.length-1].condition===void 0&&r.onError(ye(30,n.loc)),r.removeNode();let p=_l(n,s);d.branches.push(p);let u=a&&a(d,p,!1);rr(p,r),u&&u(),r.currentNode=null}else r.onError(ye(30,n.loc));break}}}(e,t,i,(n,s,r)=>{let a=i.parent.children,o=a.indexOf(n),l=0;for(;o-->=0;){let c=a[o];c&&c.type===9&&(l+=c.branches.length)}return()=>{r?n.codegenNode=Sl(s,l,i):function(c){for(;;)if(c.type===19){if(c.alternate.type!==19)return c;c=c.alternate}else c.type===20&&(c=c.value)}(n.codegenNode).alternate=Sl(s,l+n.branches.length-1,i)}}));function _l(e,t){let i=e.tagType===3;return{type:10,loc:e.loc,condition:t.name==="else"?void 0:t.exp,children:i&&!_t(e,"for")?e.children:[e],userKey:Sr(e,"key"),isTemplateIf:i}}function Sl(e,t,i){return e.condition?ba(e.condition,ql(e,t,i),Fe(i.helper(is),['""',"true"])):ql(e,t,i)}function ql(e,t,i){let{helper:n}=i,s=Be("key",ae(`${t}`,!1,bt,2)),{children:r}=e,a=r[0];if(r.length!==1||a.type!==1){if(r.length!==1||a.type!==11)return Kn(i,n(Vn),St([s]),r,64,void 0,void 0,!0,!1,!1,e.loc);{let o=a.codegenNode;return nr(o,s,i),o}}{let o=a.codegenNode,l=o.type===14&&o.callee===po?o.arguments[1].returns:o;return l.type===13&&uo(l,i),nr(l,s,i),o}}var wh=Dd("for",(e,t,i)=>{let{helper:n,removeHelper:s}=i;return function(r,a,o,l){if(!a.exp)return void o.onError(ye(31,a.loc));let c=a.forParseResult;if(!c)return void o.onError(ye(32,a.loc));Fd(c);let{scopes:d}=o,{source:p,value:u,key:w,index:g}=c,_={type:11,loc:a.loc,source:p,valueAlias:u,keyAlias:w,objectIndexAlias:g,parseResult:c,children:tr(r)?r.children:[r]};o.replaceNode(_),d.vFor++;let A=l&&l(_);return()=>{d.vFor--,A&&A()}}(e,t,i,r=>{let a=Fe(n(ro),[r.source]),o=tr(e),l=_t(e,"memo"),c=Sr(e,"key",!1,!0);c&&c.type;let d=c&&(c.type===6?c.value?ae(c.value.content,!0):void 0:c.exp),p=d?Be("key",d):null,u=r.source.type===4&&r.source.constType>0,w=u?64:c?128:256;return r.codegenNode=Kn(i,n(Vn),void 0,a,w,void 0,void 0,!0,!u,!1,e.loc),()=>{let g,{children:_}=r,A=_.length!==1||_[0].type!==1,E=ir(e)?e:o&&e.children.length===1&&ir(e.children[0])?e.children[0]:null;if(E)g=E.codegenNode,o&&p&&nr(g,p,i);else if(A)g=Kn(i,n(Vn),p?St([p]):void 0,e.children,64,void 0,void 0,!0,void 0,!1);else{var h,m,q,T,N,f,y,v;g=_[0].codegenNode,o&&p&&nr(g,p,i),!u!==g.isBlock&&(g.isBlock?(s(Oi),s((h=i.inSSR,m=g.isComponent,h||m?Pi:Bi))):s((q=i.inSSR,T=g.isComponent,q||T?pi:ui))),g.isBlock=!u,g.isBlock?(n(Oi),n((N=i.inSSR,f=g.isComponent,N||f?Pi:Bi))):n((y=i.inSSR,v=g.isComponent,y||v?pi:ui))}if(l){let k=dn(Ca(r.parseResult,[ae("_cached")]));k.body={type:21,body:[Nt(["const _memo = (",l.exp,")"]),Nt(["if (_cached && _cached.el",...d?[" && _cached.key === ",d]:[],` && ${i.helperString(Sd)}(_cached, _memo)) return _cached`]),Nt(["const _item = ",g]),ae("_item.memo = _memo"),ae("return _item")],loc:bt},a.arguments.push(k,ae("_cache"),ae(String(i.cached.length))),i.cached.push(null)}else a.arguments.push(dn(Ca(r.parseResult),g,!0))}})});function Fd(e,t){e.finalized||(e.finalized=!0)}function Ca({value:e,key:t,index:i},n=[]){var s=[e,t,i,...n];let r=s.length;for(;r--&&!s[r];);return s.slice(0,r+1).map((a,o)=>a||ae("_".repeat(o+1),!1))}var Cl=ae("undefined",!1),kh=(e,t)=>{if(e.type===1&&(e.tagType===1||e.tagType===3)){let i=_t(e,"slot");if(i)return i.exp,t.scopes.vSlot++,()=>{t.scopes.vSlot--}}};function ks(e,t,i){let n=[Be("name",e),Be("fn",t)];return i!=null&&n.push(Be("key",ae(String(i),!0))),St(n)}var jd=new WeakMap,_h=(e,t)=>function(){let i,n,s,r,a;if((e=t.currentNode).type!==1||e.tagType!==0&&e.tagType!==1)return;let{tag:o,props:l}=e,c=e.tagType===1,d=c?function(g,_,A=!1){let{tag:E}=g,h=Ta(E),m=Sr(g,"is",!1,!0);if(m)if(h){let T;if(m.type===6?T=m.value&&ae(m.value.content,!0):(T=m.exp)||(T=ae("is",!1,m.arg.loc)),T)return Fe(_.helper(ma),[T])}else m.type===6&&m.value.content.startsWith("vue:")&&(E=m.value.content.slice(4));let q=Cd(E)||_.isBuiltInComponent(E);return q?(A||_.helper(q),q):(_.helper(io),_.components.add(E),ka(E,"component"))}(e,t):`"${o}"`,p=he(d)&&d.callee===ma,u=0,w=p||d===Rn||d===eo||!c&&(o==="svg"||o==="foreignObject"||o==="math");if(l.length>0){let g=Ud(e,t,void 0,c,p);i=g.props,u=g.patchFlag,r=g.dynamicPropNames;let _=g.directives;a=_&&_.length?Ei(_.map(A=>function(E,h){let m=[],q=jd.get(E);q?m.push(h.helperString(q)):(h.helper(no),h.directives.add(E.name),m.push(ka(E.name,"directive")));let{loc:T}=E;if(E.exp&&m.push(E.exp),E.arg&&(E.exp||m.push("void 0"),m.push(E.arg)),Object.keys(E.modifiers).length){E.arg||(E.exp||m.push("void 0"),m.push("void 0"));let N=ae("true",!1,T);m.push(St(E.modifiers.map(f=>Be(f,N)),T))}return Ei(m,E.loc)}(A,t))):void 0,g.shouldUseBlock&&(w=!0)}if(e.children.length>0)if(d===Ys&&(w=!0,u|=1024),c&&d!==Rn&&d!==Ys){let{slots:g,hasDynamicSlots:_}=function(A,E,h=(m,q,T,N)=>dn(m,T,!1,!0,T.length?T[0].loc:N)){E.helper(co);let{children:m,loc:q}=A,T=[],N=[],f=E.scopes.vSlot>0||E.scopes.vFor>0,y=_t(A,"slot",!0);if(y){let{arg:z,exp:B}=y;z&&!pt(z)&&(f=!0),T.push(Be(z||ae("default",!0),h(B,void 0,m,q)))}let v=!1,k=!1,S=[],x=new Set,I=0;for(let z=0;z<m.length;z++){let B,V,H,X,ie=m[z];if(!tr(ie)||!(B=_t(ie,"slot",!0))){ie.type!==3&&S.push(ie);continue}if(y){E.onError(ye(37,B.loc));break}v=!0;let{children:pe,loc:me}=ie,{arg:xe=ae("default",!0),exp:Ve,loc:tt}=B;pt(xe)?V=xe?xe.content:"default":f=!0;let le=_t(ie,"for"),se=h(Ve,le,pe,me);if(H=_t(ie,"if"))f=!0,N.push(ba(H.exp,ks(xe,se,I++),Cl));else if(X=_t(ie,/^else(?:-if)?$/,!0)){let ke,qe=z;for(;qe--&&Md(ke=m[qe]););if(ke&&tr(ke)&&_t(ke,/^(?:else-)?if$/)){let b=N[N.length-1];for(;b.alternate.type===19;)b=b.alternate;b.alternate=X.exp?ba(X.exp,ks(xe,se,I++),Cl):ks(xe,se,I++)}else E.onError(ye(30,X.loc))}else if(le){f=!0;let ke=le.forParseResult;ke?(Fd(ke),N.push(Fe(E.helper(ro),[ke.source,dn(Ca(ke),ks(xe,se),!0)]))):E.onError(ye(32,le.loc))}else{if(V){if(x.has(V)){E.onError(ye(38,tt));continue}x.add(V),V==="default"&&(k=!0)}T.push(Be(xe,se))}}if(!y){let z=(B,V)=>Be("default",h(B,void 0,V,q));v?S.length&&!S.every(fo)&&(k?E.onError(ye(39,S[0].loc)):T.push(z(void 0,S))):T.push(z(void 0,m))}let R=f?2:function z(B){for(let V=0;V<B.length;V++){let H=B[V];switch(H.type){case 1:if(H.tagType===2||z(H.children))return!0;break;case 9:if(z(H.branches))return!0;break;case 10:case 11:if(z(H.children))return!0}}return!1}(A.children)?3:1,M=St(T.concat(Be("_",ae(R+"",!1))),q);return N.length&&(M=Fe(E.helper(_d),[M,Ei(N)])),{slots:M,hasDynamicSlots:f}}(e,t);n=g,_&&(u|=1024)}else if(e.children.length===1&&d!==Rn){let g=e.children[0],_=g.type,A=_===5||_===8;A&&gt(g,t)===0&&(u|=1),n=A||_===2?g:e.children}else n=e.children;r&&r.length&&(s=function(g){let _="[";for(let A=0,E=g.length;A<E;A++)_+=JSON.stringify(g[A]),A<E-1&&(_+=", ");return _+"]"}(r)),e.codegenNode=Kn(t,d,i,n,u===0?void 0:u,s,a,!!w,!1,c,e.loc)};function Ud(e,t,i=e.props,n,s,r=!1){let a,{tag:o,loc:l,children:c}=e,d=[],p=[],u=[],w=c.length>0,g=!1,_=0,A=!1,E=!1,h=!1,m=!1,q=!1,T=!1,N=[],f=k=>{d.length&&(p.push(St(Tl(d),l)),d=[]),k&&p.push(k)},y=()=>{t.scopes.vFor>0&&d.push(Be(ae("ref_for",!0),ae("true")))},v=({key:k,value:S})=>{if(pt(k)){let x=k.content,I=Li(x);I&&(!n||s)&&x.toLowerCase()!=="onclick"&&x!=="onUpdate:modelValue"&&!Ht(x)&&(m=!0),I&&Ht(x)&&(T=!0),I&&S.type===14&&(S=S.arguments[0]),S.type===20||(S.type===4||S.type===8)&&gt(S,t)>0||(x==="ref"?A=!0:x==="class"?E=!0:x==="style"?h=!0:x==="key"||N.includes(x)||N.push(x),n&&(x==="class"||x==="style")&&!N.includes(x)&&N.push(x))}else q=!0};for(let k=0;k<i.length;k++){let S=i[k];if(S.type===6){let{loc:x,name:I,nameLoc:R,value:M}=S;if(I==="ref"&&(A=!0,y()),I==="is"&&(Ta(o)||M&&M.content.startsWith("vue:")))continue;d.push(Be(ae(I,!0,R),ae(M?M.content:"",!0,M?M.loc:x)))}else{let{name:x,arg:I,exp:R,loc:M,modifiers:z}=S,B=x==="bind",V=x==="on";if(x==="slot"){n||t.onError(ye(40,M));continue}if(x==="once"||x==="memo"||x==="is"||B&&Wi(I,"is")&&Ta(o)||V&&r)continue;if((B&&Wi(I,"key")||V&&w&&Wi(I,"vue:before-update"))&&(g=!0),B&&Wi(I,"ref")&&y(),!I&&(B||V)){q=!0,R?B?(y(),f(),p.push(R)):f({type:14,loc:M,callee:t.helper(lo),arguments:n?[R]:[R,"true"]}):t.onError(ye(B?34:35,M));continue}B&&z.some(X=>X.content==="prop")&&(_|=32);let H=t.directiveTransforms[x];if(H){let{props:X,needRuntime:ie}=H(S,e,t);r||X.forEach(v),V&&I&&!pt(I)?f(St(X,l)):d.push(...X),ie&&(u.push(S),Ze(ie)&&jd.set(S,ie))}else!Ip(x)&&(u.push(S),w&&(g=!0))}}if(p.length?(f(),a=p.length>1?Fe(t.helper(Xs),p,l):p[0]):d.length&&(a=St(Tl(d),l)),q?_|=16:(E&&!n&&(_|=2),h&&!n&&(_|=4),N.length&&(_|=8),m&&(_|=32)),!g&&(_===0||_===32)&&(A||T||u.length>0)&&(_|=512),!t.inSSR&&a)switch(a.type){case 15:let k=-1,S=-1,x=!1;for(let M=0;M<a.properties.length;M++){let z=a.properties[M].key;pt(z)?z.content==="class"?k=M:z.content==="style"&&(S=M):z.isHandlerKey||(x=!0)}let I=a.properties[k],R=a.properties[S];x?a=Fe(t.helper(Hn),[a]):(I&&!pt(I.value)&&(I.value=Fe(t.helper(ao),[I.value])),R&&(h||R.value.type===4&&R.value.content.trim()[0]==="["||R.value.type===17)&&(R.value=Fe(t.helper(oo),[R.value])));break;case 14:break;default:a=Fe(t.helper(Hn),[Fe(t.helper(ns),[a])])}return{props:a,directives:u,patchFlag:_,dynamicPropNames:N,shouldUseBlock:g}}function Tl(e){let t=new Map,i=[];for(let r=0;r<e.length;r++){var n,s;let a=e[r];if(a.key.type===8||!a.key.isStatic){i.push(a);continue}let o=a.key.content,l=t.get(o);l?(o==="style"||o==="class"||Li(o))&&(n=l,s=a,n.value.type===17?n.value.elements.push(s.value):n.value=Ei([n.value,s.value],n.loc)):(t.set(o,a),i.push(a))}return i}function Ta(e){return e==="component"||e==="Component"}var Sh=(e,t)=>{if(ir(e)){let{children:i,loc:n}=e,{slotName:s,slotProps:r}=function(l,c){let d,p='"default"',u=[];for(let w=0;w<l.props.length;w++){let g=l.props[w];if(g.type===6)g.value&&(g.name==="name"?p=JSON.stringify(g.value.content):(g.name=we(g.name),u.push(g)));else if(g.name==="bind"&&Wi(g.arg,"name")){if(g.exp)p=g.exp;else if(g.arg&&g.arg.type===4){let _=we(g.arg.content);p=g.exp=ae(_,!1,g.arg.loc)}}else g.name==="bind"&&g.arg&&pt(g.arg)&&(g.arg.content=we(g.arg.content)),u.push(g)}if(u.length>0){let{props:w,directives:g}=Ud(l,c,u,!1,!1);d=w,g.length&&c.onError(ye(36,g[0].loc))}return{slotName:p,slotProps:d}}(e,t),a=[t.prefixIdentifiers?"_ctx.$slots":"$slots",s,"{}","undefined","true"],o=2;r&&(a[2]=r,o=3),i.length&&(a[3]=dn([],i,!1,!1,n),o=4),t.scopeId&&!t.slotted&&(o=5),a.splice(o),e.codegenNode=Fe(t.helper(kd),a,n)}},$d=(e,t,i,n)=>{let s,{loc:r,modifiers:a,arg:o}=e;if(!e.exp&&a.length,o.type===4)if(o.isStatic){let p=o.content;p.startsWith("vue:")&&(p=`vnode-${p.slice(4)}`),s=ae(t.tagType!==0||p.startsWith("vnode")||!/[A-Z]/.test(p)?Yi(we(p)):`on:${p}`,!0,o.loc)}else s=Nt([`${i.helperString(va)}(`,o,")"]);else(s=o).children.unshift(`${i.helperString(va)}(`),s.children.push(")");let l=e.exp;l&&!l.content.trim()&&(l=void 0);let c=i.cacheHandlers&&!l&&!i.inVOnce;if(l){let p,u=Nd(l),w=!(u||(p=l,uh.test(Ad(p)))),g=l.content.includes(";");(w||c&&u)&&(l=Nt([`${w?"$event":"(...args)"} => ${g?"{":"("}`,l,g?"}":")"]))}let d={props:[Be(s,l||ae("() => {}",!1,r))]};return n&&(d=n(d)),c&&(d.props[0].value=i.cache(d.props[0].value)),d.props.forEach(p=>p.key.isHandlerKey=!0),d},qh=(e,t,i)=>{let{modifiers:n}=e,s=e.arg,{exp:r}=e;return r&&r.type===4&&!r.content.trim()&&(r=void 0),s.type!==4?(s.children.unshift("("),s.children.push(') || ""')):s.isStatic||(s.content=s.content?`${s.content} || ""`:'""'),n.some(a=>a.content==="camel")&&(s.type===4?s.isStatic?s.content=we(s.content):s.content=`${i.helperString(ga)}(${s.content})`:(s.children.unshift(`${i.helperString(ga)}(`),s.children.push(")"))),!i.inSSR&&(n.some(a=>a.content==="prop")&&Al(s,"."),n.some(a=>a.content==="attr")&&Al(s,"^")),{props:[Be(s,r)]}},Al=(e,t)=>{e.type===4?e.isStatic?e.content=t+e.content:e.content=`\`${t}\${${e.content}}\``:(e.children.unshift(`'${t}' + (`),e.children.push(")"))},Ch=(e,t)=>{if(e.type===0||e.type===1||e.type===11||e.type===10)return()=>{let i,n=e.children,s=!1;for(let r=0;r<n.length;r++){let a=n[r];if(Kr(a)){s=!0;for(let o=r+1;o<n.length;o++){let l=n[o];if(Kr(l))i||(i=n[r]=Nt([a],a.loc)),i.children.push(" + ",l),n.splice(o,1),o--;else{i=void 0;break}}}}if(s&&(n.length!==1||e.type!==0&&(e.type!==1||e.tagType!==0||e.props.find(r=>r.type===7&&!t.directiveTransforms[r.name]))))for(let r=0;r<n.length;r++){let a=n[r];if(Kr(a)||a.type===8){let o=[];(a.type!==2||a.content!==" ")&&o.push(a),t.ssr||gt(a,t)!==0||o.push("1"),n[r]={type:12,content:a,loc:a.loc,codegenNode:Fe(t.helper(to),o)}}}}},Nl=new WeakSet,Th=(e,t)=>{if(e.type===1&&_t(e,"once",!0)&&!Nl.has(e)&&!t.inVOnce&&!t.inSSR)return Nl.add(e),t.inVOnce=!0,t.helper(Zs),()=>{t.inVOnce=!1;let i=t.currentNode;i.codegenNode&&(i.codegenNode=t.cache(i.codegenNode,!0,!0))}},zd=(e,t,i)=>{let n,{exp:s,arg:r}=e;if(!s)return i.onError(ye(41,e.loc)),_s();let a=s.loc.source.trim(),o=s.type===4?s.content:a,l=i.bindingMetadata[a];if(l==="props"||l==="props-aliased"||l==="literal-const"||l==="setup-const")return s.loc,_s();if(!o.trim()||!Nd(s))return i.onError(ye(42,s.loc)),_s();let c=r||ae("modelValue",!0),d=r?pt(r)?`onUpdate:${we(r.content)}`:Nt(['"onUpdate:" + ',r]):"onUpdate:modelValue",p=i.isTS?"($event: any)":"$event";n=Nt([`${p} => ((`,s,") = $event)"]);let u=[Be(c,e.exp),Be(d,n)];if(e.modifiers.length&&t.tagType===1){let w=e.modifiers.map(_=>_.content).map(_=>(xa.test(_)?JSON.stringify(_):_)+": true").join(", "),g=r?pt(r)?`${r.content}Modifiers`:Nt([r,' + "Modifiers"']):"modelModifiers";u.push(Be(g,ae(`{ ${w} }`,!1,e.loc,2)))}return _s(u)};function _s(e=[]){return{props:e}}var El=new WeakSet,Ah=(e,t)=>{if(e.type===1){let i=_t(e,"memo");if(!(!i||El.has(e))&&!t.inSSR)return El.add(e),()=>{let n=e.codegenNode||t.currentNode.codegenNode;n&&n.type===13&&(e.tagType!==1&&uo(n,t),e.codegenNode=Fe(t.helper(po),[i.exp,dn(void 0,n),"_cache",String(t.cached.length)]),t.cached.push(null))}}},Nh=(e,t)=>{if(e.type===1){for(let i of e.props)if(i.type===7&&i.name==="bind"&&(!i.exp||i.exp.type===4&&!i.exp.content.trim())&&i.arg){let n=i.arg;if(n.type===4&&n.isStatic){let s=we(n.content);(Td.test(s[0])||s[0]==="-")&&(i.exp=ae(s,!1,n.loc))}else t.onError(ye(53,n.loc)),i.exp=ae("",!0,n.loc)}}},Vd=Symbol(""),Hd=Symbol(""),Kd=Symbol(""),Qd=Symbol(""),Aa=Symbol(""),Wd=Symbol(""),Jd=Symbol(""),Gd=Symbol(""),Yd=Symbol(""),Xd=Symbol("");Object.getOwnPropertySymbols(dl={[Vd]:"vModelRadio",[Hd]:"vModelCheckbox",[Kd]:"vModelText",[Qd]:"vModelSelect",[Aa]:"vModelDynamic",[Wd]:"withModifiers",[Jd]:"withKeys",[Gd]:"vShow",[Yd]:"Transition",[Xd]:"TransitionGroup"}).forEach(e=>{cn[e]=dl[e]});var Eh={parseMode:"html",isVoidTag:zp,isNativeTag:e=>jp(e)||Up(e)||$p(e),isPreTag:e=>e==="pre",isIgnoreNewlineTag:e=>e==="pre"||e==="textarea",decodeEntities:function(e,t=!1){return Ui||(Ui=document.createElement("div")),t?(Ui.innerHTML=`<div foo="${e.replace(/"/g,"&quot;")}">`,Ui.children[0].getAttribute("foo")):(Ui.innerHTML=e,Ui.textContent)},isBuiltInComponent:e=>e==="Transition"||e==="transition"?Yd:e==="TransitionGroup"||e==="transition-group"?Xd:void 0,getNamespace(e,t,i){let n=t?t.ns:i;if(t&&n===2)if(t.tag==="annotation-xml"){if(e==="svg")return 1;t.props.some(s=>s.type===6&&s.name==="encoding"&&s.value!=null&&(s.value.content==="text/html"||s.value.content==="application/xhtml+xml"))&&(n=0)}else/^m(?:[ions]|text)$/.test(t.tag)&&e!=="mglyph"&&e!=="malignmark"&&(n=0);else t&&n===1&&(t.tag==="foreignObject"||t.tag==="desc"||t.tag==="title")&&(n=0);if(n===0){if(e==="svg")return 1;if(e==="math")return 2}return n}},Mh=yt("passive,once,capture"),Ih=yt("stop,prevent,self,ctrl,shift,alt,meta,exact,middle"),Rh=yt("left,right"),Ml=yt("onkeyup,onkeydown,onkeypress"),Il=(e,t)=>pt(e)&&e.content.toLowerCase()==="onclick"?ae(t,!0):e.type!==4?Nt(["(",e,`) === "onClick" ? "${t}" : (`,e,")"]):e,Oh=(e,t)=>{e.type===1&&e.tagType===0&&(e.tag==="script"||e.tag==="style")&&t.removeNode()},Ph=[e=>{e.type===1&&e.props.forEach((t,i)=>{let n,s;t.type===6&&t.name==="style"&&t.value&&(e.props[i]={type:7,name:"bind",arg:ae("style",!0,t.loc),exp:(n=t.value.content,s=t.loc,ae(JSON.stringify(Pl(n)),!1,s,3)),modifiers:[],loc:t.loc})})}],Bh={cloak:()=>({props:[]}),html:(e,t,i)=>{let{exp:n,loc:s}=e;return n||i.onError(ye(54,s)),t.children.length&&(i.onError(ye(55,s)),t.children.length=0),{props:[Be(ae("innerHTML",!0,s),n||ae("",!0))]}},text:(e,t,i)=>{let{exp:n,loc:s}=e;return n||i.onError(ye(56,s)),t.children.length&&(i.onError(ye(57,s)),t.children.length=0),{props:[Be(ae("textContent",!0),n?gt(n,i)>0?n:Fe(i.helperString(_r),[n],s):ae("",!0))]}},model:(e,t,i)=>{let n=zd(e,t,i);if(!n.props.length||t.tagType===1)return n;e.arg&&i.onError(ye(59,e.arg.loc));let{tag:s}=t,r=i.isCustomElement(s);if(s==="input"||s==="textarea"||s==="select"||r){let a=Kd,o=!1;if(s==="input"||r){let l=Sr(t,"type");if(l){if(l.type===7)a=Aa;else if(l.value)switch(l.value.content){case"radio":a=Vd;break;case"checkbox":a=Hd;break;case"file":o=!0,i.onError(ye(60,e.loc))}}else t.props.some(c=>c.type===7&&c.name==="bind"&&(!c.arg||c.arg.type!==4||!c.arg.isStatic))&&(a=Aa)}else s==="select"&&(a=Qd);o||(n.needRuntime=i.helper(a))}else i.onError(ye(58,e.loc));return n.props=n.props.filter(a=>a.key.type!==4||a.key.content!=="modelValue"),n},on:(e,t,i)=>$d(e,t,i,n=>{let{modifiers:s}=e;if(!s.length)return n;let{key:r,value:a}=n.props[0],{keyModifiers:o,nonKeyModifiers:l,eventOptionModifiers:c}=((d,p,u,w)=>{let g=[],_=[],A=[];for(let E=0;E<p.length;E++){let h=p[E].content;Mh(h)?A.push(h):Rh(h)?pt(d)?Ml(d.content.toLowerCase())?g.push(h):_.push(h):(g.push(h),_.push(h)):Ih(h)?_.push(h):g.push(h)}return{keyModifiers:g,nonKeyModifiers:_,eventOptionModifiers:A}})(r,s,0,e.loc);if(l.includes("right")&&(r=Il(r,"onContextmenu")),l.includes("middle")&&(r=Il(r,"onMouseup")),l.length&&(a=Fe(i.helper(Wd),[a,JSON.stringify(l)])),o.length&&(!pt(r)||Ml(r.content.toLowerCase()))&&(a=Fe(i.helper(Jd),[a,JSON.stringify(o)])),c.length){let d=c.map(Di).join("");r=pt(r)?ae(`${r.content}${d}`,!0):Nt(["(",r,`) + "${d}"`])}return{props:[Be(r,a)]}}),show:(e,t,i)=>{let{exp:n,loc:s}=e;return n||i.onError(ye(62,s)),{props:[],needRuntime:i.helper(Gd)}}},Rl=Object.create(null);function Lh(e,t){if(!ne(e))if(e.nodeType)e=e.innerHTML;else return He;let i=e+JSON.stringify(t,(o,l)=>typeof l=="function"?l.toString():l),n=Rl[i];if(n)return n;if(e[0]==="#"){let o=document.querySelector(e);e=o?o.innerHTML:""}let s=ce({hoistStatic:!0,onError:void 0,onWarn:He},t);!s.isCustomElement&&"u">typeof customElements&&(s.isCustomElement=o=>!!customElements.get(o));let{code:r}=function(o,l={}){return function(c,d={}){var p;let u,w=d.onError||ya,g=d.mode==="module";d.prefixIdentifiers===!0?w(ye(48)):g&&w(ye(49)),d.cacheHandlers&&w(ye(50)),d.scopeId&&!g&&w(ye(51));let _=ce({},d,{prefixIdentifiers:!1}),A=ne(c)?function(m,q){if(Re.reset(),Ge=null,ve=null,ht="",Ft=-1,_i=-1,Ce.length=0,Jt=m,_e=ce({},Id),q){let f;for(f in q)q[f]!=null&&(_e[f]=q[f])}Re.mode=_e.parseMode==="html"?1:2*(_e.parseMode==="sfc"),Re.inXML=_e.ns===1||_e.ns===2;let T=q&&q.delimiters;T&&(Re.delimiterOpen=er(T[0]),Re.delimiterClose=er(T[1]));let N=sr=function(f,y=""){return{type:0,source:y,children:f,helpers:new Set,components:[],directives:[],hoists:[],imports:[],cached:[],temps:0,codegenNode:void 0,loc:bt}}([],m);return Re.parse(Jt),N.loc=Ie(0,m.length),N.children=Od(N.children),sr=null,N}(c,_):c,[E,h]=[[Nh,Th,xh,Ah,wh,Sh,_h,kh,Ch],{on:$d,bind:qh,model:zd}];return u=function(m,{filename:q="",prefixIdentifiers:T=!1,hoistStatic:N=!1,hmr:f=!1,cacheHandlers:y=!1,nodeTransforms:v=[],directiveTransforms:k={},transformHoist:S=null,isBuiltInComponent:x=He,isCustomElement:I=He,expressionPlugins:R=[],scopeId:M=null,slotted:z=!0,ssr:B=!1,inSSR:V=!1,ssrCssVars:H="",bindingMetadata:X=de,inline:ie=!1,isTS:pe=!1,onError:me=ya,onWarn:xe=qd,compatConfig:Ve}){let tt=q.replace(/\?.*$/,"").match(/([^/\\]+)\.\w+$/),le={filename:q,selfName:tt&&Di(we(tt[1])),prefixIdentifiers:T,hoistStatic:N,hmr:f,cacheHandlers:y,nodeTransforms:v,directiveTransforms:k,transformHoist:S,isBuiltInComponent:x,isCustomElement:I,expressionPlugins:R,scopeId:M,slotted:z,ssr:B,inSSR:V,ssrCssVars:H,bindingMetadata:X,inline:ie,isTS:pe,onError:me,onWarn:xe,compatConfig:Ve,root:m,helpers:new Map,components:new Set,directives:new Set,hoists:[],imports:[],cached:[],constantCache:new WeakMap,vForMemoKeyedNodes:new WeakSet,temps:0,identifiers:Object.create(null),scopes:{vFor:0,vSlot:0,vPre:0,vOnce:0},parent:null,grandParent:null,currentNode:m,childIndex:0,inVOnce:!1,helper(se){let ke=le.helpers.get(se)||0;return le.helpers.set(se,ke+1),se},removeHelper(se){let ke=le.helpers.get(se);if(ke){let qe=ke-1;qe?le.helpers.set(se,qe):le.helpers.delete(se)}},helperString:se=>`_${cn[le.helper(se)]}`,replaceNode(se){le.parent.children[le.childIndex]=le.currentNode=se},removeNode(se){let ke=le.parent.children,qe=se?ke.indexOf(se):le.currentNode?le.childIndex:-1;se&&se!==le.currentNode?le.childIndex>qe&&(le.childIndex--,le.onNodeRemoved()):(le.currentNode=null,le.onNodeRemoved()),le.parent.children.splice(qe,1)},onNodeRemoved:He,addIdentifiers(se){},removeIdentifiers(se){},hoist(se){ne(se)&&(se=ae(se)),le.hoists.push(se);let ke=ae(`_hoisted_${le.hoists.length}`,!1,se.loc,2);return ke.hoisted=se,ke},cache(se,ke=!1,qe=!1){let b=function(C,O,$=!1,F=!1){return{type:20,index:C,value:O,needPauseTracking:$,inVOnce:F,needArraySpread:!1,loc:bt}}(le.cached.length,se,ke,qe);return le.cached.push(b),b}};return le}(A,p=ce({},_,{nodeTransforms:[...E,...d.nodeTransforms||[]],directiveTransforms:ce({},h,d.directiveTransforms||{})})),rr(A,u),p.hoistStatic&&function m(q,T,N,f=!1,y=!1){let{children:v}=q,k=[];for(let R=0;R<v.length;R++){let M=v[R];if(M.type===1&&M.tagType===0){let z=f?0:gt(M,N);if(z>0){if(z>=2){M.codegenNode.patchFlag=-1,k.push(M);continue}}else{let B=M.codegenNode;if(B.type===13){let V=B.patchFlag;if((V===void 0||V===512||V===1)&&Bd(M,N)>=2){let H=Ld(M);H&&(B.props=N.hoist(H))}B.dynamicProps&&(B.dynamicProps=N.hoist(B.dynamicProps))}}}else if(M.type===12&&(f?0:gt(M,N))>=2){M.codegenNode.type===14&&M.codegenNode.arguments.length>0&&M.codegenNode.arguments.push("-1"),k.push(M);continue}if(M.type===1){let z=M.tagType===1;z&&N.scopes.vSlot++,m(M,q,N,!1,y),z&&N.scopes.vSlot--}else if(M.type===11)m(M,q,N,M.children.length===1,!0);else if(M.type===9)for(let z=0;z<M.branches.length;z++)m(M.branches[z],q,N,M.branches[z].children.length===1,y)}let S=!1;if(k.length===v.length&&q.type===1){if(q.tagType===0&&q.codegenNode&&q.codegenNode.type===13&&J(q.codegenNode.children))q.codegenNode.children=x(Ei(q.codegenNode.children)),S=!0;else if(q.tagType===1&&q.codegenNode&&q.codegenNode.type===13&&q.codegenNode.children&&!J(q.codegenNode.children)&&q.codegenNode.children.type===15){let R=I(q.codegenNode,"default");R&&(R.returns=x(Ei(R.returns)),S=!0)}else if(q.tagType===3&&T&&T.type===1&&T.tagType===1&&T.codegenNode&&T.codegenNode.type===13&&T.codegenNode.children&&!J(T.codegenNode.children)&&T.codegenNode.children.type===15){let R=_t(q,"slot",!0),M=R&&R.arg&&I(T.codegenNode,R.arg);M&&(M.returns=x(Ei(M.returns)),S=!0)}}if(!S)for(let R of k)R.codegenNode=N.cache(R.codegenNode);function x(R){let M=N.cache(R);return M.needArraySpread=!0,M}function I(R,M){if(R.children&&!J(R.children)&&R.children.type===15){let z=R.children.properties.find(B=>B.key===M||B.key.content===M);return z&&z.value}}k.length&&N.transformHoist&&N.transformHoist(v,N,q)}(A,void 0,u,!!bl(A)),p.ssr||function(m,q){let{helper:T}=q,{children:N}=m;if(N.length===1){let f=bl(m);if(f&&f.codegenNode){let y=f.codegenNode;y.type===13&&uo(y,q),m.codegenNode=y}else m.codegenNode=N[0]}else N.length>1&&(m.codegenNode=Kn(q,T(Vn),void 0,m.children,64,void 0,void 0,!0,void 0,!1))}(A,u),A.helpers=new Set([...u.helpers.keys()]),A.components=[...u.components],A.directives=[...u.directives],A.imports=u.imports,A.hoists=u.hoists,A.temps=u.temps,A.cached=u.cached,A.transformed=!0,function(m,q={}){let T=function(B,{mode:V="function",prefixIdentifiers:H=V==="module",sourceMap:X=!1,filename:ie="template.vue.html",scopeId:pe=null,optimizeImports:me=!1,runtimeGlobalName:xe="Vue",runtimeModuleName:Ve="vue",ssrRuntimeModuleName:tt="vue/server-renderer",ssr:le=!1,isTS:se=!1,inSSR:ke=!1}){let qe={mode:V,prefixIdentifiers:H,sourceMap:X,filename:ie,scopeId:pe,optimizeImports:me,runtimeGlobalName:xe,runtimeModuleName:Ve,ssrRuntimeModuleName:tt,ssr:le,isTS:se,inSSR:ke,source:B.source,code:"",column:1,line:1,offset:0,indentLevel:0,pure:!1,map:void 0,helper:C=>`_${cn[C]}`,push(C,O=-2,$){qe.code+=C},indent(){b(++qe.indentLevel)},deindent(C=!1){C?--qe.indentLevel:b(--qe.indentLevel)},newline(){b(qe.indentLevel)}};function b(C){qe.push(`
`+"  ".repeat(C),0)}return qe}(m,q);q.onContextCreated&&q.onContextCreated(T);let{mode:N,push:f,prefixIdentifiers:y,indent:v,deindent:k,newline:S,ssr:x}=T,I=Array.from(m.helpers),R=I.length>0,M=!y&&N!=="module";(function(B,V){let{push:H,newline:X,runtimeGlobalName:ie}=V,pe=Array.from(B.helpers);if(pe.length>0&&(H(`const _Vue = ${ie}
`,-1),B.hoists.length)){let me=[pi,ui,is,to,wd].filter(xe=>pe.includes(xe)).map(yl).join(", ");H(`const { ${me} } = _Vue
`,-1)}(function(me,xe){if(!me.length)return;xe.pure=!0;let{push:Ve,newline:tt}=xe;tt();for(let le=0;le<me.length;le++){let se=me[le];se&&(Ve(`const _hoisted_${le+1} = `),st(se,xe),tt())}xe.pure=!1})(B.hoists,V),X(),H("return ")})(m,T);let z=(x?["_ctx","_push","_parent","_attrs"]:["_ctx","_cache"]).join(", ");if(f(`function ${x?"ssrRender":"render"}(${z}) {`),v(),M&&(f("with (_ctx) {"),v(),R&&(f(`const { ${I.map(yl).join(", ")} } = _Vue
`,-1),S())),m.components.length&&(xl(m.components,"component",T),(m.directives.length||m.temps>0)&&S()),m.directives.length&&(xl(m.directives,"directive",T),m.temps>0&&S()),m.temps>0){f("let ");for(let B=0;B<m.temps;B++)f(`${B>0?", ":""}_temp${B}`)}return(m.components.length||m.directives.length||m.temps)&&(f(`
`,0),S()),x||f("return "),m.codegenNode?st(m.codegenNode,T):f("null"),M&&(k(),f("}")),k(),f("}"),{ast:m,code:T.code,preamble:"",map:T.map?T.map.toJSON():void 0}}(A,_)}(o,ce({},Eh,l,{nodeTransforms:[Oh,...Ph,...l.nodeTransforms||[]],directiveTransforms:ce({},Bh,l.directiveTransforms||{}),transformHoist:null}))}(e,s),a=Function("Vue",r)(nh);return a._rc=!0,Rl[i]=a}Vc(Lh);var fn=function(e,t){let s=e,r=ss[t],a=null,o=0,l=null,c=[],d={},p=function(f,y){o=s*4+17,a=function(v){let k=new Array(v);for(let S=0;S<v;S+=1){k[S]=new Array(v);for(let x=0;x<v;x+=1)k[S][x]=null}return k}(o),u(0,0),u(o-7,0),u(0,o-7),_(),g(),E(f,y),s>=7&&A(f),l==null&&(l=q(s,r,c)),h(l,y)},u=function(f,y){for(let v=-1;v<=7;v+=1)if(!(f+v<=-1||o<=f+v))for(let k=-1;k<=7;k+=1)y+k<=-1||o<=y+k||(0<=v&&v<=6&&(k==0||k==6)||0<=k&&k<=6&&(v==0||v==6)||2<=v&&v<=4&&2<=k&&k<=4?a[f+v][y+k]=!0:a[f+v][y+k]=!1)},w=function(){let f=0,y=0;for(let v=0;v<8;v+=1){p(!0,v);let k=mi.getLostPoint(d);(v==0||f>k)&&(f=k,y=v)}return y},g=function(){for(let f=8;f<o-8;f+=1)a[f][6]==null&&(a[f][6]=f%2==0);for(let f=8;f<o-8;f+=1)a[6][f]==null&&(a[6][f]=f%2==0)},_=function(){let f=mi.getPatternPosition(s);for(let y=0;y<f.length;y+=1)for(let v=0;v<f.length;v+=1){let k=f[y],S=f[v];if(a[k][S]==null)for(let x=-2;x<=2;x+=1)for(let I=-2;I<=2;I+=1)x==-2||x==2||I==-2||I==2||x==0&&I==0?a[k+x][S+I]=!0:a[k+x][S+I]=!1}},A=function(f){let y=mi.getBCHTypeNumber(s);for(let v=0;v<18;v+=1){let k=!f&&(y>>v&1)==1;a[Math.floor(v/3)][v%3+o-8-3]=k}for(let v=0;v<18;v+=1){let k=!f&&(y>>v&1)==1;a[v%3+o-8-3][Math.floor(v/3)]=k}},E=function(f,y){let v=r<<3|y,k=mi.getBCHTypeInfo(v);for(let S=0;S<15;S+=1){let x=!f&&(k>>S&1)==1;S<6?a[S][8]=x:S<8?a[S+1][8]=x:a[o-15+S][8]=x}for(let S=0;S<15;S+=1){let x=!f&&(k>>S&1)==1;S<8?a[8][o-S-1]=x:S<9?a[8][15-S-1+1]=x:a[8][15-S-1]=x}a[o-8][8]=!f},h=function(f,y){let v=-1,k=o-1,S=7,x=0,I=mi.getMaskFunction(y);for(let R=o-1;R>0;R-=2)for(R==6&&(R-=1);;){for(let M=0;M<2;M+=1)if(a[k][R-M]==null){let z=!1;x<f.length&&(z=(f[x]>>>S&1)==1),I(k,R-M)&&(z=!z),a[k][R-M]=z,S-=1,S==-1&&(x+=1,S=7)}if(k+=v,k<0||o<=k){k-=v,v=-v;break}}},m=function(f,y){let v=0,k=0,S=0,x=new Array(y.length),I=new Array(y.length);for(let B=0;B<y.length;B+=1){let V=y[B].dataCount,H=y[B].totalCount-V;k=Math.max(k,V),S=Math.max(S,H),x[B]=new Array(V);for(let me=0;me<x[B].length;me+=1)x[B][me]=255&f.getBuffer()[me+v];v+=V;let X=mi.getErrorCorrectPolynomial(H),pe=rs(x[B],X.getLength()-1).mod(X);I[B]=new Array(X.getLength()-1);for(let me=0;me<I[B].length;me+=1){let xe=me+pe.getLength()-I[B].length;I[B][me]=xe>=0?pe.getAt(xe):0}}let R=0;for(let B=0;B<y.length;B+=1)R+=y[B].totalCount;let M=new Array(R),z=0;for(let B=0;B<k;B+=1)for(let V=0;V<y.length;V+=1)B<x[V].length&&(M[z]=x[V][B],z+=1);for(let B=0;B<S;B+=1)for(let V=0;V<y.length;V+=1)B<I[V].length&&(M[z]=I[V][B],z+=1);return M},q=function(f,y,v){let k=Zd.getRSBlocks(f,y),S=ep();for(let I=0;I<v.length;I+=1){let R=v[I];S.put(R.getMode(),4),S.put(R.getLength(),mi.getLengthInBits(R.getMode(),f)),R.write(S)}let x=0;for(let I=0;I<k.length;I+=1)x+=k[I].dataCount;if(S.getLengthInBits()>x*8)throw"code length overflow. ("+S.getLengthInBits()+">"+x*8+")";for(S.getLengthInBits()+4<=x*8&&S.put(0,4);S.getLengthInBits()%8!=0;)S.putBit(!1);for(;!(S.getLengthInBits()>=x*8||(S.put(236,8),S.getLengthInBits()>=x*8));)S.put(17,8);return m(S,k)};d.addData=function(f,y){y=y||"Byte";let v=null;switch(y){case"Numeric":v=Dh(f);break;case"Alphanumeric":v=Fh(f);break;case"Byte":v=jh(f);break;case"Kanji":v=Uh(f);break;default:throw"mode:"+y}c.push(v),l=null},d.isDark=function(f,y){if(f<0||o<=f||y<0||o<=y)throw f+","+y;return a[f][y]},d.getModuleCount=function(){return o},d.make=function(){if(s<1){let f=1;for(;f<40;f++){let y=Zd.getRSBlocks(f,r),v=ep();for(let S=0;S<c.length;S++){let x=c[S];v.put(x.getMode(),4),v.put(x.getLength(),mi.getLengthInBits(x.getMode(),f)),x.write(v)}let k=0;for(let S=0;S<y.length;S++)k+=y[S].dataCount;if(v.getLengthInBits()<=k*8)break}s=f}p(!1,w())},d.createTableTag=function(f,y){f=f||2,y=typeof y>"u"?f*4:y;let v="";v+='<table style="',v+=" border-width: 0px; border-style: none;",v+=" border-collapse: collapse;",v+=" padding: 0px; margin: "+y+"px;",v+='">',v+="<tbody>";for(let k=0;k<d.getModuleCount();k+=1){v+="<tr>";for(let S=0;S<d.getModuleCount();S+=1)v+='<td style="',v+=" border-width: 0px; border-style: none;",v+=" border-collapse: collapse;",v+=" padding: 0px; margin: 0px;",v+=" width: "+f+"px;",v+=" height: "+f+"px;",v+=" background-color: ",v+=d.isDark(k,S)?"#000000":"#ffffff",v+=";",v+='"/>';v+="</tr>"}return v+="</tbody>",v+="</table>",v},d.createSvgTag=function(f,y,v,k){let S={};typeof arguments[0]=="object"&&(S=arguments[0],f=S.cellSize,y=S.margin,v=S.alt,k=S.title),f=f||2,y=typeof y>"u"?f*4:y,v=typeof v=="string"?{text:v}:v||{},v.text=v.text||null,v.id=v.text?v.id||"qrcode-description":null,k=typeof k=="string"?{text:k}:k||{},k.text=k.text||null,k.id=k.text?k.id||"qrcode-title":null;let x=d.getModuleCount()*f+y*2,I,R,M,z,B="",V;for(V="l"+f+",0 0,"+f+" -"+f+",0 0,-"+f+"z ",B+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',B+=S.scalable?"":' width="'+x+'px" height="'+x+'px"',B+=' viewBox="0 0 '+x+" "+x+'" ',B+=' preserveAspectRatio="xMinYMin meet"',B+=k.text||v.text?' role="img" aria-labelledby="'+T([k.id,v.id].join(" ").trim())+'"':"",B+=">",B+=k.text?'<title id="'+T(k.id)+'">'+T(k.text)+"</title>":"",B+=v.text?'<description id="'+T(v.id)+'">'+T(v.text)+"</description>":"",B+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',B+='<path d="',M=0;M<d.getModuleCount();M+=1)for(z=M*f+y,I=0;I<d.getModuleCount();I+=1)d.isDark(M,I)&&(R=I*f+y,B+="M"+R+","+z+V);return B+='" stroke="transparent" fill="black"/>',B+="</svg>",B},d.createDataURL=function(f,y){f=f||2,y=typeof y>"u"?f*4:y;let v=d.getModuleCount()*f+y*2,k=y,S=v-y;return Hh(v,v,function(x,I){if(k<=x&&x<S&&k<=I&&I<S){let R=Math.floor((x-k)/f),M=Math.floor((I-k)/f);return d.isDark(M,R)?0:1}else return 1})},d.createImgTag=function(f,y,v){f=f||2,y=typeof y>"u"?f*4:y;let k=d.getModuleCount()*f+y*2,S="";return S+="<img",S+=' src="',S+=d.createDataURL(f,y),S+='"',S+=' width="',S+=k,S+='"',S+=' height="',S+=k,S+='"',v&&(S+=' alt="',S+=T(v),S+='"'),S+="/>",S};let T=function(f){let y="";for(let v=0;v<f.length;v+=1){let k=f.charAt(v);switch(k){case"<":y+="&lt;";break;case">":y+="&gt;";break;case"&":y+="&amp;";break;case'"':y+="&quot;";break;default:y+=k;break}}return y},N=function(f){f=typeof f>"u"?1*2:f;let v=d.getModuleCount()*1+f*2,k=f,S=v-f,x,I,R,M,z,B={"\u2588\u2588":"\u2588","\u2588 ":"\u2580"," \u2588":"\u2584","  ":" "},V={"\u2588\u2588":"\u2580","\u2588 ":"\u2580"," \u2588":" ","  ":" "},H="";for(x=0;x<v;x+=2){for(R=Math.floor((x-k)/1),M=Math.floor((x+1-k)/1),I=0;I<v;I+=1)z="\u2588",k<=I&&I<S&&k<=x&&x<S&&d.isDark(R,Math.floor((I-k)/1))&&(z=" "),k<=I&&I<S&&k<=x+1&&x+1<S&&d.isDark(M,Math.floor((I-k)/1))?z+=" ":z+="\u2588",H+=f<1&&x+1>=S?V[z]:B[z];H+=`
`}return v%2&&f>0?H.substring(0,H.length-v-1)+Array(v+1).join("\u2580"):H.substring(0,H.length-1)};return d.createASCII=function(f,y){if(f=f||1,f<2)return N(y);f-=1,y=typeof y>"u"?f*2:y;let v=d.getModuleCount()*f+y*2,k=y,S=v-y,x,I,R,M,z=Array(f+1).join("\u2588\u2588"),B=Array(f+1).join("  "),V="",H="";for(x=0;x<v;x+=1){for(R=Math.floor((x-k)/f),H="",I=0;I<v;I+=1)M=1,k<=I&&I<S&&k<=x&&x<S&&d.isDark(R,Math.floor((I-k)/f))&&(M=0),H+=M?z:B;for(R=0;R<f;R+=1)V+=H+`
`}return V.substring(0,V.length-1)},d.renderTo2dContext=function(f,y){y=y||2;let v=d.getModuleCount();for(let k=0;k<v;k++)for(let S=0;S<v;S++)f.fillStyle=d.isDark(k,S)?"black":"white",f.fillRect(S*y,k*y,y,y)},d};fn.stringToBytes=function(e){let t=[];for(let i=0;i<e.length;i+=1){let n=e.charCodeAt(i);t.push(n&255)}return t};fn.createStringToBytes=function(e,t){let i=function(){let s=zh(e),r=function(){let l=s.read();if(l==-1)throw"eof";return l},a=0,o={};for(;;){let l=s.read();if(l==-1)break;let c=r(),d=r(),p=r(),u=String.fromCharCode(l<<8|c),w=d<<8|p;o[u]=w,a+=1}if(a!=t)throw a+" != "+t;return o}(),n=63;return function(s){let r=[];for(let a=0;a<s.length;a+=1){let o=s.charCodeAt(a);if(o<128)r.push(o);else{let l=i[s.charAt(a)];typeof l=="number"?(l&255)==l?r.push(l):(r.push(l>>>8),r.push(l&255)):r.push(n)}}return r}};var et={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},ss={L:1,M:0,Q:3,H:2},hi={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},mi=function(){let e=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],t=1335,i=7973,n=21522,s={},r=function(a){let o=0;for(;a!=0;)o+=1,a>>>=1;return o};return s.getBCHTypeInfo=function(a){let o=a<<10;for(;r(o)-r(t)>=0;)o^=t<<r(o)-r(t);return(a<<10|o)^n},s.getBCHTypeNumber=function(a){let o=a<<12;for(;r(o)-r(i)>=0;)o^=i<<r(o)-r(i);return a<<12|o},s.getPatternPosition=function(a){return e[a-1]},s.getMaskFunction=function(a){switch(a){case hi.PATTERN000:return function(o,l){return(o+l)%2==0};case hi.PATTERN001:return function(o,l){return o%2==0};case hi.PATTERN010:return function(o,l){return l%3==0};case hi.PATTERN011:return function(o,l){return(o+l)%3==0};case hi.PATTERN100:return function(o,l){return(Math.floor(o/2)+Math.floor(l/3))%2==0};case hi.PATTERN101:return function(o,l){return o*l%2+o*l%3==0};case hi.PATTERN110:return function(o,l){return(o*l%2+o*l%3)%2==0};case hi.PATTERN111:return function(o,l){return(o*l%3+(o+l)%2)%2==0};default:throw"bad maskPattern:"+a}},s.getErrorCorrectPolynomial=function(a){let o=rs([1],0);for(let l=0;l<a;l+=1)o=o.multiply(rs([1,gi.gexp(l)],0));return o},s.getLengthInBits=function(a,o){if(1<=o&&o<10)switch(a){case et.MODE_NUMBER:return 10;case et.MODE_ALPHA_NUM:return 9;case et.MODE_8BIT_BYTE:return 8;case et.MODE_KANJI:return 8;default:throw"mode:"+a}else if(o<27)switch(a){case et.MODE_NUMBER:return 12;case et.MODE_ALPHA_NUM:return 11;case et.MODE_8BIT_BYTE:return 16;case et.MODE_KANJI:return 10;default:throw"mode:"+a}else if(o<41)switch(a){case et.MODE_NUMBER:return 14;case et.MODE_ALPHA_NUM:return 13;case et.MODE_8BIT_BYTE:return 16;case et.MODE_KANJI:return 12;default:throw"mode:"+a}else throw"type:"+o},s.getLostPoint=function(a){let o=a.getModuleCount(),l=0;for(let p=0;p<o;p+=1)for(let u=0;u<o;u+=1){let w=0,g=a.isDark(p,u);for(let _=-1;_<=1;_+=1)if(!(p+_<0||o<=p+_))for(let A=-1;A<=1;A+=1)u+A<0||o<=u+A||_==0&&A==0||g==a.isDark(p+_,u+A)&&(w+=1);w>5&&(l+=3+w-5)}for(let p=0;p<o-1;p+=1)for(let u=0;u<o-1;u+=1){let w=0;a.isDark(p,u)&&(w+=1),a.isDark(p+1,u)&&(w+=1),a.isDark(p,u+1)&&(w+=1),a.isDark(p+1,u+1)&&(w+=1),(w==0||w==4)&&(l+=3)}for(let p=0;p<o;p+=1)for(let u=0;u<o-6;u+=1)a.isDark(p,u)&&!a.isDark(p,u+1)&&a.isDark(p,u+2)&&a.isDark(p,u+3)&&a.isDark(p,u+4)&&!a.isDark(p,u+5)&&a.isDark(p,u+6)&&(l+=40);for(let p=0;p<o;p+=1)for(let u=0;u<o-6;u+=1)a.isDark(u,p)&&!a.isDark(u+1,p)&&a.isDark(u+2,p)&&a.isDark(u+3,p)&&a.isDark(u+4,p)&&!a.isDark(u+5,p)&&a.isDark(u+6,p)&&(l+=40);let c=0;for(let p=0;p<o;p+=1)for(let u=0;u<o;u+=1)a.isDark(u,p)&&(c+=1);let d=Math.abs(100*c/o/o-50)/5;return l+=d*10,l},s}(),gi=function(){let e=new Array(256),t=new Array(256);for(let n=0;n<8;n+=1)e[n]=1<<n;for(let n=8;n<256;n+=1)e[n]=e[n-4]^e[n-5]^e[n-6]^e[n-8];for(let n=0;n<255;n+=1)t[e[n]]=n;let i={};return i.glog=function(n){if(n<1)throw"glog("+n+")";return t[n]},i.gexp=function(n){for(;n<0;)n+=255;for(;n>=256;)n-=255;return e[n]},i}(),rs=function(e,t){if(typeof e.length>"u")throw e.length+"/"+t;let i=function(){let s=0;for(;s<e.length&&e[s]==0;)s+=1;let r=new Array(e.length-s+t);for(let a=0;a<e.length-s;a+=1)r[a]=e[a+s];return r}(),n={};return n.getAt=function(s){return i[s]},n.getLength=function(){return i.length},n.multiply=function(s){let r=new Array(n.getLength()+s.getLength()-1);for(let a=0;a<n.getLength();a+=1)for(let o=0;o<s.getLength();o+=1)r[a+o]^=gi.gexp(gi.glog(n.getAt(a))+gi.glog(s.getAt(o)));return rs(r,0)},n.mod=function(s){if(n.getLength()-s.getLength()<0)return n;let r=gi.glog(n.getAt(0))-gi.glog(s.getAt(0)),a=new Array(n.getLength());for(let o=0;o<n.getLength();o+=1)a[o]=n.getAt(o);for(let o=0;o<s.getLength();o+=1)a[o]^=gi.gexp(gi.glog(s.getAt(o))+r);return rs(a,0).mod(s)},n},Zd=function(){let e=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],t=function(s,r){let a={};return a.totalCount=s,a.dataCount=r,a},i={},n=function(s,r){switch(r){case ss.L:return e[(s-1)*4+0];case ss.M:return e[(s-1)*4+1];case ss.Q:return e[(s-1)*4+2];case ss.H:return e[(s-1)*4+3];default:return}};return i.getRSBlocks=function(s,r){let a=n(s,r);if(typeof a>"u")throw"bad rs block @ typeNumber:"+s+"/errorCorrectionLevel:"+r;let o=a.length/3,l=[];for(let c=0;c<o;c+=1){let d=a[c*3+0],p=a[c*3+1],u=a[c*3+2];for(let w=0;w<d;w+=1)l.push(t(p,u))}return l},i}(),ep=function(){let e=[],t=0,i={};return i.getBuffer=function(){return e},i.getAt=function(n){let s=Math.floor(n/8);return(e[s]>>>7-n%8&1)==1},i.put=function(n,s){for(let r=0;r<s;r+=1)i.putBit((n>>>s-r-1&1)==1)},i.getLengthInBits=function(){return t},i.putBit=function(n){let s=Math.floor(t/8);e.length<=s&&e.push(0),n&&(e[s]|=128>>>t%8),t+=1},i},Dh=function(e){let t=et.MODE_NUMBER,i=e,n={};n.getMode=function(){return t},n.getLength=function(a){return i.length},n.write=function(a){let o=i,l=0;for(;l+2<o.length;)a.put(s(o.substring(l,l+3)),10),l+=3;l<o.length&&(o.length-l==1?a.put(s(o.substring(l,l+1)),4):o.length-l==2&&a.put(s(o.substring(l,l+2)),7))};let s=function(a){let o=0;for(let l=0;l<a.length;l+=1)o=o*10+r(a.charAt(l));return o},r=function(a){if("0"<=a&&a<="9")return a.charCodeAt(0)-48;throw"illegal char :"+a};return n},Fh=function(e){let t=et.MODE_ALPHA_NUM,i=e,n={};n.getMode=function(){return t},n.getLength=function(r){return i.length},n.write=function(r){let a=i,o=0;for(;o+1<a.length;)r.put(s(a.charAt(o))*45+s(a.charAt(o+1)),11),o+=2;o<a.length&&r.put(s(a.charAt(o)),6)};let s=function(r){if("0"<=r&&r<="9")return r.charCodeAt(0)-48;if("A"<=r&&r<="Z")return r.charCodeAt(0)-65+10;switch(r){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+r}};return n},jh=function(e){let t=et.MODE_8BIT_BYTE,i=e,n=fn.stringToBytes(e),s={};return s.getMode=function(){return t},s.getLength=function(r){return n.length},s.write=function(r){for(let a=0;a<n.length;a+=1)r.put(n[a],8)},s},Uh=function(e){let t=et.MODE_KANJI,i=e,n=fn.stringToBytes;(function(a,o){let l=n(a);if(l.length!=2||(l[0]<<8|l[1])!=o)throw"sjis not supported."})("\u53CB",38726);let s=n(e),r={};return r.getMode=function(){return t},r.getLength=function(a){return~~(s.length/2)},r.write=function(a){let o=s,l=0;for(;l+1<o.length;){let c=(255&o[l])<<8|255&o[l+1];if(33088<=c&&c<=40956)c-=33088;else if(57408<=c&&c<=60351)c-=49472;else throw"illegal char at "+(l+1)+"/"+c;c=(c>>>8&255)*192+(c&255),a.put(c,13),l+=2}if(l<o.length)throw"illegal char at "+(l+1)},r},tp=function(){let e=[],t={};return t.writeByte=function(i){e.push(i&255)},t.writeShort=function(i){t.writeByte(i),t.writeByte(i>>>8)},t.writeBytes=function(i,n,s){n=n||0,s=s||i.length;for(let r=0;r<s;r+=1)t.writeByte(i[r+n])},t.writeString=function(i){for(let n=0;n<i.length;n+=1)t.writeByte(i.charCodeAt(n))},t.toByteArray=function(){return e},t.toString=function(){let i="";i+="[";for(let n=0;n<e.length;n+=1)n>0&&(i+=","),i+=e[n];return i+="]",i},t},$h=function(){let e=0,t=0,i=0,n="",s={},r=function(o){n+=String.fromCharCode(a(o&63))},a=function(o){if(o<0)throw"n:"+o;if(o<26)return 65+o;if(o<52)return 97+(o-26);if(o<62)return 48+(o-52);if(o==62)return 43;if(o==63)return 47;throw"n:"+o};return s.writeByte=function(o){for(e=e<<8|o&255,t+=8,i+=1;t>=6;)r(e>>>t-6),t-=6},s.flush=function(){if(t>0&&(r(e<<6-t),e=0,t=0),i%3!=0){let o=3-i%3;for(let l=0;l<o;l+=1)n+="="}},s.toString=function(){return n},s},zh=function(e){let t=e,i=0,n=0,s=0,r={};r.read=function(){for(;s<8;){if(i>=t.length){if(s==0)return-1;throw"unexpected end of file./"+s}let l=t.charAt(i);if(i+=1,l=="=")return s=0,-1;if(l.match(/^\s$/))continue;n=n<<6|a(l.charCodeAt(0)),s+=6}let o=n>>>s-8&255;return s-=8,o};let a=function(o){if(65<=o&&o<=90)return o-65;if(97<=o&&o<=122)return o-97+26;if(48<=o&&o<=57)return o-48+52;if(o==43)return 62;if(o==47)return 63;throw"c:"+o};return r},Vh=function(e,t){let i=e,n=t,s=new Array(e*t),r={};r.setPixel=function(c,d,p){s[d*i+c]=p},r.write=function(c){c.writeString("GIF87a"),c.writeShort(i),c.writeShort(n),c.writeByte(128),c.writeByte(0),c.writeByte(0),c.writeByte(0),c.writeByte(0),c.writeByte(0),c.writeByte(255),c.writeByte(255),c.writeByte(255),c.writeString(","),c.writeShort(0),c.writeShort(0),c.writeShort(i),c.writeShort(n),c.writeByte(0);let d=2,p=o(d);c.writeByte(d);let u=0;for(;p.length-u>255;)c.writeByte(255),c.writeBytes(p,u,255),u+=255;c.writeByte(p.length-u),c.writeBytes(p,u,p.length-u),c.writeByte(0),c.writeString(";")};let a=function(c){let d=c,p=0,u=0,w={};return w.write=function(g,_){if(g>>>_)throw"length over";for(;p+_>=8;)d.writeByte(255&(g<<p|u)),_-=8-p,g>>>=8-p,u=0,p=0;u=g<<p|u,p=p+_},w.flush=function(){p>0&&d.writeByte(u)},w},o=function(c){let d=1<<c,p=(1<<c)+1,u=c+1,w=l();for(let h=0;h<d;h+=1)w.add(String.fromCharCode(h));w.add(String.fromCharCode(d)),w.add(String.fromCharCode(p));let g=tp(),_=a(g);_.write(d,u);let A=0,E=String.fromCharCode(s[A]);for(A+=1;A<s.length;){let h=String.fromCharCode(s[A]);A+=1,w.contains(E+h)?E=E+h:(_.write(w.indexOf(E),u),w.size()<4095&&(w.size()==1<<u&&(u+=1),w.add(E+h)),E=h)}return _.write(w.indexOf(E),u),_.write(p,u),_.flush(),g.toByteArray()},l=function(){let c={},d=0,p={};return p.add=function(u){if(p.contains(u))throw"dup key:"+u;c[u]=d,d+=1},p.size=function(){return d},p.indexOf=function(u){return c[u]},p.contains=function(u){return typeof c[u]<"u"},p};return r},Hh=function(e,t,i){let n=Vh(e,t);for(let o=0;o<t;o+=1)for(let l=0;l<e;l+=1)n.setPixel(l,o,i(l,o));let s=tp();n.write(s);let r=$h(),a=s.toByteArray();for(let o=0;o<a.length;o+=1)r.writeByte(a[o]);return r.flush(),"data:image/gif;base64,"+r},ip=fn,vm=fn.stringToBytes;var qr=null;function np(e){qr=e}async function Kh(e,t){if(!qr||!qr.invoke)throw new Error("\u63D2\u4EF6\u8FD0\u884C\u65F6\u672A\u5C31\u7EEA");return await qr.invoke(e,t||{})}async function hn(e,t){let i=await Kh(e,t);return i&&typeof i=="object"&&"data"in i&&i.data!==null&&i.data!==void 0?i.data:i}var W=fi({ready:!1,err:"",uin:"",sessions:[],sid:"",msgs:[],loading:!1,loadingMore:!1,hasMore:!0,keyword:"",viewer:"",pageSize:50,cap:600,atBottom:!0});async function sp(){try{let e=await hn("qqbot.account.info");W.uin=String(e&&(e.uin||e.self_id)||"")}catch{}}async function mo(){W.err="";try{let e=await hn("qqbot.chat.sessions",{limit:200}),t=e&&e.items||[];W.sessions=t.filter(i=>i&&i.target_id),!W.sid&&W.sessions.length&&(W.sid=W.sessions[0].session_id),W.ready=!0}catch(e){W.err=String(e&&e.message||e)}}async function Cr(e){e&&(W.sid=e,W.msgs=[],W.hasMore=!0,W.atBottom=!0,await go(!1))}async function go(e){if(W.sid&&!(e&&(W.loadingMore||!W.hasMore))){e?W.loadingMore=!0:W.loading=!0;try{let t={session_id:W.sid,limit:W.pageSize};e&&W.msgs.length&&(t.before_id=W.msgs[0].id);let i=await hn("qqbot.chat.messages",t),n=i&&i.items||[];e?(W.msgs=n.concat(W.msgs),W.msgs.length>W.cap&&(W.msgs=W.msgs.slice(-W.cap))):W.msgs=n,W.hasMore=n.length>=W.pageSize}catch(t){W.err=String(t&&t.message||t)}finally{W.loading=!1,W.loadingMore=!1}}}function rp(){return W.sessions.find(e=>e.session_id===W.sid)||null}function ap(e){if(!e)return!1;if(e.role==="assistant")return!0;let t=String(e.sender_id||"");return!!(W.uin&&t&&t===W.uin)}var Qh=0;async function vo(e,t="",i=null,n=null){let s=String(e||""),r=n&&n.length?n:s.trim()?[{type:"text",data:{text:s}}]:[];if(!W.sid||!r.length)return;let a={id:"tmp-"+ ++Qh+"-"+Date.now(),created_at:Math.floor(Date.now()/1e3),sender_id:W.uin,sender_name:"",role:"assistant",segs:r,text:s,media:[],recalled:0,_pending:!0,_text:s};W.msgs.push(a);try{let o={session_id:W.sid,text:s};n&&n.length&&(o.segs=n),t&&(o.reply_id=String(t));let l=await hn("qqbot.chat.send",o);l&&i&&t&&(l.quote=i);let c=W.msgs.findIndex(d=>d.id===a.id);return c>=0&&l&&l.id?W.msgs.splice(c,1,l):c>=0&&(W.msgs[c]._pending=!1,W.msgs[c]._failed=!0),l}catch(o){let l=W.msgs.find(c=>c.id===a.id);throw l&&(l._pending=!1,l._failed=!0,l._err=String(o&&o.message||o)),o}}async function op(e){let t=W.msgs.findIndex(n=>n.id===(e&&e.id)),i=e&&(e._text||e.text)||"";return t>=0&&W.msgs.splice(t,1),vo(i)}var lp="rcq.im.read";function cp(){try{return JSON.parse(localStorage.getItem(lp)||"{}")||{}}catch{return{}}}function bo(e){return Number(cp()[e]||0)}function dp(e,t){if(!e||!t)return;let i=cp();if(!(Number(i[e]||0)>=Number(t))){i[e]=Number(t);try{localStorage.setItem(lp,JSON.stringify(i))}catch{}}}var pp=e=>e<10?"0"+e:""+e;function Ar(e){if(!e)return"";let t=new Date(e*1e3);return pp(t.getHours())+":"+pp(t.getMinutes())}function Tr(e){let t=new Date(e);return t.setHours(0,0,0,0),t.getTime()}function up(e){if(!e)return"";let t=new Date(e*1e3),i=Tr(Date.now()),n=Tr(t),s=Math.round((i-n)/864e5);return s===0?Ar(e):s===1?"\u6628\u5929":t.getFullYear()===new Date().getFullYear()?t.getMonth()+1+"\u6708"+t.getDate()+"\u65E5":t.getFullYear()+"/"+(t.getMonth()+1)+"/"+t.getDate()}function fp(e){if(!e)return"";let t=new Date(e*1e3),i=Math.round((Tr(Date.now())-Tr(t))/864e5),n=Ar(e);return i===0?n:i===1?"\u6628\u5929 "+n:(t.getFullYear()===new Date().getFullYear()?t.getMonth()+1+"\u6708"+t.getDate()+"\u65E5 ":t.getFullYear()+"\u5E74"+(t.getMonth()+1)+"\u6708"+t.getDate()+"\u65E5 ")+n}function Nr(e){if(!e)return"";let t=e.abs||(e.rel?"/opt/rcbot/media/"+e.rel:"");return t?"/api/fm/preview?path="+encodeURIComponent(t):""}function mn(e){return!e||!e.local?!1:e.exists!==0}function as(e){let t=String(e||"").trim();return/^\d+$/.test(t)?"https://qzonestyle.gtimg.cn/qzone/em/e"+t+".gif":""}function hp(e){return e=Number(e)||0,e>=1073741824?(e/1073741824).toFixed(2)+" GB":e>=1048576?(e/1048576).toFixed(1)+" MB":e>=1024?(e/1024).toFixed(0)+" KB":e+" B"}function mp(e){return e=Number(e)||0,e>=1e8?(e/1e8).toFixed(1)+"\u4EBF":e>=1e4?(e/1e4).toFixed(1)+"\u4E07":String(e)}function gp(e){let t=Array.isArray(e&&e.segs)?e.segs:[],i=[],n="",s=!1;for(let a of t){let o=a&&a.type,l=a&&a.data||{};if(o){if(o==="reply"){n=l.text||"[\u5F15\u7528\u4E86\u4E00\u6761\u6D88\u606F]";continue}switch(o){case"text":l.text&&i.push({t:"text",v:l.text});break;case"at":i.push({t:"at",v:l.qq==="all"?"@\u5168\u4F53\u6210\u5458":"@"+(l.name||l.qq||"\u67D0\u4EBA")});break;case"face":i.push({t:"face",v:l.id});break;case"markdown":i.push({t:"text",v:l.content||"[Markdown \u6D88\u606F]"});break;case"image":case"video":case"record":case"file":case"mface":case"json":case"xml":case"forward":case"node":case"location":case"contact":case"music":case"rps":case"dice":case"shake":case"poke":break;default:i.push({t:"unknown",name:o});break}}}let r=Array.isArray(e&&e.media)?e.media:[];return!i.length&&!r.length&&e&&e.text&&i.push({t:"text",v:e.text}),!i.length&&!r.length&&e&&e.text&&i.push({t:"text",v:e.text}),e&&e.role==="system"&&(s=!0),{quote:n,parts:i,system:s}}function vp(e){let t={image:[],video:[],record:[],file:[],face:[],other:[]};for(let i of e||[]){if(!i||!i.local)continue;let n=i.kind==="mface"?"face":i.kind;(t[n]||t.other).push(i)}return t}function bp(e){return e<=1?"g1":e===2||e===4?"g2":"g3"}function yp(e){let t=Math.max(1,Math.min(60,Number(e)||1));return Math.round(96+t*3.2)}function xp(e){let t=Number(e&&e.bytes||0);return t?Math.max(1,Math.min(60,Math.round(t/3e3))):2}var vi=null;function Wh(e){for(let t of e||[]){let i=t&&t.type,n=t&&t.data||{};if(i==="json")try{let s=JSON.parse(n.data),r=s.meta||{},a=s.prompt||r.detail&&r.detail.title||r.news&&r.news.title||"\u5361\u7247\u6D88\u606F",o=r.detail&&r.detail.desc||r.desc||"",l=r.news&&r.news.jumpUrl||r.detail&&r.detail.qqdocurl||"";return{kind:"card",title:a,desc:o,jump:l}}catch{return{kind:"card",title:"\u5361\u7247\u6D88\u606F",desc:"",jump:""}}if(i==="xml")return{kind:"card",title:"\u5361\u7247\u6D88\u606F",desc:String(n.data||"").slice(0,90),jump:""};if(i==="forward"||i==="node")return{kind:"forward",title:"\u5408\u5E76\u8F6C\u53D1",desc:"\u70B9\u51FB\u67E5\u770B\uFF08\u4E0B\u4E00\u9636\u6BB5\u652F\u6301\u5C55\u5F00\uFF09",jump:""}}return null}var Jh={props:{m:Object,me:Boolean},data(){return{playing:!1}},computed:{sec(){return xp(this.m)},w(){return yp(this.sec)},src(){return Nr(this.m)},bars(){let e=this.sec,t=Math.max(6,Math.min(22,Math.round(e*1.6))),i=[];for(let n=0;n<t;n++)i.push(6+Math.round(Math.abs(Math.sin(n*1.7+e))*12));return i}},beforeUnmount(){this.stop()},methods:{stop(){if(vi)try{vi.pause()}catch{}this.playing=!1},toggle(){if(this.src){if(this.playing){this.stop();return}if(vi)try{vi.pause()}catch{}vi=new Audio(this.src),vi.onended=()=>{this.playing=!1},vi.onerror=()=>{this.playing=!1},vi.play().then(()=>{this.playing=!0}).catch(()=>{this.playing=!1})}}},template:`
  <div class="im-voice" :style="{ width: w + 'px' }" @click="toggle" :title="playing ? '\u505C\u6B62' : '\u64AD\u653E\u8BED\u97F3'">
    <span class="wave">
      <i v-for="(h,i) in bars" :key="i" :style="{ height: h + 'px', opacity: playing ? .95 : .5 }"></i>
    </span>
    <span class="sec">{{ sec }}"</span>
  </div>`},wp={components:{ImVoice:Jh},props:{m:Object,compact:Boolean,showTime:String},data(){return{viewer:"",badAva:!1}},computed:{me(){return ap(this.m)},recalled(){return!!this.m.recalled},parsed(){return gp(this.m)},parts(){return this.parsed.parts},quote(){let e=this.m&&this.m.quote;return e&&(e.sender||e.text)?(e.sender?e.sender+"\uFF1A":"")+(e.text||"[\u6D88\u606F]"):this.parsed.quote},media(){return this.m.media||[]},groups(){return vp(this.media)},card(){return Wh(this.m.segs)},hasMedia(){return!!(this.groups.image.length||this.groups.video.length||this.groups.record.length||this.groups.file.length)},mediaOnly(){return!this.quote&&!this.parts.filter(e=>e.t!=="face").length&&this.hasMedia},name(){return this.m.sender_name||this.m.sender_id||"\u672A\u77E5"},avatar(){if(this.m.sender_avatar)return this.m.sender_avatar;let e=String(this.m.sender_id||"");return/^\d{5,12}$/.test(e)?"https://q1.qlogo.cn/g?b=qq&nk="+e+"&s=100":""},time(){return Ar(this.m.created_at)},initial(){return String(this.name||"?").trim().slice(0,1)},showAva(){return!!this.avatar&&!this.badAva},canRecall(){return this.me&&!this.m._pending&&!this.m._failed&&!!this.m.msg_id},images(){return this.groups.image.filter(mn)},videos(){return this.groups.video.filter(mn)},voices(){return this.groups.record.filter(mn)},files(){return this.groups.file.filter(mn)}},methods:{faceUrl:as,mediaUrl:Nr,bytes:hp,gridCls:bp,mediaAlive:mn,openImg(e){this.viewer=Nr(e)},faceErr(e){let t=e&&e.target;t&&(t.style.visibility="hidden")}},template:`
  <div>
    <div class="im-time" v-if="showTime">{{ showTime }}</div>
    <div class="im-msg" :class="{ me: me, compact: compact }" :data-mid="m.id"
      :data-msgid="m.msg_id || ''"
      @contextmenu.prevent="$emit('ctx', $event, m)">
      <div class="ava" :class="{ ph: compact }">
        <img v-if="showAva && !compact" :src="avatar" alt="" @error="badAva = true" />
        <div v-else-if="!compact" class="ava-t">{{ initial }}</div>
      </div>
      <div class="col">
        <div class="who" v-if="!compact && !me">{{ name }}</div>

        <div class="im-bub" :class="{ media: mediaOnly }">
          <div class="im-recall" v-if="recalled">\u8BE5\u6D88\u606F\u5DF2\u88AB\u64A4\u56DE</div>
          <template v-else>
            <div class="im-quote" v-if="quote" :title="quote"
              @click.stop="$emit('jump', m.quote && m.quote.msg_id)">{{ quote }}</div>

            <div v-if="card" class="im-card">
              <div class="ct">{{ card.title }}</div>
              <div class="cd" v-if="card.desc">{{ card.desc }}</div>
            </div>

            <span v-for="(p,i) in parts" :key="i">
              <span v-if="p.t === 'text'">{{ p.v }}</span>
              <span v-else-if="p.t === 'at'" class="at">{{ p.v }}</span>
              <img v-else-if="p.t === 'face'" class="face" :src="faceUrl(p.v)" alt="[\u8868\u60C5]" @error="faceErr" />
              <span v-else class="im-unk">[{{ p.name }}]</span>
            </span>
          </template>
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
          <button class="im-op" title="\u5F15\u7528" @click.stop="$emit('quote', m)">\u5F15\u7528</button>
          <button class="im-op" title="\u590D\u5236\u6587\u5B57" @click.stop="$emit('copy', m)">\u590D\u5236</button>
          <button class="im-op" v-if="canRecall" title="\u64A4\u56DE" @click.stop="$emit('recall', m)">\u64A4\u56DE</button>
        </div>

        <div class="im-meta" v-if="!compact">
          <span v-if="m._pending">\u53D1\u9001\u4E2D\u2026</span>
          <span v-else-if="m._failed" class="im-st-bad" title="\u70B9\u51FB\u91CD\u53D1"
            @click="$emit('retry', m)">\u53D1\u9001\u5931\u8D25\uFF0C\u70B9\u51FB\u91CD\u8BD5</span>
          <span v-else>{{ time }}</span>
        </div>
      </div>
    </div>

    <div class="im-viewer" v-if="viewer" @click.self="viewer = ''">
      <button class="x" @click="viewer = ''">\xD7</button>
      <img :src="viewer" alt="" />
    </div>
  </div>`};var Gh=[{id:"im",title:"\u6D88\u606F",d:"M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-4 4V16H6.5A2.5 2.5 0 014 13.5v-8z"},{id:"contacts",title:"\u8054\u7CFB\u4EBA",d:"M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8a8 8 0 0116 0v1H4v-1z"},{id:"star",title:"\u6536\u85CF",d:"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"}],kp={components:{ImMessageRow:wp},props:{},data(){return{S:W,rail:"im",railItems:Gh,showJump:!1,dragging:!1,sideWidth:268,badAva:{},sending:!1,menu:null,quote:null,readAt:0,toastMsg:"",showFace:!1,showAt:!1,faceIds:Array.from({length:200},(e,t)=>t),canSend:!1}},computed:{cur(){return rp()},filtered(){let e=(W.keyword||"").trim().toLowerCase();return e?W.sessions.filter(t=>(t.display||"").toLowerCase().includes(e)||String(t.target_id||"").includes(e)):W.sessions},rows(){let e=[],t=0,i="",n=!1;for(let s of W.msgs){if(!s)continue;let r=String(s.text||""),a=s.role==="system"||!(s.segs||[]).length&&r.indexOf("\u64A4\u56DE")>=0,o=s.created_at-t,l=!t||o>300?fp(s.created_at):"";if(a){e.push({type:"sys",key:"s"+s.id,text:r||"\u4E00\u6761\u6D88\u606F\u88AB\u64A4\u56DE"}),t=s.created_at,i="";continue}let c=String(s.sender_id||s.role||""),d=!l&&c===i&&o<300,p={type:"msg",key:s.id,m:s,compact:d,showTime:l};!n&&this.readAt&&Number(s.id)>this.readAt&&(p.divider=!0,n=!0),e.push(p),t=s.created_at,i=c}return e},total(){return this.cur&&this.cur.msg_count||W.msgs.length},people(){let e=new Map;for(let t of W.msgs){let i=String(t.sender_id||"");!i||i===W.uin||e.has(i)||e.set(i,{id:i,name:t.sender_name||i,avatar:t.sender_avatar||""})}return[...e.values()].slice(0,30)}},async mounted(){await sp(),await mo(),W.sid&&(await Cr(W.sid),this.readAt=bo(W.sid),this.$nextTick(()=>this.loadDraft(W.sid)),this.scheduleRead()),this.$nextTick(()=>this.toBottom(!1)),window.addEventListener("keydown",this.onKey),window.addEventListener("click",this.closeMenu),document.documentElement.style.overflow="hidden"},beforeUnmount(){window.removeEventListener("keydown",this.onKey),window.removeEventListener("click",this.closeMenu),document.documentElement.style.overflow=""},methods:{fmtListTime:up,fmtNum:mp,onKey(e){e.key==="Escape"&&(e.stopPropagation(),this.close())},close(){this.$emit("close")},faceUrl:as,toggleFace(){this.showFace=!this.showFace,this.showFace&&(this.showAt=!1)},toggleAt(){this.showAt=!this.showAt,this.showAt&&(this.showFace=!1)},hasContent(){let e=this.$refs.editor;return e?!!String(e.innerText||"").replace(/[\u200b\s]/g,"")||!!e.querySelector("img[data-face]"):!1},onInput(){this.canSend=this.hasContent(),clearTimeout(this._dt),this._dt=setTimeout(()=>this.saveDraft(),300)},onPaste(e){e.preventDefault();let t=(e.clipboardData||window.clipboardData).getData("text")||"";document.execCommand("insertText",!1,t)},insertNode(e){let t=this.$refs.editor;if(!t)return;t.focus();let i=window.getSelection();if(i&&i.rangeCount&&t.contains(i.anchorNode)){let n=i.getRangeAt(0);n.deleteContents(),n.insertNode(e),n.setStartAfter(e),n.collapse(!0),i.removeAllRanges(),i.addRange(n)}else t.appendChild(e);this.onInput()},addFace(e){let t=document.createElement("img");t.className="face",t.setAttribute("data-face",String(e)),t.src=as(e),t.alt="[\u8868\u60C5]",this.insertNode(t)},addAt(e){let t=document.createElement("span");t.className="at-chip",t.setAttribute("data-at",String(e.id)),t.setAttribute("data-name",e.name||""),t.textContent="@"+(e.name||e.id);let i=document.createTextNode("\xA0");this.insertNode(t),this.insertNode(i),this.showAt=!1},serialize(){let e=this.$refs.editor,t=[],i="",n=()=>{i&&(t.push({type:"text",data:{text:i}}),i="")},s=r=>{for(let a of r.childNodes){if(a.nodeType===3){i+=a.textContent;continue}if(a.nodeType!==1)continue;let o=a.dataset||{};o.face?(n(),t.push({type:"face",data:{id:String(o.face)}})):o.at?(n(),t.push({type:"at",data:{qq:String(o.at),name:o.name||""}})):a.tagName==="BR"?i+=`
`:a.tagName==="DIV"||a.tagName==="P"?(s(a),i+=`
`):s(a)}};return e&&s(e),n(),t.length&&t[t.length-1].type==="text"&&(t[t.length-1].data.text=t[t.length-1].data.text.replace(/\n+$/,""),t[t.length-1].data.text||t.pop()),t},clearEditor(){let e=this.$refs.editor;e&&(e.innerHTML=""),this.canSend=!1,this.saveDraft()},saveDraft(){let e=this.$refs.editor,t=W.sid;if(!(!e||!t))try{let i=e.innerHTML;i&&i!=="<br>"?localStorage.setItem("rcq.im.draft."+t,i):localStorage.removeItem("rcq.im.draft."+t)}catch{}},loadDraft(e){let t=this.$refs.editor;if(!t)return;let i="";try{i=localStorage.getItem("rcq.im.draft."+e)||""}catch{}t.innerHTML=i,this.canSend=this.hasContent()},async onSend(){let e=this.serialize();if(!e.length||!this.cur||this.sending)return;let t=e.filter(n=>n.type==="text").map(n=>n.data.text).join("").trim(),i=this.quote;this.quote=null,this.sending=!0,this.clearEditor();try{await vo(t,i&&i.msg_id,i,e)}catch{}finally{this.sending=!1,this.$nextTick(()=>this.toBottom(!0))}},onKeydown(e){if(e.key==="Escape"){this.showFace=!1,this.showAt=!1;return}e.key==="Enter"&&!e.shiftKey&&!e.isComposing&&(e.preventDefault(),this.onSend())},closeMenu(){this.menu=null},openCtx(e,t){this.menu={x:e.clientX,y:e.clientY,m:t}},canRecall(e){return!!(e&&e.msg_id&&e.role==="assistant"&&!e.recalled)},copyMsg(e){let t=String(e&&(e.text||(e.segs||[]).map(i=>(i.data||{}).text||"").join(""))||"");try{navigator.clipboard.writeText(t),this.toast("\u5DF2\u590D\u5236")}catch{this.toast("\u590D\u5236\u5931\u8D25\uFF08\u6D4F\u89C8\u5668\u4E0D\u5141\u8BB8\uFF09")}this.menu=null},quoteMsg(e){let t=String(e&&(e.text||"")||"").slice(0,60),i=e&&e.sender_name||"";this.quote={msg_id:e.msg_id,sender:i,text:t},this.menu=null},async doRecall(e){if(this.menu=null,!(!e||!e.msg_id))try{await hn("qqbot.chat.recall",{msg_id:e.msg_id}),e.recalled=1,this.toast("\u5DF2\u64A4\u56DE")}catch(t){this.toast(String(t&&t.message||t))}},jump(e){let t=String(e||"");if(!t)return;let i=t.replace(/"/g,'\\"'),n=document.querySelector('.rcq-im [data-msgid="'+i+'"]')||document.querySelector('.rcq-im [data-mid="'+i+'"]');if(!n){this.toast("\u88AB\u5F15\u7528\u7684\u6D88\u606F\u4E0D\u5728\u5F53\u524D\u9875");return}n.scrollIntoView({block:"center",behavior:"smooth"}),n.classList.add("im-flash"),setTimeout(()=>n.classList.remove("im-flash"),1200)},toast(e){this.toastMsg=String(e||""),clearTimeout(this._tt),this._tt=setTimeout(()=>{this.toastMsg=""},1800)},scheduleRead(){clearTimeout(this._rt),this._rt=setTimeout(()=>{W.msgs.length&&dp(W.sid,W.msgs[W.msgs.length-1].id)},1200)},async onRetry(e){try{await op(e)}catch{}this.$nextTick(()=>this.toBottom(!0))},avatarOf(e){return e&&e.avatar?e.avatar:""},initialOf(e){return String(e&&(e.display||e.target_id)||"?").trim().slice(0,1)},pick(e){!e||e.session_id===W.sid||(this.saveDraft(),this.quote=null,this.showFace=!1,this.showAt=!1,Cr(e.session_id).then(()=>{this.readAt=bo(e.session_id),this.$nextTick(()=>{this.toBottom(!1),this.loadDraft(e.session_id)}),this.scheduleRead()}))},toBottom(e=!0){let t=this.$refs.flow;t&&(t.scrollTo({top:t.scrollHeight,behavior:e?"smooth":"auto"}),W.atBottom=!0,this.showJump=!1)},async onScroll(){let e=this.$refs.flow;if(!e)return;let t=e.scrollHeight-e.scrollTop-e.clientHeight<40;if(W.atBottom=t,this.showJump=!t,e.scrollTop<160&&W.hasMore&&!W.loadingMore){let i=e.scrollHeight,n=e.scrollTop;await go(!0),this.$nextTick(()=>{let s=this.$refs.flow;s&&(s.scrollTop=s.scrollHeight-i+n)})}},async reload(){await mo(),W.sid&&(await Cr(W.sid),this.$nextTick(()=>this.toBottom(!1)))}},template:`
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
          <input v-model="S.keyword" placeholder="\u641C\u7D22" />
        </div>
        <button class="im-ico" title="\u5237\u65B0\u4F1A\u8BDD" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
      </div>
      <div class="im-list">
        <div class="im-row" v-for="s in filtered" :key="s.session_id"
          :class="{ on: s.session_id === S.sid }" @click="pick(s)">
          <div class="ava">
            <img v-if="avatarOf(s) && !badAva[s.session_id]" :src="avatarOf(s)" alt=""
              @error="badAva[s.session_id] = true" />
            <div v-else class="ava-t">{{ initialOf(s) }}</div>
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
        <button class="im-ico" title="\u5237\u65B0" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
        <button class="im-ico" title="\u5173\u95ED\uFF08Esc\uFF09" @click="close">
          <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
        </button>
      </div>

      <div class="im-flow" ref="flow" @scroll="onScroll">
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
              @retry="onRetry" @ctx="openCtx" @copy="copyMsg" @quote="quoteMsg"
              @recall="doRecall" @jump="jump" />
          </template>
        </template>
      </div>

      <button class="im-jump" v-if="showJump" title="\u56DE\u5230\u6700\u65B0" @click="toBottom(true)">
        <svg viewBox="0 0 24 24"><path d="M12 16l-6-6 1.4-1.4L12 13.2l4.6-4.6L18 10l-6 6z"/></svg>
      </button>

      <!-- \u8F93\u5165\u533A\uFF1AP1 \u53EA\u8BFB\uFF0C\u53D1\u9001\u80FD\u529B\u4E0B\u4E00\u9636\u6BB5\u63A5\u5165 -->
      <div class="im-composer">
        <div class="im-tools">
          <button class="im-tool" :class="{ on: showFace }" title="\u8868\u60C5"
            @click="toggleFace">
            <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-3.5 7a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM12 18c-2.2 0-4.1-1.3-5-3h10c-.9 1.7-2.8 3-5 3z"/></svg>
          </button>
          <button class="im-tool" :class="{ on: showAt }" title="@ \u67D0\u4EBA"
            @click="toggleAt" :disabled="!cur">@</button>
          <button class="im-tool" title="\u56FE\u7247\uFF08\u5F85\u63A5\u5165\u4E0A\u4F20\u63A5\u53E3\uFF09" disabled>
            <svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v9l4-4 3 3 3-4 4 5V7H5zm3 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/></svg>
          </button>
        </div>
        <div class="im-quote-bar" v-if="quote">
          <span class="qq">\u5F15\u7528 {{ quote.sender || '\u6D88\u606F' }}\uFF1A{{ quote.text }}</span>
          <button class="qx" title="\u53D6\u6D88\u5F15\u7528" @click="quote = null">\xD7</button>
        </div>
        <div class="im-editor" ref="editor" contenteditable="true"
          :data-ph="cur ? '\u8F93\u5165\u6D88\u606F\uFF0CEnter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C' : '\u5148\u5728\u5DE6\u8FB9\u9009\u4E00\u4E2A\u4F1A\u8BDD'"
          @input="onInput" @keydown="onKeydown" @paste="onPaste"></div>
        <div class="im-send">
          <span class="hint">{{ cur ? 'Enter \u53D1\u9001 \xB7 Shift+Enter \u6362\u884C' : '' }}</span>
          <button class="im-btn-send" :disabled="!canSend || !cur || sending"
            @click="onSend">{{ sending ? '\u53D1\u9001\u4E2D\u2026' : '\u53D1\u9001' }}</button>
        </div>

        <!-- \u8868\u60C5\u9762\u677F -->
        <div class="im-facepanel" v-if="showFace" @click.stop>
          <div class="im-facegrid">
            <img v-for="id in faceIds" :key="id" :src="faceUrl(id)" loading="lazy"
              :alt="'\u8868\u60C5' + id" @click="addFace(id)" />
          </div>
        </div>

        <!-- @ \u9009\u62E9\u5668 -->
        <div class="im-atpanel" v-if="showAt" @click.stop>
          <div class="im-atrow" v-for="p in people" :key="p.id" @click="addAt(p)">
            <img v-if="p.avatar" :src="p.avatar" alt="" />
            <div v-else class="ava-t">{{ (p.name || '?').slice(0, 1) }}</div>
            <span class="nm">{{ p.name || p.id }}</span>
            <span class="qq">{{ p.id }}</span>
          </div>
          <div class="im-empty" v-if="!people.length">\u672C\u4F1A\u8BDD\u6CA1\u6709\u53EF @ \u7684\u4EBA</div>
        </div>
      </div>
    </div>

    <div class="im-menu" v-if="menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop>
      <button @click="copyMsg(menu.m)">\u590D\u5236\u6587\u5B57</button>
      <button @click="quoteMsg(menu.m)">\u5F15\u7528</button>
      <button v-if="canRecall(menu.m)" @click="doRecall(menu.m)">\u64A4\u56DE</button>
    </div>

    <div class="im-toast" v-if="toastMsg">{{ toastMsg }}</div>
  </div>`};var _p="rcq-im-style",Yh=`
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
.im-row .ava{width:40px;height:40px;border-radius:8px;overflow:hidden;background:var(--im-active);flex:none}
.im-row .ava img{width:100%;height:100%;object-fit:cover;display:block}
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
.im-meta{font-size:11px;color:var(--im-t3);margin-top:3px;padding:0 2px}
.im-st-bad{color:#f5534f;cursor:pointer}

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

.im-composer{position:relative;flex:none;border-top:1px solid var(--im-line);background:var(--im-input);
  padding:6px 14px 10px;display:flex;flex-direction:column;gap:6px}
.im-tools{display:flex;gap:4px;align-items:center;color:var(--im-t2)}
.im-tool{width:28px;height:28px;border-radius:6px;border:none;background:none;color:inherit;
  cursor:pointer;display:flex;align-items:center;justify-content:center}
.im-tool:hover{background:var(--im-hover);color:var(--im-t1)}
.im-tool svg{width:17px;height:17px;fill:currentColor}
.im-editor{min-height:44px;max-height:38vh;overflow-y:auto;border:none;outline:none;
  background:none;font-family:inherit;font-size:14px;color:var(--im-t1);
  padding:2px 2px 6px;white-space:pre-wrap;word-break:break-word;line-height:1.5}
.im-editor:empty:before{content:attr(data-ph);color:var(--im-t3);pointer-events:none}
.im-editor img.face{width:20px;height:20px;vertical-align:-4px;margin:0 1px}
.at-chip{color:var(--im-self);background:rgba(0,153,255,.10);border-radius:4px;padding:0 4px}
.im-tool.on{background:var(--im-active);color:var(--im-t1)}

/* \u8868\u60C5\u9762\u677F / @ \u9009\u62E9\u5668 */
.im-facepanel{position:absolute;left:14px;bottom:100%;margin-bottom:8px;width:432px;
  max-height:264px;overflow:auto;background:var(--im-list);border:1px solid var(--im-line);
  border-radius:10px;box-shadow:var(--im-shadow);padding:8px;z-index:5}
.im-facegrid{display:grid;grid-template-columns:repeat(12,1fr);gap:2px}
.im-facegrid img{width:28px;height:28px;cursor:pointer;border-radius:4px;padding:2px}
.im-facegrid img:hover{background:var(--im-hover)}
.im-atpanel{position:absolute;left:14px;bottom:100%;margin-bottom:8px;width:264px;
  max-height:240px;overflow:auto;background:var(--im-list);border:1px solid var(--im-line);
  border-radius:10px;box-shadow:var(--im-shadow);padding:6px;z-index:5}
.im-atrow{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:6px;
  cursor:pointer}
.im-atrow:hover{background:var(--im-hover)}
.im-atrow img,.im-atrow .ava-t{width:26px;height:26px;border-radius:6px;object-fit:cover;flex:none}
.im-atrow .nm{font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.im-atrow .qq{font-size:11px;color:var(--im-t3)}
.im-send{display:flex;justify-content:flex-end;gap:8px;align-items:center}
.im-send .hint{font-size:11px;color:var(--im-t3);margin-right:auto}
.im-btn-send{height:28px;padding:0 16px;border-radius:6px;border:none;background:var(--im-self);
  color:#fff;font-size:13px;cursor:pointer;font-family:inherit}
.im-btn-send:disabled{opacity:.5;cursor:not-allowed}


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
.im-quote-bar{display:flex;gap:8px;align-items:center;background:var(--im-hover);
  border-left:3px solid var(--im-self);border-radius:4px;padding:4px 8px;font-size:12.5px;
  color:var(--im-t2)}
.im-quote-bar .qq{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.im-quote-bar .qx{border:none;background:none;cursor:pointer;color:var(--im-t3);
  font-size:16px;line-height:1}
.im-toast{position:fixed;left:50%;bottom:130px;transform:translateX(-50%);z-index:970;
  background:rgba(0,0,0,.78);color:#fff;font-size:12.5px;padding:6px 14px;border-radius:16px}

/* \u5927\u56FE\u67E5\u770B */
.im-viewer{position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.82);display:flex;
  align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.im-viewer img{max-width:100%;max-height:100%;border-radius:8px}
.im-viewer .x{position:absolute;top:16px;right:22px;color:#fff;font-size:26px;cursor:pointer;
  line-height:1;background:none;border:none}
`;function Sp(){if(typeof document>"u"||document.getElementById(_p))return;let e=document.createElement("style");e.id=_p,e.textContent=Yh,document.head.appendChild(e)}var Xh="qqbot",qp="rcq-style",Cp="rcq.tab",Er=null,ft=fi({toast:"",toastKind:"",conn:null}),yo=null;function Z(e,t){ft.toast=String(e??""),ft.toastKind=t||"",yo&&clearTimeout(yo),yo=setTimeout(()=>{ft.toast=""},t==="err"?5200:2600)}async function je(e,t){if(!Er||!Er.invoke)throw new Error("\u63D2\u4EF6\u8FD0\u884C\u65F6\u672A\u5C31\u7EEA");return await Er.invoke(e,t||{})}async function fe(e,t){let i=await je(e,t);return i&&typeof i=="object"&&"data"in i&&i.data!==null&&i.data!==void 0?i.data:i}function oe(e){return e?String(e&&e.message||e):"\u672A\u77E5\u9519\u8BEF"}var Lt=e=>e<10?"0"+e:""+e;function Np(e){if(!e)return"\u2014";let t=new Date(e*1e3);return t.getMonth()+1+"-"+Lt(t.getDate())+" "+Lt(t.getHours())+":"+Lt(t.getMinutes())}function wo(e){if(!e)return"\u2014";let t=new Date(e*1e3);return t.getFullYear()+"-"+Lt(t.getMonth()+1)+"-"+Lt(t.getDate())+" "+Lt(t.getHours())+":"+Lt(t.getMinutes())+":"+Lt(t.getSeconds())}function os(e){return e==null||e===""||(e=Number(e),isNaN(e))?"\u2014":e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e4?(e/1e4).toFixed(1)+"\u4E07":String(e)}function xo(e){return String(e||"").split(/[,，\s]+/).map(t=>t.trim()).filter(Boolean)}function ko(e){if(!e)return"";let t=e.abs||(e.rel?"/opt/rcbot/media/"+e.rel:"");return t?"/api/fm/preview?path="+encodeURIComponent(t):""}function _o(e){return!e||!e.local?!1:e.exists!==0}function Tp(e){if(!e)return"";try{let t=ip(0,"M");return t.addData(e),t.make(),t.createSvgTag({cellSize:5,margin:0,scalable:!0})}catch{return""}}var Zh=`
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
.rcq-mono{font-family:var(--font-mono);font-size:11.5px}

.rcq-empty{padding:38px 12px;text-align:center;color:var(--f);font-size:12.5px}
.rcq-empty b{display:block;font-size:24px;margin-bottom:6px;opacity:.45;font-weight:400}

/* \u4E8C\u7EF4\u7801 */
.rcq-qr{width:196px;height:196px;background:#fff;border:1px solid var(--bd);
 border-radius:var(--r);padding:9px;display:flex;align-items:center;justify-content:center;flex:none}
.rcq-qr svg{width:100%;height:100%;display:block}
.rcq-qr .ph{color:#999;font-size:12px;text-align:center;padding:0 10px}

/* \u65E5\u5FD7\uFF08NapCat \u732B\u732B\u65E5\u5FD7\u98CE\u683C\uFF1A\u7EAF\u6587\u672C\u884C\uFF0C\u6309\u7EA7\u522B\u7740\u8272\uFF09 */
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

/* ---- \u804A\u5929\u8BB0\u5F55\u4E09\u680F ---- */
.rcq-chats{display:grid;grid-template-columns:250px minmax(0,1fr);gap:12px;align-items:start}
.rcq-chatcol{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);
 display:flex;flex-direction:column;overflow:hidden;max-height:min(74vh,720px)}
.rcq-chatcol .hd{padding:10px 12px;border-bottom:1px solid var(--bd);flex:none;
 display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rcq-chatcol .hd b{font-size:12.5px;font-weight:600}
.rcq-chatcol .bd{flex:1;overflow:auto;min-height:0}
.rcq-chatcol .ft{flex:none;padding:9px 12px;border-top:1px solid var(--bd)}
.rcq-cpick{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;
 border-left:2px solid transparent}
.rcq-cpick:hover{background:var(--sf2)}
.rcq-cpick.on{background:var(--sf2);border-left-color:var(--ac)}
.rcq-cpick .av{width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none;
 background:var(--sf3);border:1px solid var(--bd)}
.rcq-cpick .tx{flex:1;min-width:0}
.rcq-cpick .tx b{display:block;font-size:12px;font-weight:600;overflow:hidden;
 text-overflow:ellipsis;white-space:nowrap}
.rcq-cpick .tx span{font-size:11px;color:var(--m)}
.rcq-cgrp{padding:8px 12px 4px;font-size:11px;color:var(--f);font-weight:600;
 letter-spacing:.02em;background:var(--sf)}
.rcq-csess{padding:8px 12px;cursor:pointer;border-left:2px solid transparent}
.rcq-csess:hover{background:var(--sf2)}
.rcq-csess.on{background:var(--sf2);border-left-color:var(--ac)}
.rcq-csess .t{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px}
.rcq-csess .t span{font-size:10.5px;color:var(--m);font-weight:400;margin-left:auto}
.rcq-csess .d{font-size:11px;color:var(--m);overflow:hidden;text-overflow:ellipsis;
 white-space:nowrap;margin-top:1px}

/* \u6D88\u606F\u7A97\u683C */
.rcq-thread{padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.rcq-day{align-self:center;font-size:11px;color:var(--f);margin:10px 0 6px;
 background:var(--sf2);padding:2px 10px;border-radius:999px}
.rcq-bub{display:flex;gap:8px;max-width:86%;align-items:flex-start}
.rcq-bub.me{align-self:flex-end;flex-direction:row-reverse}
.rcq-bub .ava{width:30px;height:30px;border-radius:50%;object-fit:cover;flex:none;
 background:var(--sf3);border:1px solid var(--bd);font-size:11px;color:var(--m);
 display:flex;align-items:center;justify-content:center}
.rcq-bub .col{min-width:0}
.rcq-bub .who{font-size:11px;color:var(--m);margin-bottom:3px}
.rcq-bub.me .who{text-align:right}
.rcq-bub .bd{background:var(--sf2);border:1px solid var(--bd);border-radius:10px;
 padding:7px 11px;font-size:12.5px;white-space:pre-wrap;word-break:break-word;
 line-height:1.6}
.rcq-bub.me .bd{background:var(--acbg);border-color:transparent}
.rcq-bub .bd.recalled{opacity:.62}
.rcq-bub .bd img{max-width:230px;max-height:230px;border-radius:7px;display:block;
 cursor:zoom-in}
.rcq-bub .bd video{max-width:280px;border-radius:7px;display:block}
.rcq-bub .bd audio{max-width:250px;display:block;margin-top:3px}
.rcq-bub .bd .rcq-file{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;
 padding:4px 9px;border:1px solid var(--bd);border-radius:7px;background:var(--sf);
 color:var(--t);text-decoration:none}
.rcq-rtag{display:inline-block;margin-top:4px;font-size:10.5px;color:var(--warn);
 border:1px solid var(--warn);border-radius:999px;padding:0 7px}
.rcq-empty2{padding:30px 14px;text-align:center;color:var(--f);font-size:12.5px}
.rcq-loadmore{padding:9px;text-align:center;font-size:11.5px;color:var(--m);cursor:pointer}
.rcq-loadmore:hover{color:var(--ac)}
.rcq-media{flex-wrap:wrap;gap:5px;margin-top:5px}

/* ---- \u626B\u7801\u533A\uFF08NapCat \u753B\u4E8C\u7EF4\u7801 / SnowLuma \u5185\u5D4C\u8FDC\u7A0B\u684C\u9762\uFF09---- */
.rcq-scan{margin-top:14px;border-top:1px solid var(--bd);padding-top:14px}
.rcq-vncbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.rcq-vncbar b{font-size:12.5px;font-weight:600}
.rcq-vncwrap{border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;
 background:#1b1b1b}
.rcq-vnc{width:100%;height:min(62vh,560px);border:0;display:block}

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
`;function em(){if(document.getElementById(qp))return;let e=document.createElement("style");e.id=qp,e.textContent=Zh,document.head.appendChild(e)}var tm={data(){return{S:ft,ov:null,busy:!1,err:"",timer:null}},computed:{acc(){return this.ov&&this.ov.account||{}},ver(){return this.ov&&this.ov.versions||{}},sysinfo(){return this.ov&&this.ov.sys||{}},cpu(){return this.sysinfo.cpu||{}},mem(){return this.sysinfo.memory||{}},cnt(){return this.ov&&this.ov.counters||{}},botst(){return this.ov&&this.ov.bot||null},isSnow(){return(this.ov&&this.ov.backend||"")==="snowluma"},vers(){let e=this.ver;return this.isSnow?[["\u6846\u67B6\u7248\u672C",e.napcat],["QQ \u7248\u672C",e.qq],["OneBot \u7248\u672C",e.webui]]:[["NapCat \u7248\u672C",e.napcat],["QQ \u7248\u672C",e.qq],["WebUI \u7248\u672C",e.webui]]},cpuPct(){let e=parseFloat((this.cpu.usage||{}).system);return isNaN(e)?0:Math.min(100,Math.round(e))},memPct(){let e=parseFloat(this.mem.total),t=parseFloat((this.mem.usage||{}).system);return!e||!t?0:Math.min(100,Math.round(t/e*100))},online(){return!!this.acc.login&&!this.acc.offline}},async mounted(){await this.load(),this.timer=setInterval(()=>this.load(!0),5e3)},beforeUnmount(){this.timer&&clearInterval(this.timer)},methods:{fmtNum:os,async load(e){e||(this.busy=!0);try{this.ov=await je("qqbot.nc.overview"),this.err=(this.ov.errors||[]).join("\uFF1B")}catch(t){this.err=oe(t)}finally{this.busy=!1}},dash(e){return 264-264*e/100},accAvatar(e){if(e.avatar)return e.avatar;let t=String(e&&e.uin||"");return/^\d{5,12}$/.test(t)?"https://q1.qlogo.cn/g?b=qq&nk="+t+"&s=100":""}},template:`
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

    <div class="rcq-counters" v-if="isSnow" style="grid-template-columns:repeat(4,1fr)">
      <div class="rcq-ct"><b>{{ cnt.groups || 0 }}</b><span>\u7FA4\u804A</span></div>
      <div class="rcq-ct"><b>{{ cnt.friends || 0 }}</b><span>\u597D\u53CB</span></div>
      <div class="rcq-ct"><b>{{ cnt.sessions || 0 }}</b><span>\u4F1A\u8BDD</span></div>
      <div class="rcq-ct"><b>{{ cnt.messages || 0 }}</b><span>\u6D88\u606F</span></div>
    </div>
    <div class="rcq-counters" v-else>
      <div class="rcq-ct"><b>{{ cnt.configs || 0 }}</b><span>\u7F51\u7EDC\u914D\u7F6E</span></div>
      <div class="rcq-ct"><b>{{ cnt.httpServers || 0 }}</b><span>HTTP \u670D\u52A1\u5668</span></div>
      <div class="rcq-ct"><b>{{ cnt.httpClients || 0 }}</b><span>HTTP \u5BA2\u6237\u7AEF</span></div>
      <div class="rcq-ct"><b>{{ cnt.wsServers || 0 }}</b><span>WS \u670D\u52A1\u5668</span></div>
      <div class="rcq-ct"><b>{{ cnt.wsClients || 0 }}</b><span>WS \u5BA2\u6237\u7AEF</span></div>
    </div>

    <div class="rcq-pnl">
      <div class="rcq-ph"><b>RainCough Bot</b><span class="sp"></span>
        <span class="rcq-lamp" v-if="botst"><b :class="botst.onebot && botst.onebot.connected ? 'on' : 'off'"></b>
          {{ botst.onebot && botst.onebot.connected ? (isSnow ? '\u5DF2\u8FDE SnowLuma' : '\u5DF2\u8FDE NapCat') : '\u672A\u8FDE\u63A5' }}</span>
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
  </div>`},im={data(){return{S:ft,acc:null,busy:"",err:"",qr:"",qrErr:"",qrBusy:!1,qrOpen:!1,msg:"",be:null,novncUrl:"",novncPw:"",switching:!1}},computed:{login(){return!!(this.acc&&this.acc.login)},isSL(){return this.acc&&this.acc.backend==="snowluma"},beKind(){return this.be&&this.be.kind||this.acc&&this.acc.backend||"napcat"},beOpts(){let e=this.be&&this.be.options||[];return e.length?e:[{value:"napcat",label:"NapCat\uFF08\u539F\u751F\u5B89\u88C5\uFF09"},{value:"snowluma",label:"SnowLuma\uFF08Docker\uFF09"}]},napcatOk(){return(this.beOpts.find(e=>e.value==="napcat")||{}).installed!==!1},ready(){return!!(this.acc&&this.acc.core_ready)},online(){return!!(this.acc&&(this.acc.online||this.acc.connected))},uin(){return this.acc&&this.acc.uin||""},nick(){return this.acc&&this.acc.nick||""},avatar(){if(this.acc&&this.acc.avatar)return this.acc.avatar;let e=this.uin;return/^\d{5,12}$/.test(e)?"https://q1.qlogo.cn/g?b=qq&nk="+e+"&s=100":""},statusText(){if(!this.acc)return"\u672A\u77E5";if(this.online&&this.ready)return"\u5DF2\u767B\u5F55";if(this.acc.login)return"\u5DF2\u767B\u5F55\uFF08\u521D\u59CB\u5316\u4E2D\uFF09";if(this.acc.accepted)return"\u624B\u673A\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u767B\u5F55\u2026";let e=this.acc.state||"";return e==="failed"?"\u542F\u52A8\u5931\u8D25":e==="inactive"||e==="exited"?"\u5DF2\u505C\u6B62":e==="active"||e==="running"?"\u8FD0\u884C\u4E2D\uFF08\u672A\u767B\u5F55\uFF09":e==="absent"?"\u672A\u90E8\u7F72":e||"\u672A\u77E5"},statusCls(){return this.online&&this.ready?"ok":this.acc&&this.acc.state==="failed"?"off":""}},async mounted(){await this.loadBackend(),await this.load(),this.timer=setInterval(()=>this.load(!0),5e3)},beforeUnmount(){this.timer&&clearInterval(this.timer)},methods:{async load(e){e||(this.busy="load");try{this.acc=await fe("qqbot.account.info"),this.err=this.acc&&this.acc.error||"",this.qrOpen&&this.acc&&!this.acc.login&&this.pollStatus(0)}catch(t){this.err=oe(t)}finally{this.busy=""}},async loadBackend(){try{this.be=await fe("qqbot.backend.get")}catch{this.be=null}},optLabel(e){let t=String(e&&e.label||e&&e.value||"").split("\uFF08")[0];return e&&e.installed===!1?t+"\uFF08\u672A\u5B89\u88C5\uFF09":t},buildNovnc(e){if(!e||!e.novnc_path)return"";let t=this.be&&this.be.snowluma&&this.be.snowluma.public_host||"";return t||(t=location.hostname),(!t||t==="localhost")&&(t="127.0.0.1"),location.protocol+"//"+t+":"+(e.novnc_port||6081)+e.novnc_path},async switchBackend(e){if(e===this.beKind)return;let t=e==="snowluma"?"SnowLuma\uFF08Docker\uFF09":"NapCat\uFF08\u539F\u751F\uFF09";if(confirm("\u5207\u6362\u5230 "+t+`\uFF1F

\u4E24\u5957\u73AF\u5883\u4E92\u4E0D\u5F71\u54CD\uFF0C\u968F\u65F6\u53EF\u4EE5\u518D\u5207\u56DE\u6765\u3002
\u5207\u6362\u540E rcbot \u4F1A\u6539\u8FDE\u53E6\u4E00\u4E2A OneBot \u7AEF\u53E3\u3002`)){this.switching=!0;try{await fe("qqbot.backend.set",{kind:e}),Z("\u5DF2\u5207\u6362\u5230 "+t,"ok"),this.qrOpen=!1,this.novncUrl="",await this.loadBackend(),await this.load(!0)}catch(i){Z(oe(i),"err")}finally{this.switching=!1}}},async showQr(){this.qrBusy=!0,this.qr="",this.qrErr="",this.msg="",this.novncUrl="",this.qrOpen=!0;try{let e=await fe("qqbot.account.qrcode",{});if(e&&e.login){this.msg="\u5DF2\u7ECF\u767B\u5F55\u4E86\uFF1A"+(e.nick||e.uin),await this.load(!0);return}e&&e.mode==="novnc"?(this.novncUrl=this.buildNovnc(e),this.novncPw=e.novnc_password||"",this.novncUrl||(this.qrErr="\u8FDC\u7A0B\u684C\u9762\u5730\u5740\u6CA1\u62FC\u51FA\u6765\uFF08\u7F3A noVNC \u7AEF\u53E3\u6216\u5BC6\u7801\uFF09"),this.pollStatus(0)):e&&e.qrcode?(this.qr=Tp(e.qrcode),this.pollStatus(0)):this.qrErr="\u4E8C\u7EF4\u7801\u8FD8\u6CA1\u51FA\u6765\uFF0C\u7A0D\u540E\u518D\u70B9\u4E00\u6B21"}catch(e){this.qrErr=oe(e)}finally{this.qrBusy=!1}},async refreshQr(){try{let e=await fe("qqbot.account.refresh_qrcode",{});e&&e.qrcode&&(this.qr=Tp(e.qrcode))}catch(e){this.qrErr=oe(e)}},pollStatus(e){e>100||!this.qrOpen||setTimeout(async()=>{if(this.qrOpen){try{let t=await fe("qqbot.account.status",{});if(t&&t.done){this.msg="\u767B\u5F55\u6210\u529F\uFF1A"+(t.nick||t.uin)+"\uFF08"+t.uin+"\uFF09",this.qr="",Z("\u5DF2\u767B\u5F55 "+t.uin,"ok"),await this.load(!0),setTimeout(()=>{this.qrOpen=!1},1200);return}t&&t.accepted&&!t.logged?this.msg="\u624B\u673A\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u767B\u5F55 QQ\u2026":t&&t.logged&&!t.core_ready&&(this.msg="QQ \u5DF2\u767B\u5F55\uFF0C\u6B63\u5728\u521D\u59CB\u5316 NapCat\u2026"),t&&t.error&&(this.msg=t.error)}catch(t){this.msg=oe(t)}this.pollStatus(e+1)}},3e3)},async act(e){this.busy=e;try{let t={start:"\u5DF2\u542F\u52A8",stop:"\u5DF2\u505C\u6B62",restart:"\u5DF2\u91CD\u542F",quick_login:"\u5DF2\u53D1\u8D77\u5FEB\u767B",logout:"\u5DF2\u9000\u51FA\u767B\u5F55"}[e]||"\u5DF2\u6267\u884C";if(e==="logout"&&!confirm("\u9000\u51FA\u767B\u5F55\u4F1A\u6E05\u6389\u672C\u673A\u7684\u767B\u5F55\u6001\uFF0C\u4E0B\u6B21\u8981\u91CD\u65B0\u626B\u7801\u3002\u786E\u5B9A\uFF1F"))return;await je("qqbot.account.action",{action:e}),Z(t,"ok"),this.qrOpen=!1,this.qr="",await this.load(!0)}catch(t){Z(oe(t),"err")}finally{this.busy=""}},closeQr(){this.qrOpen=!1,this.qr="",this.msg="",this.novncUrl=""}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-pnl">
      <div class="rcq-ph">
        <b>QQ \u8D26\u6237</b>
        <span class="rcq-hint">\u5355\u8D26\u6237\u6A21\u5F0F</span>
        <span class="sp"></span>
        <span class="rcq-hint">\u6846\u67B6</span>
        <select class="input" style="width:auto;font-size:12px" :disabled="switching"
          :value="beKind" @change="switchBackend($event.target.value)">
          <option v-for="o in beOpts" :key="o.value" :value="o.value"
            :disabled="o.installed === false">{{ optLabel(o) }}</option>
        </select>
        <button class="btn btn-sm btn-primary" :disabled="qrBusy" @click="showQr()">
          {{ qrBusy ? '\u51C6\u5907\u4E2D\u2026' : (login ? '\u91CD\u65B0\u767B\u5F55' : '\u626B\u7801\u767B\u5F55') }}
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
        <button class="btn btn-sm" :disabled="!!busy" @click="act('restart')">\u91CD\u542F</button>
        <button v-if="!isSL" class="btn btn-sm" :disabled="!!busy || !login"
          @click="act('quick_login')">\u5FEB\u901F\u767B\u5F55</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="act('stop')">\u505C\u6B62</button>
        <button class="btn btn-sm" :disabled="!!busy || !login" @click="act('logout')">\u9000\u51FA\u767B\u5F55</button>
      </div>

      <!-- ============ \u626B\u7801\u533A\uFF1A\u4E24\u79CD\u540E\u7AEF\u5B8C\u5168\u4E0D\u540C\u7684\u4EA4\u4E92 ============ -->
      <div v-if="qrOpen" class="rcq-scan">
        <!-- SnowLuma\uFF1A\u6CA1\u6709\u4E8C\u7EF4\u7801 API\uFF0C\u53EA\u80FD\u5185\u5D4C noVNC \u8FDC\u7A0B\u684C\u9762 -->
        <template v-if="isSL || novncUrl">
          <div class="rcq-vncbar">
            <b>\u8FDC\u7A0B\u684C\u9762</b>
            <span class="rcq-hint">\u5728\u4E0B\u9762\u7684\u753B\u9762\u91CC\u7528\u624B\u673A QQ \u626B\u7801\u767B\u5F55</span>
            <span class="sp"></span>
            <a v-if="novncUrl" :href="novncUrl" target="_blank" rel="noopener"
              class="btn btn-sm">\u65B0\u7A97\u53E3\u6253\u5F00</a>
            <button class="btn btn-sm" @click="closeQr()">\u5173\u95ED</button>
          </div>
          <div v-if="novncUrl" class="rcq-vncwrap">
            <iframe :src="novncUrl" class="rcq-vnc" allow="clipboard-read; clipboard-write"
              referrerpolicy="no-referrer"></iframe>
          </div>
          <div v-else class="rcq-empty2">
            {{ qrErr || (qrBusy ? '\u6B63\u5728\u542F\u52A8\u5BB9\u5668\u4E0E\u8FDC\u7A0B\u684C\u9762\u2026' : '\u8FDC\u7A0B\u684C\u9762\u8FD8\u6CA1\u51C6\u5907\u597D') }}
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
        </template>

        <!-- NapCat\uFF1A\u8C03 API \u62FF\u4E8C\u7EF4\u7801\uFF0C\u753B\u6210 SVG -->
        <template v-else>
          <div style="display:flex;gap:14px;align-items:flex-start">
            <div>
              <!-- \u2605 \u5FC5\u987B\u7528 v-html\uFF1AmakeQr \u8FD4\u56DE\u7684\u662F SVG \u5B57\u7B26\u4E32\uFF0C
                   \u585E\u8FDB <img src> \u662F\u6E32\u67D3\u4E0D\u51FA\u6765\u7684\uFF08img \u7684 src \u8981\u7684\u662F URL\uFF09\u3002 -->
              <div v-if="qr" v-html="qr" class="rcq-qr" style="width:180px;height:180px"></div>
              <div v-else class="rcq-empty"
                style="width:180px;height:180px;display:flex;align-items:center;justify-content:center;border-radius:8px">
                {{ qrBusy ? '\u6B63\u5728\u83B7\u53D6\u4E8C\u7EF4\u7801\u2026' : (qrErr || '\u4E8C\u7EF4\u7801\u8FD8\u6CA1\u51FA\u6765') }}
              </div>
            </div>
            <div style="flex:1;min-width:0">
              <div class="rcq-note" style="display:block">
                \u8BF7\u7528\u624B\u673A QQ \u626B\u63CF\u4E0B\u9762\u7684\u4E8C\u7EF4\u7801\u6388\u6743\u767B\u5F55\u3002<br />
                \u767B\u5F55\u6210\u529F\u540E\u4F1A\u81EA\u52A8\u8BC6\u522B\u51FA\u8D26\u53F7\u5E76\u8FDE\u63A5\u673A\u5668\u4EBA\u3002
              </div>
              <div v-if="msg" style="margin-top:10px;font-size:12px">{{ msg }}</div>
              <div v-if="qrErr" style="margin-top:10px;font-size:12px;color:var(--bad)">{{ qrErr }}</div>
              <div style="margin-top:12px;display:flex;gap:8px">
                <button class="btn btn-sm" :disabled="qrBusy" @click="refreshQr()">\u5237\u65B0\u4E8C\u7EF4\u7801</button>
                <button class="btn btn-sm" @click="closeQr()">\u5173\u95ED</button>
              </div>
            </div>
          </div>
        </template>

        <div v-if="msg && (isSL || novncUrl)" style="margin-top:8px;font-size:12px">{{ msg }}</div>
      </div>

      <div class="rcq-note" style="margin-top:14px">
        \u672C\u63D2\u4EF6\u662F\u5355\u8D26\u6237\u6A21\u5F0F\uFF1A\u53EA\u7BA1\u7406\u4E00\u4E2A QQ \u53F7\u3002
        <br />
        <template v-if="isSL">
          <b>SnowLuma</b> \u628A QQ \u6574\u5305\u8DD1\u5728 Docker \u91CC\uFF0C\u767B\u5F55\u8981\u5728\u5185\u5D4C\u7684\u8FDC\u7A0B\u684C\u9762\u91CC\u626B\u7801
          \uFF08QQ \u5BA2\u6237\u7AEF\u81EA\u5DF1\u753B\u4E8C\u7EF4\u7801\uFF0C\u6CA1\u6709 API \u80FD\u5355\u72EC\u53D6\u51FA\u6765\uFF09\u3002
        </template>
        <template v-else>
          \u767B\u5F55\u7528 <b>NapCat</b> \u81EA\u5E26\u7684\u4E8C\u7EF4\u7801\u63A5\u53E3\uFF08\u548C QQ \u5BA2\u6237\u7AEF\u5B98\u65B9\u626B\u7801\u4E00\u81F4\uFF09\u3002
        </template>
        <br />
        \u6362\u53F7\u65F6\u70B9\u300C\u9000\u51FA\u767B\u5F55\u300D\u6E05\u6389\u767B\u5F55\u6001\uFF0C\u518D\u91CD\u65B0\u626B\u7801\u5373\u53EF\u3002
        <template v-if="napcatOk">\u4E24\u5957\u6846\u67B6\u7684\u5F00\u5173\u5728\u4E0A\u9762\u7684\u300C\u6846\u67B6\u300D\u4E0B\u62C9\u91CC\uFF0C\u968F\u65F6\u53EF\u4EE5\u5207\u56DE\u3002</template>
        <template v-else>\u672C\u673A\u53EA\u88C5\u4E86 SnowLuma\uFF08NapCat \u5DF2\u5378\u8F7D\uFF09\uFF0C\u6846\u67B6\u4E0B\u62C9\u91CC NapCat \u663E\u793A\u4E3A\u4E0D\u53EF\u9009\u3002</template>
      </div>
    </div>
  </div>`},nm={data(){return{S:ft,sess:[],msgs:[],stats:null,curSess:"",kw:"",beforeId:0,more:!1,busy:"",err:"",light:"",loadingMore:!1}},computed:{groups(){let e={group:[],private:[]};for(let t of this.sess)t.kind==="group"?e.group.push(t):e.private.push(t);return e},mediaBytes(){return((this.stats||{}).media||{}).bytes||0},diskPct(){return((this.stats||{}).disk||{}).used_pct||0},diskFree(){return((this.stats||{}).disk||{}).free||0}},async mounted(){await this.loadSessions(),await this.loadStats()},methods:{fmtTime:Np,fmtFull:wo,fmtNum:os,mediaAlive:_o,bytes(e){return e=Number(e)||0,e>=1073741824?(e/1073741824).toFixed(2)+" G":e>=1048576?(e/1048576).toFixed(1)+" M":e>=1024?(e/1024).toFixed(0)+" K":e+" B"},async loadStats(){try{this.stats=await fe("qqbot.chat.stats",{})}catch{this.stats=null}},async loadSessions(){this.busy="sess";try{let e=await fe("qqbot.chat.sessions",{kw:this.kw,limit:300});this.sess=e&&e.items||[],this.curSess&&!this.sess.some(t=>t.session_id===this.curSess)&&(this.curSess="",this.msgs=[])}catch(e){this.err=oe(e)}finally{this.busy=""}},async pickSess(e){this.curSess=e,this.msgs=[],this.beforeId=0,await this.loadMore(!0)},async loadMore(e){if(this.curSess&&!this.loadingMore){this.loadingMore=!0;try{let t=await fe("qqbot.chat.messages",{session_id:this.curSess,before_id:e?0:this.beforeId,limit:50}),i=t&&t.items||[];e?this.msgs=i:this.msgs=i.concat(this.msgs),this.more=i.length>=50,i.length&&(this.beforeId=i[0].id),this.schedulePendingRefresh()}catch(t){Z(oe(t),"err")}finally{this.loadingMore=!1}}},async exportJson(){this.busy="exp";try{let e=await fe("qqbot.chat.export",{session_id:this.curSess}),t=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),i=document.createElement("a");i.href=URL.createObjectURL(t),i.download="chat-export-"+Date.now()+".json",i.click(),setTimeout(()=>URL.revokeObjectURL(i.href),3e3),Z("\u5DF2\u5BFC\u51FA","ok")}catch(e){Z(oe(e),"err")}finally{this.busy=""}},mediaUrl(e){return ko(e)},mediaState(e){return!e||!e.local||e.exists===0?"gone":e.playable===0?e.transcode==="pending"?"pending":"failed":"play"},hasPendingMedia(){for(let e of this.msgs)for(let t of e.media||[])if(t.transcode==="pending")return!0;return!1},schedulePendingRefresh(){this._pendTimer&&(clearTimeout(this._pendTimer),this._pendTimer=null),this.hasPendingMedia()&&(this._pendTimer=setTimeout(async()=>{this._pendTimer=null,this.curSess&&(await this.loadMore(!0),this.schedulePendingRefresh())},6e3))},async clearSess(){let e=this.sess.find(n=>n.session_id===this.curSess),t=e?e.display||e.target_id:"\u8FD9\u4E2A\u4F1A\u8BDD";if(!confirm("\u6E05\u7A7A\u4F1A\u8BDD\u300C"+t+`\u300D\u7684\u5168\u90E8\u804A\u5929\u8BB0\u5F55\uFF1F

\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`))return;let i=!1;confirm(`\u8981\u8FDE\u56FE\u7247/\u89C6\u9891/\u8BED\u97F3\u8FD9\u4E9B\u5A92\u4F53\u6587\u4EF6\u4E00\u8D77\u5220\u6389\u5417\uFF1F

\u786E\u5B9A = \u4E00\u8D77\u5220
\u53D6\u6D88 = \u53EA\u5220\u6587\u5B57\u8BB0\u5F55\uFF08\u5A92\u4F53\u4FDD\u7559\uFF09`)&&(i=!0),this.busy="clear";try{let n=await fe("qqbot.chat.clear_session",{session_id:this.curSess,with_media:i,confirm:!0});Z("\u5DF2\u6E05\u7A7A "+(n.messages||0)+" \u6761\u6D88\u606F"+(i?"\uFF0C\u5220\u9664 "+(n.files||0)+" \u4E2A\u5A92\u4F53\u6587\u4EF6":""),"ok"),this.curSess="",this.msgs=[],await this.loadSessions(),await this.loadStats()}catch(n){Z(oe(n),"err")}finally{this.busy=""}},dayOf(e){let t=new Date((e||0)*1e3);return t.getFullYear()+"-"+Lt(t.getMonth()+1)+"-"+Lt(t.getDate())},isNewDay(e){return e===0?!0:this.dayOf(this.msgs[e].created_at)!==this.dayOf(this.msgs[e-1].created_at)},segsOf(e){return e.segs||[]},mediaOf(e){return e.media||[]},senderAvatar(e){let t=e.sender||{};if(t.avatar)return t.avatar;let i=String(t.id||e.sender_id||"");return/^\d{5,12}$/.test(i)?"https://q1.qlogo.cn/g?b=qq&nk="+i+"&s=100":""},textOf(e){return e.text?e.text:""},openLight(e){let t=this.mediaUrl(e);t&&(this.light=t)},async purge(){if(confirm(`\u6E05\u7406\u5A92\u4F53\u6587\u4EF6\uFF1F

\u53EA\u5220\u56FE\u7247/\u8BED\u97F3/\u89C6\u9891\u7B49\u5A92\u4F53\u526F\u672C\uFF0C\u804A\u5929\u8BB0\u5F55\u6587\u672C\u4E00\u6761\u4E0D\u5220\u3002`)){this.busy="purge";try{let e=await fe("qqbot.chat.purge_media",{session_id:this.curSess,confirm:!0});Z("\u5DF2\u6E05\u7406 "+(e.files||0)+" \u4E2A\u6587\u4EF6\uFF0C\u91CA\u653E "+this.bytes(e.bytes||0),"ok"),await this.loadStats(),await this.loadSessions()}catch(e){Z(oe(e),"err")}finally{this.busy=""}}}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div v-if="stats" class="rcq-pnl">
      <div class="rcq-flex">
        <div class="rcq-fld"><span class="k">\u6D88\u606F</span>
          <span class="v">{{ fmtNum(stats.chat.messages) }} \u6761</span></div>
        <div class="rcq-fld"><span class="k">\u64A4\u56DE</span>
          <span class="v">{{ fmtNum(stats.chat.recalled) }} \u6761</span></div>
        <div class="rcq-fld"><span class="k">\u5A92\u4F53</span>
          <span class="v">{{ bytes(mediaBytes) }}</span></div>
        <div class="rcq-fld"><span class="k">\u78C1\u76D8\u53EF\u7528</span>
          <span class="v">{{ bytes(diskFree) }}</span></div>
        <span class="sp" style="margin-left:auto"></span>
        <button class="btn btn-sm" :disabled="!!busy" @click="exportJson">\u5BFC\u51FA JSON</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="purge">\u6E05\u7406\u5A92\u4F53</button>
      </div>
      <div class="rcq-wl" title="\u78C1\u76D8\u5360\u7528 {{ diskPct }}%">
        <i :class="diskPct >= 95 ? 'max' : (diskPct >= 85 ? 'hi' : '')" :style="{ width: diskPct + '%' }"></i>
      </div>
      <div class="rcq-note">
        \u804A\u5929\u8BB0\u5F55\u6C38\u4E45\u4FDD\u7559\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u5220\u9664\u3002\u78C1\u76D8\u5360\u7528\u8D85\u8FC7 85% \u4F1A\u6709\u63D0\u9192\uFF0C
        \u5C4A\u65F6\u53EF\u4EE5\u300C\u6E05\u7406\u5A92\u4F53\u300D\u817E\u7A7A\u95F4 \u2014\u2014 \u53EA\u5220\u5A92\u4F53\u6587\u4EF6\uFF0C\u6587\u5B57\u8BB0\u5F55\u4E00\u6761\u4E0D\u52A8\u3002
      </div>
    </div>

    <div class="rcq-chats">
      <!-- \u4F1A\u8BDD\u680F -->
      <div class="rcq-chatcol">
        <div class="hd">
          <b>\u4F1A\u8BDD</b>
          <span class="rcq-hint" style="margin-left:auto">{{ sess.length }}</span>
        </div>
        <div class="ft">
          <input class="input" v-model="kw" placeholder="\u641C\u7D22\u5185\u5BB9/\u53D1\u9001\u8005"
            style="width:100%" @keyup.enter="loadSessions()" />
        </div>
        <div class="bd">
          <div v-if="!sess.length" class="rcq-empty2">\u8FD8\u6CA1\u6709\u804A\u5929\u8BB0\u5F55</div>
          <template v-else>
            <div v-if="groups.group.length" class="rcq-cgrp">\u7FA4\u804A</div>
            <div class="rcq-csess" v-for="s in groups.group" :key="s.session_id"
              :class="{ on: curSess === s.session_id }" @click="pickSess(s.session_id)">
              <div class="t">
                <img v-if="s.avatar" :src="s.avatar" alt=""
                  style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex:none" />
                {{ s.display || s.target_id }}
                <span>{{ fmtTime(s.last_at) }}</span></div>
              <div class="d">{{ s.msg_count }} \u6761{{ s.recalled_count ? ' \xB7 \u64A4\u56DE ' + s.recalled_count : '' }}</div>
            </div>
            <div v-if="groups.private.length" class="rcq-cgrp">\u79C1\u4FE1</div>
            <div class="rcq-csess" v-for="s in groups.private" :key="s.session_id"
              :class="{ on: curSess === s.session_id }" @click="pickSess(s.session_id)">
              <div class="t">
                <img v-if="s.avatar" :src="s.avatar" alt=""
                  style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex:none" />
                {{ s.display || s.target_id }}
                <span>{{ fmtTime(s.last_at) }}</span></div>
              <div class="d">{{ s.msg_count }} \u6761{{ s.recalled_count ? ' \xB7 \u64A4\u56DE ' + s.recalled_count : '' }}</div>
            </div>
          </template>
        </div>
      </div>

      <!-- \u6D88\u606F\u7A97\u683C -->
      <div class="rcq-chatcol">
        <div class="hd">
          <b>\u804A\u5929\u8BB0\u5F55</b>
          <span class="rcq-hint" style="margin-left:auto">
            {{ curSess ? msgs.length + ' \u6761' : '\u5DE6\u8FB9\u9009\u4E00\u4E2A\u4F1A\u8BDD' }}
          </span>
          <button v-if="curSess" class="btn btn-sm" :disabled="!!busy"
            @click="clearSess">{{ busy === 'clear' ? '\u6E05\u7A7A\u4E2D\u2026' : '\u6E05\u7A7A\u4F1A\u8BDD' }}</button>
        </div>
        <div class="bd" ref="thread">
          <div v-if="!curSess" class="rcq-empty2">
            \u9009\u4E00\u4E2A\u4F1A\u8BDD\u770B\u5B8C\u6574\u804A\u5929\u5185\u5BB9<br />
            \u5305\u542B\u6587\u672C\u3001\u8868\u60C5\u3001\u56FE\u7247\u3001\u89C6\u9891\u3001\u8BED\u97F3<br />
            \u64A4\u56DE\u7684\u6D88\u606F\u4F1A\u4FDD\u7559\u539F\u6587\u5E76\u6807\u6CE8
          </div>
          <div v-else class="rcq-thread">
            <div class="rcq-loadmore" v-if="more" @click="loadMore(false)">
              {{ loadingMore ? '\u52A0\u8F7D\u4E2D\u2026' : '\u5411\u4E0A\u52A0\u8F7D\u66F4\u591A' }}
            </div>
            <template v-for="(m, i) in msgs" :key="m.id">
              <div class="rcq-day" v-if="isNewDay(i)">{{ dayOf(m.created_at) }}</div>
              <div class="rcq-bub" :class="{ me: m.role === 'assistant' }">
                <div class="ava" v-if="m.role !== 'assistant'">
                  <img v-if="senderAvatar(m)" :src="senderAvatar(m)"
                    style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" />
                  <template v-else>
                    {{ (m.sender_name || m.sender_id || '?').slice(0, 1) }}
                  </template>
                </div>
                <div class="col">
                  <div class="who" v-if="m.role !== 'assistant'">
                    {{ m.sender_name || m.sender_id }}
                    <span style="opacity:.7">{{ fmtFull(m.created_at).slice(11) }}</span>
                  </div>
                  <div class="bd" :class="{ recalled: m.recalled }">
                    <span v-if="m.role === 'system'" style="color:var(--f);font-style:italic">
                      {{ textOf(m) }}
                    </span>
                    <span v-else>{{ textOf(m) }}</span>

                    <template v-for="md in mediaOf(m)" :key="md.seg">
                      <img v-if="md.kind === 'image' && mediaAlive(md)" :src="mediaUrl(md)"
                        @click="openLight(md)" />
                      <img v-else-if="md.kind === 'face' && mediaAlive(md)" :src="mediaUrl(md)"
                        style="width:26px;height:26px" />
                      <video v-else-if="md.kind === 'video' && mediaState(md) === 'play'"
                        controls preload="metadata" :src="mediaUrl(md)"></video>
                      <audio v-else-if="md.kind === 'record' && mediaState(md) === 'play'"
                        controls preload="metadata" :src="mediaUrl(md)"></audio>
                      <span v-else-if="mediaState(md) === 'pending'" class="rcq-noplay">
                        \u6B63\u5728\u8F6C\u7801\u6210\u53EF\u64AD\u653E\u683C\u5F0F\u2026<a :href="mediaUrl(md)" download>\u4E0B\u8F7D\u539F\u4EF6</a>
                      </span>
                      <a v-else-if="md.local && mediaState(md) !== 'gone'"
                        class="rcq-file" :href="mediaUrl(md)" download>
                        {{ md.name || (md.kind + ' \u6587\u4EF6') }}
                        <span v-if="mediaState(md) === 'failed'">\uFF08\u6D4F\u89C8\u5668\u653E\u4E0D\u4E86\u8FD9\u4E2A\u683C\u5F0F\uFF09</span>
                      </a>
                      <span v-else class="rcq-note">
                        [{{ md.kind }} \u5DF2\u5931\u6548]
                      </span>
                    </template>
                  </div>
                  <span class="rcq-rtag" v-if="m.recalled">\u5DF2\u88AB\u64A4\u56DE</span>
                </div>
              </div>
            </template>
            <div v-if="curSess && !msgs.length" class="rcq-empty2">\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u8BB0\u5F55</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="light" class="rcq-light" @click="light = ''">
      <button class="x" @click.stop="light = ''">\xD7</button>
      <img :src="light" alt="" />
    </div>
  </div>`},sm={data(){return{S:ft,items:[],stats:null,kind:"",sender:"",kw:"",limit:60,offset:0,hasMore:!1,busy:"",err:"",light:"",lightKind:"",picked:{}}},computed:{kindStats(){let e={};for(let t of(this.stats||{}).items||[])e[t.kind]=t;return e},totalBytes(){return(this.stats||{}).total_bytes||0},totalFiles(){return(this.stats||{}).total_files||0},pickedIds(){return Object.keys(this.picked).filter(e=>this.picked[e]).map(e=>Number(e))},pendingCount(){return this.items.filter(e=>e.transcode==="pending").length}},async mounted(){await this.load()},methods:{fmtFull:wo,fmtNum:os,mediaAlive:_o,bytes(e){return e=Number(e)||0,e>=1073741824?(e/1073741824).toFixed(2)+" G":e>=1048576?(e/1048576).toFixed(1)+" M":e>=1024?(e/1024).toFixed(0)+" K":e+" B"},mediaUrl(e){return ko(e)},kindLabel(e){return{image:"\u56FE\u7247",video:"\u89C6\u9891",record:"\u8BED\u97F3",face:"\u8868\u60C5",file:"\u6587\u4EF6"}[e]||e||"\u5176\u5B83"},kindIcon(e){return{image:"\u{1F5BC}",video:"\u{1F3AC}",record:"\u{1F3A4}",face:"\u{1F600}",file:"\u{1F4CE}"}[e]||"\u{1F4C4}"},async load(e){this.busy="load";try{let t=await fe("qqbot.chat.media_list",{kind:this.kind,sender:this.sender,kw:this.kw,limit:this.limit,offset:e?this.offset:0}),i=t&&t.items||[];this.items=e?this.items.concat(i):i,this.stats=t&&t.stats||this.stats,this.offset=this.items.length,this.hasMore=i.length>=this.limit}catch(t){this.err=oe(t)}finally{this.busy=""}},async reload(){this.offset=0,this.picked={},await this.load(!1)},async loadMore(){await this.load(!0)},toggle(e){this.picked[e]=!this.picked[e]},pickAll(){let e=this.items.every(i=>this.picked[i.id]),t={};if(!e)for(let i of this.items)t[i.id]=!0;this.picked=t},open(e){this.lightKind=e.kind,this.light=this.mediaUrl(e)},async transcode(){let e=this.pickedIds.length?this.pickedIds:null;if(!(!e&&!confirm(`\u628A\u5A92\u4F53\u5E93\u91CC\u6240\u6709\u300C\u6D4F\u89C8\u5668\u653E\u4E0D\u4E86\u300D\u7684\u89C6\u9891/\u8BED\u97F3\u8F6C\u6210\u53EF\u64AD\u653E\u683C\u5F0F\uFF1F

\u89C6\u9891\u7F16\u7801\u8F6C\u6362\u6BD4\u8F83\u6162\uFF0C\u8BF7\u52FF\u4E2D\u65AD\u9762\u677F\u3002`))){this.busy="transcode";try{let t=await fe("qqbot.chat.media_transcode",e?{ids:e}:{});Z("\u8F6C\u7801\u5B8C\u6210\uFF1A\u6210\u529F "+(t.ok||0)+"\uFF0C\u5931\u8D25 "+(t.failed||0),"ok"),await this.reload()}catch(t){Z(oe(t),"err")}finally{this.busy=""}}},async remove(){let e=this.pickedIds;if(!e.length){Z("\u5148\u52FE\u9009\u8981\u5220\u9664\u7684\u5A92\u4F53","err");return}if(confirm("\u5220\u9664\u9009\u4E2D\u7684 "+e.length+` \u4E2A\u5A92\u4F53\u6587\u4EF6\uFF1F

\u78C1\u76D8\u4E0A\u7684\u6587\u4EF6\u4F1A\u771F\u7684\u5220\u6389\uFF0C\u804A\u5929\u8BB0\u5F55\u91CC\u7684\u4F4D\u7F6E\u4F1A\u53D8\u6210\u300C\u5DF2\u5931\u6548\u300D\u3002`)){this.busy="del";try{let t=await fe("qqbot.chat.media_delete",{ids:e,confirm:!0});Z("\u5DF2\u5220\u9664 "+(t.files||0)+" \u4E2A\u6587\u4EF6\uFF0C\u91CA\u653E "+this.bytes(t.bytes||0),"ok"),await this.reload()}catch(t){Z(oe(t),"err")}finally{this.busy=""}}},async reindex(){this.busy="reindex";try{let e=await fe("qqbot.chat.media_reindex",{});Z("\u5DF2\u91CD\u5EFA\u7D22\u5F15\uFF1A"+(e.indexed||0)+" \u4E2A\u5A92\u4F53"+(e.cleaned?"\uFF0C\u6E05\u7406\u50F5\u5C38 "+e.cleaned:""),"ok"),await this.reload()}catch(e){Z(oe(e),"err")}finally{this.busy=""}},async repair(){this.busy="repair";try{let e=await fe("qqbot.chat.media_repair",{});Z("\u5DF2\u4FEE\u590D "+(e.fixed||0)+" \u6761\u6D88\u606F\u7684\u5A92\u4F53\u5F15\u7528","ok"),await this.reload()}catch(e){Z(oe(e),"err")}finally{this.busy=""}}},template:`
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
  </div>`},rm={data(){return{S:ft,items:[],senders:[],total:0,sender:"",recalled:"",kind:"",kw:"",limit:50,beforeId:0,more:!1,busy:"",err:"",light:"",lightKind:"",showSenders:!1}},computed:{filtersOn(){return!!(this.sender||this.recalled||this.kind||this.kw)},recalledOpts(){return[{v:"",t:"\u5168\u90E8"},{v:"no",t:"\u672A\u64A4\u56DE"},{v:"yes",t:"\u5DF2\u64A4\u56DE"}]},kindOpts(){return[{v:"",t:"\u5168\u90E8"},{v:"text",t:"\u6587\u672C"},{v:"image",t:"\u56FE\u7247"},{v:"video",t:"\u89C6\u9891"},{v:"record",t:"\u8BED\u97F3"},{v:"face",t:"\u8868\u60C5"},{v:"file",t:"\u6587\u4EF6"}]},suggest(){let e=String(this.sender||"").trim().toLowerCase();return e?this.senders.filter(t=>{let i=String(t.sender_id||""),n=String(t.sender_name||"");return i.indexOf(e)>=0||n.toLowerCase().indexOf(e)>=0}).slice(0,8):[]}},async mounted(){await this.loadSenders(),await this.search(!1)},methods:{fmtFull:wo,fmtNum:os,mediaAlive:_o,bytes(e){return e=Number(e)||0,e>=1048576?(e/1048576).toFixed(1)+" M":e>=1024?(e/1024).toFixed(0)+" K":e+" B"},mediaUrl(e){return ko(e)},kindLabel(e){return{image:"\u56FE\u7247",video:"\u89C6\u9891",record:"\u8BED\u97F3",face:"\u8868\u60C5",file:"\u6587\u4EF6"}[e]||e||"\u5176\u5B83"},async loadSenders(){try{let e=await fe("qqbot.chat.senders",{});this.senders=e&&e.items||[]}catch{}},async search(e){this.busy="search";try{let t=await fe("qqbot.chat.query",{sender:this.sender,recalled:this.recalled,kind:this.kind,kw:this.kw,limit:this.limit,before_id:e?this.beforeId:0}),i=t&&t.items||[];this.items=e?this.items.concat(i):i,this.total=t&&t.total||this.items.length,this.beforeId=i.length?i[i.length-1].id:0,this.more=i.length>=this.limit}catch(t){this.err=oe(t)}finally{this.busy=""}},async reload(){this.beforeId=0,await this.search(!1)},async loadMore(){await this.search(!0)},pickSender(e){this.sender=e.sender_id||e.sender_name||"",this.showSenders=!1,this.reload()},clearFilters(){this.sender="",this.recalled="",this.kind="",this.kw="",this.reload()},openMedia(e){this.lightKind=e.kind,this.light=this.mediaUrl(e)},kindsOf(e){let t=[];for(let i of e.media||[]){let n=i.kind||"";n&&t.indexOf(n)<0&&t.push(n)}return t}},template:`
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
  </div>`},am={data(){return{S:ft,list:[],def:"",cur:null,busy:"",err:"",dirty:!1}},computed:{isNew(){return!!(this.cur&&this.cur.__new)}},async mounted(){await this.load()},methods:{async load(){try{let e=await fe("rcbot.personas");if(this.list=e&&e.items||[],this.def=e&&e.default||"",!this.cur||this.cur.__new)this.cur||this.pick(this.list[0]||null);else{let t=this.list.find(i=>i.id===this.cur.id);t&&!this.dirty&&this.pick(t)}}catch(e){this.err=oe(e)}},pick(e){this.cur=e?Object.assign({},e):null,this.dirty=!1},add(){this.cur={id:"",name:"\u65B0\u4EBA\u683C",prompt:"",__new:!0},this.dirty=!0},async save(){if(!this.cur)return;let e=this.cur;if(!String(e.name||"").trim()){Z("\u4EBA\u683C\u540D\u5B57\u4E0D\u80FD\u4E3A\u7A7A","err");return}this.busy="save";try{let t=await fe("rcbot.persona.save",{id:e.__new?"":e.id,name:e.name,prompt:e.prompt});Z("\u5DF2\u4FDD\u5B58","ok"),this.dirty=!1,await this.load(),t&&t.id&&this.pick(this.list.find(i=>i.id===t.id)||null)}catch(t){Z(oe(t),"err")}finally{this.busy=""}},async setDefault(e){this.busy="def"+e.id;try{await je("rcbot.persona.save",{id:e.id,name:e.name,prompt:e.prompt,set_default:!0}),Z("\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u4EBA\u683C","ok"),await this.load()}catch(t){Z(oe(t),"err")}finally{this.busy=""}},async del(e){if(confirm("\u5220\u9664\u4EBA\u683C\u300C"+(e.name||e.id)+"\u300D\uFF1F\u7528\u5230\u5B83\u7684\u4F1A\u8BDD\u4F1A\u56DE\u843D\u5230\u9ED8\u8BA4\u4EBA\u683C\u3002")){this.busy="del"+e.id;try{await je("rcbot.persona.delete",{id:e.id}),Z("\u5DF2\u5220\u9664","ok"),this.cur=null,await this.load()}catch(t){Z(oe(t),"err")}finally{this.busy=""}}}},template:`
  <div class="rcq-split">
    <div class="rcq-pnl flat">
      <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
        <b>\u4EBA\u683C</b><span class="sp"></span>
        <button class="btn btn-sm btn-primary" @click="add">\u65B0\u5EFA</button>
      </div>
      <div class="rcq-list">
        <div class="rcq-row click" v-for="p in list" :key="p.id"
          :class="{ on: cur && cur.id === p.id }" @click="pick(p)">
          <div class="main">
            <div class="t">{{ p.name || p.id }}
              <span class="tag-chip tag-chip-sm" v-if="p.id === def">\u9ED8\u8BA4</span>
            </div>
            <div class="d">{{ (p.prompt || '\uFF08\u7A7A\u63D0\u793A\u8BCD\uFF09').slice(0, 80) }}</div>
          </div>
        </div>
        <div v-if="!list.length" class="rcq-empty"><b>\u263A</b>\u8FD8\u6CA1\u6709\u4EBA\u683C\uFF0C\u70B9\u300C\u65B0\u5EFA\u300D\u52A0\u4E00\u4E2A</div>
      </div>
    </div>

    <div class="rcq-pnl" v-if="cur">
      <div class="rcq-ph"><b>{{ isNew ? '\u65B0\u5EFA\u4EBA\u683C' : '\u7F16\u8F91\u4EBA\u683C' }}</b><span class="sp"></span>
        <span class="tag-chip tag-chip-sm" v-if="cur.id && cur.id === def">\u9ED8\u8BA4</span>
      </div>
      <div class="rcq-form">
        <label class="rcq-fi wide"><span>\u540D\u79F0</span>
          <input class="input" v-model="cur.name" @input="dirty = true" placeholder="\u4F8B\u5982\uFF1A\u9ED8\u8BA4\u4EBA\u683C / \u5BA2\u670D\u5C0F\u52A9\u624B" />
        </label>
        <label class="rcq-fi wide"><span>\u7CFB\u7EDF\u63D0\u793A\u8BCD</span>
          <textarea class="rcq-ta" v-model="cur.prompt" @input="dirty = true"
            placeholder="\u63CF\u8FF0\u5B83\u7684\u8EAB\u4EFD\u3001\u8BED\u6C14\u3001\u8FB9\u754C\u3002\u4F8B\u5982\uFF1A\u4F60\u53EB\u5C0F\u96E8\uFF0C\u8BF4\u8BDD\u7B80\u77ED\u81EA\u7136\uFF0C\u4E0D\u7528\u656C\u8BED\uFF0C\u4E0D\u4E3B\u52A8\u63D0\u81EA\u5DF1\u662F AI\u3002"></textarea>
        </label>
      </div>
      <div class="rcq-flex" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="save">\u4FDD\u5B58</button>
        <button class="btn btn-sm" v-if="cur.id && cur.id !== def" :disabled="!!busy"
          @click="setDefault(cur)">\u8BBE\u4E3A\u9ED8\u8BA4</button>
        <button class="btn btn-sm btn-danger" v-if="cur.id && !isNew" :disabled="!!busy"
          @click="del(cur)">\u5220\u9664</button>
        <span class="rcq-hint" v-if="dirty">\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539</span>
      </div>
      <div class="rcq-note">
        \u4EBA\u683C\u5C31\u662F\u6BCF\u8F6E\u5BF9\u8BDD\u7684\u7CFB\u7EDF\u63D0\u793A\u8BCD\u3002\u4F1A\u8BDD\u53EF\u4EE5\u5728\u300C\u4F1A\u8BDD\u7BA1\u7406\u300D\u91CC\u5355\u72EC\u6307\u5B9A\u4EBA\u683C\uFF0C\u6CA1\u6307\u5B9A\u5C31\u7528\u9ED8\u8BA4\u4EBA\u683C\u3002
      </div>
    </div>
    <div class="rcq-pnl" v-else>
      <div class="rcq-empty"><b>\u263A</b>\u5DE6\u8FB9\u9009\u4E00\u4E2A\uFF0C\u6216\u8005\u65B0\u5EFA</div>
    </div>
  </div>`},om={data(){return{S:ft,list:[],stats:{},defPersona:"",defProvider:"",personas:[],providers:[],cur:null,detail:null,ctx:null,filter:"all",kw:"",busy:"",err:"",limit:60}},computed:{shown(){let e=this.kw.trim().toLowerCase();return this.list.filter(t=>this.filter==="group"&&t.kind!=="group"||this.filter==="private"&&t.kind==="group"?!1:e?((t.display||"")+" "+(t.id||"")+" "+(t.target_id||"")).toLowerCase().indexOf(e)>=0:!0)},usedPct(){let e=this.ctx;return!e||!e.budget?0:Math.min(100,Math.round(e.est_tokens/e.budget*100))},barClass(){return this.usedPct>=90?"max":this.usedPct>=70?"hi":""}},async mounted(){await this.load()},methods:{fmtTime:Np,fmtNum:os,async load(){this.busy="load";try{let e=await fe("rcbot.sessions");this.list=e&&e.items||[],this.stats=e&&e.stats||{},this.defPersona=e&&e.default_persona||"",this.defProvider=e&&e.default_provider||"";let t=await fe("rcbot.personas");this.personas=t&&t.items||[];let i=await fe("rcbot.providers");if(this.providers=i&&i.items||[],this.cur){let n=this.list.find(s=>s.id===this.cur.id);n&&(this.cur=n)}}catch(e){this.err=oe(e)}finally{this.busy=""}},async open(e){this.cur=e,this.busy="open";try{this.detail=await fe("rcbot.session.get",{id:e.id,limit:this.limit}),this.ctx=await fe("rcbot.context",{id:e.id})}catch(t){Z(oe(t),"err")}finally{this.busy=""}},async reloadDetail(){if(this.cur)try{this.detail=await fe("rcbot.session.get",{id:this.cur.id,limit:this.limit}),this.ctx=await fe("rcbot.context",{id:this.cur.id})}catch(e){Z(oe(e),"err")}},async patch(e,t){if(this.cur){this.busy="p"+e;try{let i={id:this.cur.id};i[e]=t,await je("rcbot.session.save",i),Z("\u5DF2\u66F4\u65B0","ok"),await this.load(),await this.reloadDetail()}catch(i){Z(oe(i),"err")}finally{this.busy=""}}},async clear(){if(this.cur&&confirm("\u6E05\u7A7A\u300C"+(this.cur.display||this.cur.id)+"\u300D\u7684\u4E0A\u4E0B\u6587\uFF1F\u6D88\u606F\u4F1A\u5220\u6389\uFF0C\u4F1A\u8BDD\u4FDD\u7559\u3002")){this.busy="clear";try{await je("rcbot.session.clear",{id:this.cur.id}),Z("\u4E0A\u4E0B\u6587\u5DF2\u6E05\u7A7A","ok"),await this.load(),await this.reloadDetail()}catch(e){Z(oe(e),"err")}finally{this.busy=""}}},async del(){if(this.cur&&confirm("\u5220\u9664\u4F1A\u8BDD\u300C"+(this.cur.display||this.cur.id)+"\u300D\uFF1F\u6D88\u606F\u548C\u6458\u8981\u4E00\u8D77\u5220\u3002")){this.busy="del";try{await je("rcbot.session.delete",{id:this.cur.id}),Z("\u5DF2\u5220\u9664","ok"),this.cur=null,this.detail=null,this.ctx=null,await this.load()}catch(e){Z(oe(e),"err")}finally{this.busy=""}}},personaName(e){if(!e)return"\u9ED8\u8BA4";let t=this.personas.find(i=>i.id===e);return t?t.name:e},providerName(e){if(!e)return"\u9ED8\u8BA4";let t=this.providers.find(i=>i.id===e);return t?t.label||t.id:e}},template:`
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-split">
      <div class="rcq-pnl flat">
        <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
          <b>\u4F1A\u8BDD</b>
          <span class="rcq-hint">{{ stats.sessions || 0 }} \u4E2A \xB7 \u6D88\u606F {{ fmtNum(stats.messages || 0) }}</span>
          <span class="sp"></span>
          <button class="btn btn-sm" @click="load">\u5237\u65B0</button>
        </div>
        <div class="rcq-flex" style="padding:0 16px 10px">
          <button class="btn btn-sm" :class="filter === 'all' ? 'btn-primary' : ''" @click="filter = 'all'">\u5168\u90E8</button>
          <button class="btn btn-sm" :class="filter === 'group' ? 'btn-primary' : ''" @click="filter = 'group'">\u7FA4\u804A</button>
          <button class="btn btn-sm" :class="filter === 'private' ? 'btn-primary' : ''" @click="filter = 'private'">\u79C1\u804A</button>
          <input class="input" style="flex:1;min-width:90px;padding:4px 10px;font-size:12px"
            v-model="kw" placeholder="\u641C\u4F1A\u8BDD" />
        </div>
        <div class="rcq-list">
          <div class="rcq-row click" v-for="s in shown" :key="s.id"
            :class="{ on: cur && cur.id === s.id }" @click="open(s)">
            <div class="main">
              <div class="t">
                <span class="tag-chip tag-chip-sm">{{ s.kind === 'group' ? '\u7FA4' : '\u79C1' }}</span>
                {{ s.display || s.target_id || s.id }}
                <span class="tag-chip tag-chip-sm" v-if="s.enabled === 0">\u5DF2\u505C\u7528</span>
              </div>
              <div class="d">
                {{ s.msg_count || 0 }} \u6761 \xB7 {{ s.mode_label || '' }}
                <template v-if="s.persona_id"> \xB7 {{ personaName(s.persona_id) }}</template>
                \xB7 {{ fmtTime(s.last_at || s.updated_at) }}
              </div>
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
            <label class="rcq-fi"><span>\u4EBA\u683C</span>
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
  </div>`},lm={data(){return{S:ft,list:[],def:"",cur:null,busy:"",err:"",dirty:!1,test:null,models:[],showKey:!1}},computed:{isNew(){return!!(this.cur&&this.cur.__new)}},async mounted(){await this.load()},methods:{async load(){try{let e=await fe("rcbot.providers");if(this.list=e&&e.items||[],this.def=e&&e.default||"",!this.cur)this.pick(this.list[0]||null);else if(!this.cur.__new&&!this.dirty){let t=this.list.find(i=>i.id===this.cur.id);t&&this.pick(t)}}catch(e){this.err=oe(e)}},pick(e){this.cur=e?Object.assign({type:"openai",timeout:120,enable:!0},e):null,this.dirty=!1,this.test=null,this.models=[]},add(){this.cur={id:"",label:"",type:"openai",api_base:"https://api.openai.com/v1",api_key:"",model:"",timeout:120,enable:!0,__new:!0},this.dirty=!0,this.test=null,this.models=[]},async save(){let e=this.cur;if(e){if(!String(e.label||"").trim()){Z("\u7ED9\u63D0\u4F9B\u5546\u8D77\u4E2A\u540D\u5B57","err");return}if(!String(e.api_base||"").trim()){Z("api_base \u4E0D\u80FD\u4E3A\u7A7A","err");return}this.busy="save";try{await je("rcbot.provider.save",{id:e.__new?"":e.id,label:e.label,type:e.type,api_base:e.api_base,api_key:e.api_key,model:e.model,timeout:Number(e.timeout)||120,enable:!!e.enable}),Z("\u5DF2\u4FDD\u5B58","ok"),this.dirty=!1,this.cur=null,await this.load()}catch(t){Z(oe(t),"err")}finally{this.busy=""}}},async setDefault(e){this.busy="def"+e.id;try{await je("rcbot.provider.save",{id:e.id,label:e.label,type:e.type,api_base:e.api_base,api_key:e.api_key,model:e.model,timeout:e.timeout,enable:e.enable,set_default:!0}),Z("\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u63D0\u4F9B\u5546","ok"),await this.load()}catch(t){Z(oe(t),"err")}finally{this.busy=""}},async del(e){if(confirm("\u5220\u9664\u63D0\u4F9B\u5546\u300C"+(e.label||e.id)+"\u300D\uFF1F")){this.busy="del"+e.id;try{await je("rcbot.provider.delete",{id:e.id}),Z("\u5DF2\u5220\u9664","ok"),this.cur=null,await this.load()}catch(t){Z(oe(t),"err")}finally{this.busy=""}}},async doTest(e){this.busy="test"+e.id,this.test=null;try{let t=await fe("rcbot.provider.test",{id:e.id});this.test=Object.assign({id:e.id},t||{}),Z(t.ok?"\u901A\u4E86\uFF0C"+t.ms+"ms":"\u4E0D\u901A\uFF1A"+(t.error||""),t.ok?"ok":"err")}catch(t){Z(oe(t),"err")}finally{this.busy=""}},async fetchModels(){let e=this.cur;if(!e||e.__new){Z("\u5148\u4FDD\u5B58\u518D\u62C9\u6A21\u578B\u5217\u8868","err");return}this.busy="models";try{let t=await fe("rcbot.provider.models",{id:e.id});this.models=t&&(t.items||t.models)||[],this.models.length||Z("\u6CA1\u62C9\u5230\u6A21\u578B","err")}catch(t){Z(oe(t),"err")}finally{this.busy=""}}},template:`
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
  </div>`},cm={data(){return{S:ft,items:[],mode:"live",level:"",lines:400,follow:!0,source:"",connected:!1,hint:"",busy:!1,timer:null,err:""}},computed:{filtered(){return this.items}},async mounted(){await this.load(),this.tick()},beforeUnmount(){this.timer&&clearTimeout(this.timer)},methods:{tick(){this.timer&&clearTimeout(this.timer),this.mode==="live"&&this.follow&&(this.timer=setTimeout(async()=>{await this.load(!0),this.tick()},2e3))},async load(e){e||(this.busy=!0);try{let t=await je("qqbot.account.logs",{mode:this.mode,level:this.level,lines:Number(this.lines)||400}),i=t.items.length!==this.items.length;this.items=t.items||[],this.source=t.source,this.connected=!!t.connected,this.hint=t.hint||"",this.err="",i&&this.follow&&this.$nextTick(this.scrollBottom)}catch(t){this.err=oe(t)}finally{this.busy=!1}},scrollBottom(){let e=this.$refs.box;e&&(e.scrollTop=e.scrollHeight)},async switchMode(e){this.mode=e,this.items=[],await this.load(),this.tick()},async setLevel(e){this.level=this.level===e?"":e,await this.load()},async clear(){try{await je("qqbot.account.logs.clear"),this.items=[],Z("\u7F13\u51B2\u5DF2\u6E05\u7A7A","ok")}catch(e){Z(oe(e),"err")}},download(){let e=this.items.map(n=>"["+String(n.level).toUpperCase()+"] "+n.text).join(`
`),t=new Blob([e],{type:"text/plain;charset=utf-8"}),i=document.createElement("a");i.href=URL.createObjectURL(t),i.download="napcat-"+Date.now()+".log",i.click(),setTimeout(()=>URL.revokeObjectURL(i.href),3e3)},lineClass(e){return"rcq-ln rcq-lv-"+(e.level||"info")},lvText(e){return"["+String(e.level||"info").toUpperCase()+"]"}},template:`
  <div>
    <div class="rcq-pnl">
      <div class="rcq-ph">
        <button class="btn btn-sm" :class="mode === 'live' ? 'btn-primary' : ''" @click="switchMode('live')">\u5B9E\u65F6\u65E5\u5FD7</button>
        <button class="btn btn-sm" :class="mode === 'history' ? 'btn-primary' : ''" @click="switchMode('history')">\u5386\u53F2\u65E5\u5FD7</button>
        <span class="sp"></span>
        <span class="rcq-lamp"><b :class="connected ? 'on' : 'off'"></b>
          {{ mode === 'live' ? (connected ? 'SSE \u5DF2\u8FDE\u63A5' : 'SSE \u65AD\u5F00') : (source === 'journal' ? 'journalctl' : 'NapCat \u7F13\u51B2') }}</span>
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
      \u5B9E\u65F6\u65E5\u5FD7\u8BA2\u9605 NapCat \u7684 SSE \u901A\u9053\uFF08\u4E0D\u4F9D\u8D56 systemd\uFF0C\u975E root \u4E5F\u80FD\u770B\uFF09\uFF1B\u5386\u53F2\u65E5\u5FD7\u8BFB
      <code>journalctl -u napcat</code>\uFF0C\u8BFB\u4E0D\u5230\u65F6\u4F1A\u56DE\u843D\u5230\u5B9E\u65F6\u7F13\u51B2\u3002
    </div>
  </div>`},dm={data(){return{S:ft,cfg:null,conn:null,busy:"",err:"",searchQ:"",searchOut:null,tab:"ctx"}},computed:{ctx(){return this.cfg&&this.cfg.context||{}},bot(){return this.cfg&&this.cfg.bot||{}},feats(){return this.cfg&&this.cfg.features||{}},ws(){return this.feats.web_search||{}},vis(){return this.feats.vision||{}}},async mounted(){await this.load()},methods:{async load(){this.busy="load";try{this.cfg=await fe("rcbot.config.get"),this.conn=await je("qqbot.conn.get"),this.err=""}catch(e){this.err=oe(e)}finally{this.busy=""}},async saveCtx(){this.busy="ctx";try{await je("rcbot.config.save",{context:{max_tokens:Number(this.ctx.max_tokens)||128e3,max_output_tokens:Number(this.ctx.max_output_tokens)||4096,keep_recent_ratio:Number(this.ctx.keep_recent_ratio)||.15,max_history_messages:Number(this.ctx.max_history_messages)||200,compress_enabled:!!this.ctx.compress_enabled,compress_provider:this.ctx.compress_provider||""}}),Z("\u4E0A\u4E0B\u6587\u8BBE\u7F6E\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(oe(e),"err")}finally{this.busy=""}},async saveBot(){this.busy="bot";try{await je("rcbot.config.save",{bot:{enabled:!!this.bot.enabled,group_need_at:!!this.bot.group_need_at,private_always_reply:!!this.bot.private_always_reply,reply_with_mention:!!this.bot.reply_with_mention,wake_prefix:xo(this.bot.__prefixText!=null?this.bot.__prefixText:(this.bot.wake_prefix||[]).join(",")),allowed_groups:xo(this.bot.__allowText!=null?this.bot.__allowText:(this.bot.allowed_groups||[]).join(",")),blocked_groups:xo(this.bot.__blockText!=null?this.bot.__blockText:(this.bot.blocked_groups||[]).join(",")),rate_limit:{window:Number((this.bot.rate_limit||{}).window)||60,max:Number((this.bot.rate_limit||{}).max)||30}}}),Z("\u89E6\u53D1\u89C4\u5219\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(oe(e),"err")}finally{this.busy=""}},async saveFeat(){this.busy="feat";try{await je("rcbot.config.save",{features:{web_search:{enabled:!!this.ws.enabled,max_results:Number(this.ws.max_results)||5},vision:{enabled:!!this.vis.enabled,max_images:Number(this.vis.max_images)||3}}}),Z("\u80FD\u529B\u5F00\u5173\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(oe(e),"err")}finally{this.busy=""}},async saveConn(){this.busy="conn";try{await je("qqbot.conn.save",{config:{api:this.conn.config.api,timeout:Number(this.conn.config.timeout)||90,napcat:{base:this.conn.config.napcat.base,token:this.conn.config.napcat.token,unit:this.conn.config.napcat.unit}}}),Z("\u8FDE\u63A5\u8BBE\u7F6E\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(oe(e),"err")}finally{this.busy=""}},async testSearch(){let e=this.searchQ.trim();if(e){this.busy="search",this.searchOut=null;try{let t=await fe("rcbot.tools.search",{q:e});this.searchOut=t||{}}catch(t){Z(oe(t),"err")}finally{this.busy=""}}}},template:`
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
        <div class="rcq-ph" style="margin-bottom:10px"><b>NapCat\uFF08\u534F\u8BAE\u7AEF\uFF09</b><span class="sp"></span>
          <span class="rcq-lamp"><b :class="conn.napcat && conn.napcat.ok ? 'on' : 'off'"></b>
            {{ conn.napcat && conn.napcat.ok ? '\u5DF2\u8FDE\u901A' : '\u8FDE\u4E0D\u4E0A' }}</span></div>
        <div class="rcq-form">
          <label class="rcq-fi wide"><span>WebUI \u5730\u5740</span>
            <input class="input" v-model="conn.config.napcat.base" placeholder="http://127.0.0.1:6099" /></label>
          <label class="rcq-fi"><span>WebUI Token</span>
            <input class="input" type="password" v-model="conn.config.napcat.token" /></label>
          <label class="rcq-fi"><span>systemd \u5355\u5143\u540D\uFF08\u8BFB\u5386\u53F2\u65E5\u5FD7\uFF09</span>
            <input class="input" v-model="conn.config.napcat.unit" placeholder="napcat" /></label>
        </div>
        <div class="rcq-note" v-if="conn.napcat && conn.napcat.error">{{ conn.napcat.error }}</div>

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
  </div>`},Ap=[{id:"im",label:"\u6D88\u606F",comp:kp,fullscreen:!0},{id:"overview",label:"\u6982\u89C8",comp:tm},{id:"account",label:"QQ \u8D26\u6237",comp:im},{id:"chats",label:"\u804A\u5929\u8BB0\u5F55",comp:nm},{id:"query",label:"\u67E5\u8BE2",comp:rm},{id:"media",label:"\u5A92\u4F53\u5E93",comp:sm},{id:"persona",label:"\u4EBA\u683C",comp:am},{id:"sessions",label:"\u4F1A\u8BDD\u7BA1\u7406",comp:om},{id:"providers",label:"\u6A21\u578B\u63D0\u4F9B\u5546",comp:lm},{id:"logs",label:"\u8FD0\u884C\u65E5\u5FD7",comp:cm},{id:"settings",label:"\u8BBE\u7F6E",comp:dm}],pm={data(){let e="overview";try{let t=localStorage.getItem(Cp);t&&Ap.some(i=>i.id===t)&&(e=t)}catch{}return{S:ft,tab:e,TABS:Ap,conn:null,key:0}},computed:{cur(){return(this.TABS.find(e=>e.id===this.tab)||this.TABS[0]).comp},isFull(){let e=this.TABS.find(t=>t.id===this.tab);return!!(e&&e.fullscreen)},ncOn(){return!!(this.conn&&this.conn.napcat&&this.conn.napcat.ok)},rbOn(){return!!(this.conn&&this.conn.rcbot&&this.conn.rcbot.ok)}},async mounted(){await this.check()},methods:{async check(){try{this.conn=await je("qqbot.conn.get")}catch{}},go(e){this.tab=e;try{localStorage.setItem(Cp,e)}catch{}this.check()},onImClose(){this.go("overview")},refresh(){this.key++,this.check()}},template:`
  <div class="rcq">
    <div class="rcq-bar" v-if="!isFull">
      <div class="rcq-tab" v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }"
        @click="go(t.id)">{{ t.label }}</div>
      <div class="rcq-bar-r">
        <span class="rcq-lamp"><b :class="ncOn ? 'on' : 'off'"></b>NapCat</span>
        <span class="rcq-lamp"><b :class="rbOn ? 'on' : 'off'"></b>Bot</span>
        <button class="btn btn-sm" @click="refresh">\u5237\u65B0</button>
      </div>
    </div>

    <component :is="cur" :key="tab + '-' + key" @close="onImClose" />

    <div class="rcq-toast" v-if="S.toast" :class="S.toastKind">{{ S.toast }}</div>
  </div>`};function um(e,t){em(),Sp(),Er=t,np(t);let i=zn(pm),n=()=>{try{i.unmount()}catch{}};return i.mount(e),n}function fm(e){e.__rcPluginV4__=e.__rcPluginV4__||{},e.__rcPluginV4__[Xh]={pages:[{path:"",title:"QQ Bot"}],mount:um}}typeof window<"u"&&fm(window);})();
