(()=>{var So,De,Se,Ni,Mi,Es,Yn,Is,ta,An,Vn,ln,na;function bt(e){let t=Object.create(null);for(let n of e.split(","))t[n]=1;return n=>n in t}var de={},Xn=[],He=()=>{},Qn=()=>!1,Fn=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&(e.charCodeAt(2)>122||97>e.charCodeAt(2)),cr=e=>e.startsWith("onUpdate:"),le=Object.assign,Ba=(e,t)=>{let n=e.indexOf(t);n>-1&&e.splice(n,1)},Nu=Object.prototype.hasOwnProperty,me=(e,t)=>Nu.call(e,t),J=Array.isArray,te=e=>typeof e=="function",ie=e=>typeof e=="string",Ze=e=>typeof e=="symbol",fe=e=>e!==null&&typeof e=="object",La=e=>(fe(e)||te(e))&&te(e.then)&&te(e.catch),Ne=Object.prototype.toString,dr=e=>ie(e)&&e!=="NaN"&&e[0]!=="-"&&""+parseInt(e,10)===e,Ht=bt(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"),Mu=bt("bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"),ur=e=>{let t=Object.create(null);return n=>t[n]||(t[n]=e(n))},Eu=/-\w/g,xe=ur(e=>e.replace(Eu,t=>t.slice(1).toUpperCase())),Iu=/\B([A-Z])/g,dt=ur(e=>e.replace(Iu,"-$1").toLowerCase()),jn=ur(e=>e.charAt(0).toUpperCase()+e.slice(1)),Zn=ur(e=>e?`on${jn(e)}`:""),$e=(e,t)=>!Object.is(e,t),ei=(e,...t)=>{for(let n=0;n<e.length;n++)e[n](...t)},Ol=(e,t,n,i=!1)=>{Object.defineProperty(e,t,{configurable:!0,enumerable:!1,writable:i,value:n})},pr=e=>{let t=parseFloat(e);return isNaN(t)?e:t},ti=e=>{let t=ie(e)?Number(e):NaN;return isNaN(t)?e:t},fr=()=>So||(So="u">typeof globalThis?globalThis:"u">typeof self?self:"u">typeof window?window:"u">typeof global?global:{}),Ru=bt("Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol");function Gi(e){if(J(e)){let t={};for(let n=0;n<e.length;n++){let i=e[n],s=ie(i)?Pl(i):Gi(i);if(s)for(let r in s)t[r]=s[r]}return t}if(ie(e)||fe(e))return e}var Ou=/;(?![^(]*\))/g,Pu=/:([^]+)/,Bu=/\/\*[^]*?\*\//g;function Pl(e){let t={};return e.replace(Bu,"").split(Ou).forEach(n=>{if(n){let i=n.split(Pu);i.length>1&&(t[i[0].trim()]=i[1].trim())}}),t}function Yi(e){let t="";if(ie(e))t=e;else if(J(e))for(let n=0;n<e.length;n++){let i=Yi(e[n]);i&&(t+=i+" ")}else if(fe(e))for(let n in e)e[n]&&(t+=n+" ");return t.trim()}function Lu(e){if(!e)return null;let{class:t,style:n}=e;return t&&!ie(t)&&(e.class=Yi(t)),n&&(e.style=Gi(n)),e}var Du=bt("html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot"),Fu=bt("svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view"),ju=bt("annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics"),Uu=bt("area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr"),$u=bt("itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly");function Gt(e,t){let n,i;if(e===t)return!0;let s=(n=e,Ne.call(n)==="[object Date]"),r=(i=t,Ne.call(i)==="[object Date]");if(s||r)return!!s&&!!r&&e.getTime()===t.getTime();if(s=Ze(e),r=Ze(t),s||r)return e===t;if(s=J(e),r=J(t),s||r)return!!s&&!!r&&function(a,o){if(a.length!==o.length)return!1;let l=!0;for(let c=0;l&&c<a.length;c++)l=Gt(a[c],o[c]);return l}(e,t);if(s=fe(e),r=fe(t),s||r){if(!s||!r||Object.keys(e).length!==Object.keys(t).length)return!1;for(let a in e){let o=e.hasOwnProperty(a),l=t.hasOwnProperty(a);if(o&&!l||!o&&l||!Gt(e[a],t[a]))return!1}}return String(e)===String(t)}function hr(e,t){return e.findIndex(n=>Gt(n,t))}var Bl=e=>!!(e&&e.__v_isRef===!0),Ll=e=>ie(e)?e:e==null?"":J(e)||fe(e)&&(e.toString===Ne||!te(e.toString))?Bl(e)?Ll(e.value):JSON.stringify(e,Dl,2):String(e),Dl=(e,t)=>{let n;if(Bl(t))return Dl(e,t.value);if(n=t,Ne.call(n)==="[object Map]")return{[`Map(${t.size})`]:[...t.entries()].reduce((i,[s,r],a)=>(i[Dr(s,a)+" =>"]=r,i),{})};{let i;if(i=t,Ne.call(i)==="[object Set]")return{[`Set(${t.size})`]:[...t.values()].map(s=>Dr(s))};{if(Ze(t))return Dr(t);let s;if(fe(t)&&!J(t)&&(s=t,Ne.call(s)!=="[object Object]"))return String(t)}}return t},Dr=(e,t="")=>{var n;return Ze(e)?`Symbol(${(n=e.description)!=null?n:t})`:e},Li=class{constructor(t=!1){this.detached=t,this._active=!0,this._on=0,this.effects=[],this.cleanups=[],this._isPaused=!1,this._warnOnRun=!0,this.__v_skip=!0,!t&&De&&(De.active?(this.parent=De,this.index=(De.scopes||(De.scopes=[])).push(this)-1):(this._active=!1,this._warnOnRun=!1))}get active(){return this._active}pause(){if(this._active){let t,n;if(this._isPaused=!0,this.scopes){let i=this.scopes.slice();for(t=0,n=i.length;t<n;t++)i[t].pause()}for(t=0,n=this.effects.length;t<n;t++)this.effects[t].pause()}}resume(){if(this._active&&this._isPaused){let t,n;if(this._isPaused=!1,this.scopes){let s=this.scopes.slice();for(t=0,n=s.length;t<n;t++)s[t].resume()}let i=this.effects.slice();for(t=0,n=i.length;t<n;t++)i[t].resume()}}run(t){if(this._active){let n=De;try{return De=this,t()}finally{De=n}}}on(){++this._on==1&&(this.prevScope=De,De=this)}off(){if(this._on>0&&--this._on==0){if(De===this)De=this.prevScope;else{let t=De;for(;t;){if(t.prevScope===this){t.prevScope=this.prevScope;break}t=t.prevScope}}this.prevScope=void 0}}stop(t){if(this._active){let n,i;for(this._active=!1,n=0,i=this.effects.length;n<i;n++)this.effects[n].stop();for(this.effects.length=0,n=0,i=this.cleanups.length;n<i;n++)this.cleanups[n]();if(this.cleanups.length=0,this.scopes){let s=this.scopes.slice();for(n=0,i=s.length;n<i;n++)s[n].stop(!0);this.scopes.length=0}if(!this.detached&&this.parent&&!t){let s=this.parent.scopes.pop();s&&s!==this&&(this.parent.scopes[this.index]=s,s.index=this.index)}this.parent=void 0}}};function Vu(e){return new Li(e)}function Fl(){return De}function zu(e,t=!1){De&&De.cleanups.push(e)}var Fr=new WeakSet,Rn=class{constructor(t){this.fn=t,this.deps=void 0,this.depsTail=void 0,this.flags=5,this.next=void 0,this.cleanup=void 0,this.scheduler=void 0,De&&(De.active?De.effects.push(this):this.flags&=-2)}pause(){this.flags|=64}resume(){64&this.flags&&(this.flags&=-65,Fr.has(this)&&(Fr.delete(this),this.trigger()))}notify(){(!(2&this.flags)||32&this.flags)&&(8&this.flags||jl(this))}run(){if(!(1&this.flags))return this.fn();this.flags|=2,qo(this),Ul(this);let t=Se,n=At;Se=this,At=!0;try{return this.fn()}finally{$l(this),Se=t,At=n,this.flags&=-3}}stop(){if(1&this.flags){for(let t=this.deps;t;t=t.nextDep)Fa(t);this.deps=this.depsTail=void 0,qo(this),this.onStop&&this.onStop(),this.flags&=-2}}trigger(){64&this.flags?Fr.add(this):this.scheduler?this.scheduler():this.runIfDirty()}runIfDirty(){ia(this)&&this.run()}get dirty(){return ia(this)}},mr=0;function jl(e,t=!1){if(e.flags|=8,t){e.next=Mi,Mi=e;return}e.next=Ni,Ni=e}function Da(){let e;if(!(--mr>0)){if(Mi){let t=Mi;for(Mi=void 0;t;){let n=t.next;t.next=void 0,t.flags&=-9,t=n}}for(;Ni;){let t=Ni;for(Ni=void 0;t;){let n=t.next;if(t.next=void 0,t.flags&=-9,1&t.flags)try{t.trigger()}catch(i){e||(e=i)}t=n}}if(e)throw e}}function Ul(e){for(let t=e.deps;t;t=t.nextDep)t.version=-1,t.prevActiveLink=t.dep.activeLink,t.dep.activeLink=t}function $l(e){let t,n=e.depsTail,i=n;for(;i;){let s=i.prevDep;i.version===-1?(i===n&&(n=s),Fa(i),function(r){let{prevDep:a,nextDep:o}=r;a&&(a.nextDep=o,r.prevDep=void 0),o&&(o.prevDep=a,r.nextDep=void 0)}(i)):t=i,i.dep.activeLink=i.prevActiveLink,i.prevActiveLink=void 0,i=s}e.deps=t,e.depsTail=n}function ia(e){for(let t=e.deps;t;t=t.nextDep)if(t.dep.version!==t.version||t.dep.computed&&(Vl(t.dep.computed)||t.dep.version!==t.version))return!0;return!!e._dirty}function Vl(e){if(4&e.flags&&!(16&e.flags)||(e.flags&=-17,e.globalVersion===Di)||(e.globalVersion=Di,!e.isSSR&&128&e.flags&&(!e.deps&&!e._dirty||!ia(e))))return;e.flags|=2;let t=e.dep,n=Se,i=At;Se=e,At=!0;try{Ul(e);let s=e.fn(e._value);(t.version===0||$e(s,e._value))&&(e.flags|=128,e._value=s,t.version++)}catch(s){throw t.version++,s}finally{Se=n,At=i,$l(e),e.flags&=-3}}function Fa(e,t=!1){let{dep:n,prevSub:i,nextSub:s}=e;if(i&&(i.nextSub=s,e.prevSub=void 0),s&&(s.prevSub=i,e.nextSub=void 0),n.subs===e&&(n.subs=i,!i&&n.computed)){n.computed.flags&=-5;for(let r=n.computed.deps;r;r=r.nextDep)Fa(r,!0)}t||--n.sc||!n.map||n.map.delete(n.key)}function Hu(e,t){e.effect instanceof Rn&&(e=e.effect.fn);let n=new Rn(e);t&&le(n,t);try{n.run()}catch(s){throw n.stop(),s}let i=n.run.bind(n);return i.effect=n,i}function Ku(e){e.effect.stop()}var At=!0,zl=[];function Yt(){zl.push(At),At=!1}function Xt(){let e=zl.pop();At=e===void 0||e}function qo(e){let{cleanup:t}=e;if(e.cleanup=void 0,t){let n=Se;Se=void 0;try{t()}finally{Se=n}}}var Di=0,sa=class{constructor(t,n){this.sub=t,this.dep=n,this.version=n.version,this.nextDep=this.prevDep=this.nextSub=this.prevSub=this.prevActiveLink=void 0}},ai=class{constructor(t){this.computed=t,this.version=0,this.activeLink=void 0,this.subs=void 0,this.map=void 0,this.key=void 0,this.sc=0,this.__v_skip=!0}track(t){if(!Se||!At||Se===this.computed)return;let n=this.activeLink;if(n===void 0||n.sub!==Se)n=this.activeLink=new sa(Se,this),Se.deps?(n.prevDep=Se.depsTail,Se.depsTail.nextDep=n,Se.depsTail=n):Se.deps=Se.depsTail=n,function i(s){if(s.dep.sc++,4&s.sub.flags){let r=s.dep.computed;if(r&&!s.dep.subs){r.flags|=20;for(let o=r.deps;o;o=o.nextDep)i(o)}let a=s.dep.subs;a!==s&&(s.prevSub=a,a&&(a.nextSub=s)),s.dep.subs=s}}(n);else if(n.version===-1&&(n.version=this.version,n.nextDep)){let i=n.nextDep;i.prevDep=n.prevDep,n.prevDep&&(n.prevDep.nextDep=i),n.prevDep=Se.depsTail,n.nextDep=void 0,Se.depsTail.nextDep=n,Se.depsTail=n,Se.deps===n&&(Se.deps=i)}return n}trigger(t){this.version++,Di++,this.notify(t)}notify(t){mr++;try{for(let n=this.subs;n;n=n.prevSub)n.sub.notify()&&n.sub.dep.notify()}finally{Da()}}},Rs=new WeakMap,Nn=Symbol(""),ra=Symbol(""),Fi=Symbol("");function Ye(e,t,n){if(At&&Se){let i=Rs.get(e);i||Rs.set(e,i=new Map);let s=i.get(n);s||(i.set(n,s=new ai),s.map=i,s.key=n),s.track()}}function $t(e,t,n,i,s,r){let a=Rs.get(e);if(!a)return void Di++;let o=l=>{l&&l.trigger()};if(mr++,t==="clear")a.forEach(o);else{let l=J(e),c=l&&dr(n);if(l&&n==="length"){let d=Number(i);a.forEach((u,p)=>{(p==="length"||p===Fi||!Ze(p)&&p>=d)&&o(u)})}else switch((n!==void 0||a.has(void 0))&&o(a.get(n)),c&&o(a.get(Fi)),t){case"add":if(l)c&&o(a.get("length"));else{let u;o(a.get(Nn)),u=e,Ne.call(u)==="[object Map]"&&o(a.get(ra))}break;case"delete":if(!l){let u;o(a.get(Nn)),u=e,Ne.call(u)==="[object Map]"&&o(a.get(ra))}break;case"set":let d;d=e,Ne.call(d)==="[object Map]"&&o(a.get(Nn))}}Da()}function zn(e){let t=pe(e);return t===e?t:(Ye(t,"iterate",Fi),pt(e)?t:t.map(Nt))}function gr(e){return Ye(e=pe(e),"iterate",Fi),e}function Pt(e,t){return Bt(e)?Kt(e)?ni(Nt(t)):ni(t):Nt(t)}var Qu={__proto__:null,[Symbol.iterator](){return jr(this,Symbol.iterator,e=>Pt(this,e))},concat(...e){return zn(this).concat(...e.map(t=>J(t)?zn(t):t))},entries(){return jr(this,"entries",e=>(e[1]=Pt(this,e[1]),e))},every(e,t){return Dt(this,"every",e,t,void 0,arguments)},filter(e,t){return Dt(this,"filter",e,t,n=>n.map(i=>Pt(this,i)),arguments)},find(e,t){return Dt(this,"find",e,t,n=>Pt(this,n),arguments)},findIndex(e,t){return Dt(this,"findIndex",e,t,void 0,arguments)},findLast(e,t){return Dt(this,"findLast",e,t,n=>Pt(this,n),arguments)},findLastIndex(e,t){return Dt(this,"findLastIndex",e,t,void 0,arguments)},forEach(e,t){return Dt(this,"forEach",e,t,void 0,arguments)},includes(...e){return Ur(this,"includes",e)},indexOf(...e){return Ur(this,"indexOf",e)},join(e){return zn(this).join(e)},lastIndexOf(...e){return Ur(this,"lastIndexOf",e)},map(e,t){return Dt(this,"map",e,t,void 0,arguments)},pop(){return xi(this,"pop")},push(...e){return xi(this,"push",e)},reduce(e,...t){return Co(this,"reduce",e,t)},reduceRight(e,...t){return Co(this,"reduceRight",e,t)},shift(){return xi(this,"shift")},some(e,t){return Dt(this,"some",e,t,void 0,arguments)},splice(...e){return xi(this,"splice",e)},toReversed(){return zn(this).toReversed()},toSorted(e){return zn(this).toSorted(e)},toSpliced(...e){return zn(this).toSpliced(...e)},unshift(...e){return xi(this,"unshift",e)},values(){return jr(this,"values",e=>Pt(this,e))}};function jr(e,t,n){let i=gr(e),s=i[t]();return i===e||pt(e)||(s._next=s.next,s.next=()=>{let r=s._next();return r.done||(r.value=n(r.value)),r}),s}var Wu=Array.prototype;function Dt(e,t,n,i,s,r){let a=gr(e),o=a!==e&&!pt(e),l=a[t];if(l!==Wu[t]){let u=l.apply(e,r);return o?Nt(u):u}let c=n;a!==e&&(o?c=function(u,p){return n.call(this,Pt(e,u),p,e)}:n.length>2&&(c=function(u,p){return n.call(this,u,p,e)}));let d=l.call(a,c,i);return o&&s?s(d):d}function Co(e,t,n,i){let s=gr(e),r=s!==e&&!pt(e),a=n,o=!1;s!==e&&(r?(o=i.length===0,a=function(c,d,u){return o&&(o=!1,c=Pt(e,c)),n.call(this,c,Pt(e,d),u,e)}):n.length>3&&(a=function(c,d,u){return n.call(this,c,d,u,e)}));let l=s[t](a,...i);return o?Pt(e,l):l}function Ur(e,t,n){let i=pe(e);Ye(i,"iterate",Fi);let s=i[t](...n);return(s===-1||s===!1)&&Xi(n[0])?(n[0]=pe(n[0]),i[t](...n)):s}function xi(e,t,n=[]){Yt(),mr++;let i=pe(e)[t].apply(e,n);return Da(),Xt(),i}var Ju=bt("__proto__,__v_isRef,__isVue"),Hl=new Set(Object.getOwnPropertyNames(Symbol).filter(e=>e!=="arguments"&&e!=="caller").map(e=>Symbol[e]).filter(Ze));function Gu(e){Ze(e)||(e=String(e));let t=pe(this);return Ye(t,"has",e),t.hasOwnProperty(e)}var Os=class{constructor(t=!1,n=!1){this._isReadonly=t,this._isShallow=n}get(t,n,i){if(n==="__v_skip")return t.__v_skip;let s=this._isReadonly,r=this._isShallow;if(n==="__v_isReactive")return!s;if(n==="__v_isReadonly")return s;if(n==="__v_isShallow")return r;if(n==="__v_raw")return i===(s?r?Jl:Wl:r?Ql:Kl).get(t)||Object.getPrototypeOf(t)===Object.getPrototypeOf(i)?t:void 0;let a=J(t);if(!s){let l;if(a&&(l=Qu[n]))return l;if(n==="hasOwnProperty")return Gu}let o=Reflect.get(t,n,Le(t)?t:i);if((Ze(n)?Hl.has(n):Ju(n))||(s||Ye(t,"get",n),r))return o;if(Le(o)){let l=a&&dr(n)?o:o.value;return s&&fe(l)?Ls(l):l}return fe(o)?s?Ls(o):hn(o):o}},Ps=class extends Os{constructor(t=!1){super(!1,t)}set(t,n,i,s){let r=t[n],a=J(t)&&dr(n);if(!this._isShallow){let c=Bt(r);if(pt(i)||Bt(i)||(r=pe(r),i=pe(i)),!a&&Le(r)&&!Le(i))return c||(r.value=i),!0}let o=a?Number(n)<t.length:me(t,n),l=Reflect.set(t,n,i,Le(t)?t:s);return t===pe(s)&&l&&(o?$e(i,r)&&$t(t,"set",n,i):$t(t,"add",n,i)),l}deleteProperty(t,n){let i=me(t,n);t[n];let s=Reflect.deleteProperty(t,n);return s&&i&&$t(t,"delete",n,void 0),s}has(t,n){let i=Reflect.has(t,n);return Ze(n)&&Hl.has(n)||Ye(t,"has",n),i}ownKeys(t){return Ye(t,"iterate",J(t)?"length":Nn),Reflect.ownKeys(t)}},Bs=class extends Os{constructor(t=!1){super(!0,t)}set(t,n){return!0}deleteProperty(t,n){return!0}},Yu=new Ps,Xu=new Bs,Zu=new Ps(!0),ep=new Bs(!0),$r=e=>e;function fs(e){return function(){return e!=="delete"&&(e==="clear"?void 0:this)}}function vr(e,t){let n,i=(le(n={get(s){let r=this.__v_raw,a=pe(r),o=pe(s);e||($e(s,o)&&Ye(a,"get",s),Ye(a,"get",o));let{has:l}=Reflect.getPrototypeOf(a),c=t?$r:e?ni:Nt;return l.call(a,s)?c(r.get(s)):l.call(a,o)?c(r.get(o)):void(r!==a&&r.get(s))},get size(){let s=this.__v_raw;return e||Ye(pe(s),"iterate",Nn),s.size},has(s){let r=this.__v_raw,a=pe(r),o=pe(s);return e||($e(s,o)&&Ye(a,"has",s),Ye(a,"has",o)),s===o?r.has(s):r.has(s)||r.has(o)},forEach(s,r){let a=this,o=a.__v_raw,l=pe(o),c=t?$r:e?ni:Nt;return e||Ye(l,"iterate",Nn),o.forEach((d,u)=>s.call(r,c(d),c(u),a))}},e?{add:fs("add"),set:fs("set"),delete:fs("delete"),clear:fs("clear")}:{add(s){let r=pe(this),a=Reflect.getPrototypeOf(r),o=pe(s),l=t||pt(s)||Bt(s)?s:o;return a.has.call(r,l)||$e(s,l)&&a.has.call(r,s)||$e(o,l)&&a.has.call(r,o)||(r.add(l),$t(r,"add",l,l)),this},set(s,r){t||pt(r)||Bt(r)||(r=pe(r));let a=pe(this),{has:o,get:l}=Reflect.getPrototypeOf(a),c=o.call(a,s);c||(s=pe(s),c=o.call(a,s));let d=l.call(a,s);return a.set(s,r),c?$e(r,d)&&$t(a,"set",s,r):$t(a,"add",s,r),this},delete(s){let r=pe(this),{has:a,get:o}=Reflect.getPrototypeOf(r),l=a.call(r,s);l||(s=pe(s),l=a.call(r,s)),o&&o.call(r,s);let c=r.delete(s);return l&&$t(r,"delete",s,void 0),c},clear(){let s=pe(this),r=s.size!==0,a=s.clear();return r&&$t(s,"clear",void 0,void 0),a}}),["keys","values","entries",Symbol.iterator].forEach(s=>{n[s]=function(...r){let a,o=this.__v_raw,l=pe(o),c=(a=l,Ne.call(a)==="[object Map]"),d=s==="entries"||s===Symbol.iterator&&c,u=o[s](...r),p=t?$r:e?ni:Nt;return e||Ye(l,"iterate",s==="keys"&&c?ra:Nn),le(Object.create(u),{next(){let{value:w,done:g}=u.next();return g?{value:w,done:g}:{value:d?[p(w[0]),p(w[1])]:p(w),done:g}}})}}),n);return(s,r,a)=>r==="__v_isReactive"?!e:r==="__v_isReadonly"?e:r==="__v_raw"?s:Reflect.get(me(i,r)&&r in s?i:s,r,a)}var tp={get:vr(!1,!1)},np={get:vr(!1,!0)},ip={get:vr(!0,!1)},sp={get:vr(!0,!0)},Kl=new WeakMap,Ql=new WeakMap,Wl=new WeakMap,Jl=new WeakMap;function hn(e){return Bt(e)?e:br(e,!1,Yu,tp,Kl)}function Gl(e){return br(e,!1,Zu,np,Ql)}function Ls(e){return br(e,!0,Xu,ip,Wl)}function rp(e){return br(e,!0,ep,sp,Jl)}function br(e,t,n,i,s){let r;if(!fe(e)||e.__v_raw&&!(t&&e.__v_isReactive)||e.__v_skip||!Object.isExtensible(e))return e;let a=s.get(e);if(a)return a;let o=function(c){switch(c){case"Object":case"Array":return 1;case"Map":case"Set":case"WeakMap":case"WeakSet":return 2;default:return 0}}((r=e,Ne.call(r)).slice(8,-1));if(o===0)return e;let l=new Proxy(e,o===2?i:n);return s.set(e,l),l}function Kt(e){return Bt(e)?Kt(e.__v_raw):!!(e&&e.__v_isReactive)}function Bt(e){return!!(e&&e.__v_isReadonly)}function pt(e){return!!(e&&e.__v_isShallow)}function Xi(e){return!!e&&!!e.__v_raw}function pe(e){let t=e&&e.__v_raw;return t?pe(t):e}function Yl(e){return!me(e,"__v_skip")&&Object.isExtensible(e)&&Ol(e,"__v_skip",!0),e}var Nt=e=>fe(e)?hn(e):e,ni=e=>fe(e)?Ls(e):e;function Le(e){return!!e&&e.__v_isRef===!0}function Ei(e){return Zl(e,!1)}function Xl(e){return Zl(e,!0)}function Zl(e,t){return Le(e)?e:new aa(e,t)}var aa=class{constructor(t,n){this.dep=new ai,this.__v_isRef=!0,this.__v_isShallow=!1,this._rawValue=n?t:pe(t),this._value=n?t:Nt(t),this.__v_isShallow=n}get value(){return this.dep.track(),this._value}set value(t){let n=this._rawValue,i=this.__v_isShallow||pt(t)||Bt(t);$e(t=i?t:pe(t),n)&&(this._rawValue=t,this._value=i?t:Nt(t),this.dep.trigger())}};function ap(e){e.dep&&e.dep.trigger()}function Zi(e){return Le(e)?e.value:e}function op(e){return te(e)?e():Zi(e)}var lp={get:(e,t,n)=>t==="__v_raw"?e:Zi(Reflect.get(e,t,n)),set:(e,t,n,i)=>{let s=e[t];return Le(s)&&!Le(n)?(s.value=n,!0):Reflect.set(e,t,n,i)}};function ja(e){return Kt(e)?e:new Proxy(e,lp)}var oa=class{constructor(t){this.__v_isRef=!0,this._value=void 0;let n=this.dep=new ai,{get:i,set:s}=t(n.track.bind(n),n.trigger.bind(n));this._get=i,this._set=s}get value(){return this._value=this._get()}set value(t){this._set(t)}};function ec(e){return new oa(e)}function cp(e){let t=J(e)?Array(e.length):{};for(let n in e)t[n]=new Ds(e,n,void 0);return t}var Ds=class{constructor(t,n,i){this._object=t,this._defaultValue=i,this.__v_isRef=!0,this._value=void 0,this._key=Ze(n)?n:String(n),this._raw=pe(t);let s=!0,r=t;if(!J(t)||Ze(this._key)||!dr(this._key))do s=!Xi(r)||pt(r);while(s&&(r=r.__v_raw));this._shallow=s}get value(){let t=this._object[this._key];return this._shallow&&(t=Zi(t)),this._value=t===void 0?this._defaultValue:t}set value(t){if(this._shallow&&Le(this._raw[this._key])){let n=this._object[this._key];if(Le(n)){n.value=t;return}}this._object[this._key]=t}get dep(){var t,n;let i;return t=this._raw,n=this._key,(i=Rs.get(t))&&i.get(n)}},la=class{constructor(t){this._getter=t,this.__v_isRef=!0,this.__v_isReadonly=!0,this._value=void 0}get value(){return this._value=this._getter()}};function dp(e,t,n){return Le(e)?e:te(e)?new la(e):!fe(e)||!(arguments.length>1)?Ei(e):new Ds(e,t,n)}var ca=class{constructor(t,n,i){this.fn=t,this.setter=n,this._value=void 0,this.dep=new ai(this),this.__v_isRef=!0,this.deps=void 0,this.depsTail=void 0,this.flags=16,this.globalVersion=Di-1,this.next=void 0,this.effect=this,this.__v_isReadonly=!n,this.isSSR=i}notify(){if(this.flags|=16,!(8&this.flags)&&Se!==this)return jl(this,!0),!0}get value(){let t=this.dep.track();return Vl(this),t&&(t.version=this.dep.version),this._value}set value(t){this.setter&&this.setter(t)}},up={GET:"get",HAS:"has",ITERATE:"iterate"},pp={SET:"set",ADD:"add",DELETE:"delete",CLEAR:"clear"},hs={},Fs=new WeakMap;function fp(){return ln}function tc(e,t=!1,n=ln){if(n){let i=Fs.get(n);i||Fs.set(n,i=[]),i.push(e)}}function Vt(e,t=1/0,n){if(t<=0||!fe(e)||e.__v_skip||((n=n||new Map).get(e)||0)>=t)return e;if(n.set(e,t),t--,Le(e))Vt(e.value,t,n);else if(J(e))for(let i=0;i<e.length;i++)Vt(e[i],t,n);else{let i,s;if(i=e,Ne.call(i)==="[object Set]"||(s=e,Ne.call(s)==="[object Map]"))e.forEach(r=>{Vt(r,t,n)});else{let r;if(r=e,Ne.call(r)==="[object Object]"){for(let a in e)Vt(e[a],t,n);for(let a of Object.getOwnPropertySymbols(e))Object.prototype.propertyIsEnumerable.call(e,a)&&Vt(e[a],t,n)}}}return e}function hp(e,t){}var mp={SETUP_FUNCTION:0,0:"SETUP_FUNCTION",RENDER_FUNCTION:1,1:"RENDER_FUNCTION",NATIVE_EVENT_HANDLER:5,5:"NATIVE_EVENT_HANDLER",COMPONENT_EVENT_HANDLER:6,6:"COMPONENT_EVENT_HANDLER",VNODE_HOOK:7,7:"VNODE_HOOK",DIRECTIVE_HOOK:8,8:"DIRECTIVE_HOOK",TRANSITION_HOOK:9,9:"TRANSITION_HOOK",APP_ERROR_HANDLER:10,10:"APP_ERROR_HANDLER",APP_WARN_HANDLER:11,11:"APP_WARN_HANDLER",FUNCTION_REF:12,12:"FUNCTION_REF",ASYNC_COMPONENT_LOADER:13,13:"ASYNC_COMPONENT_LOADER",SCHEDULER:14,14:"SCHEDULER",COMPONENT_UPDATE:15,15:"COMPONENT_UPDATE",APP_UNMOUNT_CLEANUP:16,16:"APP_UNMOUNT_CLEANUP"};function pi(e,t,n,i){try{return i?e(...i):e()}catch(s){Un(s,t,n)}}function gt(e,t,n,i){if(te(e)){let s=pi(e,t,n,i);return s&&La(s)&&s.catch(r=>{Un(r,t,n)}),s}if(J(e)){let s=[];for(let r=0;r<e.length;r++)s.push(gt(e[r],t,n,i));return s}}function Un(e,t,n,i=!0){let s=t?t.vnode:null,{errorHandler:r,throwUnhandledErrorInProduction:a}=t&&t.appContext.config||de;if(t){let o=t.parent,l=t.proxy,c=`https://vuejs.org/error-reference/#runtime-${n}`;for(;o;){let d=o.ec;if(d){for(let u=0;u<d.length;u++)if(d[u](e,l,c)===!1)return}o=o.parent}if(r){Yt(),pi(r,null,10,[e,l,c]),Xt();return}}(function(o,l=!0,c=!1){if(c)throw o;console.error(o)})(e,i,a)}var rt=[],Rt=-1,ii=[],cn=null,Kn=0,nc=Promise.resolve(),Ts=null;function yr(e){let t=Ts||nc;return e?t.then(this?e.bind(this):e):t}function Ua(e){if(!(1&e.flags)){let t=Ii(e),n=rt[rt.length-1];!n||!(2&e.flags)&&t>=Ii(n)?rt.push(e):rt.splice(function(i){let s=Rt+1,r=rt.length;for(;s<r;){let a=s+r>>>1,o=rt[a],l=Ii(o);l<i||l===i&&2&o.flags?s=a+1:r=a}return s}(t),0,e),e.flags|=1,ic()}}function ic(){Ts||(Ts=nc.then(function e(t){try{for(Rt=0;Rt<rt.length;Rt++){let n=rt[Rt];n&&!(8&n.flags)&&(4&n.flags&&(n.flags&=-2),pi(n,n.i,n.i?15:14),4&n.flags||(n.flags&=-2))}}finally{for(;Rt<rt.length;Rt++){let n=rt[Rt];n&&(n.flags&=-2)}Rt=-1,rt.length=0,js(),Ts=null,(rt.length||ii.length)&&e()}}))}function ji(e){J(e)?ii.push(...e):cn&&e.id===-1?cn.splice(Kn+1,0,e):1&e.flags||(ii.push(e),e.flags|=1),ic()}function To(e,t,n=Rt+1){for(;n<rt.length;n++){let i=rt[n];if(i&&2&i.flags){if(e&&i.id!==e.uid)continue;rt.splice(n,1),n--,4&i.flags&&(i.flags&=-2),i(),4&i.flags||(i.flags&=-2)}}}function js(e){if(ii.length){let t=[...new Set(ii)].sort((n,i)=>Ii(n)-Ii(i));if(ii.length=0,cn)return void cn.push(...t);for(cn=t,Kn=0;Kn<cn.length;Kn++){let n=cn[Kn];4&n.flags&&(n.flags&=-2),8&n.flags||n(),n.flags&=-2}cn=null,Kn=0}}var Ii=e=>e.id==null?2&e.flags?-1:1/0:e.id,Qe=null,xr=null;function Ui(e){let t=Qe;return Qe=e,xr=e&&e.type.__scopeId||null,t}function gp(e){xr=e}function vp(){xr=null}var bp=e=>$a;function $a(e,t=Qe,n){if(!t||e._n)return e;let i=(...s)=>{let r;i._d&&zi(-1);let a=Ui(t),o=Wt.length;try{r=e(...s)}finally{for(let l=Wt.length;l>o;l--)qr();Ui(a),i._d&&zi(1)}return r};return i._n=!0,i._c=!0,i._d=!0,i}function yp(e,t){if(Qe===null)return e;let n=ss(Qe),i=e.dirs||(e.dirs=[]);for(let s=0;s<t.length;s++){let[r,a,o,l=de]=t[s];r&&(te(r)&&(r={mounted:r,updated:r}),r.deep&&Vt(a),i.push({dir:r,instance:n,value:a,oldValue:void 0,arg:o,modifiers:l}))}return e}function Ot(e,t,n,i){let s=e.dirs,r=t&&t.dirs;for(let a=0;a<s.length;a++){let o=s[a];r&&(o.oldValue=r[a].value);let l=o.dir[i];l&&(Yt(),gt(l,n,8,[e.el,o,e,t]),Xt())}}function sc(e,t){if(Ke){let n=Ke.provides,i=Ke.parent&&Ke.parent.provides;i===n&&(n=Ke.provides=Object.create(i)),n[e]=t}}function Ri(e,t,n=!1){let i=at();if(i||Mn){let s=Mn?Mn._context.provides:i?i.parent==null||i.ce?i.vnode.appContext&&i.vnode.appContext.provides:i.parent.provides:void 0;if(s&&e in s)return s[e];if(arguments.length>1)return n&&te(t)?t.call(i&&i.proxy):t}}function xp(){return!!(at()||Mn)}var rc=Symbol.for("v-scx"),ac=()=>Ri(rc);function wp(e,t){return es(e,null,t)}function kp(e,t){return es(e,null,{flush:"post"})}function oc(e,t){return es(e,null,{flush:"sync"})}function si(e,t,n){return es(e,t,n)}function es(e,t,n=de){let i,{immediate:s,flush:r}=n,a=le({},n),o=t&&s||!t&&r!=="post";if(Pn){if(r==="sync"){let u=ac();i=u.__watcherHandles||(u.__watcherHandles=[])}else if(!o){let u=()=>{};return u.stop=He,u.resume=He,u.pause=He,u}}let l=Ke;a.call=(u,p,w)=>gt(u,l,p,w);let c=!1;r==="post"?a.scheduler=u=>{Pe(u,l&&l.suspense)}:r!=="sync"&&(c=!0,a.scheduler=(u,p)=>{p?u():Ua(u)}),a.augmentJob=u=>{t&&(u.flags|=4),c&&(u.flags|=2,l&&(u.id=l.uid,u.i=l))};let d=function(u,p,w=de){let g,_,A,M,{immediate:h,deep:m,once:q,scheduler:T,augmentJob:N,call:f}=w,y=E=>m?E:pt(E)||m===!1||m===0?Vt(E,1):Vt(E),v=!1,k=!1;if(Le(u)?(_=()=>u.value,v=pt(u)):Kt(u)?(_=()=>y(u),v=!0):J(u)?(k=!0,v=u.some(E=>Kt(E)||pt(E)),_=()=>u.map(E=>Le(E)?E.value:Kt(E)?y(E):te(E)?f?f(E,2):E():void 0)):_=te(u)?p?f?()=>f(u,2):u:()=>{if(A){Yt();try{A()}finally{Xt()}}let E=ln;ln=g;try{return f?f(u,3,[M]):u(M)}finally{ln=E}}:He,p&&m){let E=_,V=m===!0?1/0:m;_=()=>Vt(E(),V)}let S=Fl(),x=()=>{g.stop(),S&&S.active&&Ba(S.effects,g)};if(q&&p){let E=p;p=(...V)=>{let B=E(...V);return x(),B}}let I=k?Array(u.length).fill(hs):hs,R=E=>{if(1&g.flags&&(g.dirty||E))if(p){let V=g.run();if(E||m||v||(k?V.some((B,z)=>$e(B,I[z])):$e(V,I))){A&&A();let B=ln;ln=g;try{let z=[V,I===hs?void 0:k&&I[0]===hs?[]:I,M];I=V,f?f(p,3,z):p(...z)}finally{ln=B}}}else g.run()};return N&&N(R),(g=new Rn(_)).scheduler=T?()=>T(R,!1):R,M=E=>tc(E,!1,g),A=g.onStop=()=>{let E=Fs.get(g);if(E){if(f)f(E,4);else for(let V of E)V();Fs.delete(g)}},p?h?R(!0):I=g.run():T?T(R.bind(null,!0),!0):g.run(),x.pause=g.pause.bind(g),x.resume=g.resume.bind(g),x.stop=x,x}(e,t,a);return Pn&&(i?i.push(d):o&&d()),d}function _p(e,t,n){let i,s=this.proxy,r=ie(e)?e.includes(".")?lc(s,e):()=>s[e]:e.bind(s,s);te(t)?i=t:(i=t.handler,n=t);let a=fi(this),o=es(r,i.bind(s),n);return a(),o}function lc(e,t){let n=t.split(".");return()=>{let i=e;for(let s=0;s<n.length&&i;s++)i=i[n[s]];return i}}var an=new WeakMap,cc=Symbol("_vte"),Sn=e=>e&&(e.disabled||e.disabled===""),Ao=e=>"u">typeof SVGElement&&e instanceof SVGElement,No=e=>typeof MathMLElement=="function"&&e instanceof MathMLElement,Vr=(e,t)=>{let n=e&&e.to;return ie(n)?t?t(n):null:n};function ms(e,t,n,{o:{insert:i},m:s},r=2){r===0&&i(e.targetAnchor,t,n);let{el:a,anchor:o,shapeFlag:l,children:c,props:d}=e,u=r===2;if(u&&i(a,t,n),!an.has(e)&&(!u||Sn(d))&&16&l)for(let p=0;p<c.length;p++)s(c[p],t,n,2);u&&i(o,t,n)}var Sp={name:"Teleport",__isTeleport:!0,process(e,t,n,i,s,r,a,o,l,c){let{mc:d,pc:u,pbc:p,o:{insert:w,querySelector:g,createText:_,parentNode:A}}=c,M=Sn(t.props),{dynamicChildren:h}=t,m=(N,f,y)=>{16&N.shapeFlag&&d(N.children,f,y,s,r,a,o,l)},q=(N=t)=>{let f=Sn(N.props),y=N.target=Vr(N.props,g),v=zr(y,N,_,w);y&&(a!=="svg"&&Ao(y)?a="svg":a!=="mathml"&&No(y)&&(a="mathml"),s&&s.isCE&&(s.ce._teleportTargets||(s.ce._teleportTargets=new Set)).add(y),f||(m(N,y,v),wi(N,!1)))},T=N=>{let f=()=>{if(an.get(N)===f){if(an.delete(N),Sn(N.props)){let y=A(N.el)||n;m(N,y,N.anchor),wi(N,!0)}q(N)}};an.set(N,f),Pe(f,r)};if(e==null){let N,f=t.el=_(""),y=t.anchor=_("");if(w(f,n,i),w(y,n,i),(N=t.props)&&(N.defer||N.defer==="")||r&&r.pendingBranch)return void T(t);M&&(m(t,n,y),wi(t,!0)),q()}else{t.el=e.el;let N=t.anchor=e.anchor,f=an.get(e);if(f){f.flags|=8,an.delete(e),T(t);return}t.targetStart=e.targetStart;let y=t.target=e.target,v=t.targetAnchor=e.targetAnchor,k=Sn(e.props),S=k?n:y,x=k?N:v;if(a==="svg"||Ao(y)?a="svg":(a==="mathml"||No(y))&&(a="mathml"),h?(p(e.dynamicChildren,h,S,s,r,a,o),eo(e,t,!0)):l||u(e,t,S,x,s,r,a,o,!1),M)k?t.props&&e.props&&t.props.to!==e.props.to&&(t.props.to=e.props.to):ms(t,n,N,c,1);else if((t.props&&t.props.to)!==(e.props&&e.props.to)){let I=Vr(t.props,g);I&&(t.target=I,ms(t,I,null,c,0))}else k&&ms(t,y,v,c,1);wi(t,M)}},remove(e,t,n,{um:i,o:{remove:s}},r){let{shapeFlag:a,children:o,anchor:l,targetStart:c,targetAnchor:d,target:u,props:p}=e,w=Sn(p),g=r||!w,_=an.get(e);if(_&&(_.flags|=8,an.delete(e)),u&&(s(c),s(d)),r&&s(l),!_&&(w||u)&&16&a)for(let A=0;A<o.length;A++){let M=o[A];i(M,t,n,g,!!M.dynamicChildren)}},move:ms,hydrate:function(e,t,n,i,s,r,{o:{nextSibling:a,parentNode:o,querySelector:l,insert:c,createText:d}},u){function p(A,M){let h=M;for(;h;){if(h&&h.nodeType===8){if(h.data==="teleport start anchor")t.targetStart=h;else if(h.data==="teleport anchor"){t.targetAnchor=h,A._lpa=t.targetAnchor&&a(t.targetAnchor);break}}h=a(h)}}function w(A,M){M.anchor=u(a(A),M,o(A),n,i,s,r)}let g=t.target=Vr(t.props,l),_=Sn(t.props);if(g){let A=g._lpa||g.firstChild;16&t.shapeFlag&&(_?(w(e,t),p(g,A),t.targetAnchor||zr(g,t,d,c,o(e)===g?e:null)):(t.anchor=a(e),p(g,A),t.targetAnchor||zr(g,t,d,c),u(A&&a(A),t,g,n,i,s,r))),wi(t,_)}else _&&16&t.shapeFlag&&(w(e,t),t.targetStart=e,t.targetAnchor=a(e));return t.anchor&&a(t.anchor)}};function wi(e,t){let n=e.ctx;if(n&&n.ut){let i,s;for(t?(i=e.el,s=e.anchor):(i=e.targetStart,s=e.targetAnchor);i&&i!==s;)i.nodeType===1&&i.setAttribute("data-v-owner",n.uid),i=i.nextSibling;n.ut()}}function zr(e,t,n,i,s=null){let r=t.targetStart=n(""),a=t.targetAnchor=n("");return r[cc]=a,e&&(i(r,e,s),i(a,e,s)),a}var kt=Symbol("_leaveCb"),ki=Symbol("_enterCb");function Va(){let e={isMounted:!1,isLeaving:!1,isUnmounting:!1,leavingVNodes:new Map};return ns(()=>{e.isMounted=!0}),_r(()=>{e.isUnmounting=!0}),e}var wt=[Function,Array],za={mode:String,appear:Boolean,persisted:Boolean,onBeforeEnter:wt,onEnter:wt,onAfterEnter:wt,onEnterCancelled:wt,onBeforeLeave:wt,onLeave:wt,onAfterLeave:wt,onLeaveCancelled:wt,onBeforeAppear:wt,onAppear:wt,onAfterAppear:wt,onAppearCancelled:wt},dc=e=>{let t=e.subTree;return t.component?dc(t.component):t};function uc(e){let t=e[0];if(e.length>1){for(let n of e)if(n.type!==Oe){t=n;break}}return t}var pc={name:"BaseTransition",props:za,setup(e,{slots:t}){let n=at(),i=Va();return()=>{let s=t.default&&wr(t.default(),!0),r=s&&s.length?uc(s):n.subTree?Fc():void 0;if(!r)return;let a=pe(e),{mode:o}=a;if(i.isLeaving)return Hr(r);let l=Mo(r);if(!l)return Hr(r);let c=oi(l,a,i,n,u=>c=u);l.type!==Oe&&Zt(l,c);let d=n.subTree&&Mo(n.subTree);if(d&&d.type!==Oe&&!Tt(d,l)&&dc(n).type!==Oe){let u=oi(d,a,i,n);if(Zt(d,u),o==="out-in"&&l.type!==Oe)return i.isLeaving=!0,u.afterLeave=()=>{i.isLeaving=!1,8&n.job.flags||n.update(),delete u.afterLeave,d=void 0},Hr(r);o==="in-out"&&l.type!==Oe?u.delayLeave=(p,w,g)=>{fc(i,d)[String(d.key)]=d,p[kt]=()=>{w(),p[kt]=void 0,delete c.delayedLeave,d=void 0},c.delayedLeave=()=>{g(),delete c.delayedLeave,d=void 0}}:d=void 0}else d&&(d=void 0);return r}}};function fc(e,t){let{leavingVNodes:n}=e,i=n.get(t.type);return i||(i=Object.create(null),n.set(t.type,i)),i}function oi(e,t,n,i,s){let{appear:r,mode:a,persisted:o=!1,onBeforeEnter:l,onEnter:c,onAfterEnter:d,onEnterCancelled:u,onBeforeLeave:p,onLeave:w,onAfterLeave:g,onLeaveCancelled:_,onBeforeAppear:A,onAppear:M,onAfterAppear:h,onAppearCancelled:m}=t,q=String(e.key),T=fc(n,e),N=(v,k)=>{v&&gt(v,i,9,k)},f=(v,k)=>{let S=k[1];N(v,k),J(v)?v.every(x=>x.length<=1)&&S():v.length<=1&&S()},y={mode:a,persisted:o,beforeEnter(v){let k=l;if(!n.isMounted)if(r)k=A||l;else return;v[kt]&&v[kt](!0);let S=T[q];S&&Tt(e,S)&&S.el[kt]&&S.el[kt](),N(k,[v])},enter(v){if(T[q]===e)return;let k=c,S=d,x=u;if(!n.isMounted)if(r)k=M||c,S=h||d,x=m||u;else return;let I=!1;v[ki]=E=>{I||(I=!0,E?N(x,[v]):N(S,[v]),y.delayedLeave&&y.delayedLeave(),v[ki]=void 0)};let R=v[ki].bind(null,!1);k?f(k,[v,R]):R()},leave(v,k){let S=String(e.key);if(v[ki]&&v[ki](!0),n.isUnmounting)return k();N(p,[v]);let x=!1;v[kt]=R=>{x||(x=!0,k(),R?N(_,[v]):N(g,[v]),v[kt]=void 0,T[S]===e&&delete T[S])};let I=v[kt].bind(null,!1);T[S]=e,w?f(w,[v,I]):I()},clone(v){let k=oi(v,t,n,i,s);return s&&s(k),k}};return y}function Hr(e){if(ts(e))return(e=Lt(e)).children=null,e}function Mo(e){if(!ts(e))return e.type.__isTeleport&&e.children?uc(e.children):e;if(e.component)return e.component.subTree;let{shapeFlag:t,children:n}=e;if(n){if(16&t)return n[0];if(32&t&&te(n.default))return n.default()}}function Zt(e,t){6&e.shapeFlag&&e.component?(e.transition=t,Zt(e.component.subTree,t)):128&e.shapeFlag?(e.ssContent.transition=t.clone(e.ssContent),e.ssFallback.transition=t.clone(e.ssFallback)):e.transition=t}function wr(e,t=!1,n){let i=[],s=0;for(let r=0;r<e.length;r++){let a=e[r],o=n==null?a.key:String(n)+String(a.key!=null?a.key:r);a.type===Ve?(128&a.patchFlag&&s++,i=i.concat(wr(a.children,t,o))):(t||a.type!==Oe)&&i.push(o!=null?Lt(a,{key:o}):a)}if(s>1)for(let r=0;r<i.length;r++)i[r].patchFlag=-2;return i}function Ha(e,t){return te(e)?le({name:e.name},t,{setup:e}):e}function qp(){let e=at();return e?(e.appContext.config.idPrefix||"v")+"-"+e.ids[0]+e.ids[1]++:""}function Ka(e){e.ids=[e.ids[0]+e.ids[2]+++"-",0,0]}function Cp(e){let t=at(),n=Xl(null);return t&&Object.defineProperty(t.refs===de?t.refs={}:t.refs,e,{enumerable:!0,get:()=>n.value,set:i=>n.value=i}),n}function Eo(e,t){let n;return!!((n=Object.getOwnPropertyDescriptor(e,t))&&!n.configurable)}var Us=new WeakMap;function ri(e,t,n,i,s=!1){if(J(e))return void e.forEach((_,A)=>ri(_,t&&(J(t)?t[A]:t),n,i,s));if(Qt(i)&&!s){512&i.shapeFlag&&i.type.__asyncResolved&&i.component.subTree.component&&ri(e,t,n,i.component.subTree);return}let r=4&i.shapeFlag?ss(i.component):i.el,a=s?null:r,{i:o,r:l}=e,c=t&&t.r,d=o.refs===de?o.refs={}:o.refs,u=o.setupState,p=pe(u),w=u===de?Qn:_=>!Eo(d,_)&&me(p,_),g=(_,A)=>!(A&&Eo(d,A));if(c!=null&&c!==l&&(Io(t),ie(c)?(d[c]=null,w(c)&&(u[c]=null)):Le(c)&&(g(c,t.k)&&(c.value=null),t.k&&(d[t.k]=null))),te(l))pi(l,o,12,[a,d]);else{let _=ie(l),A=Le(l);if(_||A){let M=()=>{if(e.f){let h=_?w(l)?u[l]:d[l]:g()||!e.k?l.value:d[e.k];if(s)J(h)&&Ba(h,r);else if(J(h))h.includes(r)||h.push(r);else if(_)d[l]=[r],w(l)&&(u[l]=d[l]);else{let m=[r];g(l,e.k)&&(l.value=m),e.k&&(d[e.k]=m)}}else _?(d[l]=a,w(l)&&(u[l]=a)):A&&(g(l,e.k)&&(l.value=a),e.k&&(d[e.k]=a))};if(a){let h=()=>{M(),Us.delete(e)};h.id=-1,Us.set(e,h),Pe(h,n)}else Io(e),M()}}}function Io(e){let t=Us.get(e);t&&(t.flags|=8,Us.delete(e))}var Ro=!1,Hn=()=>{Ro||(console.error("Hydration completed but contains mismatches."),Ro=!0)},gs=e=>{if(e.nodeType===1){if(e.namespaceURI.includes("svg")&&e.tagName!=="foreignObject")return"svg";if(e.namespaceURI.includes("MathML"))return"mathml"}},Wn=e=>e.nodeType===8;function Tp(e){let{mt:t,p:n,o:{patchProp:i,createText:s,nextSibling:r,parentNode:a,remove:o,insert:l,createComment:c}}=e,d=(h,m,q,T,N,f=!1)=>{f=f||!!m.dynamicChildren;let y=Wn(h)&&h.data==="[",v=()=>g(h,m,q,T,N,y),{type:k,ref:S,shapeFlag:x,patchFlag:I}=m,R=h.nodeType;m.el=h,I===-2&&(f=!1,m.dynamicChildren=null);let E=null;switch(k){case dn:R!==3?m.children===""?(l(m.el=s(""),a(h),h),E=h):E=v():(h.data!==m.children&&(Hn(),h.data=m.children),E=r(h));break;case Oe:M(h)?(E=r(h),A(m.el=h.content.firstChild,h,q)):E=R!==8||y?v():r(h);break;case En:if(y&&(R=(h=r(h)).nodeType),R===1||R===3){E=h;let V=!m.children.length;for(let B=0;B<m.staticCount;B++)V&&(m.children+=E.nodeType===1?E.outerHTML:E.data),B===m.staticCount-1&&(m.anchor=E),E=r(E);return y?r(E):E}v();break;case Ve:E=y?w(h,m,q,T,N,f):v();break;default:if(1&x)E=R===1&&m.type.toLowerCase()===h.tagName.toLowerCase()||M(h)?u(h,m,q,T,N,f):v();else if(6&x){m.slotScopeIds=N;let V=a(h);if(E=y?_(h):Wn(h)&&h.data==="teleport start"?_(h,h.data,"teleport end"):r(h),t(m,V,null,q,T,gs(V),f),Qt(m)&&!m.type.__asyncResolved){let B;y?(B=Te(Ve)).anchor=E?E.previousSibling:V.lastChild:B=h.nodeType===3?no(""):Te("div"),B.el=h,m.component.subTree=B}}else 64&x?E=R!==8?v():m.type.hydrate(h,m,q,T,N,f,e,p):128&x&&(E=m.type.hydrate(h,m,q,T,gs(a(h)),N,f,e,d))}return S!=null&&ri(S,null,T,m),E},u=(h,m,q,T,N,f)=>{f=f||!!m.dynamicChildren;let{type:y,dynamicProps:v,props:k,patchFlag:S,shapeFlag:x,dirs:I,transition:R}=m,E=y==="input"||y==="option",V=!!v;if(E||V||S!==-1){let B;I&&Ot(m,null,q,"created");let z=!1;if(M(h)){z=Oc(null,R)&&q&&q.vnode.props&&q.vnode.props.appear;let H=h.content.firstChild;if(z){let X=H.getAttribute("class");X&&(H.$cls=X),R.beforeEnter(H)}A(H,h,q),m.el=h=H}if(16&x&&!(k&&(k.innerHTML||k.textContent))){let H=p(h.firstChild,m,h,q,T,N,f);for(H&&!vs(h,1)&&Hn();H;){let X=H;H=H.nextSibling,o(X)}}else if(8&x){let H=m.children;H[0]===`
`&&(h.tagName==="PRE"||h.tagName==="TEXTAREA")&&(H=H.slice(1));let{textContent:X}=h;X!==H&&X!==H.replace(/\r\n|\r/g,`
`)&&(vs(h,0)||Hn(),h.textContent=m.children)}if(k){if(E||V||!f||48&S){let H=h.tagName.includes("-"),X=h.namespaceURI.includes("svg")?"svg":h.namespaceURI.includes("MathML")?"mathml":void 0;for(let ne in k)(E&&(ne.endsWith("value")||ne==="indeterminate")||Fn(ne)&&!Ht(ne)||ne[0]==="."||H&&!Ht(ne)||v&&v.includes(ne))&&i(h,ne,null,k[ne],X,q)}else if(k.onClick)i(h,"onClick",null,k.onClick,void 0,q);else if(4&S&&Kt(k.style))for(let H in k.style)k.style[H]}(B=k&&k.onVnodeBeforeMount)&&lt(B,q,m),I&&Ot(m,null,q,"beforeMount"),((B=k&&k.onVnodeMounted)||I||z)&&Pc(()=>{B&&lt(B,q,m),z&&R.enter(h),I&&Ot(m,null,q,"mounted")},T)}return h.nextSibling},p=(h,m,q,T,N,f,y)=>{y=y||!!m.dynamicChildren;let v=m.children,k=v.length,S=!1;for(let x=0;x<k;x++){let I=y?v[x]:v[x]=ct(v[x]),R=I.type===dn;h?(R&&!y&&x+1<k&&ct(v[x+1]).type===dn&&(l(s(h.data.slice(I.children.length)),q,r(h)),h.data=I.children),h=d(h,I,T,N,f,y)):R&&!I.children?l(I.el=s(""),q):(!S&&(S=!0,vs(q,1)||Hn()),n(null,I,q,null,T,N,gs(q),f))}return h},w=(h,m,q,T,N,f)=>{let{slotScopeIds:y}=m;y&&(N=N?N.concat(y):y);let v=a(h),k=p(r(h),m,v,q,T,N,f);return k&&Wn(k)&&k.data==="]"?r(m.anchor=k):(Hn(),l(m.anchor=c("]"),v,k),k)},g=(h,m,q,T,N,f)=>{var y,v,k;if(y=h,v=m,vs(y.parentElement,1)||(k=y).nodeType===1&&da(k.getAttribute($s),1)||function({props:I}){let R=I&&I[$s];return typeof R=="string"&&da(R,1)}(v)||Hn(),m.el=null,f){let I=_(h);for(;;){let R=r(h);if(R&&R!==I)o(R);else break}}let S=r(h),x=a(h);return o(h),n(null,m,x,S,q,T,gs(x),N),q&&(q.vnode.el=m.el,Sr(q,m.el)),S},_=(h,m="[",q="]")=>{let T=0;for(;h;)if((h=r(h))&&Wn(h)&&(h.data===m&&T++,h.data===q)){if(T===0)return r(h);T--}return h},A=(h,m,q)=>{let T=m.parentNode;T&&T.replaceChild(h,m);let N=q;for(;N;)N.vnode.el===m&&(N.vnode.el=N.subTree.el=h),N=N.parent},M=h=>h.nodeType===1&&h.tagName==="TEMPLATE";return[(h,m)=>{if(!m.hasChildNodes()){n(null,h,m),js(),m._vnode=h;return}d(m.firstChild,h,null,null,null),js(),m._vnode=h},d]}var $s="data-allow-mismatch",Ap={0:"text",1:"children",2:"class",3:"style",4:"attribute"};function vs(e,t){if(t===0||t===1)for(;e&&!e.hasAttribute($s);)e=e.parentElement;return da(e&&e.getAttribute($s),t)}function da(e,t){if(e==null)return!1;{if(e==="")return!0;let n=e.split(",");return!!(t===0&&n.includes("children"))||n.includes(Ap[t])}}var Np=fr().requestIdleCallback||(e=>setTimeout(e,1)),Mp=fr().cancelIdleCallback||(e=>clearTimeout(e)),Ep=(e=1e4)=>t=>{let n=Np(t,{timeout:e});return()=>Mp(n)},Ip=e=>(t,n)=>{let i=new IntersectionObserver(s=>{for(let r of s)if(r.isIntersecting){i.disconnect(),t();break}},e);return n(s=>{if(s instanceof Element){if(function(r){let{top:a,left:o,bottom:l,right:c}=r.getBoundingClientRect(),{innerHeight:d,innerWidth:u}=window;return(a>0&&a<d||l>0&&l<d)&&(o>0&&o<u||c>0&&c<u)}(s))return t(),i.disconnect(),!1;i.observe(s)}}),()=>i.disconnect()},Rp=e=>t=>{if(e){let n=matchMedia(e);if(!n.matches)return n.addEventListener("change",t,{once:!0}),()=>n.removeEventListener("change",t);t()}},Op=(e=[])=>(t,n)=>{ie(e)&&(e=[e]);let i=!1,s=a=>{i||(i=!0,r(),t(),a.target.dispatchEvent(new a.constructor(a.type,a)))},r=()=>{n(a=>{for(let o of e)a.removeEventListener(o,s)})};return n(a=>{for(let o of e)a.addEventListener(o,s,{once:!0})}),r},Qt=e=>!!e.type.__asyncLoader;function Pp(e){let t;te(e)&&(e={loader:e});let{loader:n,loadingComponent:i,errorComponent:s,delay:r=200,hydrate:a,timeout:o,suspensible:l=!0,onError:c}=e,d=null,u=0,p=()=>{let w;return d||(w=d=n().catch(g=>{if(g=g instanceof Error?g:Error(String(g)),c)return new Promise((_,A)=>{c(g,()=>_((u++,d=null,p())),()=>A(g),u+1)});throw g}).then(g=>w!==d&&d?d:(g&&(g.__esModule||g[Symbol.toStringTag]==="Module")&&(g=g.default),t=g,g)))};return Ha({name:"AsyncComponentWrapper",__asyncLoader:p,__asyncHydrate(w,g,_){let A=w.isConnected,M=!1;(g.bu||(g.bu=[])).push(()=>M=!0);let h=()=>{M||w.parentNode&&(!A||w.isConnected)&&_()},m=a?()=>{let q=a(h,T=>function(N,f){if(Wn(N)&&N.data==="["){let y=1,v=N.nextSibling;for(;v;){if(v.nodeType===1){if(f(v)===!1)break}else if(Wn(v))if(v.data==="]"){if(--y==0)break}else v.data==="["&&y++;v=v.nextSibling}}else f(N)}(w,T));q&&(g.bum||(g.bum=[])).push(q)}:h;t?m():p().then(()=>!g.isUnmounted&&m())},get __asyncResolved(){return t},setup(){let w,g,_=Ke;if(Ka(_),t)return()=>bs(t,_);let A=q=>{d=null,Un(q,_,13,!s)};if(l&&_.suspense||Pn)return p().then(q=>()=>bs(q,_)).catch(q=>(A(q),()=>s?Te(s,{error:q}):null));let M=Ei(!1),h=Ei(),m=Ei(!!r);return is(()=>{w!=null&&clearTimeout(w),g!=null&&clearTimeout(g)}),r&&(g=setTimeout(()=>{_.isUnmounted||(m.value=!1)},r)),o!=null&&(w=setTimeout(()=>{if(!_.isUnmounted&&!M.value&&!h.value){let q=Error(`Async component timed out after ${o}ms.`);A(q),h.value=q}},o)),p().then(()=>{!_.isUnmounted&&(M.value=!0,_.parent&&ts(_.parent.vnode)&&_.parent.update())}).catch(q=>{if(_.isUnmounted){d=null;return}A(q),h.value=q}),()=>M.value&&t?bs(t,_):h.value&&s?Te(s,{error:h.value}):i&&!m.value?bs(i,_):void 0}})}function bs(e,t){let{ref:n,props:i,children:s,ce:r}=t.vnode,a=Te(e,i,s);return a.ref=n,a.ce=r,delete t.vnode.ce,a}var ts=e=>e.type.__isKeepAlive,Bp={name:"KeepAlive",__isKeepAlive:!0,props:{include:[String,RegExp,Array],exclude:[String,RegExp,Array],max:[String,Number]},setup(e,{slots:t}){let n=at(),i=n.ctx;if(!i.renderer)return()=>{let h=t.default&&t.default();return h&&h.length===1?h[0]:h};let s=new Map,r=new Set,a=null,o=n.suspense,{renderer:{p:l,m:c,um:d,o:{createElement:u}}}=i,p=u("div");function w(h){Kr(h),d(h,n,o,!0)}function g(h){s.forEach((m,q)=>{let T=xa(Qt(m)?m.type.__asyncResolved||{}:m.type);T&&!h(T)&&_(q)})}function _(h){let m=s.get(h);!m||a&&Tt(m,a)?a&&Kr(a):w(m),s.delete(h),r.delete(h)}i.activate=(h,m,q,T,N)=>{let f=h.component;c(h,m,q,0,o),l(f.vnode,h,m,q,f,o,T,h.slotScopeIds,N),Pe(()=>{f.isDeactivated=!1,f.a&&ei(f.a);let y=h.props&&h.props.onVnodeMounted;y&&lt(y,f.parent,h)},o)},i.deactivate=h=>{let m=h.component;Ks(m.m),Ks(m.a),c(h,p,null,1,o),Pe(()=>{m.da&&ei(m.da);let q=h.props&&h.props.onVnodeUnmounted;q&&lt(q,m.parent,h),m.isDeactivated=!0},o)},si(()=>[e.include,e.exclude],([h,m])=>{h&&g(q=>Ci(h,q)),m&&g(q=>!Ci(m,q))},{flush:"post",deep:!0});let A=null,M=()=>{A!=null&&(Qs(n.subTree.type)?Pe(()=>{s.set(A,ys(n.subTree))},n.subTree.suspense):s.set(A,ys(n.subTree)))};return ns(M),kr(M),_r(()=>{s.forEach(h=>{let{subTree:m,suspense:q}=n,T=ys(m);if(h.type===T.type&&h.key===T.key){Kr(T);let N=T.component.da;N&&Pe(N,q);return}w(h)})}),()=>{if(A=null,!t.default)return a=null;let h=t.default(),m=h[0];if(h.length>1)return a=null,h;if(!en(m)||!(4&m.shapeFlag)&&!(128&m.shapeFlag))return a=null,m;let q=ys(m);if(q.type===Oe)return a=null,q;let T=q.type,N=xa(Qt(q)?q.type.__asyncResolved||{}:T),{include:f,exclude:y,max:v}=e;if(f&&(!N||!Ci(f,N))||y&&N&&Ci(y,N))return q.shapeFlag&=-257,a=q,m;let k=q.key==null?T:q.key,S=s.get(k);return q.el&&(q=Lt(q),128&m.shapeFlag&&(m.ssContent=q)),A=k,S?(q.el=S.el,q.component=S.component,q.transition&&Zt(q,q.transition),q.shapeFlag|=512,r.delete(k),r.add(k)):(r.add(k),v&&r.size>parseInt(v,10)&&_(r.values().next().value)),q.shapeFlag|=256,a=q,Qs(m.type)?m:q}}};function Ci(e,t){let n;return J(e)?e.some(i=>Ci(i,t)):ie(e)?e.split(",").includes(t):(n=e,Ne.call(n)==="[object RegExp]"&&(e.lastIndex=0,e.test(t)))}function hc(e,t){gc(e,"a",t)}function mc(e,t){gc(e,"da",t)}function gc(e,t,n=Ke){let i=e.__wdc||(e.__wdc=()=>{let s=n;for(;s;){if(s.isDeactivated)return;s=s.parent}return e()});if(Vs(t,i,n),n){let s=n.parent;for(;s&&s.parent;)ts(s.parent.vnode)&&function(r,a,o,l){let c=Vs(a,r,l,!0);is(()=>{Ba(l[a],c)},o)}(i,t,n,s),s=s.parent}}function Kr(e){e.shapeFlag&=-257,e.shapeFlag&=-513}function ys(e){return 128&e.shapeFlag?e.ssContent:e}function Vs(e,t,n=Ke,i=!1){if(n){let s=n[e]||(n[e]=[]),r=t.__weh||(t.__weh=(...a)=>{Yt();let o=fi(n),l=gt(t,n,e,a);return o(),Xt(),l});return i?s.unshift(r):s.push(r),r}}var tn=e=>(t,n=Ke)=>{Pn&&e!=="sp"||Vs(e,(...i)=>t(...i),n)},vc=tn("bm"),ns=tn("m"),Qa=tn("bu"),kr=tn("u"),_r=tn("bum"),is=tn("um"),bc=tn("sp"),yc=tn("rtg"),xc=tn("rtc");function wc(e,t=Ke){Vs("ec",e,t)}var Wa="components";function Lp(e,t){return Ja(Wa,e,!0,t)||e}var kc=Symbol.for("v-ndc");function Dp(e){return ie(e)?Ja(Wa,e,!1)||e:e||kc}function Fp(e){return Ja("directives",e)}function Ja(e,t,n=!0,i=!1){let s=Qe||Ke;if(s){let r=s.type;if(e===Wa){let o=xa(r,!1);if(o&&(o===t||o===xe(t)||o===jn(xe(t))))return r}let a=Oo(s[e]||r[e],t)||Oo(s.appContext[e],t);return!a&&i?r:a}}function Oo(e,t){return e&&(e[t]||e[xe(t)]||e[jn(xe(t))])}function jp(e,t,n,i){let s,r=n&&n[i],a=J(e);if(a||ie(e)){let o=a&&Kt(e),l=!1,c=!1;o&&(l=!pt(e),c=Bt(e),e=gr(e)),s=Array(e.length);for(let d=0,u=e.length;d<u;d++)s[d]=t(l?c?ni(Nt(e[d])):Nt(e[d]):e[d],d,void 0,r&&r[d])}else if(typeof e=="number"){s=Array(e);for(let o=0;o<e;o++)s[o]=t(o+1,o,void 0,r&&r[o])}else if(fe(e))if(e[Symbol.iterator])s=Array.from(e,(o,l)=>t(o,l,void 0,r&&r[l]));else{let o=Object.keys(e);s=Array(o.length);for(let l=0,c=o.length;l<c;l++){let d=o[l];s[l]=t(e[d],d,l,r&&r[l])}}else s=[];return n&&(n[i]=s),s}function Up(e,t){for(let n=0;n<t.length;n++){let i=t[n];if(J(i))for(let s=0;s<i.length;s++)e[i[s].name]=i[s].fn;else i&&(e[i.name]=i.key?(...s)=>{let r=i.fn(...s);return r&&(r.key=i.key),r}:i.fn)}return e}function $p(e,t,n={},i,s,r){let a;if(Qe.ce||Qe.parent&&Qt(Qe.parent)&&Qe.parent.ce){let c=r!=null&&n.key==null?le({},n,{key:r}):n,d=Object.keys(c).length>0;return t!=="default"&&(c.name=t),Vi(),Ws(Ve,null,[Te("slot",c,i&&i())],d?-2:64)}let o=e[t];o&&o._c&&(o._d=!1);let l=Wt.length;Vi();try{let c=o&&Ga(o(n)),d=n.key||r||c&&c.key;a=Ws(Ve,{key:(d&&!Ze(d)?d:`_${t}`)+(!c&&i?"_fb":"")},c||(i?i():[]),c&&e._===1?64:-2)}catch(c){for(let d=Wt.length;d>l;d--)qr();throw c}finally{o&&o._c&&(o._d=!0)}return!s&&a.scopeId&&(a.slotScopeIds=[a.scopeId+"-s"]),a}function Ga(e){return e.some(t=>!en(t)||t.type!==Oe&&(t.type!==Ve||!!Ga(t.children)))?e:null}function Vp(e,t){let n={};for(let i in e)n[t&&/[A-Z]/.test(i)?`on:${i}`:Zn(i)]=e[i];return n}var ua=e=>e?$c(e)?ss(e):ua(e.parent):null,Oi=le(Object.create(null),{$:e=>e,$el:e=>e.vnode.el,$data:e=>e.data,$props:e=>e.props,$attrs:e=>e.attrs,$slots:e=>e.slots,$refs:e=>e.refs,$parent:e=>ua(e.parent),$root:e=>ua(e.root),$host:e=>e.ce,$emit:e=>e.emit,$options:e=>ha(e),$forceUpdate:e=>e.f||(e.f=()=>{Ua(e.update)}),$nextTick:e=>e.n||(e.n=yr.bind(e.proxy)),$watch:e=>_p.bind(e)}),Qr=(e,t)=>e!==de&&!e.__isScriptSetup&&me(e,t),pa={get({_:e},t){let n,i;if(t==="__v_skip")return!0;let{ctx:s,setupState:r,data:a,props:o,accessCache:l,type:c,appContext:d}=e;if(t[0]!=="$"){let p=l[t];if(p!==void 0)switch(p){case 1:return r[t];case 2:return a[t];case 4:return s[t];case 3:return o[t]}else{if(Qr(r,t))return l[t]=1,r[t];if(a!==de&&me(a,t))return l[t]=2,a[t];if(me(o,t))return l[t]=3,o[t];if(s!==de&&me(s,t))return l[t]=4,s[t];fa&&(l[t]=0)}}let u=Oi[t];return u?(t==="$attrs"&&Ye(e.attrs,"get",""),u(e)):(n=c.__cssModules)&&(n=n[t])?n:s!==de&&me(s,t)?(l[t]=4,s[t]):me(i=d.config.globalProperties,t)?i[t]:void 0},set({_:e},t,n){let{data:i,setupState:s,ctx:r}=e;return Qr(s,t)?(s[t]=n,!0):i!==de&&me(i,t)?(i[t]=n,!0):!me(e.props,t)&&!(t[0]==="$"&&t.slice(1)in e)&&(r[t]=n,!0)},has({_:{data:e,setupState:t,accessCache:n,ctx:i,appContext:s,props:r,type:a}},o){let l;return!!(n[o]||e!==de&&o[0]!=="$"&&me(e,o)||Qr(t,o)||me(r,o)||me(i,o)||me(Oi,o)||me(s.config.globalProperties,o)||(l=a.__cssModules)&&l[o])},defineProperty(e,t,n){return n.get!=null?e._.accessCache[t]=0:me(n,"value")&&this.set(e,t,n.value,null),Reflect.defineProperty(e,t,n)}},zp=le({},pa,{get(e,t){if(t!==Symbol.unscopables)return pa.get(e,t,e)},has:(e,t)=>t[0]!=="_"&&!Ru(t)});function Hp(){return null}function Kp(){return null}function Qp(e){}function Wp(e){}function Jp(){return null}function Gp(){}function Yp(e,t){return null}function Xp(){return _c().slots}function Zp(){return _c().attrs}function _c(e){let t=at();return t.setupContext||(t.setupContext=Kc(t))}function $i(e){return J(e)?e.reduce((t,n)=>(t[n]=null,t),{}):e}function ef(e,t){let n=$i(e);for(let i in t){if(i.startsWith("__skip"))continue;let s=n[i];s?J(s)||te(s)?s=n[i]={type:s,default:t[i]}:s.default=t[i]:s===null&&(s=n[i]={default:t[i]}),s&&t[`__skip_${i}`]&&(s.skipFactory=!0)}return n}function tf(e,t){return e&&t?J(e)&&J(t)?e.concat(t):le({},$i(e),$i(t)):e||t}function nf(e,t){let n={};for(let i in e)t.includes(i)||Object.defineProperty(n,i,{enumerable:!0,get:()=>e[i]});return n}function sf(e){let t=at(),n=Pn,i=e();Hi(),n&&Yn(!1);let s=()=>{fi(t),n&&Yn(!0)},r=()=>{at()!==t&&t.scope.off(),Hi(),n&&Yn(!1)};return La(i)&&(i=i.catch(a=>{throw s(),Promise.resolve().then(()=>Promise.resolve().then(r)),a})),[i,()=>{s(),Promise.resolve().then(r)}]}var fa=!0;function Po(e,t,n){gt(J(e)?e.map(i=>i.bind(t.proxy)):e.bind(t.proxy),t,n)}function ha(e){let t,n=e.type,{mixins:i,extends:s}=n,{mixins:r,optionsCache:a,config:{optionMergeStrategies:o}}=e.appContext,l=a.get(n);return l?t=l:r.length||i||s?(t={},r.length&&r.forEach(c=>zs(t,c,o,!0)),zs(t,n,o)):t=n,fe(n)&&a.set(n,t),t}function zs(e,t,n,i=!1){let{mixins:s,extends:r}=t;for(let a in r&&zs(e,r,n,!0),s&&s.forEach(o=>zs(e,o,n,!0)),t)if(!(i&&a==="expose")){let o=rf[a]||n&&n[a];e[a]=o?o(e[a],t[a]):t[a]}return e}var rf={data:Bo,props:Lo,emits:Lo,methods:_i,computed:_i,beforeCreate:it,created:it,beforeMount:it,mounted:it,beforeUpdate:it,updated:it,beforeDestroy:it,beforeUnmount:it,destroyed:it,unmounted:it,activated:it,deactivated:it,errorCaptured:it,serverPrefetch:it,components:_i,directives:_i,watch:function(e,t){if(!e)return t;if(!t)return e;let n=le(Object.create(null),e);for(let i in t)n[i]=it(e[i],t[i]);return n},provide:Bo,inject:function(e,t){return _i(ma(e),ma(t))}};function Bo(e,t){return t?e?function(){return le(te(e)?e.call(this,this):e,te(t)?t.call(this,this):t)}:t:e}function ma(e){if(J(e)){let t={};for(let n=0;n<e.length;n++)t[e[n]]=e[n];return t}return e}function it(e,t){return e?[...new Set([].concat(e,t))]:t}function _i(e,t){return e?le(Object.create(null),e,t):t}function Lo(e,t){return e?J(e)&&J(t)?[...new Set([...e,...t])]:le(Object.create(null),$i(e),$i(t??{})):t}function Sc(){return{app:null,config:{isNativeTag:Qn,performance:!1,globalProperties:{},optionMergeStrategies:{},errorHandler:void 0,warnHandler:void 0,compilerOptions:{}},mixins:[],components:{},directives:{},provides:Object.create(null),optionsCache:new WeakMap,propsCache:new WeakMap,emitsCache:new WeakMap}}var af=0,Mn=null;function of(e,t,n=de){let i=at(),s=xe(t),r=dt(t),a=qc(e,s),o=ec((l,c)=>{let d,u,p=de;return oc(()=>{let w=e[s];$e(d,w)&&(d=w,c())}),{get:()=>(l(),n.get?n.get(d):d),set(w){let g=n.set?n.set(w):w;if(!$e(g,d)&&!(p!==de&&$e(w,p)))return;let _=i.vnode.props,A=!!(_&&(t in _||s in _||r in _)&&(`onUpdate:${t}`in _||`onUpdate:${s}`in _||`onUpdate:${r}`in _));A||(d=w,c()),i.emit(`update:${t}`,g),$e(w,p)&&($e(w,g)&&!$e(g,u)||A&&p!==de&&!$e(g,d))&&c(),p=w,u=g}}});return o[Symbol.iterator]=()=>{let l=0;return{next:()=>l<2?{value:l++?a||de:o,done:!1}:{done:!0}}},o}var qc=(e,t)=>t==="modelValue"||t==="model-value"?e.modelModifiers:e[`${t}Modifiers`]||e[`${xe(t)}Modifiers`]||e[`${dt(t)}Modifiers`];function lf(e,t,...n){let i;if(e.isUnmounted)return;let s=e.vnode.props||de,r=n,a=t.startsWith("update:"),o=a&&qc(s,t.slice(7));o&&(o.trim&&(r=n.map(d=>ie(d)?d.trim():d)),o.number&&(r=n.map(pr)));let l=s[i=Zn(t)]||s[i=Zn(xe(t))];!l&&a&&(l=s[i=Zn(dt(t))]),l&&gt(l,e,6,r);let c=s[i+"Once"];if(c){if(e.emitted){if(e.emitted[i])return}else e.emitted={};e.emitted[i]=!0,gt(c,e,6,r)}}var cf=new WeakMap;function Hs(e,t){return!!e&&!!Fn(t)&&(me(e,(t=(t=t.slice(2))==="Once"?t:t.replace(/Once$/,""))[0].toLowerCase()+t.slice(1))||me(e,dt(t))||me(e,t))}function As(e){let t,n,{type:i,vnode:s,proxy:r,withProxy:a,propsOptions:[o],slots:l,attrs:c,emit:d,render:u,renderCache:p,props:w,data:g,setupState:_,ctx:A,inheritAttrs:M}=e,h=Ui(e);try{if(4&s.shapeFlag){let q=a||r;t=ct(u.call(q,q,p,w,_,g,A)),n=c}else t=ct(i.length>1?i(w,{attrs:c,slots:l,emit:d}):i(w,null)),n=i.props?c:df(c)}catch(q){Wt.length=0,Un(q,e,1),t=Te(Oe)}let m=t;if(n&&M!==!1){let q=Object.keys(n),{shapeFlag:T}=m;q.length&&7&T&&(o&&q.some(cr)&&(n=uf(n,o)),m=Lt(m,n,!1,!0))}return s.dirs&&((m=Lt(m,null,!1,!0)).dirs=m.dirs?m.dirs.concat(s.dirs):s.dirs),s.transition&&Zt(m,s.transition),t=m,Ui(h),t}var df=e=>{let t;for(let n in e)(n==="class"||n==="style"||Fn(n))&&((t||(t={}))[n]=e[n]);return t},uf=(e,t)=>{let n={};for(let i in e)cr(i)&&i.slice(9)in t||(n[i]=e[i]);return n};function Do(e,t,n){let i=Object.keys(t);if(i.length!==Object.keys(e).length)return!0;for(let s=0;s<i.length;s++){let r=i[s];if(Cc(t,e,r)&&!Hs(n,r))return!0}return!1}function Cc(e,t,n){let i=e[n],s=t[n];return n==="style"&&fe(i)&&fe(s)?!Gt(i,s):i!==s}function Sr({vnode:e,parent:t,suspense:n},i){for(;t;){let s=t.subTree;if(s.suspense&&s.suspense.activeBranch===e&&(s.suspense.vnode.el=s.el=i,e=s),s===e)(e=t.vnode).el=i,t=t.parent;else break}n&&n.activeBranch===e&&(n.vnode.el=i)}var ga={},Tc=e=>Object.getPrototypeOf(e)===ga;function Ac(e,t,n,i){let s,[r,a]=e.propsOptions,o=!1;if(t)for(let l in t){let c;if(Ht(l))continue;let d=t[l];r&&me(r,c=xe(l))?a&&a.includes(c)?(s||(s={}))[c]=d:n[c]=d:Hs(e.emitsOptions,l)||l in i&&d===i[l]||(i[l]=d,o=!0)}if(a){let l=pe(n),c=s||de;for(let d=0;d<a.length;d++){let u=a[d];n[u]=va(r,l,u,c[u],e,!me(c,u))}}return o}function va(e,t,n,i,s,r){let a=e[n];if(a!=null){let o=me(a,"default");if(o&&i===void 0){let l=a.default;if(a.type!==Function&&!a.skipFactory&&te(l)){let{propsDefaults:c}=s;if(n in c)i=c[n];else{let d=fi(s);i=c[n]=l.call(null,t),d()}}else i=l;s.ce&&s.ce._setProp(n,i)}a[0]&&(r&&!o?i=!1:a[1]&&(i===""||i===dt(n))&&(i=!0))}return i}var pf=new WeakMap;function Fo(e){return!(e[0]==="$"||Ht(e))}var Ya=e=>e==="_"||e==="_ctx"||e==="$stable",Xa=e=>J(e)?e.map(ct):[ct(e)],ff=(e,t,n)=>{if(t._n)return t;let i=$a((...s)=>Xa(t(...s)),n);return i._c=!1,i},Nc=(e,t,n)=>{let i=e._ctx;for(let s in e){if(Ya(s))continue;let r=e[s];if(te(r))t[s]=ff(s,r,i);else if(r!=null){let a=Xa(r);t[s]=()=>a}}},Mc=(e,t)=>{let n=Xa(t);e.slots.default=()=>n},Ec=(e,t,n)=>{for(let i in t)(n||!Ya(i))&&(e[i]=t[i])},Pe=Pc;function Za(e){return Rc(e)}function Ic(e){return Rc(e,Tp)}function Rc(e,t){var n;let i,s;fr().__VUE__=!0;let{insert:r,remove:a,patchProp:o,createElement:l,createText:c,createComment:d,setText:u,setElementText:p,parentNode:w,nextSibling:g,setScopeId:_=He,insertStaticContent:A}=e,M=(b,C,O,$=null,F=null,P=null,U,D=null,j=!!C.dynamicChildren)=>{if(b===C)return;b&&!Tt(b,C)&&($=oe(b),ue(b,F,P,!0),b=null),C.patchFlag===-2&&(j=!1,C.dynamicChildren=null);let{type:L,ref:K,shapeFlag:Q}=C;switch(L){case dn:h(b,C,O,$);break;case Oe:m(b,C,O,$);break;case En:b==null&&q(C,O,$,U);break;case Ve:x(b,C,O,$,F,P,U,D,j);break;default:1&Q?T(b,C,O,$,F,P,U,D,j):6&Q?I(b,C,O,$,F,P,U,D,j):(64&Q||128&Q)&&L.process(b,C,O,$,F,P,U,D,j,qe)}K!=null&&F?ri(K,b&&b.ref,P,C||b,!C):K==null&&b&&b.ref!=null&&ri(b.ref,null,P,b,!0)},h=(b,C,O,$)=>{if(b==null)r(C.el=c(C.children),O,$);else{let F=C.el=b.el;C.children!==b.children&&u(F,C.children)}},m=(b,C,O,$)=>{b==null?r(C.el=d(C.children||""),O,$):C.el=b.el},q=(b,C,O,$)=>{[b.el,b.anchor]=A(b.children,C,O,$,b.el,b.anchor)},T=(b,C,O,$,F,P,U,D,j)=>{if(C.type==="svg"?U="svg":C.type==="math"&&(U="mathml"),b==null)N(C,O,$,F,P,U,D,j);else{let L=b.el&&b.el._isVueCE?b.el:null;try{L&&L._beginPatch(),v(b,C,F,P,U,D,j)}finally{L&&L._endPatch()}}},N=(b,C,O,$,F,P,U,D)=>{let j,L,{props:K,shapeFlag:Q,transition:Y,dirs:G}=b;if(j=b.el=l(b.type,P,K&&K.is,K),8&Q?p(j,b.children):16&Q&&y(b.children,j,null,$,F,Wr(b,P),U,D),G&&Ot(b,null,$,"created"),f(j,b,b.scopeId,U,$),K){for(let ee in K)ee==="value"||Ht(ee)||o(j,ee,null,K[ee],P,$);"value"in K&&o(j,"value",null,K.value,P),(L=K.onVnodeBeforeMount)&&lt(L,$,b)}G&&Ot(b,null,$,"beforeMount");let re=Oc(F,Y);re&&Y.beforeEnter(j),r(j,C,O),((L=K&&K.onVnodeMounted)||re||G)&&Pe(()=>{L&&lt(L,$,b),re&&Y.enter(j),G&&Ot(b,null,$,"mounted")},F)},f=(b,C,O,$,F)=>{if(O&&_(b,O),$)for(let P=0;P<$.length;P++)_(b,$[P]);if(F){let P=F.subTree;if(C===P||Qs(P.type)&&(P.ssContent===C||P.ssFallback===C)){let U=F.vnode;f(b,U,U.scopeId,U.slotScopeIds,F.parent)}}},y=(b,C,O,$,F,P,U,D,j=0)=>{for(let L=j;L<b.length;L++)M(null,b[L]=D?Ut(b[L]):ct(b[L]),C,O,$,F,P,U,D)},v=(b,C,O,$,F,P,U)=>{let D,j=C.el=b.el,{patchFlag:L,dynamicChildren:K,dirs:Q}=C;L|=16&b.patchFlag;let Y=b.props||de,G=C.props||de;if(O&&kn(O,!1),(D=G.onVnodeBeforeUpdate)&&lt(D,O,C,b),Q&&Ot(C,b,O,"beforeUpdate"),O&&kn(O,!0),K&&(!b.dynamicChildren||b.dynamicChildren.length!==K.length)&&(L=0,U=!1,K=null),(Y.innerHTML&&G.innerHTML==null||Y.textContent&&G.textContent==null)&&p(j,""),K?k(b.dynamicChildren,K,j,O,$,Wr(C,F),P):U||z(b,C,j,null,O,$,Wr(C,F),P,!1),L>0){if(16&L)S(j,Y,G,O,F);else if(2&L&&Y.class!==G.class&&o(j,"class",null,G.class,F),4&L&&o(j,"style",Y.style,G.style,F),8&L){let re=C.dynamicProps;for(let ee=0;ee<re.length;ee++){let ve=re[ee],Ae=Y[ve],Me=G[ve];(Me!==Ae||ve==="value")&&o(j,ve,Ae,Me,F,O)}}1&L&&b.children!==C.children&&p(j,C.children)}else U||K!=null||S(j,Y,G,O,F);((D=G.onVnodeUpdated)||Q)&&Pe(()=>{D&&lt(D,O,C,b),Q&&Ot(C,b,O,"updated")},$)},k=(b,C,O,$,F,P,U)=>{for(let D=0;D<C.length;D++){let j=b[D],L=C[D],K=j.el&&(j.type===Ve||!Tt(j,L)||198&j.shapeFlag)?w(j.el):O;M(j,L,K,null,$,F,P,U,!0)}},S=(b,C,O,$,F)=>{if(C!==O){if(C!==de)for(let P in C)Ht(P)||P in O||o(b,P,C[P],null,F,$);for(let P in O){if(Ht(P))continue;let U=O[P],D=C[P];U!==D&&P!=="value"&&o(b,P,D,U,F,$)}"value"in O&&o(b,"value",C.value,O.value,F)}},x=(b,C,O,$,F,P,U,D,j)=>{let L=C.el=b?b.el:c(""),K=C.anchor=b?b.anchor:c(""),{patchFlag:Q,dynamicChildren:Y,slotScopeIds:G}=C;G&&(D=D?D.concat(G):G),b==null?(r(L,O,$),r(K,O,$),y(C.children||[],O,K,F,P,U,D,j)):Q>0&&64&Q&&Y&&b.dynamicChildren&&b.dynamicChildren.length===Y.length?(k(b.dynamicChildren,Y,O,F,P,U,D),(C.key!=null||F&&C===F.subTree)&&eo(b,C,!0)):z(b,C,O,K,F,P,U,D,j)},I=(b,C,O,$,F,P,U,D,j)=>{C.slotScopeIds=D,b==null?512&C.shapeFlag?F.ctx.activate(C,O,$,U,j):R(C,O,$,F,P,U,j):E(b,C,j)},R=(b,C,O,$,F,P,U)=>{let D=b.component=Uc(b,$,F);if(ts(b)&&(D.ctx.renderer=qe),Vc(D,!1,U),D.asyncDep){if(F&&F.registerDep(D,V,U),!b.el){let j=D.subTree=Te(Oe);m(null,j,C,O),b.placeholder=j.el}}else V(D,b,C,O,F,P,U)},E=(b,C,O)=>{let $=C.component=b.component;if(function(F,P,U){let{props:D,children:j,component:L}=F,{props:K,children:Q,patchFlag:Y}=P,G=L.emitsOptions;if(P.dirs||P.transition)return!0;if(!U||!(Y>=0))return(!!j||!!Q)&&(!Q||!Q.$stable)||D!==K&&(D?!K||Do(D,K,G):!!K);if(1024&Y)return!0;if(16&Y)return D?Do(D,K,G):!!K;if(8&Y){let re=P.dynamicProps;for(let ee=0;ee<re.length;ee++){let ve=re[ee];if(Cc(K,D,ve)&&!Hs(G,ve))return!0}}return!1}(b,C,O)){if($.asyncDep&&!$.asyncResolved)return void B($,C,O);$.next=C,$.update()}else C.el=b.el,$.vnode=C},V=(b,C,O,$,F,P,U)=>{b.scope.on();let D=b.effect=new Rn(()=>{if(b.isMounted){let K,{next:Q,bu:Y,u:G,parent:re,vnode:ee}=b;{let ot=function us(xn){let nn=xn.subTree.component;if(nn)return nn.asyncDep&&!nn.asyncResolved?nn:us(nn)}(b);if(ot){Q&&(Q.el=ee.el,B(b,Q,U)),ot.asyncDep.then(()=>{Pe(()=>{b.isUnmounted||j()},F)});return}}let ve=Q;kn(b,!1),Q?(Q.el=ee.el,B(b,Q,U)):Q=ee,Y&&ei(Y),(K=Q.props&&Q.props.onVnodeBeforeUpdate)&&lt(K,re,Q,ee),kn(b,!0);let Ae=As(b),Me=b.subTree;b.subTree=Ae,M(Me,Ae,w(Me.el),oe(Me),b,F,P),Q.el=Ae.el,ve===null&&Sr(b,Ae.el),G&&Pe(G,F),(K=Q.props&&Q.props.onVnodeUpdated)&&Pe(()=>lt(K,re,Q,ee),F)}else{let K,{el:Q,props:Y}=C,{bm:G,m:re,parent:ee,root:ve,type:Ae}=b,Me=Qt(C);if(kn(b,!1),G&&ei(G),!Me&&(K=Y&&Y.onVnodeBeforeMount)&&lt(K,ee,C),kn(b,!0),Q&&s){let ot=()=>{b.subTree=As(b),s(Q,b.subTree,b,F,null)};Me&&Ae.__asyncHydrate?Ae.__asyncHydrate(Q,b,ot):ot()}else{ve.ce&&ve.ce._hasShadowRoot()&&ve.ce._injectChildStyle(Ae,b.parent?b.parent.type:void 0);let ot=b.subTree=As(b);M(null,ot,O,$,b,F,P),C.el=ot.el}if(re&&Pe(re,F),!Me&&(K=Y&&Y.onVnodeMounted)){let ot=C;Pe(()=>lt(K,ee,ot),F)}(256&C.shapeFlag||ee&&Qt(ee.vnode)&&256&ee.vnode.shapeFlag)&&b.a&&Pe(b.a,F),b.isMounted=!0,C=O=$=null}});b.scope.off();let j=b.update=D.run.bind(D),L=b.job=D.runIfDirty.bind(D);L.i=b,L.id=b.uid,D.scheduler=()=>Ua(L),kn(b,!0),j()},B=(b,C,O)=>{C.component=b;let $=b.vnode.props;b.vnode=C,b.next=null,function(F,P,U,D){let{props:j,attrs:L,vnode:{patchFlag:K}}=F,Q=pe(j),[Y]=F.propsOptions,G=!1;if((D||K>0)&&!(16&K)){if(8&K){let re=F.vnode.dynamicProps;for(let ee=0;ee<re.length;ee++){let ve=re[ee];if(Hs(F.emitsOptions,ve))continue;let Ae=P[ve];if(Y)if(me(L,ve))Ae!==L[ve]&&(L[ve]=Ae,G=!0);else{let Me=xe(ve);j[Me]=va(Y,Q,Me,Ae,F,!1)}else Ae!==L[ve]&&(L[ve]=Ae,G=!0)}}}else{let re;for(let ee in Ac(F,P,j,L)&&(G=!0),Q)P&&(me(P,ee)||(re=dt(ee))!==ee&&me(P,re))||(Y?U&&(U[ee]!==void 0||U[re]!==void 0)&&(j[ee]=va(Y,Q,ee,void 0,F,!0)):delete j[ee]);if(L!==Q)for(let ee in L)P&&me(P,ee)||(delete L[ee],G=!0)}G&&$t(F.attrs,"set","")}(b,C.props,$,O),((F,P,U)=>{let{vnode:D,slots:j}=F,L=!0,K=de;if(32&D.shapeFlag){let Q=P._;Q?U&&Q===1?L=!1:Ec(j,P,U):(L=!P.$stable,Nc(P,j)),K=P}else P&&(Mc(F,P),K={default:1});if(L)for(let Q in j)Ya(Q)||K[Q]!=null||delete j[Q]})(b,C.children,O),Yt(),To(b),Xt()},z=(b,C,O,$,F,P,U,D,j=!1)=>{let L=b&&b.children,K=b?b.shapeFlag:0,Q=C.children,{patchFlag:Y,shapeFlag:G}=C;if(Y>0){if(128&Y)return void X(L,Q,O,$,F,P,U,D,j);if(256&Y)return void H(L,Q,O,$,F,P,U,D,j)}8&G?(16&K&&tt(L,F,P),Q!==L&&p(O,Q)):16&K?16&G?X(L,Q,O,$,F,P,U,D,j):tt(L,F,P,!0):(8&K&&p(O,""),16&G&&y(Q,O,$,F,P,U,D,j))},H=(b,C,O,$,F,P,U,D,j)=>{let L;b=b||Xn,C=C||Xn;let K=b.length,Q=C.length,Y=Math.min(K,Q);for(L=0;L<Y;L++){let G=C[L]=j?Ut(C[L]):ct(C[L]);M(b[L],G,O,null,F,P,U,D,j)}K>Q?tt(b,F,P,!0,!1,Y):y(C,O,$,F,P,U,D,j,Y)},X=(b,C,O,$,F,P,U,D,j)=>{let L=0,K=C.length,Q=b.length-1,Y=K-1;for(;L<=Q&&L<=Y;){let G=b[L],re=C[L]=j?Ut(C[L]):ct(C[L]);if(Tt(G,re))M(G,re,O,null,F,P,U,D,j);else break;L++}for(;L<=Q&&L<=Y;){let G=b[Q],re=C[Y]=j?Ut(C[Y]):ct(C[Y]);if(Tt(G,re))M(G,re,O,null,F,P,U,D,j);else break;Q--,Y--}if(L>Q){if(L<=Y){let G=Y+1,re=G<K?C[G].el:$;for(;L<=Y;)M(null,C[L]=j?Ut(C[L]):ct(C[L]),O,re,F,P,U,D,j),L++}}else if(L>Y)for(;L<=Q;)ue(b[L],F,P,!0),L++;else{let G,re=L,ee=L,ve=new Map;for(L=ee;L<=Y;L++){let Ee=C[L]=j?Ut(C[L]):ct(C[L]);Ee.key!=null&&ve.set(Ee.key,L)}let Ae=0,Me=Y-ee+1,ot=!1,us=0,xn=Array(Me);for(L=0;L<Me;L++)xn[L]=0;for(L=re;L<=Q;L++){let Ee,Ue=b[L];if(Ae>=Me){ue(Ue,F,P,!0);continue}if(Ue.key!=null)Ee=ve.get(Ue.key);else for(G=ee;G<=Y;G++)if(xn[G-ee]===0&&Tt(Ue,C[G])){Ee=G;break}Ee===void 0?ue(Ue,F,P,!0):(xn[Ee-ee]=L+1,Ee>=us?us=Ee:ot=!0,M(Ue,C[Ee],O,null,F,P,U,D,j),Ae++)}let nn=ot?function(Ee){let Ue,yi,nt,Et,wn,$n=Ee.slice(),xt=[0],Au=Ee.length;for(Ue=0;Ue<Au;Ue++){let ps=Ee[Ue];if(ps!==0){if(Ee[yi=xt[xt.length-1]]<ps){$n[Ue]=yi,xt.push(Ue);continue}for(nt=0,Et=xt.length-1;nt<Et;)Ee[xt[wn=nt+Et>>1]]<ps?nt=wn+1:Et=wn;ps<Ee[xt[nt]]&&(nt>0&&($n[Ue]=xt[nt-1]),xt[nt]=Ue)}}for(nt=xt.length,Et=xt[nt-1];nt-- >0;)xt[nt]=Et,Et=$n[Et];return xt}(xn):Xn;for(G=nn.length-1,L=Me-1;L>=0;L--){let Ee=ee+L,Ue=C[Ee],yi=C[Ee+1],nt=Ee+1<K?yi.el||function Et(wn){if(wn.placeholder)return wn.placeholder;let $n=wn.component;return $n?Et($n.subTree):null}(yi):$;xn[L]===0?M(null,Ue,O,nt,F,P,U,D,j):ot&&(G<0||L!==nn[G]?ne(Ue,O,nt,2):G--)}}},ne=(b,C,O,$,F=null)=>{let{el:P,type:U,transition:D,children:j,shapeFlag:L}=b;if(6&L)return void ne(b.component.subTree,C,O,$);if(128&L)return void b.suspense.move(C,O,$);if(64&L)return void U.move(b,C,O,qe);if(U===Ve){r(P,C,O);for(let K=0;K<j.length;K++)ne(j[K],C,O,$);r(b.anchor,C,O);return}if(U===En)return void(({el:K,anchor:Q},Y,G)=>{let re;for(;K&&K!==Q;)re=g(K),r(K,Y,G),K=re;r(Q,Y,G)})(b,C,O);if($!==2&&1&L&&D)if($===0)D.persisted&&!P[kt]?r(P,C,O):(D.beforeEnter(P),r(P,C,O),Pe(()=>D.enter(P),F));else{let{leave:K,delayLeave:Q,afterLeave:Y}=D,G=()=>{b.ctx.isUnmounted?a(P):r(P,C,O)},re=()=>{let ee=P._isLeaving||!!P[kt];P._isLeaving&&P[kt](!0),D.persisted&&!ee?G():K(P,()=>{G(),Y&&Y()})};Q?Q(P,G,re):re()}else r(P,C,O)},ue=(b,C,O,$=!1,F=!1)=>{let P,{type:U,props:D,ref:j,children:L,dynamicChildren:K,shapeFlag:Q,patchFlag:Y,dirs:G,cacheIndex:re,memo:ee}=b;if(Y===-2&&(F=!1),j!=null&&(Yt(),ri(j,null,O,b,!0),Xt()),re!=null&&(C.renderCache[re]=void 0),256&Q)return void C.ctx.deactivate(b);let ve=1&Q&&G,Ae=!Qt(b);if(Ae&&(P=D&&D.onVnodeBeforeUnmount)&&lt(P,C,b),6&Q)ze(b.component,O,$);else{if(128&Q)return void b.suspense.unmount(O,$);ve&&Ot(b,null,C,"beforeUnmount"),64&Q?b.type.remove(b,C,O,qe,$):K&&!K.hasOnce&&(U!==Ve||Y>0&&64&Y)?tt(K,C,O,!1,!0):(U===Ve&&384&Y||!F&&16&Q)&&tt(L,C,O),$&&he(b)}let Me=ee!=null&&re==null;(Ae&&(P=D&&D.onVnodeUnmounted)||ve||Me)&&Pe(()=>{P&&lt(P,C,b),ve&&Ot(b,null,C,"unmounted"),Me&&(b.el=null)},O)},he=b=>{let{type:C,el:O,anchor:$,transition:F}=b;if(C===Ve)return void ye(O,$);if(C===En)return void(({el:U,anchor:D})=>{let j;for(;U&&U!==D;)j=g(U),a(U),U=j;a(D)})(b);let P=()=>{a(O),F&&!F.persisted&&F.afterLeave&&F.afterLeave()};if(1&b.shapeFlag&&F&&!F.persisted){let{leave:U,delayLeave:D}=F,j=()=>U(O,P);D?D(b.el,P,j):j()}else P()},ye=(b,C)=>{let O;for(;b!==C;)O=g(b),a(b),b=O;a(C)},ze=(b,C,O)=>{let{bum:$,scope:F,job:P,subTree:U,um:D,m:j,a:L}=b;Ks(j),Ks(L),$&&ei($),F.stop(),P&&(P.flags|=8,ue(U,b,C,O)),D&&Pe(D,C),Pe(()=>{b.isUnmounted=!0},C)},tt=(b,C,O,$=!1,F=!1,P=0)=>{for(let U=P;U<b.length;U++)ue(b[U],C,O,$,F)},oe=b=>{if(6&b.shapeFlag)return oe(b.component.subTree);if(128&b.shapeFlag)return b.suspense.next();let C=g(b.anchor||b.el),O=C&&C[cc];return O?g(O):C},se=!1,ke=(b,C,O)=>{let $;b==null?C._vnode&&(ue(C._vnode,null,null,!0),$=C._vnode.component):M(C._vnode||null,b,C,null,null,null,O),C._vnode=b,se||(se=!0,To($),js(),se=!1)},qe={p:M,um:ue,m:ne,r:he,mt:R,mc:y,pc:z,pbc:k,n:oe,o:e};return t&&([i,s]=t(qe)),{render:ke,hydrate:i,createApp:(n=i,function(b,C=null){te(b)||(b=le({},b)),C==null||fe(C)||(C=null);let O=Sc(),$=new WeakSet,F=[],P=!1,U=O.app={_uid:af++,_component:b,_props:C,_container:null,_context:O,_instance:null,version:Gc,get config(){return O.config},set config(D){},use:(D,...j)=>($.has(D)||(D&&te(D.install)?($.add(D),D.install(U,...j)):te(D)&&($.add(D),D(U,...j))),U),mixin:D=>(O.mixins.includes(D)||O.mixins.push(D),U),component:(D,j)=>j?(O.components[D]=j,U):O.components[D],directive:(D,j)=>j?(O.directives[D]=j,U):O.directives[D],mount(D,j,L){if(!P){let K=U._ceVNode||Te(b,C);return K.appContext=O,L===!0?L="svg":L===!1&&(L=void 0),j&&n?n(K,D):ke(K,D,L),P=!0,U._container=D,D.__vue_app__=U,ss(K.component)}},onUnmount(D){F.push(D)},unmount(){P&&(gt(F,U._instance,16),ke(null,U._container),delete U._container.__vue_app__)},provide:(D,j)=>(O.provides[D]=j,U),runWithContext(D){let j=Mn;Mn=U;try{return D()}finally{Mn=j}}};return U})}}function Wr({type:e,props:t},n){return n==="svg"&&e==="foreignObject"||n==="mathml"&&e==="annotation-xml"&&t&&t.encoding&&t.encoding.includes("html")?void 0:n}function kn({effect:e,job:t},n){n?(e.flags|=32,t.flags|=4):(e.flags&=-33,t.flags&=-5)}function Oc(e,t){return(!e||e&&!e.pendingBranch)&&t&&!t.persisted}function eo(e,t,n=!1){let i=e.children,s=t.children;if(J(i)&&J(s))for(let r=0;r<i.length;r++){let a=i[r],o=s[r];1&o.shapeFlag&&!o.dynamicChildren&&((o.patchFlag<=0||o.patchFlag===32)&&((o=s[r]=Ut(s[r])).el=a.el),n||o.patchFlag===-2||eo(a,o)),o.type===dn&&(o.patchFlag===-1&&(o=s[r]=Ut(o)),o.el=a.el),o.type!==Oe||o.el||(o.el=a.el)}}function Ks(e){if(e)for(let t=0;t<e.length;t++)e[t].flags|=8}var Qs=e=>e.__isSuspense,ba=0,hf={name:"Suspense",__isSuspense:!0,process(e,t,n,i,s,r,a,o,l,c){if(e==null)(function(d,u,p,w,g,_,A,M,h){let{p:m,o:{createElement:q}}=h,T=q("div"),N=d.suspense=jo(d,g,w,u,T,p,_,A,M,h);m(null,N.pendingBranch=d.ssContent,T,null,w,N,_,A),N.deps>0?(Pi(d,"onPending"),Pi(d,"onFallback"),m(null,d.ssFallback,u,p,w,null,_,A),Jn(N,d.ssFallback)):N.resolve(!1,!0)})(t,n,i,s,r,a,o,l,c);else{if(r&&r.deps>0&&!e.suspense.isInFallback){t.suspense=e.suspense,t.suspense.vnode=t,t.el=e.el;return}(function(d,u,p,w,g,_,A,M,{p:h,um:m,o:{createElement:q}}){let T=u.suspense=d.suspense;T.vnode=u,u.el=d.el;let N=u.ssContent,f=u.ssFallback,{activeBranch:y,pendingBranch:v,isInFallback:k,isHydrating:S}=T;if(v)T.pendingBranch=N,Tt(v,N)?(h(v,N,T.hiddenContainer,null,g,T,_,A,M),T.deps<=0?T.resolve():k&&!S&&(h(y,f,p,w,g,null,_,A,M),Jn(T,f))):(T.pendingId=ba++,S?(T.isHydrating=!1,T.activeBranch=v):m(v,g,T),T.deps=0,T.effects.length=0,T.hiddenContainer=q("div"),k?(h(null,N,T.hiddenContainer,null,g,T,_,A,M),T.deps<=0?T.resolve():(h(y,f,p,w,g,null,_,A,M),Jn(T,f))):y&&Tt(y,N)?(h(y,N,p,w,g,T,_,A,M),T.resolve(!0)):(h(null,N,T.hiddenContainer,null,g,T,_,A,M),T.deps<=0&&T.resolve()));else if(y&&Tt(y,N))h(y,N,p,w,g,T,_,A,M),Jn(T,N);else if(Pi(u,"onPending"),T.pendingBranch=N,512&N.shapeFlag?T.pendingId=N.component.suspenseId:T.pendingId=ba++,h(null,N,T.hiddenContainer,null,g,T,_,A,M),T.deps<=0)T.resolve();else{let{timeout:x,pendingId:I}=T;x>0?setTimeout(()=>{T.pendingId===I&&T.fallback(f)},x):x===0&&T.fallback(f)}})(e,t,n,i,s,a,o,l,c)}},hydrate:function(e,t,n,i,s,r,a,o,l){let c=t.suspense=jo(t,i,n,e.parentNode,document.createElement("div"),null,s,r,a,o,!0),d=l(e,c.pendingBranch=t.ssContent,n,c,r,a);return c.deps===0&&c.resolve(!1,!0),d},normalize:function(e){let{shapeFlag:t,children:n}=e,i=32&t;e.ssContent=Uo(i?n.default:n),e.ssFallback=i?Uo(n.fallback):Te(Oe)}};function Pi(e,t){let n=e.props&&e.props[t];te(n)&&n()}function jo(e,t,n,i,s,r,a,o,l,c,d=!1){var u;let p,w,{p:g,m:_,um:A,n:M,o:{parentNode:h,remove:m}}=c,q=(p=(u=e).props&&u.props.suspensible)!=null&&p!==!1;q&&t&&t.pendingBranch&&(w=t.pendingId,t.deps++);let T=e.props?ti(e.props.timeout):void 0,N=r,f={vnode:e,parent:t,parentComponent:n,namespace:a,container:i,hiddenContainer:s,deps:0,pendingId:ba++,timeout:typeof T=="number"?T:-1,activeBranch:null,isFallbackMountPending:!1,pendingBranch:null,isInFallback:!d,isHydrating:d,isUnmounted:!1,effects:[],resolve(y=!1,v=!1){let{vnode:k,activeBranch:S,pendingBranch:x,pendingId:I,effects:R,parentComponent:E,container:V,isInFallback:B}=f,z=!1;if(f.isHydrating)f.isHydrating=!1;else if(!y){z=S&&x.transition&&x.transition.mode==="out-in";let ne=!1;z&&(S.transition.afterLeave=()=>{I===f.pendingId&&(_(x,V,r!==N||ne?r:M(S),0),ji(R),B&&k.ssFallback&&(k.ssFallback.el=null))}),S&&!f.isFallbackMountPending&&(h(S.el)===V&&(r=M(S),ne=!0),A(S,E,f,!0),!z&&B&&k.ssFallback&&Pe(()=>k.ssFallback.el=null,f)),z||_(x,V,r,0)}f.isFallbackMountPending=!1,Jn(f,x),f.pendingBranch=null,f.isInFallback=!1;let H=f.parent,X=!1;for(;H;){if(H.pendingBranch){H.effects.push(...R),X=!0;break}H=H.parent}X||z||ji(R),f.effects=[],q&&t&&t.pendingBranch&&w===t.pendingId&&(t.deps--,t.deps!==0||v||t.resolve()),Pi(k,"onResolve")},fallback(y){if(!f.pendingBranch)return;let{vnode:v,activeBranch:k,parentComponent:S,container:x,namespace:I}=f;Pi(v,"onFallback");let R=M(k),E=()=>{f.isFallbackMountPending=!1,f.isInFallback&&(g(null,y,x,R,S,null,I,o,l),Jn(f,y))},V=y.transition&&y.transition.mode==="out-in";V&&(f.isFallbackMountPending=!0,k.transition.afterLeave=E),f.isInFallback=!0,A(k,S,null,!0),V||E()},move(y,v,k){f.activeBranch&&_(f.activeBranch,y,v,k),f.container=y},next:()=>f.activeBranch&&M(f.activeBranch),registerDep(y,v,k){let S=!!f.pendingBranch;S&&f.deps++;let x=y.vnode.el;y.asyncDep.catch(I=>{Un(I,y,0)}).then(I=>{if(y.isUnmounted||f.isUnmounted||f.pendingId!==y.suspenseId)return;Hi(),y.asyncResolved=!0;let{vnode:R}=y;ya(y,I,!1),x&&(R.el=x);let E=!x&&y.subTree.el;v(y,R,h(x||y.subTree.el),x?null:M(y.subTree),f,a,k),E&&(R.placeholder=null,m(E)),Sr(y,R.el),S&&--f.deps==0&&f.resolve()})},unmount(y,v){f.isUnmounted=!0,f.activeBranch&&A(f.activeBranch,n,y,v),f.pendingBranch&&A(f.pendingBranch,n,y,v)}};return f}function Uo(e){let t;if(te(e)){let n=On&&e._c;n&&(e._d=!1,Vi()),e=e(),n&&(e._d=!0,t=Xe,qr())}return J(e)&&(e=function(n){let i;for(let s=0;s<n.length;s++){let r=n[s];if(!en(r))return;if(r.type!==Oe||r.children==="v-if"){if(i)return;i=r}}return i}(e)),e=ct(e),t&&!e.dynamicChildren&&(e.dynamicChildren=t.filter(n=>n!==e)),e}function Pc(e,t){t&&t.pendingBranch?J(e)?t.effects.push(...e):t.effects.push(e):ji(e)}function Jn(e,t){e.activeBranch=t;let{vnode:n,parentComponent:i}=e,s=t.el;for(;!s&&t.component;)s=(t=t.component.subTree).el;n.el=s,i&&i.subTree===n&&(i.vnode.el=s,Sr(i,s))}var Ve=Symbol.for("v-fgt"),dn=Symbol.for("v-txt"),Oe=Symbol.for("v-cmt"),En=Symbol.for("v-stc"),Wt=[],Xe=null;function Vi(e=!1){Wt.push(Xe=e?null:[])}function qr(){Wt.pop(),Xe=Wt[Wt.length-1]||null}var On=1;function zi(e,t=!1){On+=e,e<0&&Xe&&t&&(Xe.hasOnce=!0)}function Bc(e){return e.dynamicChildren=On>0?Xe||Xn:null,qr(),On>0&&Xe&&Xe.push(e),e}function mf(e,t,n,i,s,r){return Bc(to(e,t,n,i,s,r,!0))}function Ws(e,t,n,i,s){return Bc(Te(e,t,n,i,s,!0))}function en(e){return!!e&&e.__v_isVNode===!0}function Tt(e,t){return e.type===t.type&&e.key===t.key}function gf(e){}var Lc=({key:e})=>e??null,Ns=({ref:e,ref_key:t,ref_for:n})=>(typeof e=="number"&&(e=""+e),e!=null?ie(e)||Le(e)||te(e)?{i:Qe,r:e,k:t,f:!!n}:e:null);function to(e,t=null,n=null,i=0,s=null,r=+(e!==Ve),a=!1,o=!1){let l={__v_isVNode:!0,__v_skip:!0,type:e,props:t,key:t&&Lc(t),ref:t&&Ns(t),scopeId:xr,slotScopeIds:null,children:n,component:null,suspense:null,ssContent:null,ssFallback:null,dirs:null,transition:null,el:null,anchor:null,target:null,targetStart:null,targetAnchor:null,staticCount:0,shapeFlag:r,patchFlag:i,dynamicProps:s,dynamicChildren:null,appContext:null,ctx:Qe};return o?(Js(l,n),128&r&&e.normalize(l)):n&&(l.shapeFlag|=ie(n)?8:16),On>0&&!a&&Xe&&(l.patchFlag>0||6&r)&&l.patchFlag!==32&&Xe.push(l),l}var Te=function(e,t=null,n=null,i=0,s=null,r=!1){var a;if(e&&e!==kc||(e=Oe),en(e)){let l=Lt(e,t,!0);return n&&Js(l,n),On>0&&!r&&Xe&&(6&l.shapeFlag?Xe[Xe.indexOf(e)]=l:Xe.push(l)),l.patchFlag=-2,l}if(te(a=e)&&"__vccOpts"in a&&(e=e.__vccOpts),t){let{class:l,style:c}=t=Dc(t);l&&!ie(l)&&(t.class=Yi(l)),fe(c)&&(Xi(c)&&!J(c)&&(c=le({},c)),t.style=Gi(c))}let o=ie(e)?1:Qs(e)?128:e.__isTeleport?64:fe(e)?4:2*!!te(e);return to(e,t,n,i,s,o,r,!0)};function Dc(e){return e?Xi(e)||Tc(e)?le({},e):e:null}function Lt(e,t,n=!1,i=!1){let{props:s,ref:r,patchFlag:a,children:o,transition:l}=e,c=t?jc(s||{},t):s,d={__v_isVNode:!0,__v_skip:!0,type:e.type,props:c,key:c&&Lc(c),ref:t&&t.ref?n&&r?J(r)?r.concat(Ns(t)):[r,Ns(t)]:Ns(t):r,scopeId:e.scopeId,slotScopeIds:e.slotScopeIds,children:o,target:e.target,targetStart:e.targetStart,targetAnchor:e.targetAnchor,staticCount:e.staticCount,shapeFlag:e.shapeFlag,patchFlag:t&&e.type!==Ve?a===-1?16:16|a:a,dynamicProps:e.dynamicProps,dynamicChildren:e.dynamicChildren,appContext:e.appContext,dirs:e.dirs,transition:l,component:e.component,suspense:e.suspense,ssContent:e.ssContent&&Lt(e.ssContent),ssFallback:e.ssFallback&&Lt(e.ssFallback),placeholder:e.placeholder,el:e.el,anchor:e.anchor,ctx:e.ctx,ce:e.ce};return l&&i&&Zt(d,l.clone(d)),d}function no(e=" ",t=0){return Te(dn,null,e,t)}function vf(e,t){let n=Te(En,null,e);return n.staticCount=t,n}function Fc(e="",t=!1){return t?(Vi(),Ws(Oe,null,e)):Te(Oe,null,e)}function ct(e){return e==null||typeof e=="boolean"?Te(Oe):J(e)?Te(Ve,null,e.slice()):en(e)?Ut(e):Te(dn,null,String(e))}function Ut(e){return e.el===null&&e.patchFlag!==-1||e.memo?e:Lt(e)}function Js(e,t){let n=0,{shapeFlag:i}=e;if(t==null)t=null;else if(J(t))n=16;else if(typeof t=="object")if(65&i){let s=t.default;s&&(s._c&&(s._d=!1),Js(e,s()),s._c&&(s._d=!0));return}else{n=32;let s=t._;s||Tc(t)?s===3&&Qe&&(Qe.slots._===1?t._=1:(t._=2,e.patchFlag|=1024)):t._ctx=Qe}else if(te(t)){if(65&i)return void Js(e,{default:t});t={default:t,_ctx:Qe},n=32}else t=String(t),64&i?(n=16,t=[no(t)]):n=8;e.children=t,e.shapeFlag|=n}function jc(...e){let t={};for(let n=0;n<e.length;n++){let i=e[n];for(let s in i)if(s==="class")t.class!==i.class&&(t.class=Yi([t.class,i.class]));else if(s==="style")t.style=Gi([t.style,i.style]);else if(Fn(s)){let r=t[s],a=i[s];a&&r!==a&&!(J(r)&&r.includes(a))?t[s]=r?[].concat(r,a):a:a!=null||r!=null||cr(s)||(t[s]=a)}else s!==""&&(t[s]=i[s])}return t}function lt(e,t,n,i=null){gt(e,t,7,[n,i])}var bf=Sc(),yf=0;function Uc(e,t,n){let i=e.type,s=(t?t.appContext:e.appContext)||bf,r={uid:yf++,vnode:e,type:i,parent:t,appContext:s,root:null,next:null,subTree:null,effect:null,update:null,job:null,scope:new Li(!0),render:null,proxy:null,exposed:null,exposeProxy:null,withProxy:null,provides:t?t.provides:Object.create(s.provides),ids:t?t.ids:["",0,0],accessCache:null,renderCache:[],components:null,directives:null,propsOptions:function a(o,l,c=!1){let d=c?pf:l.propsCache,u=d.get(o);if(u)return u;let p=o.props,w={},g=[],_=!1;if(!te(o)){let M=h=>{_=!0;let[m,q]=a(h,l,!0);le(w,m),q&&g.push(...q)};!c&&l.mixins.length&&l.mixins.forEach(M),o.extends&&M(o.extends),o.mixins&&o.mixins.forEach(M)}if(!p&&!_)return fe(o)&&d.set(o,Xn),Xn;if(J(p))for(let M=0;M<p.length;M++){let h=xe(p[M]);Fo(h)&&(w[h]=de)}else if(p)for(let M in p){let h=xe(M);if(Fo(h)){let m=p[M],q=w[h]=J(m)||te(m)?{type:m}:le({},m),T=q.type,N=!1,f=!0;if(J(T))for(let y=0;y<T.length;++y){let v=T[y],k=te(v)&&v.name;if(k==="Boolean"){N=!0;break}k==="String"&&(f=!1)}else N=te(T)&&T.name==="Boolean";q[0]=N,q[1]=f,(N||me(q,"default"))&&g.push(h)}}let A=[w,g];return fe(o)&&d.set(o,A),A}(i,s),emitsOptions:function a(o,l,c=!1){let d=c?cf:l.emitsCache,u=d.get(o);if(u!==void 0)return u;let p=o.emits,w={},g=!1;if(!te(o)){let _=A=>{let M=a(A,l,!0);M&&(g=!0,le(w,M))};!c&&l.mixins.length&&l.mixins.forEach(_),o.extends&&_(o.extends),o.mixins&&o.mixins.forEach(_)}return p||g?(J(p)?p.forEach(_=>w[_]=null):le(w,p),fe(o)&&d.set(o,w),w):(fe(o)&&d.set(o,null),null)}(i,s),emit:null,emitted:null,propsDefaults:de,inheritAttrs:i.inheritAttrs,ctx:de,data:de,props:de,attrs:de,slots:de,refs:de,setupState:de,setupContext:null,suspense:n,suspenseId:n?n.pendingId:0,asyncDep:null,asyncResolved:!1,isMounted:!1,isUnmounted:!1,isDeactivated:!1,bc:null,c:null,bm:null,m:null,bu:null,u:null,um:null,bum:null,da:null,a:null,rtg:null,rtc:null,ec:null,sp:null};return r.ctx={_:r},r.root=t?t.root:r,r.emit=lf.bind(null,r),e.ce&&e.ce(r),r}var Ke=null,at=()=>Ke||Qe;{let e=fr(),t=(n,i)=>{let s;return(s=e[n])||(s=e[n]=[]),s.push(i),r=>{s.length>1?s.forEach(a=>a(r)):s[0](r)}};Es=t("__VUE_INSTANCE_SETTERS__",n=>Ke=n),Yn=t("__VUE_SSR_SETTERS__",n=>Pn=n)}var fi=e=>{let t=Ke;return Es(e),e.scope.on(),()=>{e.scope.off(),Es(t)}},Hi=()=>{Ke&&Ke.scope.off(),Es(null)};function $c(e){return 4&e.vnode.shapeFlag}var Pn=!1;function Vc(e,t=!1,n=!1){t&&Yn(t);let{props:i,children:s}=e.vnode,r=$c(e);(function(c,d,u,p=!1){let w={},g=Object.create(ga);for(let _ in c.propsDefaults=Object.create(null),Ac(c,d,w,g),c.propsOptions[0])_ in w||(w[_]=void 0);u?c.props=p?w:Gl(w):c.type.props?c.props=w:c.props=g,c.attrs=g})(e,i,r,t);var a=n||t;let o=e.slots=Object.create(ga);if(32&e.vnode.shapeFlag){let c=s._;c?(Ec(o,s,a),a&&Ol(o,"_",c,!0)):Nc(s,o)}else s&&Mc(e,s);let l=r?function(c,d){let u=c.type;c.accessCache=Object.create(null),c.proxy=new Proxy(c.ctx,pa);let{setup:p}=u;if(p){Yt();let w=c.setupContext=p.length>1?Kc(c):null,g=fi(c),_=pi(p,c,0,[c.props,w]),A=La(_);if(Xt(),g(),(A||c.sp)&&!Qt(c)&&Ka(c),A){if(_.then(Hi,Hi),d)return _.then(M=>{ya(c,M,d)}).catch(M=>{Un(M,c,0)});c.asyncDep=_}else ya(c,_,d)}else Hc(c,d)}(e,t):void 0;return t&&Yn(!1),l}function ya(e,t,n){te(t)?e.type.__ssrInlineRender?e.ssrRender=t:e.render=t:fe(t)&&(e.setupState=ja(t)),Hc(e,n)}function zc(e){Is=e,ta=t=>{t.render._rc&&(t.withProxy=new Proxy(t.ctx,zp))}}var xf=()=>!Is;function Hc(e,t,n){let i=e.type;if(!e.render){if(!t&&Is&&!i.render){let s=i.template||ha(e).template;if(s){let{isCustomElement:r,compilerOptions:a}=e.appContext.config,{delimiters:o,compilerOptions:l}=i,c=le(le({isCustomElement:r,delimiters:o},a),l);i.render=Is(s,c)}}e.render=i.render||He,ta&&ta(e)}{let s=fi(e);Yt();try{(function(r){let a=ha(r),o=r.proxy,l=r.ctx;fa=!1,a.beforeCreate&&Po(a.beforeCreate,r,"bc");let{data:c,computed:d,methods:u,watch:p,provide:w,inject:g,created:_,beforeMount:A,mounted:M,beforeUpdate:h,updated:m,activated:q,deactivated:T,beforeUnmount:N,unmounted:f,render:y,renderTracked:v,renderTriggered:k,errorCaptured:S,serverPrefetch:x,expose:I,inheritAttrs:R,components:E,directives:V}=a;if(g&&function(z,H){for(let X in J(z)&&(z=ma(z)),z){let ne,ue=z[X];Le(ne=fe(ue)?"default"in ue?Ri(ue.from||X,ue.default,!0):Ri(ue.from||X):Ri(ue))?Object.defineProperty(H,X,{enumerable:!0,configurable:!0,get:()=>ne.value,set:he=>ne.value=he}):H[X]=ne}}(g,l),u)for(let z in u){let H=u[z];te(H)&&(l[z]=H.bind(o))}if(c){let z=c.call(o,o);fe(z)&&(r.data=hn(z))}if(fa=!0,d)for(let z in d){let H=d[z],X=te(H)?H.bind(o,o):te(H.get)?H.get.bind(o,o):He,ne=Qc({get:X,set:!te(H)&&te(H.set)?H.set.bind(o):He});Object.defineProperty(l,z,{enumerable:!0,configurable:!0,get:()=>ne.value,set:ue=>ne.value=ue})}if(p)for(let z in p)(function H(X,ne,ue,he){let ye=he.includes(".")?lc(ue,he):()=>ue[he];if(ie(X)){let ze=ne[X];te(ze)&&si(ye,ze)}else if(te(X))si(ye,X.bind(ue));else if(fe(X))if(J(X))X.forEach(ze=>H(ze,ne,ue,he));else{let ze=te(X.handler)?X.handler.bind(ue):ne[X.handler];te(ze)&&si(ye,ze,X)}})(p[z],l,o,z);if(w){let z=te(w)?w.call(o):w;Reflect.ownKeys(z).forEach(H=>{sc(H,z[H])})}function B(z,H){J(H)?H.forEach(X=>z(X.bind(o))):H&&z(H.bind(o))}if(_&&Po(_,r,"c"),B(vc,A),B(ns,M),B(Qa,h),B(kr,m),B(hc,q),B(mc,T),B(wc,S),B(xc,v),B(yc,k),B(_r,N),B(is,f),B(bc,x),J(I))if(I.length){let z=r.exposed||(r.exposed={});I.forEach(H=>{Object.defineProperty(z,H,{get:()=>o[H],set:X=>o[H]=X,enumerable:!0})})}else r.exposed||(r.exposed={});y&&r.render===He&&(r.render=y),R!=null&&(r.inheritAttrs=R),E&&(r.components=E),V&&(r.directives=V),x&&Ka(r)})(e)}finally{Xt(),s()}}}var wf={get:(e,t)=>(Ye(e,"get",""),e[t])};function Kc(e){return{attrs:new Proxy(e.attrs,wf),slots:e.slots,emit:e.emit,expose:t=>{e.exposed=t||{}}}}function ss(e){return e.exposed?e.exposeProxy||(e.exposeProxy=new Proxy(ja(Yl(e.exposed)),{get:(t,n)=>n in t?t[n]:n in Oi?Oi[n](e):void 0,has:(t,n)=>n in t||n in Oi})):e.proxy}function xa(e,t=!0){return te(e)?e.displayName||e.name:e.name||t&&e.__name}var Qc=(e,t)=>function(n,i=!1){let s,r;return te(n)?s=n:(s=n.get,r=n.set),new ca(s,r,i)}(e,Pn);function Wc(e,t,n){try{zi(-1);let i=arguments.length;return i!==2?(i>3?n=Array.prototype.slice.call(arguments,2):i===3&&en(n)&&(n=[n]),Te(e,t,n)):!fe(t)||J(t)?Te(e,null,t):en(t)?Te(e,null,[t]):Te(e,t)}finally{zi(1)}}function kf(){}function _f(e,t,n,i){let s=n[i];if(s&&Jc(s,e))return s;let r=t();return r.memo=e.slice(),r.cacheIndex=i,n[i]=r}function Jc(e,t){let n=e.memo;if(n.length!=t.length)return!1;for(let i=0;i<n.length;i++)if($e(n[i],t[i]))return!1;return On>0&&Xe&&Xe.push(e),!0}var Gc="3.5.40",Sf=He,qf=null,Cf,Tf=He,Af={createComponentInstance:Uc,setupComponent:Vc,renderComponentRoot:As,setCurrentRenderingInstance:Ui,isVNode:en,normalizeVNode:ct,getComponentPublicInstance:ss,ensureValidVNode:Ga,pushWarningContext:function(e){},popWarningContext:function(){}},Nf=null,Mf=null,Ef=null,$o="u">typeof window&&window.trustedTypes;if($o)try{na=$o.createPolicy("vue",{createHTML:e=>e})}catch{}var Yc=na?e=>na.createHTML(e):e=>e,jt="u">typeof document?document:null,Vo=jt&&jt.createElement("template"),Xc={insert:(e,t,n)=>{t.insertBefore(e,n||null)},remove:e=>{let t=e.parentNode;t&&t.removeChild(e)},createElement:(e,t,n,i)=>{let s=t==="svg"?jt.createElementNS("http://www.w3.org/2000/svg",e):t==="mathml"?jt.createElementNS("http://www.w3.org/1998/Math/MathML",e):n?jt.createElement(e,{is:n}):jt.createElement(e);return e==="select"&&i&&i.multiple!=null&&s.setAttribute("multiple",i.multiple),s},createText:e=>jt.createTextNode(e),createComment:e=>jt.createComment(e),setText:(e,t)=>{e.nodeValue=t},setElementText:(e,t)=>{e.textContent=t},parentNode:e=>e.parentNode,nextSibling:e=>e.nextSibling,querySelector:e=>jt.querySelector(e),setScopeId(e,t){e.setAttribute(t,"")},insertStaticContent(e,t,n,i,s,r){let a=n?n.previousSibling:t.lastChild;if(s&&(s===r||s.nextSibling))for(;t.insertBefore(s.cloneNode(!0),n),s!==r&&(s=s.nextSibling););else{Vo.innerHTML=Yc(i==="svg"?`<svg>${e}</svg>`:i==="mathml"?`<math>${e}</math>`:e);let o=Vo.content;if(i==="svg"||i==="mathml"){let l=o.firstChild;for(;l.firstChild;)o.appendChild(l.firstChild);o.removeChild(l)}t.insertBefore(o,n)}return[a?a.nextSibling:t.firstChild,n?n.previousSibling:t.lastChild]}},sn="transition",Si="animation",li=Symbol("_vtc"),Zc={name:String,type:String,css:{type:Boolean,default:!0},duration:[String,Number,Object],enterFromClass:String,enterActiveClass:String,enterToClass:String,appearFromClass:String,appearActiveClass:String,appearToClass:String,leaveFromClass:String,leaveActiveClass:String,leaveToClass:String},ed=le({},za,Zc),If=((Yr=(e,{slots:t})=>Wc(pc,td(e),t)).displayName="Transition",Yr.props=ed,Yr),_n=(e,t=[])=>{J(e)?e.forEach(n=>n(...t)):e&&e(...t)},zo=e=>!!e&&(J(e)?e.some(t=>t.length>1):e.length>1);function td(e){let t={};for(let x in e)x in Zc||(t[x]=e[x]);if(e.css===!1)return t;let{name:n="v",type:i,duration:s,enterFromClass:r=`${n}-enter-from`,enterActiveClass:a=`${n}-enter-active`,enterToClass:o=`${n}-enter-to`,appearFromClass:l=r,appearActiveClass:c=a,appearToClass:d=o,leaveFromClass:u=`${n}-leave-from`,leaveActiveClass:p=`${n}-leave-active`,leaveToClass:w=`${n}-leave-to`}=e,g=function(x){if(x==null)return null;{if(fe(x))return[function(R){return ti(R)}(x.enter),function(R){return ti(R)}(x.leave)];let I=function(R){return ti(R)}(x);return[I,I]}}(s),_=g&&g[0],A=g&&g[1],{onBeforeEnter:M,onEnter:h,onEnterCancelled:m,onLeave:q,onLeaveCancelled:T,onBeforeAppear:N=M,onAppear:f=h,onAppearCancelled:y=m}=t,v=(x,I,R,E)=>{x._enterCancelled=E,on(x,I?d:o),on(x,I?c:a),R&&R()},k=(x,I)=>{x._isLeaving=!1,on(x,u),on(x,w),on(x,p),I&&I()},S=x=>(I,R)=>{let E=x?f:h,V=()=>v(I,x,R);_n(E,[I,V]),Ho(()=>{on(I,x?l:r),It(I,x?d:o),zo(E)||Ko(I,i,_,V)})};return le(t,{onBeforeEnter(x){_n(M,[x]),It(x,r),It(x,a)},onBeforeAppear(x){_n(N,[x]),It(x,l),It(x,c)},onEnter:S(!1),onAppear:S(!0),onLeave(x,I){x._isLeaving=!0;let R=()=>k(x,I);It(x,u),x._enterCancelled?(It(x,p),wa(x)):(wa(x),It(x,p)),Ho(()=>{x._isLeaving&&(on(x,u),It(x,w),zo(q)||Ko(x,i,A,R))}),_n(q,[x,R])},onEnterCancelled(x){v(x,!1,void 0,!0),_n(m,[x])},onAppearCancelled(x){v(x,!0,void 0,!0),_n(y,[x])},onLeaveCancelled(x){k(x),_n(T,[x])}})}function It(e,t){t.split(/\s+/).forEach(n=>n&&e.classList.add(n)),(e[li]||(e[li]=new Set)).add(t)}function on(e,t){t.split(/\s+/).forEach(i=>i&&e.classList.remove(i));let n=e[li];n&&(n.delete(t),n.size||(e[li]=void 0))}function Ho(e){requestAnimationFrame(()=>{requestAnimationFrame(e)})}var Rf=0;function Ko(e,t,n,i){let s=e._endId=++Rf,r=()=>{s===e._endId&&i()};if(n!=null)return setTimeout(r,n);let{type:a,timeout:o,propCount:l}=nd(e,t);if(!a)return i();let c=a+"end",d=0,u=()=>{e.removeEventListener(c,p),r()},p=w=>{w.target===e&&++d>=l&&u()};setTimeout(()=>{d<l&&u()},o+1),e.addEventListener(c,p)}function nd(e,t){let n=window.getComputedStyle(e),i=g=>(n[g]||"").split(", "),s=i(`${sn}Delay`),r=i(`${sn}Duration`),a=Qo(s,r),o=i(`${Si}Delay`),l=i(`${Si}Duration`),c=Qo(o,l),d=null,u=0,p=0;t===sn?a>0&&(d=sn,u=a,p=r.length):t===Si?c>0&&(d=Si,u=c,p=l.length):p=(d=(u=Math.max(a,c))>0?a>c?sn:Si:null)?d===sn?r.length:l.length:0;let w=d===sn&&/\b(?:transform|all)(?:,|$)/.test(i(`${sn}Property`).toString());return{type:d,timeout:u,propCount:p,hasTransform:w}}function Qo(e,t){for(;e.length<t.length;)e=e.concat(e);return Math.max(...t.map((n,i)=>Wo(n)+Wo(e[i])))}function Wo(e){return e==="auto"?0:1e3*Number(e.slice(0,-1).replace(",","."))}function wa(e){return(e?e.ownerDocument:document).body.offsetHeight}var Gs=Symbol("_vod"),io=Symbol("_vsh"),id={name:"show",beforeMount(e,{value:t},{transition:n}){e[Gs]=e.style.display==="none"?"":e.style.display,n&&t?n.beforeEnter(e):qi(e,t)},mounted(e,{value:t},{transition:n}){n&&t&&n.enter(e)},updated(e,{value:t,oldValue:n},{transition:i}){!t!=!n&&(i?t?(i.beforeEnter(e),qi(e,!0),i.enter(e)):i.leave(e,()=>{qi(e,!1)}):qi(e,t))},beforeUnmount(e,{value:t}){qi(e,t)}};function qi(e,t){e.style.display=t?e[Gs]:"none",e[io]=!t}var sd=Symbol("");function Of(e){let t=at();if(!t)return;let n=t.ut=(s=e(t.proxy))=>{Array.from(document.querySelectorAll(`[data-v-owner="${t.uid}"]`)).forEach(r=>xs(r,s))},i=()=>{let s=e(t.proxy);t.ce?xs(t.ce,s):function r(a,o){if(128&a.shapeFlag){let l=a.suspense;a=l.activeBranch,l.pendingBranch&&!l.isHydrating&&l.effects.push(()=>{r(l.activeBranch,o)})}for(;a.component;)a=a.component.subTree;if(1&a.shapeFlag&&a.el)xs(a.el,o);else if(a.type===Ve)a.children.forEach(l=>r(l,o));else if(a.type===En){let{el:l,anchor:c}=a;for(;l&&(xs(l,o),l!==c);)l=l.nextSibling}}(t.subTree,s),n(s)};Qa(()=>{ji(i)}),ns(()=>{si(i,He,{flush:"post"});let s=new MutationObserver(i);s.observe(t.subTree.el.parentNode,{childList:!0}),is(()=>s.disconnect())})}function xs(e,t){if(e.nodeType===1){let i=e.style,s="";for(let r in t){var n;let a=(n=t[r])==null?"initial":typeof n=="string"?n===""?" ":n:String(n);i.setProperty(`--${r}`,a),s+=`--${r}: ${a};`}i[sd]=s}}var Pf=/(?:^|;)\s*display\s*:/,Jo=/\s*!important$/;function Ti(e,t,n){if(J(n))n.forEach(i=>Ti(e,t,i));else if(n==null&&(n=""),t.startsWith("--"))e.setProperty(t,n);else{let i=function(s,r){let a=Jr[r];if(a)return a;let o=xe(r);if(o!=="filter"&&o in s)return Jr[r]=o;o=jn(o);for(let l=0;l<Go.length;l++){let c=Go[l]+o;if(c in s)return Jr[r]=c}return r}(e,t);Jo.test(n)?e.setProperty(dt(i),n.replace(Jo,""),"important"):e[i]=n}}var Go=["Webkit","Moz","ms"],Jr={},Yo="http://www.w3.org/1999/xlink";function Xo(e,t,n,i,s,r=$u(t)){i&&t.startsWith("xlink:")?n==null?e.removeAttributeNS(Yo,t.slice(6,t.length)):e.setAttributeNS(Yo,t,n):n==null||r&&!(n||n==="")?e.removeAttribute(t):e.setAttribute(t,r?"":Ze(n)?String(n):n)}function Zo(e,t,n,i,s){if(t==="innerHTML"||t==="textContent"){n!=null&&(e[t]=t==="innerHTML"?Yc(n):n);return}let r=e.tagName;if(t==="value"&&r!=="PROGRESS"&&!r.includes("-")){let l=r==="OPTION"?e.getAttribute("value")||"":e.value,c=n==null?e.type==="checkbox"?"on":"":String(n);l===c&&"_value"in e||(e.value=c),n==null&&e.removeAttribute(t),e._value=n;return}let a=!1;if(n===""||n==null){let l=typeof e[t];if(l==="boolean"){var o;n=!!(o=n)||o===""}else n==null&&l==="string"?(n="",a=!0):l==="number"&&(n=0,a=!0)}try{e[t]=n}catch{}a&&e.removeAttribute(s||t)}function zt(e,t,n,i){e.addEventListener(t,n,i)}var el=Symbol("_vei"),Bf=/(Once|Passive|Capture)$/,Lf=/^on:?(?:Once|Passive|Capture)$/,Gr=0,Df=Promise.resolve(),tl=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&e.charCodeAt(2)>96&&123>e.charCodeAt(2),rd=(e,t,n,i,s,r)=>{let a=s==="svg";if(t==="class"){var o;let l;o=i,(l=e[li])&&(o=(o?[o,...l]:[...l]).join(" ")),o==null?e.removeAttribute("class"):a?e.setAttribute("class",o):e.className=o}else t==="style"?function(l,c,d){let u=l.style,p=ie(d),w=!1;if(d&&!p){if(c)if(ie(c))for(let h of c.split(";")){let m=h.slice(0,h.indexOf(":")).trim();d[m]==null&&Ti(u,m,"")}else for(let h in c)d[h]==null&&Ti(u,h,"");for(let h in d){var g,_,A,M;h==="display"&&(w=!0);let m=d[h];m!=null?(g=l,_=h,A=!ie(c)&&c?c[h]:void 0,M=m,g.tagName==="TEXTAREA"&&(_==="width"||_==="height")&&ie(M)&&A===M||Ti(u,h,m)):Ti(u,h,"")}}else if(p){if(c!==d){let h=u[sd];h&&(d+=";"+h),u.cssText=d,w=Pf.test(d)}}else c&&l.removeAttribute("style");Gs in l&&(l[Gs]=w?u.display:"",l[io]&&(u.display="none"))}(e,n,i):Fn(t)?cr(t)||function(l,c,d,u=null){let p=l[el]||(l[el]={}),w=p[c];if(d&&w)w.value=d;else{let[A,M]=function(h){let m,q;for(;(q=h.match(Bf))&&!Lf.test(h);)m||(m={}),h=h.slice(0,h.length-q[1].length),m[q[1].toLowerCase()]=!0;return[h[2]===":"?h.slice(3):dt(h.slice(2)),m]}(c);if(d){var g,_;let h;zt(l,A,p[c]=(g=d,_=u,(h=m=>{if(m._vts){if(m._vts<=h.attached)return}else m._vts=Date.now();let q=h.value;if(J(q)){let T=m.stopImmediatePropagation;m.stopImmediatePropagation=()=>{T.call(m),m._stopped=!0};let N=q.slice(),f=[m];for(let y=0;y<N.length&&!m._stopped;y++){let v=N[y];v&&gt(v,_,5,f)}}else gt(q,_,5,[m])}).value=g,h.attached=Gr||(Df.then(()=>Gr=0),Gr=Date.now()),h),M)}else w&&(l.removeEventListener(A,w,M),p[c]=void 0)}}(e,t,i,r):(t[0]==="."?(t=t.slice(1),0):t[0]==="^"?(t=t.slice(1),1):!function(l,c,d,u){if(u)return!!(c==="innerHTML"||c==="textContent"||c in l&&tl(c)&&te(d));if(c==="spellcheck"||c==="draggable"||c==="translate"||c==="autocorrect"||c==="sandbox"&&l.tagName==="IFRAME"||c==="form"||c==="list"&&l.tagName==="INPUT"||c==="type"&&l.tagName==="TEXTAREA")return!1;if(c==="width"||c==="height"){let p=l.tagName;if(p==="IMG"||p==="VIDEO"||p==="CANVAS"||p==="SOURCE")return!1}return!(tl(c)&&ie(d))&&c in l}(e,t,i,a))?e._isVueCE&&(function(l,c){let d=l._def.props;if(!d)return!1;let u=xe(c);return Array.isArray(d)?d.some(p=>xe(p)===u):Object.keys(d).some(p=>xe(p)===u)}(e,t)||e._def.__asyncLoader&&(/[A-Z]/.test(t)||!ie(i)))?Zo(e,xe(t),i,r,t):(t==="true-value"?e._trueValue=i:t==="false-value"&&(e._falseValue=i),Xo(e,t,i,a)):(Zo(e,t,i),e.tagName.includes("-")||t!=="value"&&t!=="checked"&&t!=="selected"||Xo(e,t,i,a,r,t!=="value"))},nl={};function ad(e,t,n){let i,s=Ha(e,t);i=s,Ne.call(i)==="[object Object]"&&(s=le({},s,t));class r extends Ys{constructor(o){super(s,o,n)}}return r.def=s,r}var Ff=(e,t)=>ad(e,t,vd),jf="u">typeof HTMLElement?HTMLElement:class{},Ys=class e extends jf{constructor(t,n={},i=Ki){super(),this._def=t,this._props=n,this._createApp=i,this._isVueCE=!0,this._instance=null,this._app=null,this._nonce=this._def.nonce,this._connected=!1,this._resolved=!1,this._patching=!1,this._dirty=!1,this._numberProps=null,this._styleChildren=new WeakSet,this._styleAnchors=new WeakMap,this._ob=null,this.shadowRoot&&i!==Ki?this._root=this.shadowRoot:t.shadowRoot!==!1?(this.attachShadow(le({},t.shadowRootOptions,{mode:"open"})),this._root=this.shadowRoot):this._root=this}connectedCallback(){if(!this.isConnected)return;this.shadowRoot||this._resolved||this._parseSlots(),this._connected=!0;let t=this;for(;t=t&&(t.assignedSlot||t.parentNode||t.host);)if(t instanceof e){this._parent=t;break}this._instance||(this._resolved?this._mount(this._def):t&&t._pendingResolve?this._pendingResolve=t._pendingResolve.then(()=>{this._pendingResolve=void 0,this._resolveDef()}):this._resolveDef())}_setParent(t=this._parent){t&&(this._instance.parent=t._instance,this._inheritParentContext(t))}_inheritParentContext(t=this._parent){t&&this._app&&Object.setPrototypeOf(this._app._context.provides,t._instance.provides)}disconnectedCallback(){this._connected=!1,yr(()=>{!this._connected&&(this._ob&&(this._ob.disconnect(),this._ob=null),this._app&&this._app.unmount(),this._instance&&(this._instance.ce=void 0),this._app=this._instance=null,this._teleportTargets&&(this._teleportTargets.clear(),this._teleportTargets=void 0))})}_processMutations(t){for(let n of t)this._setAttr(n.attributeName)}_resolveDef(){if(this._pendingResolve)return;for(let i=0;i<this.attributes.length;i++)this._setAttr(this.attributes[i].name);this._ob=new MutationObserver(this._processMutations.bind(this)),this._ob.observe(this,{attributes:!0});let t=(i,s=!1)=>{let r;this._resolved=!0,this._pendingResolve=void 0;let{props:a,styles:o}=i;if(a&&!J(a))for(let l in a){let c=a[l];(c===Number||c&&c.type===Number)&&(l in this._props&&(this._props[l]=ti(this._props[l])),(r||(r=Object.create(null)))[xe(l)]=!0)}this._numberProps=r,this._resolveProps(i),this.shadowRoot&&this._applyStyles(o),this._mount(i)},n=this._def.__asyncLoader;n?this._pendingResolve=n().then(i=>{i.configureApp=this._def.configureApp,t(this._def=i,!0)}):t(this._def)}_mount(t){this._app=this._createApp(t),this._inheritParentContext(),t.configureApp&&t.configureApp(this._app),this._app._ceVNode=this._createVNode(),this._app.mount(this._root);let n=this._instance&&this._instance.exposed;if(n)for(let i in n)me(this,i)||Object.defineProperty(this,i,{get:()=>Zi(n[i])})}_resolveProps(t){let{props:n}=t,i=J(n)?n:Object.keys(n||{});for(let s of Object.keys(this))s[0]!=="_"&&i.includes(s)&&this._setProp(s,this[s]);for(let s of i.map(xe))Object.defineProperty(this,s,{get(){return this._getProp(s)},set(r){this._setProp(s,r,!0,!this._patching)}})}_setAttr(t){if(t.startsWith("data-v-"))return;let n=this.hasAttribute(t),i=n?this.getAttribute(t):nl,s=xe(t);n&&this._numberProps&&this._numberProps[s]&&(i=ti(i)),this._setProp(s,i,!1,!0)}_getProp(t){return this._props[t]}_setProp(t,n,i=!0,s=!1){if(n!==this._props[t]&&(this._dirty=!0,n===nl?delete this._props[t]:(this._props[t]=n,t==="key"&&this._app&&(this._app._ceVNode.key=n)),s&&this._instance&&this._update(),i)){let r=this._ob;r&&(this._processMutations(r.takeRecords()),r.disconnect()),n===!0?this.setAttribute(dt(t),""):typeof n=="string"||typeof n=="number"?this.setAttribute(dt(t),n+""):n||this.removeAttribute(dt(t)),r&&r.observe(this,{attributes:!0})}}_update(){let t=this._createVNode();this._app&&(t.appContext=this._app._context),gd(t,this._root)}_createVNode(){let t={};this.shadowRoot||(t.onVnodeMounted=t.onVnodeUpdated=this._renderSlots.bind(this));let n=Te(this._def,le(t,this._props));return this._instance||(n.ce=i=>{this._instance=i,i.ce=this,i.isCE=!0;let s=(r,a)=>{let o;this.dispatchEvent(new CustomEvent(r,(o=a[0],Ne.call(o)==="[object Object]"?le({detail:a},a[0]):{detail:a})))};i.emit=(r,...a)=>{s(r,a),dt(r)!==r&&s(dt(r),a)},this._setParent()}),n}_applyStyles(t,n,i){if(!t)return;if(n){if(n===this._def||this._styleChildren.has(n))return;this._styleChildren.add(n)}let s=this._nonce,r=this.shadowRoot,a=i?this._getStyleAnchor(i)||this._getStyleAnchor(this._def):this._getRootStyleInsertionAnchor(r),o=null;for(let l=t.length-1;l>=0;l--){let c=document.createElement("style");s&&c.setAttribute("nonce",s),c.textContent=t[l],r.insertBefore(c,o||a),o=c,l===0&&(i||this._styleAnchors.set(this._def,c),n&&this._styleAnchors.set(n,c))}}_getStyleAnchor(t){if(!t)return null;let n=this._styleAnchors.get(t);return n&&n.parentNode===this.shadowRoot?n:(n&&this._styleAnchors.delete(t),null)}_getRootStyleInsertionAnchor(t){for(let n=0;n<t.childNodes.length;n++){let i=t.childNodes[n];if(!(i instanceof HTMLStyleElement))return i}return null}_parseSlots(){let t,n=this._slots={};for(;t=this.firstChild;){let i=t.nodeType===1&&t.getAttribute("slot")||"default";(n[i]||(n[i]=[])).push(t),this.removeChild(t)}}_renderSlots(){let t=this._getSlots(),n=this._instance.type.__scopeId;for(let i=0;i<t.length;i++){let s=t[i],r=s.getAttribute("name")||"default",a=this._slots[r],o=s.parentNode;if(a)for(let l of a){if(n&&l.nodeType===1){let c,d=n+"-s",u=document.createTreeWalker(l,1);for(l.setAttribute(d,"");c=u.nextNode();)c.setAttribute(d,"")}o.insertBefore(l,s)}else for(;s.firstChild;)o.insertBefore(s.firstChild,s);o.removeChild(s)}}_getSlots(){let t=[this];this._teleportTargets&&t.push(...this._teleportTargets);let n=new Set;for(let i of t){let s=i.querySelectorAll("slot");for(let r=0;r<s.length;r++)n.add(s[r])}return Array.from(n)}_injectChildStyle(t,n){this._applyStyles(t.styles,t,n)}_beginPatch(){this._patching=!0,this._dirty=!1}_endPatch(){this._patching=!1,this._dirty&&this._instance&&this._update()}_hasShadowRoot(){return this._def.shadowRoot!==!1}_removeChildStyle(t){}};function od(e){let t=at();return t&&t.ce||null}function Uf(){let e=od();return e&&e.shadowRoot}function $f(e="$style"){{let t=at();if(!t)return de;let n=t.type.__cssModules;return n&&n[e]||de}}var ld=new WeakMap,cd=new WeakMap,Xs=Symbol("_moveCb"),il=Symbol("_enterCb"),Vf=(Xr={name:"TransitionGroup",props:le({},ed,{tag:String,moveClass:String}),setup(e,{slots:t}){let n,i,s=at(),r=Va();return kr(()=>{if(!n.length)return;let a=e.moveClass||`${e.name||"v"}-move`;if(!function(l,c,d){let u=l.cloneNode(),p=l[li];p&&p.forEach(_=>{_.split(/\s+/).forEach(A=>A&&u.classList.remove(A))}),d.split(/\s+/).forEach(_=>_&&u.classList.add(_)),u.style.display="none";let w=c.nodeType===1?c:c.parentNode;w.appendChild(u);let{hasTransform:g}=nd(u);return w.removeChild(u),g}(n[0].el,s.vnode.el,a)){n=[];return}n.forEach(zf),n.forEach(Hf);let o=n.filter(Kf);wa(s.vnode.el),o.forEach(l=>{let c=l.el,d=c.style;It(c,a),d.transform=d.webkitTransform=d.transitionDuration="";let u=c[Xs]=p=>{(!p||p.target===c)&&(!p||p.propertyName.endsWith("transform"))&&(c.removeEventListener("transitionend",u),c[Xs]=null,on(c,a))};c.addEventListener("transitionend",u)}),n=[]}),()=>{let a=pe(e),o=td(a),l=a.tag||Ve;if(n=[],i)for(let c=0;c<i.length;c++){let d=i[c];d.el&&d.el instanceof Element&&!d.el[io]&&(n.push(d),Zt(d,oi(d,o,r,s)),ld.set(d,dd(d.el)))}i=t.default?wr(t.default()):[];for(let c=0;c<i.length;c++){let d=i[c];d.key!=null&&Zt(d,oi(d,o,r,s))}return Te(l,null,i)}}},delete Xr.props.mode,Xr);function zf(e){let t=e.el;t[Xs]&&t[Xs](),t[il]&&t[il]()}function Hf(e){cd.set(e,dd(e.el))}function Kf(e){let t=ld.get(e),n=cd.get(e),i=t.left-n.left,s=t.top-n.top;if(i||s){let r=e.el,a=r.style,o=r.getBoundingClientRect(),l=1,c=1;return r.offsetWidth&&(l=o.width/r.offsetWidth),r.offsetHeight&&(c=o.height/r.offsetHeight),Number.isFinite(l)&&l!==0||(l=1),Number.isFinite(c)&&c!==0||(c=1),.01>Math.abs(l-1)&&(l=1),.01>Math.abs(c-1)&&(c=1),a.transform=a.webkitTransform=`translate(${i/l}px,${s/c}px)`,a.transitionDuration="0s",e}}function dd(e){let t=e.getBoundingClientRect();return{left:t.left,top:t.top}}var un=e=>{let t=e.props["onUpdate:modelValue"]||!1;return J(t)?n=>ei(t,n):t};function Qf(e){e.target.composing=!0}function sl(e){let t=e.target;t.composing&&(t.composing=!1,t.dispatchEvent(new Event("input")))}var qt=Symbol("_assign");function rl(e,t,n){return t&&(e=e.trim()),n&&(e=pr(e)),e}var Zs={created(e,{modifiers:{lazy:t,trim:n,number:i}},s){e[qt]=un(s);let r=i||s.props&&s.props.type==="number";zt(e,t?"change":"input",a=>{a.target.composing||e[qt](rl(e.value,n,r))}),(n||r)&&zt(e,"change",()=>{e.value=rl(e.value,n,r)}),t||(zt(e,"compositionstart",Qf),zt(e,"compositionend",sl),zt(e,"change",sl))},mounted(e,{value:t}){e.value=t??""},beforeUpdate(e,{value:t,oldValue:n,modifiers:{lazy:i,trim:s,number:r}},a){if(e[qt]=un(a),e.composing)return;let o=(r||e.type==="number")&&!/^0\d/.test(e.value)?pr(e.value):e.value,l=t??"";if(o===l)return;let c=e.getRootNode();(c instanceof Document||c instanceof ShadowRoot)&&c.activeElement===e&&e.type!=="range"&&(i&&t===n||s&&e.value.trim()===l)||(e.value=l)}},so={deep:!0,created(e,t,n){e[qt]=un(n),zt(e,"change",()=>{let i=e._modelValue,s=ci(e),r=e.checked,a=e[qt];if(J(i)){let o=hr(i,s),l=o!==-1;if(r&&!l)a(i.concat(s));else if(!r&&l){let c=[...i];c.splice(o,1),a(c)}}else{let o;if(o=i,Ne.call(o)==="[object Set]"){let l=new Set(i);r?l.add(s):l.delete(s),a(l)}else a(pd(e,r))}})},mounted:al,beforeUpdate(e,t,n){e[qt]=un(n),al(e,t,n)}};function al(e,{value:t,oldValue:n},i){let s;if(e._modelValue=t,J(t))s=hr(t,i.props.value)>-1;else{let r;if(r=t,Ne.call(r)==="[object Set]")s=t.has(i.props.value);else{if(t===n)return;s=Gt(t,pd(e,!0))}}e.checked!==s&&(e.checked=s)}var ro={created(e,{value:t},n){e.checked=Gt(t,n.props.value),e[qt]=un(n),zt(e,"change",()=>{e[qt](ci(e))})},beforeUpdate(e,{value:t,oldValue:n},i){e[qt]=un(i),t!==n&&(e.checked=Gt(t,i.props.value))}},ud={deep:!0,created(e,{value:t,modifiers:{number:n}},i){e._modelValue=t,zt(e,"change",()=>{let s,r=Array.prototype.filter.call(e.options,a=>a.selected).map(a=>n?pr(ci(a)):ci(a));e[qt](e.multiple?(s=e._modelValue,Ne.call(s)==="[object Set]"?new Set(r):r):r[0]),e._assigning=!0,yr(()=>{e._assigning=!1})}),e[qt]=un(i)},mounted(e,{value:t}){ol(e,t)},beforeUpdate(e,{value:t},n){e._modelValue=t,e[qt]=un(n)},updated(e,{value:t}){e._assigning||ol(e,t)}};function ol(e,t){let n,i=e.multiple,s=J(t);if(!i||s||(n=t,Ne.call(n)==="[object Set]")){for(let r=0,a=e.options.length;r<a;r++){let o=e.options[r],l=ci(o);if(i)if(s){let c=typeof l;c==="string"||c==="number"?o.selected=t.some(d=>String(d)===String(l)):o.selected=hr(t,l)>-1}else o.selected=t.has(l);else if(Gt(ci(o),t)){e.selectedIndex!==r&&(e.selectedIndex=r);return}}i||e.selectedIndex===-1||(e.selectedIndex=-1)}}function ci(e){return"_value"in e?e._value:e.value}function pd(e,t){let n=t?"_trueValue":"_falseValue";return n in e?e[n]:t}var fd={created(e,t,n){ws(e,t,n,null,"created")},mounted(e,t,n){ws(e,t,n,null,"mounted")},beforeUpdate(e,t,n,i){ws(e,t,n,i,"beforeUpdate")},updated(e,t,n,i){ws(e,t,n,i,"updated")}};function hd(e,t){switch(e){case"SELECT":return ud;case"TEXTAREA":return Zs;default:switch(t){case"checkbox":return so;case"radio":return ro;default:return Zs}}}function ws(e,t,n,i,s){let r=hd(e.tagName,n.props&&n.props.type)[s];r&&r(e,t,n,i)}var Wf=["ctrl","shift","alt","meta"],Jf={stop:e=>e.stopPropagation(),prevent:e=>e.preventDefault(),self:e=>e.target!==e.currentTarget,ctrl:e=>!e.ctrlKey,shift:e=>!e.shiftKey,alt:e=>!e.altKey,meta:e=>!e.metaKey,left:e=>"button"in e&&e.button!==0,middle:e=>"button"in e&&e.button!==1,right:e=>"button"in e&&e.button!==2,exact:(e,t)=>Wf.some(n=>e[`${n}Key`]&&!t.includes(n))},Gf=(e,t)=>{if(!e)return e;let n=e._withMods||(e._withMods={}),i=t.join(".");return n[i]||(n[i]=(s,...r)=>{for(let a=0;a<t.length;a++){let o=Jf[t[a]];if(o&&o(s,t))return}return e(s,...r)})},Yf={esc:"escape",space:" ",up:"arrow-up",left:"arrow-left",right:"arrow-right",down:"arrow-down",delete:"backspace"},Xf=(e,t)=>{let n=e._withKeys||(e._withKeys={}),i=t.join(".");return n[i]||(n[i]=s=>{if(!("key"in s))return;let r=dt(s.key);if(t.some(a=>a===r||Yf[a]===r))return e(s)})},ao=le({patchProp:rd},Xc),ll=!1;function md(){return An=ll?An:Ic(ao),ll=!0,An}var gd=(...e)=>{(An||(An=Za(ao))).render(...e)},Zf=(...e)=>{md().hydrate(...e)},Ki=(...e)=>{let t=(An||(An=Za(ao))).createApp(...e),{mount:n}=t;return t.mount=i=>{let s=yd(i);if(!s)return;let r=t._component;te(r)||r.render||r.template||(r.template=s.innerHTML),s.nodeType===1&&(s.textContent="");let a=n(s,!1,bd(s));return s instanceof Element&&(s.removeAttribute("v-cloak"),s.setAttribute("data-v-app","")),a},t},vd=(...e)=>{let t=md().createApp(...e),{mount:n}=t;return t.mount=i=>{let s=yd(i);if(s)return n(s,!0,bd(s))},t};function bd(e){return e instanceof SVGElement?"svg":typeof MathMLElement=="function"&&e instanceof MathMLElement?"mathml":void 0}function yd(e){return ie(e)?document.querySelector(e):e}var cl=!1,eh=()=>{cl||(cl=!0,Zs.getSSRProps=({value:e})=>({value:e}),ro.getSSRProps=({value:e},t)=>{if(t.props&&Gt(t.props.value,e))return{checked:!0}},so.getSSRProps=({value:e},t)=>{if(J(e)){if(t.props&&hr(e,t.props.value)>-1)return{checked:!0}}else{let n;if(n=e,Ne.call(n)==="[object Set]"){if(t.props&&e.has(t.props.value))return{checked:!0}}else if(e)return{checked:!0}}},fd.getSSRProps=(e,t)=>{if(typeof t.type!="string")return;let n=hd(t.type.toUpperCase(),t.props&&t.props.type);if(n.getSSRProps)return n.getSSRProps(e,t)},id.getSSRProps=({value:e})=>{if(!e)return{style:{display:"none"}}})},Yr,Xr,dl,th=Object.freeze({__proto__:null,BaseTransition:pc,BaseTransitionPropsValidators:za,Comment:Oe,DeprecationTypes:Ef,EffectScope:Li,ErrorCodes:mp,ErrorTypeStrings:qf,Fragment:Ve,KeepAlive:Bp,ReactiveEffect:Rn,Static:En,Suspense:hf,Teleport:Sp,Text:dn,TrackOpTypes:up,Transition:If,TransitionGroup:Vf,TriggerOpTypes:pp,VueElement:Ys,assertNumber:hp,callWithAsyncErrorHandling:gt,callWithErrorHandling:pi,camelize:xe,capitalize:jn,cloneVNode:Lt,compatUtils:Mf,computed:Qc,createApp:Ki,createBlock:Ws,createCommentVNode:Fc,createElementBlock:mf,createElementVNode:to,createHydrationRenderer:Ic,createPropsRestProxy:nf,createRenderer:Za,createSSRApp:vd,createSlots:Up,createStaticVNode:vf,createTextVNode:no,createVNode:Te,customRef:ec,defineAsyncComponent:Pp,defineComponent:Ha,defineCustomElement:ad,defineEmits:Kp,defineExpose:Qp,defineModel:Gp,defineOptions:Wp,defineProps:Hp,defineSSRCustomElement:Ff,defineSlots:Jp,devtools:Cf,effect:Hu,effectScope:Vu,getCurrentInstance:at,getCurrentScope:Fl,getCurrentWatcher:fp,getTransitionRawChildren:wr,guardReactiveProps:Dc,h:Wc,handleError:Un,hasInjectionContext:xp,hydrate:Zf,hydrateOnIdle:Ep,hydrateOnInteraction:Op,hydrateOnMediaQuery:Rp,hydrateOnVisible:Ip,initCustomFormatter:kf,initDirectivesForSSR:eh,inject:Ri,isMemoSame:Jc,isProxy:Xi,isReactive:Kt,isReadonly:Bt,isRef:Le,isRuntimeOnly:xf,isShallow:pt,isVNode:en,markRaw:Yl,mergeDefaults:ef,mergeModels:tf,mergeProps:jc,nextTick:yr,nodeOps:Xc,normalizeClass:Yi,normalizeProps:Lu,normalizeStyle:Gi,onActivated:hc,onBeforeMount:vc,onBeforeUnmount:_r,onBeforeUpdate:Qa,onDeactivated:mc,onErrorCaptured:wc,onMounted:ns,onRenderTracked:xc,onRenderTriggered:yc,onScopeDispose:zu,onServerPrefetch:bc,onUnmounted:is,onUpdated:kr,onWatcherCleanup:tc,openBlock:Vi,patchProp:rd,popScopeId:vp,provide:sc,proxyRefs:ja,pushScopeId:gp,queuePostFlushCb:ji,reactive:hn,readonly:Ls,ref:Ei,registerRuntimeCompiler:zc,render:gd,renderList:jp,renderSlot:$p,resolveComponent:Lp,resolveDirective:Fp,resolveDynamicComponent:Dp,resolveFilter:Nf,resolveTransitionHooks:oi,setBlockTracking:zi,setDevtoolsHook:Tf,setTransitionHooks:Zt,shallowReactive:Gl,shallowReadonly:rp,shallowRef:Xl,ssrContextKey:rc,ssrUtils:Af,stop:Ku,toDisplayString:Ll,toHandlerKey:Zn,toHandlers:Vp,toRaw:pe,toRef:dp,toRefs:cp,toValue:op,transformVNodeArgs:gf,triggerRef:ap,unref:Zi,useAttrs:Zp,useCssModule:$f,useCssVars:Of,useHost:od,useId:qp,useModel:of,useSSRContext:ac,useShadowRoot:Uf,useSlots:Xp,useTemplateRef:Cp,useTransitionState:Va,vModelCheckbox:so,vModelDynamic:fd,vModelRadio:ro,vModelSelect:ud,vModelText:Zs,vShow:id,version:Gc,warn:Sf,watch:si,watchEffect:wp,watchPostEffect:kp,watchSyncEffect:oc,withAsyncContext:sf,withCtx:$a,withDefaults:Yp,withDirectives:yp,withKeys:Xf,withMemo:_f,withModifiers:Gf,withScopeId:bp}),Qi=Symbol(""),Bi=Symbol(""),oo=Symbol(""),er=Symbol(""),xd=Symbol(""),Bn=Symbol(""),Ln=Symbol(""),Dn=Symbol(""),pn=Symbol(""),fn=Symbol(""),rs=Symbol(""),lo=Symbol(""),wd=Symbol(""),co=Symbol(""),ka=Symbol(""),uo=Symbol(""),nh=Symbol(""),po=Symbol(""),fo=Symbol(""),kd=Symbol(""),_d=Symbol(""),Cr=Symbol(""),tr=Symbol(""),ho=Symbol(""),mo=Symbol(""),Wi=Symbol(""),as=Symbol(""),go=Symbol(""),_a=Symbol(""),ih=Symbol(""),Sa=Symbol(""),nr=Symbol(""),sh=Symbol(""),rh=Symbol(""),vo=Symbol(""),ah=Symbol(""),oh=Symbol(""),bo=Symbol(""),Sd=Symbol(""),di={[Qi]:"Fragment",[Bi]:"Teleport",[oo]:"Suspense",[er]:"KeepAlive",[xd]:"BaseTransition",[Bn]:"openBlock",[Ln]:"createBlock",[Dn]:"createElementBlock",[pn]:"createVNode",[fn]:"createElementVNode",[rs]:"createCommentVNode",[lo]:"createTextVNode",[wd]:"createStaticVNode",[co]:"resolveComponent",[ka]:"resolveDynamicComponent",[uo]:"resolveDirective",[nh]:"resolveFilter",[po]:"withDirectives",[fo]:"renderList",[kd]:"renderSlot",[_d]:"createSlots",[Cr]:"toDisplayString",[tr]:"mergeProps",[ho]:"normalizeClass",[mo]:"normalizeStyle",[Wi]:"normalizeProps",[as]:"guardReactiveProps",[go]:"toHandlers",[_a]:"camelize",[ih]:"capitalize",[Sa]:"toHandlerKey",[nr]:"setBlockTracking",[sh]:"pushScopeId",[rh]:"popScopeId",[vo]:"withCtx",[ah]:"unref",[oh]:"isRef",[bo]:"withMemo",[Sd]:"isMemoSame"},vt={start:{line:1,column:1,offset:0},end:{line:1,column:1,offset:0},source:""};function Ji(e,t,n,i,s,r,a,o=!1,l=!1,c=!1,d=vt){var u,p,w,g;return e&&(o?(e.helper(Bn),e.helper((u=e.inSSR,p=c,u||p?Ln:Dn))):e.helper((w=e.inSSR,g=c,w||g?pn:fn)),a&&e.helper(po)),{type:13,tag:t,props:n,children:i,patchFlag:s,dynamicProps:r,directives:a,isBlock:o,disableTracking:l,isComponent:c,loc:d}}function In(e,t=vt){return{type:17,loc:t,elements:e}}function St(e,t=vt){return{type:15,loc:t,properties:e}}function Be(e,t){return{type:16,loc:vt,key:ie(e)?ae(e,!0):e,value:t}}function ae(e,t=!1,n=vt,i=0){return{type:4,loc:n,content:e,isStatic:t,constType:t?3:i}}function Mt(e,t=vt){return{type:8,loc:t,children:e}}function Fe(e,t=[],n=vt){return{type:14,loc:n,callee:e,arguments:t}}function ui(e,t,n=!1,i=!1,s=vt){return{type:18,params:e,returns:t,newline:n,isSlot:i,loc:s}}function qa(e,t,n,i=!0){return{type:19,test:e,consequent:t,alternate:n,newline:i,loc:vt}}function yo(e,{helper:t,removeHelper:n,inSSR:i}){if(!e.isBlock){var s,r;e.isBlock=!0,n((s=e.isComponent,i||s?pn:fn)),t(Bn),t((r=e.isComponent,i||r?Ln:Dn))}}var ul=new Uint8Array([123,123]),pl=new Uint8Array([125,125]);function fl(e){return e>=97&&e<=122||e>=65&&e<=90}function ht(e){return e===32||e===10||e===9||e===12||e===13}function rn(e){return e===47||e===62||ht(e)}function ir(e){let t=new Uint8Array(e.length);for(let n=0;n<e.length;n++)t[n]=e.charCodeAt(n);return t}var We={Cdata:new Uint8Array([67,68,65,84,65,91]),CdataEnd:new Uint8Array([93,93,62]),CommentEnd:new Uint8Array([45,45,62]),ScriptEnd:new Uint8Array([60,47,115,99,114,105,112,116]),StyleEnd:new Uint8Array([60,47,115,116,121,108,101]),TitleEnd:new Uint8Array([60,47,116,105,116,108,101]),TextareaEnd:new Uint8Array([60,47,116,101,120,116,97,114,101,97])};function Ca(e){throw e}function qd(e){}function be(e,t,n,i){let s=SyntaxError(`https://vuejs.org/error-reference/#compiler-${e}`);return s.code=e,s.loc=t,s}var ut=e=>e.type===4&&e.isStatic;function Cd(e){switch(e){case"Teleport":case"teleport":return Bi;case"Suspense":case"suspense":return oo;case"KeepAlive":case"keep-alive":return er;case"BaseTransition":case"base-transition":return xd}}var Ta=/^$|^\d|[^\$\w\xA0-\uFFFF]/,Td=/[A-Za-z_$\xA0-\uFFFF]/,lh=/[\.\?\w$\xA0-\uFFFF]/,ch=/\s+[.[]\s*|\s*[.[]\s+/g,Ad=e=>e.type===4?e.content:e.loc.source,Nd=e=>{let t=Ad(e).trim().replace(ch,o=>o.trim()),n=0,i=[],s=0,r=0,a=null;for(let o=0;o<t.length;o++){let l=t.charAt(o);switch(n){case 0:if(l==="[")i.push(n),n=1,s++;else if(l==="(")i.push(n),n=2,r++;else if(!(o===0?Td:lh).test(l))return!1;break;case 1:l==="'"||l==='"'||l==="`"?(i.push(n),n=3,a=l):l==="["?s++:l!=="]"||--s||(n=i.pop());break;case 2:if(l==="'"||l==='"'||l==="`")i.push(n),n=3,a=l;else if(l==="(")r++;else if(l===")"){if(o===t.length-1)return!1;--r||(n=i.pop())}break;case 3:l===a&&(n=i.pop(),a=null)}}return!s&&!r},dh=/^\s*(?:async\s*)?(?:\([^)]*?\)|[\w$_]+)\s*(?::[^=]+)?=>|^\s*(?:async\s+)?function(?:\s+[\w$]+)?\s*\(/;function _t(e,t,n=!1){for(let i=0;i<e.props.length;i++){let s=e.props[i];if(s.type===7&&(n||s.exp)&&(ie(t)?s.name===t:t.test(s.name)))return s}}function Tr(e,t,n=!1,i=!1){for(let s=0;s<e.props.length;s++){let r=e.props[s];if(r.type===6){if(n)continue;if(r.name===t&&(r.value||i))return r}else if(r.name==="bind"&&(r.exp||i)&&Gn(r.arg,t))return r}}function Gn(e,t){return!!(e&&ut(e)&&e.content===t)}function Zr(e){return e.type===5||e.type===2}function hl(e){return e.type===7&&e.name==="pre"}function uh(e){return e.type===7&&e.name==="slot"}function sr(e){return e.type===1&&e.tagType===3}function rr(e){return e.type===1&&e.tagType===2}var ph=new Set([Wi,as]);function Aa(e,t=[]){if(e&&!ie(e)&&e.type===14){let n=e.callee;if(!ie(n)&&ph.has(n))return Aa(e.arguments[0],t.concat(e))}return[e,t]}function ar(e,t,n){let i,s;if(e.type!==13&&function(o,l){var c,d,u;if(l.key.type!==4||l.key.content!=="key")return!1;let p=o.arguments[2];if(p&&!ie(p)){let[w]=Aa(p);if(w&&!ie(w)&&w.type===15&&ea(l,w))return!0}return(c=o.arguments)[2]||(c[2]="{}"),(d=o.arguments)[3]||(d[3]="undefined"),(u=o.arguments)[4]||(u[4]="undefined"),o.arguments[5]=l.value,!0}(e,t))return;let r=e.type===13?e.props:e.arguments[2],a=[];if(r&&!ie(r)&&r.type===14){let o=Aa(r);r=o[0],s=(a=o[1])[a.length-1]}if(r==null||ie(r))i=St([t]);else if(r.type===14){let o=r.arguments[0];ie(o)||o.type!==15?r.callee===go?i=Fe(n.helper(tr),[St([t]),r]):r.arguments.unshift(St([t])):ea(t,o)||o.properties.unshift(t),i||(i=r)}else r.type===15?(ea(t,r)||r.properties.unshift(t),i=r):(i=Fe(n.helper(tr),[St([t]),r]),s&&s.callee===as&&(s=a[a.length-2]));e.type===13?s?s.arguments[0]=i:e.props=i:s?s.arguments[0]=i:e.arguments[2]=i}function ea(e,t){let n=!1;if(e.key.type===4){let i=e.key.content;n=t.properties.some(s=>s.key.type===4&&s.key.content===i)}return n}function Na(e,t){return`_${t}_${e.replace(/[^\w]/g,(n,i)=>n==="-"?"_":e.charCodeAt(i).toString())}`}var fh=/([\s\S]*?)\s+(?:in|of)\s+(\S[\s\S]*)/;function Md(e){for(let t=0;t<e.length;t++)if(!ht(e.charCodeAt(t)))return!1;return!0}function xo(e){return e.type===2&&Md(e.content)||e.type===12&&xo(e.content)}function Ed(e){return e.type===3||xo(e)}var Id={parseMode:"base",ns:0,delimiters:["{{","}}"],getNamespace:()=>0,isVoidTag:Qn,isPreTag:Qn,isIgnoreNewlineTag:Qn,isCustomElement:Qn,onError:Ca,onWarn:qd,comments:!1,prefixIdentifiers:!1},_e=Id,or=null,Jt="",Ge=null,ge=null,ft="",Ft=-1,qn=-1,wo=0,Cn=!1,Ma=null,Ce=[],Re=new class{constructor(e,t){this.stack=e,this.cbs=t,this.state=1,this.buffer="",this.sectionStart=0,this.index=0,this.entityStart=0,this.baseState=1,this.inRCDATA=!1,this.inXML=!1,this.inVPre=!1,this.newlines=[],this.mode=0,this.delimiterOpen=ul,this.delimiterClose=pl,this.delimiterIndex=-1,this.currentSequence=void 0,this.sequenceIndex=0}get inSFCRoot(){return this.mode===2&&this.stack.length===0}reset(){this.state=1,this.mode=0,this.buffer="",this.sectionStart=0,this.index=0,this.baseState=1,this.inRCDATA=!1,this.currentSequence=void 0,this.newlines.length=0,this.delimiterOpen=ul,this.delimiterClose=pl}getPos(e){let t=1,n=e+1,i=this.newlines.length,s=-1;if(i>100){let r=-1,a=i;for(;r+1<a;){let o=r+a>>>1;this.newlines[o]<e?r=o:a=o}s=r}else for(let r=i-1;r>=0;r--)if(e>this.newlines[r]){s=r;break}return s>=0&&(t=s+2,n=e-this.newlines[s]),{column:n,line:t,offset:e}}peek(){return this.buffer.charCodeAt(this.index+1)}stateText(e){e===60?(this.index>this.sectionStart&&this.cbs.ontext(this.sectionStart,this.index),this.state=5,this.sectionStart=this.index):this.inVPre||e!==this.delimiterOpen[0]||(this.state=2,this.delimiterIndex=0,this.stateInterpolationOpen(e))}stateInterpolationOpen(e){if(e===this.delimiterOpen[this.delimiterIndex])if(this.delimiterIndex===this.delimiterOpen.length-1){let t=this.index+1-this.delimiterOpen.length;t>this.sectionStart&&this.cbs.ontext(this.sectionStart,t),this.state=3,this.sectionStart=t}else this.delimiterIndex++;else this.inRCDATA?(this.state=32,this.stateInRCDATA(e)):(this.state=1,this.stateText(e))}stateInterpolation(e){e===this.delimiterClose[0]&&(this.state=4,this.delimiterIndex=0,this.stateInterpolationClose(e))}stateInterpolationClose(e){e===this.delimiterClose[this.delimiterIndex]?this.delimiterIndex===this.delimiterClose.length-1?(this.cbs.oninterpolation(this.sectionStart,this.index+1),this.inRCDATA?this.state=32:this.state=1,this.sectionStart=this.index+1):this.delimiterIndex++:(this.state=3,this.stateInterpolation(e))}stateSpecialStartSequence(e){let t=this.sequenceIndex===this.currentSequence.length;if(t?rn(e):(32|e)===this.currentSequence[this.sequenceIndex]){if(!t)return void this.sequenceIndex++}else this.inRCDATA=!1;this.sequenceIndex=0,this.state=6,this.stateInTagName(e)}stateInRCDATA(e){if(this.sequenceIndex===this.currentSequence.length){if(e===62||ht(e)){let t=this.index-this.currentSequence.length;if(this.sectionStart<t){let n=this.index;this.index=t,this.cbs.ontext(this.sectionStart,t),this.index=n}this.sectionStart=t+2,this.stateInClosingTagName(e),this.inRCDATA=!1;return}this.sequenceIndex=0}(32|e)===this.currentSequence[this.sequenceIndex]?this.sequenceIndex+=1:this.sequenceIndex===0?this.currentSequence!==We.TitleEnd&&(this.currentSequence!==We.TextareaEnd||this.inSFCRoot)?this.fastForwardTo(60)&&(this.sequenceIndex=1):this.inVPre||e!==this.delimiterOpen[0]||(this.state=2,this.delimiterIndex=0,this.stateInterpolationOpen(e)):this.sequenceIndex=+(e===60)}stateCDATASequence(e){e===We.Cdata[this.sequenceIndex]?++this.sequenceIndex===We.Cdata.length&&(this.state=28,this.currentSequence=We.CdataEnd,this.sequenceIndex=0,this.sectionStart=this.index+1):(this.sequenceIndex=0,this.state=23,this.stateInDeclaration(e))}fastForwardTo(e){for(;++this.index<this.buffer.length;){let t=this.buffer.charCodeAt(this.index);if(t===10&&this.newlines.push(this.index),t===e)return!0}return this.index=this.buffer.length-1,!1}stateInCommentLike(e){e===this.currentSequence[this.sequenceIndex]?++this.sequenceIndex===this.currentSequence.length&&(this.currentSequence===We.CdataEnd?this.cbs.oncdata(this.sectionStart,this.index-2):this.cbs.oncomment(this.sectionStart,this.index-2),this.sequenceIndex=0,this.sectionStart=this.index+1,this.state=1):this.sequenceIndex===0?this.fastForwardTo(this.currentSequence[0])&&(this.sequenceIndex=1):e!==this.currentSequence[this.sequenceIndex-1]&&(this.sequenceIndex=0)}startSpecial(e,t){this.enterRCDATA(e,t),this.state=31}enterRCDATA(e,t){this.inRCDATA=!0,this.currentSequence=e,this.sequenceIndex=t}stateBeforeTagName(e){e===33?(this.state=22,this.sectionStart=this.index+1):e===63?(this.state=24,this.sectionStart=this.index+1):fl(e)?(this.sectionStart=this.index,this.mode===0?this.state=6:this.inSFCRoot?this.state=34:this.inXML?this.state=6:e===116?this.state=30:this.state=e===115?29:6):e===47?this.state=8:(this.state=1,this.stateText(e))}stateInTagName(e){rn(e)&&this.handleTagName(e)}stateInSFCRootTagName(e){if(rn(e)){let t=this.buffer.slice(this.sectionStart,this.index);t!=="template"&&this.enterRCDATA(ir("</"+t),0),this.handleTagName(e)}}handleTagName(e){this.cbs.onopentagname(this.sectionStart,this.index),this.sectionStart=-1,this.state=11,this.stateBeforeAttrName(e)}stateBeforeClosingTagName(e){ht(e)||(e===62?(this.state=1,this.sectionStart=this.index+1):(this.state=fl(e)?9:27,this.sectionStart=this.index))}stateInClosingTagName(e){(e===62||ht(e))&&(this.cbs.onclosetag(this.sectionStart,this.index),this.sectionStart=-1,this.state=10,this.stateAfterClosingTagName(e))}stateAfterClosingTagName(e){e===62&&(this.state=1,this.sectionStart=this.index+1)}stateBeforeAttrName(e){e===62?(this.cbs.onopentagend(this.index),this.inRCDATA?this.state=32:this.state=1,this.sectionStart=this.index+1):e===47?this.state=7:e===60&&this.peek()===47?(this.cbs.onopentagend(this.index),this.state=5,this.sectionStart=this.index):ht(e)||this.handleAttrStart(e)}handleAttrStart(e){e===118&&this.peek()===45?(this.state=13,this.sectionStart=this.index):e===46||e===58||e===64||e===35?(this.cbs.ondirname(this.index,this.index+1),this.state=14,this.sectionStart=this.index+1):(this.state=12,this.sectionStart=this.index)}stateInSelfClosingTag(e){e===62?(this.cbs.onselfclosingtag(this.index),this.state=1,this.sectionStart=this.index+1,this.inRCDATA=!1):ht(e)||(this.state=11,this.stateBeforeAttrName(e))}stateInAttrName(e){(e===61||rn(e))&&(this.cbs.onattribname(this.sectionStart,this.index),this.handleAttrNameEnd(e))}stateInDirName(e){e===61||rn(e)?(this.cbs.ondirname(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===58?(this.cbs.ondirname(this.sectionStart,this.index),this.state=14,this.sectionStart=this.index+1):e===46&&(this.cbs.ondirname(this.sectionStart,this.index),this.state=16,this.sectionStart=this.index+1)}stateInDirArg(e){e===61||rn(e)?(this.cbs.ondirarg(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===91?this.state=15:e===46&&(this.cbs.ondirarg(this.sectionStart,this.index),this.state=16,this.sectionStart=this.index+1)}stateInDynamicDirArg(e){e===93?this.state=14:(e===61||rn(e))&&(this.cbs.ondirarg(this.sectionStart,this.index+1),this.handleAttrNameEnd(e))}stateInDirModifier(e){e===61||rn(e)?(this.cbs.ondirmodifier(this.sectionStart,this.index),this.handleAttrNameEnd(e)):e===46&&(this.cbs.ondirmodifier(this.sectionStart,this.index),this.sectionStart=this.index+1)}handleAttrNameEnd(e){this.sectionStart=this.index,this.state=17,this.cbs.onattribnameend(this.index),this.stateAfterAttrName(e)}stateAfterAttrName(e){e===61?this.state=18:e===47||e===62?(this.cbs.onattribend(0,this.sectionStart),this.sectionStart=-1,this.state=11,this.stateBeforeAttrName(e)):ht(e)||(this.cbs.onattribend(0,this.sectionStart),this.handleAttrStart(e))}stateBeforeAttrValue(e){e===34?(this.state=19,this.sectionStart=this.index+1):e===39?(this.state=20,this.sectionStart=this.index+1):ht(e)||(this.sectionStart=this.index,this.state=21,this.stateInAttrValueNoQuotes(e))}handleInAttrValue(e,t){(e===t||this.fastForwardTo(t))&&(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=-1,this.cbs.onattribend(t===34?3:2,this.index+1),this.state=11)}stateInAttrValueDoubleQuotes(e){this.handleInAttrValue(e,34)}stateInAttrValueSingleQuotes(e){this.handleInAttrValue(e,39)}stateInAttrValueNoQuotes(e){ht(e)||e===62?(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=-1,this.cbs.onattribend(1,this.index),this.state=11,this.stateBeforeAttrName(e)):(e===39||e===60||e===61||e===96)&&this.cbs.onerr(18,this.index)}stateBeforeDeclaration(e){e===91?(this.state=26,this.sequenceIndex=0):this.state=e===45?25:23}stateInDeclaration(e){(e===62||this.fastForwardTo(62))&&(this.state=1,this.sectionStart=this.index+1)}stateInProcessingInstruction(e){(e===62||this.fastForwardTo(62))&&(this.cbs.onprocessinginstruction(this.sectionStart,this.index),this.state=1,this.sectionStart=this.index+1)}stateBeforeComment(e){e===45?(this.state=28,this.currentSequence=We.CommentEnd,this.sequenceIndex=2,this.sectionStart=this.index+1):this.state=23}stateInSpecialComment(e){(e===62||this.fastForwardTo(62))&&(this.cbs.oncomment(this.sectionStart,this.index),this.state=1,this.sectionStart=this.index+1)}stateBeforeSpecialS(e){e===We.ScriptEnd[3]?this.startSpecial(We.ScriptEnd,4):e===We.StyleEnd[3]?this.startSpecial(We.StyleEnd,4):(this.state=6,this.stateInTagName(e))}stateBeforeSpecialT(e){e===We.TitleEnd[3]?this.startSpecial(We.TitleEnd,4):e===We.TextareaEnd[3]?this.startSpecial(We.TextareaEnd,4):(this.state=6,this.stateInTagName(e))}startEntity(){}stateInEntity(){}parse(e){for(this.buffer=e;this.index<this.buffer.length;){let t=this.buffer.charCodeAt(this.index);switch(t===10&&this.state!==33&&this.newlines.push(this.index),this.state){case 1:this.stateText(t);break;case 2:this.stateInterpolationOpen(t);break;case 3:this.stateInterpolation(t);break;case 4:this.stateInterpolationClose(t);break;case 31:this.stateSpecialStartSequence(t);break;case 32:this.stateInRCDATA(t);break;case 26:this.stateCDATASequence(t);break;case 19:this.stateInAttrValueDoubleQuotes(t);break;case 12:this.stateInAttrName(t);break;case 13:this.stateInDirName(t);break;case 14:this.stateInDirArg(t);break;case 15:this.stateInDynamicDirArg(t);break;case 16:this.stateInDirModifier(t);break;case 28:this.stateInCommentLike(t);break;case 27:this.stateInSpecialComment(t);break;case 11:this.stateBeforeAttrName(t);break;case 6:this.stateInTagName(t);break;case 34:this.stateInSFCRootTagName(t);break;case 9:this.stateInClosingTagName(t);break;case 5:this.stateBeforeTagName(t);break;case 17:this.stateAfterAttrName(t);break;case 20:this.stateInAttrValueSingleQuotes(t);break;case 18:this.stateBeforeAttrValue(t);break;case 8:this.stateBeforeClosingTagName(t);break;case 10:this.stateAfterClosingTagName(t);break;case 29:this.stateBeforeSpecialS(t);break;case 30:this.stateBeforeSpecialT(t);break;case 21:this.stateInAttrValueNoQuotes(t);break;case 7:this.stateInSelfClosingTag(t);break;case 23:this.stateInDeclaration(t);break;case 22:this.stateBeforeDeclaration(t);break;case 25:this.stateBeforeComment(t);break;case 24:this.stateInProcessingInstruction(t);break;case 33:this.stateInEntity()}this.index++}this.cleanup(),this.finish()}cleanup(){this.sectionStart!==this.index&&(this.state===1||this.state===32&&this.sequenceIndex===0?(this.cbs.ontext(this.sectionStart,this.index),this.sectionStart=this.index):(this.state===19||this.state===20||this.state===21)&&(this.cbs.onattribdata(this.sectionStart,this.index),this.sectionStart=this.index))}finish(){this.handleTrailingData(),this.cbs.onend()}handleTrailingData(){let e=this.buffer.length;this.sectionStart>=e||(this.state===28?this.currentSequence===We.CdataEnd?this.cbs.oncdata(this.sectionStart,e):this.cbs.oncomment(this.sectionStart,e):this.state===6||this.state===11||this.state===18||this.state===17||this.state===12||this.state===13||this.state===14||this.state===15||this.state===16||this.state===20||this.state===19||this.state===21||this.state===9||this.cbs.ontext(this.sectionStart,e))}emitCodePoint(e,t){}}(Ce,{onerr:vl,ontext(e,t){ks(Je(e,t),e,t)},ontextentity(e,t,n){ks(e,t,n)},oninterpolation(e,t){if(Cn)return ks(Je(e,t),e,t);let n=e+Re.delimiterOpen.length,i=t-Re.delimiterClose.length;for(;ht(Jt.charCodeAt(n));)n++;for(;ht(Jt.charCodeAt(i-1));)i--;let s=Je(n,i);s.includes("&")&&(s=_e.decodeEntities(s,!1)),Ea({type:5,content:_s(s,!1,Ie(n,i)),loc:Ie(e,t)})},onopentagname(e,t){let n=Je(e,t);Ge={type:1,tag:n,ns:_e.getNamespace(n,Ce[0],_e.ns),tagType:0,props:[],children:[],loc:Ie(e-1,t),codegenNode:void 0}},onopentagend(e){gl(e)},onclosetag(e,t){let n=Je(e,t);if(!_e.isVoidTag(n)){let i=!1;for(let s=0;s<Ce.length;s++)if(Ce[s].tag.toLowerCase()===n.toLowerCase()){i=!0,s>0&&Ce[0].loc.start.offset;for(let r=0;r<=s;r++)Ms(Ce.shift(),t,r<s);break}i||Rd(e,60)}},onselfclosingtag(e){let t=Ge.tag;Ge.isSelfClosing=!0,gl(e),Ce[0]&&Ce[0].tag===t&&Ms(Ce.shift(),e)},onattribname(e,t){ge={type:6,name:Je(e,t),nameLoc:Ie(e,t),value:void 0,loc:Ie(e)}},ondirname(e,t){let n=Je(e,t),i=n==="."||n===":"?"bind":n==="@"?"on":n==="#"?"slot":n.slice(2);if(Cn||i==="")ge={type:6,name:n,nameLoc:Ie(e,t),value:void 0,loc:Ie(e)};else if(ge={type:7,name:i,rawName:n,exp:void 0,arg:void 0,modifiers:n==="."?[ae("prop")]:[],loc:Ie(e)},i==="pre"){Cn=Re.inVPre=!0,Ma=Ge;let s=Ge.props;for(let r=0;r<s.length;r++)s[r].type===7&&(s[r]=function(a){let o={type:6,name:a.rawName,nameLoc:Ie(a.loc.start.offset,a.loc.start.offset+a.rawName.length),value:void 0,loc:a.loc};if(a.exp){let l=a.exp.loc;l.end.offset<a.loc.end.offset&&(l.start.offset--,l.start.column--,l.end.offset++,l.end.column++),o.value={type:2,content:a.exp.content,loc:l}}return o}(s[r]))}},ondirarg(e,t){if(e===t)return;let n=Je(e,t);if(Cn&&!hl(ge))ge.name+=n,Tn(ge.nameLoc,t);else{let i=n[0]!=="[";ge.arg=_s(i?n:n.slice(1,-1),i,Ie(e,t),3*!!i)}},ondirmodifier(e,t){let n=Je(e,t);if(Cn&&!hl(ge))ge.name+="."+n,Tn(ge.nameLoc,t);else if(ge.name==="slot"){let i=ge.arg;i&&(i.content+="."+n,Tn(i.loc,t))}else{let i=ae(n,!0,Ie(e,t));ge.modifiers.push(i)}},onattribdata(e,t){ft+=Je(e,t),Ft<0&&(Ft=e),qn=t},onattribentity(e,t,n){ft+=e,Ft<0&&(Ft=t),qn=n},onattribnameend(e){let t=Je(ge.loc.start.offset,e);ge.type===7&&(ge.rawName=t),Ge.props.some(n=>(n.type===7?n.rawName:n.name)===t)},onattribend(e,t){Ge&&ge&&(Tn(ge.loc,t),e!==0&&(ft.includes("&")&&(ft=_e.decodeEntities(ft,!0)),ge.type===6?(ge.name==="class"&&(ft=Pd(ft).trim()),ge.value={type:2,content:ft,loc:e===1?Ie(Ft,qn):Ie(Ft-1,qn+1)},Re.inSFCRoot&&Ge.tag==="template"&&ge.name==="lang"&&ft&&ft!=="html"&&Re.enterRCDATA(ir("</template"),0)):(ge.exp=_s(ft,!1,Ie(Ft,qn),0,0),ge.name==="for"&&(ge.forParseResult=function(n){let i=n.loc,s=n.content,r=s.match(fh);if(!r)return;let[,a,o]=r,l=(w,g,_=!1)=>{let A=i.start.offset+g,M=A+w.length;return _s(w,!1,Ie(A,M),0,+!!_)},c={source:l(o.trim(),s.indexOf(o,a.length)),value:void 0,key:void 0,index:void 0,finalized:!1},d=a.trim().replace(hh,"").trim(),u=a.indexOf(d),p=d.match(ml);if(p){let w;d=d.replace(ml,"").trim();let g=p[1].trim();if(g&&(w=s.indexOf(g,u+d.length),c.key=l(g,w,!0)),p[2]){let _=p[2].trim();_&&(c.index=l(_,s.indexOf(_,c.key?w+g.length:u+d.length),!0))}}return d&&(c.value=l(d,u,!0)),c}(ge.exp)))),(ge.type!==7||ge.name!=="pre")&&Ge.props.push(ge)),ft="",Ft=qn=-1},oncomment(e,t){_e.comments&&Ea({type:3,content:Je(e,t),loc:Ie(e-4,t+3)})},onend(){let e=Jt.length;for(let t=0;t<Ce.length;t++)Ms(Ce[t],e-1),Ce[t].loc.start.offset},oncdata(e,t){(Ce[0]?Ce[0].ns:_e.ns)!==0&&ks(Je(e,t),e,t)},onprocessinginstruction(e){(Ce[0]?Ce[0].ns:_e.ns)===0&&vl(21,e-1)}}),ml=/,([^,\}\]]*)(?:,([^,\}\]]*))?$/,hh=/^\(|\)$/g;function Je(e,t){return Jt.slice(e,t)}function gl(e){Re.inSFCRoot&&(Ge.innerLoc=Ie(e+1,e+1)),Ea(Ge);let{tag:t,ns:n}=Ge;n===0&&_e.isPreTag(t)&&wo++,_e.isVoidTag(t)?Ms(Ge,e):(Ce.unshift(Ge),(n===1||n===2)&&(Re.inXML=!0)),Ge=null}function ks(e,t,n){{let r=Ce[0]&&Ce[0].tag;r!=="script"&&r!=="style"&&e.includes("&")&&(e=_e.decodeEntities(e,!1))}let i=Ce[0]||or,s=i.children[i.children.length-1];s&&s.type===2?(s.content+=e,Tn(s.loc,n)):i.children.push({type:2,content:e,loc:Ie(t,n)})}function Ms(e,t,n=!1){n?Tn(e.loc,Rd(t,60)):Tn(e.loc,function(a){let o=a;for(;Jt.charCodeAt(o)!==62&&o<Jt.length-1;)o++;return o}(t)+1),Re.inSFCRoot&&(e.children.length?e.innerLoc.end=le({},e.children[e.children.length-1].loc.end):e.innerLoc.end=le({},e.innerLoc.start),e.innerLoc.source=Je(e.innerLoc.start.offset,e.innerLoc.end.offset));let{tag:i,ns:s,children:r}=e;if(!Cn&&(i==="slot"?e.tagType=2:function({tag:a,props:o}){if(a==="template"){for(let l=0;l<o.length;l++)if(o[l].type===7&&mh.has(o[l].name))return!0}return!1}(e)?e.tagType=3:function({tag:a,props:o}){var l;if(_e.isCustomElement(a))return!1;if(a==="component"||(l=a.charCodeAt(0))>64&&l<91||Cd(a)||_e.isBuiltInComponent&&_e.isBuiltInComponent(a)||_e.isNativeTag&&!_e.isNativeTag(a))return!0;for(let c=0;c<o.length;c++){let d=o[c];if(d.type===6&&d.name==="is"&&d.value&&d.value.content.startsWith("vue:"))return!0}return!1}(e)&&(e.tagType=1)),Re.inRCDATA||(e.children=Od(r)),s===0&&_e.isIgnoreNewlineTag(i)){let a=r[0];a&&a.type===2&&(a.content=a.content.replace(/^\r?\n/,""))}s===0&&_e.isPreTag(i)&&wo--,Ma===e&&(Cn=Re.inVPre=!1,Ma=null),Re.inXML&&(Ce[0]?Ce[0].ns:_e.ns)===0&&(Re.inXML=!1)}function Rd(e,t){let n=e;for(;Jt.charCodeAt(n)!==t&&n>=0;)n--;return n}var mh=new Set(["if","else","else-if","for","slot"]),gh=/\r\n/g;function Od(e){let t=_e.whitespace!=="preserve",n=!1;for(let i=0;i<e.length;i++){let s=e[i];if(s.type===2)if(wo)s.content=s.content.replace(gh,`
`);else if(Md(s.content)){let r=e[i-1]&&e[i-1].type,a=e[i+1]&&e[i+1].type;!r||!a||t&&(r===3&&(a===3||a===1)||r===1&&(a===3||a===1&&function(o){for(let l=0;l<o.length;l++){let c=o.charCodeAt(l);if(c===10||c===13)return!0}return!1}(s.content)))?(n=!0,e[i]=null):s.content=" "}else t&&(s.content=Pd(s.content))}return n?e.filter(Boolean):e}function Pd(e){let t="",n=!1;for(let i=0;i<e.length;i++)ht(e.charCodeAt(i))?n||(t+=" ",n=!0):(t+=e[i],n=!1);return t}function Ea(e){(Ce[0]||or).children.push(e)}function Ie(e,t){return{start:Re.getPos(e),end:t==null?t:Re.getPos(t),source:t==null?t:Je(e,t)}}function Tn(e,t){e.end=Re.getPos(t),e.source=Je(e.start.offset,t)}function _s(e,t=!1,n,i=0,s=0){return ae(e,t,n,i)}function vl(e,t,n){_e.onError(be(e,Ie(t,t)))}function bl(e){let t=e.children.filter(n=>n.type!==3);return t.length!==1||t[0].type!==1||rr(t[0])?null:t[0]}function mt(e,t){let{constantCache:n}=t;switch(e.type){case 1:if(e.tagType!==0)return 0;let o=n.get(e);if(o!==void 0)return o;let l=e.codegenNode;if(l.type!==13||l.isBlock&&e.tag!=="svg"&&e.tag!=="foreignObject"&&e.tag!=="math")return 0;if(l.patchFlag!==void 0)return n.set(e,0),0;{let d=3,u=Bd(e,t);if(u===0)return n.set(e,0),0;u<d&&(d=u);for(let p=0;p<e.children.length;p++){let w=mt(e.children[p],t);if(w===0)return n.set(e,0),0;w<d&&(d=w)}if(d>1)for(let p=0;p<e.props.length;p++){let w=e.props[p];if(w.type===7&&w.name==="bind"&&w.exp){let g=mt(w.exp,t);if(g===0)return n.set(e,0),0;g<d&&(d=g)}}if(l.isBlock){var i,s,r,a;for(let p=0;p<e.props.length;p++)if(e.props[p].type===7)return n.set(e,0),0;t.removeHelper(Bn),t.removeHelper((i=t.inSSR,s=l.isComponent,i||s?Ln:Dn)),l.isBlock=!1,t.helper((r=t.inSSR,a=l.isComponent,r||a?pn:fn))}return n.set(e,d),d}case 2:case 3:return 3;case 9:case 11:case 10:default:return 0;case 5:case 12:return mt(e.content,t);case 4:return e.constType;case 8:let c=3;for(let d=0;d<e.children.length;d++){let u=e.children[d];if(ie(u)||Ze(u))continue;let p=mt(u,t);if(p===0)return 0;p<c&&(c=p)}return c;case 20:return 2}}var vh=new Set([ho,mo,Wi,as]);function Bd(e,t){let n=3,i=Ld(e);if(i&&i.type===15){let{properties:s}=i;for(let r=0;r<s.length;r++){let a,{key:o,value:l}=s[r],c=mt(o,t);if(c===0)return c;if(c<n&&(n=c),(a=l.type===4?mt(l,t):l.type===14?function d(u,p){if(u.type===14&&!ie(u.callee)&&vh.has(u.callee)){let w=u.arguments[0];if(w.type===4)return mt(w,p);if(w.type===14)return d(w,p)}return 0}(l,t):0)===0)return a;a<n&&(n=a)}}return n}function Ld(e){let t=e.codegenNode;if(t.type===13)return t.props}function lr(e,t){t.currentNode=e;let{nodeTransforms:n}=t,i=[];for(let a=0;a<n.length;a++){let o=n[a](e,t);if(o&&(J(o)?i.push(...o):i.push(o)),!t.currentNode)return;e=t.currentNode}switch(e.type){case 3:t.ssr||t.helper(rs);break;case 5:t.ssr||t.helper(Cr);break;case 9:for(let l=0;l<e.branches.length;l++)lr(e.branches[l],t);break;case 10:case 11:case 1:case 0:var s=e;let a=0,o=()=>{a--};for(;a<s.children.length;a++){let l=s.children[a];ie(l)||(t.grandParent=t.parent,t.parent=s,t.childIndex=a,t.onNodeRemoved=o,lr(l,t))}}t.currentNode=e;let r=i.length;for(;r--;)i[r]()}function Dd(e,t){let n=ie(e)?i=>i===e:i=>e.test(i);return(i,s)=>{if(i.type===1){let{props:r}=i;if(i.tagType===3&&r.some(uh))return;let a=[];for(let o=0;o<r.length;o++){let l=r[o];if(l.type===7&&n(l.name)){r.splice(o,1),o--;let c=t(i,l,s);c&&a.push(c)}}return a}}}var Ss="/*@__PURE__*/",yl=e=>`${di[e]}: _${di[e]}`;function xl(e,t,{helper:n,push:i,newline:s,isTS:r}){let a=n(t==="component"?co:uo);for(let o=0;o<e.length;o++){let l=e[o],c=l.endsWith("__self");c&&(l=l.slice(0,-6)),i(`const ${Na(l,t)} = ${a}(${JSON.stringify(l)}${c?", true":""})${r?"!":""}`),o<e.length-1&&s()}}function Ia(e,t){let n=e.length>3;t.push("["),n&&t.indent(),Ai(e,t,n),n&&t.deindent(),t.push("]")}function Ai(e,t,n=!1,i=!0){let{push:s,newline:r}=t;for(let a=0;a<e.length;a++){let o=e[a];ie(o)?s(o,-3):J(o)?Ia(o,t):st(o,t),a<e.length-1&&(n?(i&&s(","),r()):i&&s(", "))}}function st(e,t){var n,i,s;if(ie(e))return void t.push(e,-3);if(Ze(e))return void t.push(t.helper(e));switch(e.type){case 1:case 9:case 11:case 12:st(e.codegenNode,t);break;case 2:n=e,t.push(JSON.stringify(n.content),-3,n);break;case 4:wl(e,t);break;case 5:(function(r,a){let{push:o,helper:l,pure:c}=a;c&&o(Ss),o(`${l(Cr)}(`),st(r.content,a),o(")")})(e,t);break;case 8:kl(e,t);break;case 3:(function(r,a){let{push:o,helper:l,pure:c}=a;c&&o(Ss),o(`${l(rs)}(${JSON.stringify(r.content)})`,-3,r)})(e,t);break;case 13:(function(r,a){var o,l;let c,{push:d,helper:u,pure:p}=a,{tag:w,props:g,children:_,patchFlag:A,dynamicProps:M,directives:h,isBlock:m,disableTracking:q,isComponent:T}=r;A&&(c=String(A)),h&&d(u(po)+"("),m&&d(`(${u(Bn)}(${q?"true":""}), `),p&&d(Ss),d(u(m?(o=a.inSSR,o||T?Ln:Dn):(l=a.inSSR,l||T?pn:fn))+"(",-2,r),Ai(function(N){let f=N.length;for(;f--&&N[f]==null;);return N.slice(0,f+1).map(y=>y||"null")}([w,g,_,c,M]),a),d(")"),m&&d(")"),h&&(d(", "),st(h,a),d(")"))})(e,t);break;case 14:(function(r,a){let{push:o,helper:l,pure:c}=a,d=ie(r.callee)?r.callee:l(r.callee);c&&o(Ss),o(d+"(",-2,r),Ai(r.arguments,a),o(")")})(e,t);break;case 15:(function(r,a){let{push:o,indent:l,deindent:c,newline:d}=a,{properties:u}=r;if(!u.length)return o("{}",-2,r);let p=u.length>1;o(p?"{":"{ "),p&&l();for(let w=0;w<u.length;w++){let{key:g,value:_}=u[w];(function(A,M){let{push:h}=M;if(A.type===8)h("["),kl(A,M),h("]");else if(A.isStatic){let m;h((m=A.content,Ta.test(m)?JSON.stringify(A.content):A.content),-2,A)}else h(`[${A.content}]`,-3,A)})(g,a),o(": "),st(_,a),w<u.length-1&&(o(","),d())}p&&c(),o(p?"}":" }")})(e,t);break;case 17:i=e,s=t,Ia(i.elements,s);break;case 18:(function(r,a){let{push:o,indent:l,deindent:c}=a,{params:d,returns:u,body:p,newline:w,isSlot:g}=r;g&&o(`_${di[vo]}(`),o("(",-2,r),J(d)?Ai(d,a):d&&st(d,a),o(") => "),(w||p)&&(o("{"),l()),u?(w&&o("return "),J(u)?Ia(u,a):st(u,a)):p&&st(p,a),(w||p)&&(c(),o("}")),g&&o(")")})(e,t);break;case 19:(function(r,a){let{test:o,consequent:l,alternate:c,newline:d}=r,{push:u,indent:p,deindent:w,newline:g}=a;if(o.type===4){let A,M=(A=o.content,!!Ta.test(A));M&&u("("),wl(o,a),M&&u(")")}else u("("),st(o,a),u(")");d&&p(),a.indentLevel++,d||u(" "),u("? "),st(l,a),a.indentLevel--,d&&g(),d||u(" "),u(": ");let _=c.type===19;!_&&a.indentLevel++,st(c,a),!_&&a.indentLevel--,d&&w(!0)})(e,t);break;case 20:(function(r,a){let{push:o,helper:l,indent:c,deindent:d,newline:u}=a,{needPauseTracking:p,needArraySpread:w}=r;w&&o("[...("),o(`_cache[${r.index}] || (`),p&&(c(),o(`${l(nr)}(-1`),r.inVOnce&&o(", true"),o("),"),u(),o("(")),o(`_cache[${r.index}] = `),st(r.value,a),p&&(o(`).cacheIndex = ${r.index},`),u(),o(`${l(nr)}(1),`),u(),o(`_cache[${r.index}]`),d()),o(")"),w&&o(")]")})(e,t);break;case 21:Ai(e.body,t,!0,!1)}}function wl(e,t){let{content:n,isStatic:i}=e;t.push(i?JSON.stringify(n):n,-3,e)}function kl(e,t){for(let n=0;n<e.children.length;n++){let i=e.children[n];ie(i)?t.push(i,-3):st(i,t)}}var bh=Dd(/^(?:if|else|else-if)$/,(e,t,n)=>function(i,s,r,a){if(s.name!=="else"&&(!s.exp||!s.exp.content.trim())){let l=s.exp?s.exp.loc:i.loc;r.onError(be(28,s.loc)),s.exp=ae("true",!1,l)}if(s.name==="if"){var o;let l=_l(i,s),c={type:9,loc:Ie((o=i.loc).start.offset,o.end.offset),branches:[l]};if(r.replaceNode(c),a)return a(c,l,!0)}else{let l=r.parent.children,c=l.indexOf(i);for(;c-->=-1;){let d=l[c];if(d&&Ed(d)){r.removeNode(d);continue}if(d&&d.type===9){(s.name==="else-if"||s.name==="else")&&d.branches[d.branches.length-1].condition===void 0&&r.onError(be(30,i.loc)),r.removeNode();let u=_l(i,s);d.branches.push(u);let p=a&&a(d,u,!1);lr(u,r),p&&p(),r.currentNode=null}else r.onError(be(30,i.loc));break}}}(e,t,n,(i,s,r)=>{let a=n.parent.children,o=a.indexOf(i),l=0;for(;o-->=0;){let c=a[o];c&&c.type===9&&(l+=c.branches.length)}return()=>{r?i.codegenNode=Sl(s,l,n):function(c){for(;;)if(c.type===19){if(c.alternate.type!==19)return c;c=c.alternate}else c.type===20&&(c=c.value)}(i.codegenNode).alternate=Sl(s,l+i.branches.length-1,n)}}));function _l(e,t){let n=e.tagType===3;return{type:10,loc:e.loc,condition:t.name==="else"?void 0:t.exp,children:n&&!_t(e,"for")?e.children:[e],userKey:Tr(e,"key"),isTemplateIf:n}}function Sl(e,t,n){return e.condition?qa(e.condition,ql(e,t,n),Fe(n.helper(rs),['""',"true"])):ql(e,t,n)}function ql(e,t,n){let{helper:i}=n,s=Be("key",ae(`${t}`,!1,vt,2)),{children:r}=e,a=r[0];if(r.length!==1||a.type!==1){if(r.length!==1||a.type!==11)return Ji(n,i(Qi),St([s]),r,64,void 0,void 0,!0,!1,!1,e.loc);{let o=a.codegenNode;return ar(o,s,n),o}}{let o=a.codegenNode,l=o.type===14&&o.callee===bo?o.arguments[1].returns:o;return l.type===13&&yo(l,n),ar(l,s,n),o}}var yh=Dd("for",(e,t,n)=>{let{helper:i,removeHelper:s}=n;return function(r,a,o,l){if(!a.exp)return void o.onError(be(31,a.loc));let c=a.forParseResult;if(!c)return void o.onError(be(32,a.loc));Fd(c);let{scopes:d}=o,{source:u,value:p,key:w,index:g}=c,_={type:11,loc:a.loc,source:u,valueAlias:p,keyAlias:w,objectIndexAlias:g,parseResult:c,children:sr(r)?r.children:[r]};o.replaceNode(_),d.vFor++;let A=l&&l(_);return()=>{d.vFor--,A&&A()}}(e,t,n,r=>{let a=Fe(i(fo),[r.source]),o=sr(e),l=_t(e,"memo"),c=Tr(e,"key",!1,!0);c&&c.type;let d=c&&(c.type===6?c.value?ae(c.value.content,!0):void 0:c.exp),u=d?Be("key",d):null,p=r.source.type===4&&r.source.constType>0,w=p?64:c?128:256;return r.codegenNode=Ji(n,i(Qi),void 0,a,w,void 0,void 0,!0,!p,!1,e.loc),()=>{let g,{children:_}=r,A=_.length!==1||_[0].type!==1,M=rr(e)?e:o&&e.children.length===1&&rr(e.children[0])?e.children[0]:null;if(M)g=M.codegenNode,o&&u&&ar(g,u,n);else if(A)g=Ji(n,i(Qi),u?St([u]):void 0,e.children,64,void 0,void 0,!0,void 0,!1);else{var h,m,q,T,N,f,y,v;g=_[0].codegenNode,o&&u&&ar(g,u,n),!p!==g.isBlock&&(g.isBlock?(s(Bn),s((h=n.inSSR,m=g.isComponent,h||m?Ln:Dn))):s((q=n.inSSR,T=g.isComponent,q||T?pn:fn))),g.isBlock=!p,g.isBlock?(i(Bn),i((N=n.inSSR,f=g.isComponent,N||f?Ln:Dn))):i((y=n.inSSR,v=g.isComponent,y||v?pn:fn))}if(l){let k=ui(Ra(r.parseResult,[ae("_cached")]));k.body={type:21,body:[Mt(["const _memo = (",l.exp,")"]),Mt(["if (_cached && _cached.el",...d?[" && _cached.key === ",d]:[],` && ${n.helperString(Sd)}(_cached, _memo)) return _cached`]),Mt(["const _item = ",g]),ae("_item.memo = _memo"),ae("return _item")],loc:vt},a.arguments.push(k,ae("_cache"),ae(String(n.cached.length))),n.cached.push(null)}else a.arguments.push(ui(Ra(r.parseResult),g,!0))}})});function Fd(e,t){e.finalized||(e.finalized=!0)}function Ra({value:e,key:t,index:n},i=[]){var s=[e,t,n,...i];let r=s.length;for(;r--&&!s[r];);return s.slice(0,r+1).map((a,o)=>a||ae("_".repeat(o+1),!1))}var Cl=ae("undefined",!1),xh=(e,t)=>{if(e.type===1&&(e.tagType===1||e.tagType===3)){let n=_t(e,"slot");if(n)return n.exp,t.scopes.vSlot++,()=>{t.scopes.vSlot--}}};function qs(e,t,n){let i=[Be("name",e),Be("fn",t)];return n!=null&&i.push(Be("key",ae(String(n),!0))),St(i)}var jd=new WeakMap,wh=(e,t)=>function(){let n,i,s,r,a;if((e=t.currentNode).type!==1||e.tagType!==0&&e.tagType!==1)return;let{tag:o,props:l}=e,c=e.tagType===1,d=c?function(g,_,A=!1){let{tag:M}=g,h=Oa(M),m=Tr(g,"is",!1,!0);if(m)if(h){let T;if(m.type===6?T=m.value&&ae(m.value.content,!0):(T=m.exp)||(T=ae("is",!1,m.arg.loc)),T)return Fe(_.helper(ka),[T])}else m.type===6&&m.value.content.startsWith("vue:")&&(M=m.value.content.slice(4));let q=Cd(M)||_.isBuiltInComponent(M);return q?(A||_.helper(q),q):(_.helper(co),_.components.add(M),Na(M,"component"))}(e,t):`"${o}"`,u=fe(d)&&d.callee===ka,p=0,w=u||d===Bi||d===oo||!c&&(o==="svg"||o==="foreignObject"||o==="math");if(l.length>0){let g=Ud(e,t,void 0,c,u);n=g.props,p=g.patchFlag,r=g.dynamicPropNames;let _=g.directives;a=_&&_.length?In(_.map(A=>function(M,h){let m=[],q=jd.get(M);q?m.push(h.helperString(q)):(h.helper(uo),h.directives.add(M.name),m.push(Na(M.name,"directive")));let{loc:T}=M;if(M.exp&&m.push(M.exp),M.arg&&(M.exp||m.push("void 0"),m.push(M.arg)),Object.keys(M.modifiers).length){M.arg||(M.exp||m.push("void 0"),m.push("void 0"));let N=ae("true",!1,T);m.push(St(M.modifiers.map(f=>Be(f,N)),T))}return In(m,M.loc)}(A,t))):void 0,g.shouldUseBlock&&(w=!0)}if(e.children.length>0)if(d===er&&(w=!0,p|=1024),c&&d!==Bi&&d!==er){let{slots:g,hasDynamicSlots:_}=function(A,M,h=(m,q,T,N)=>ui(m,T,!1,!0,T.length?T[0].loc:N)){M.helper(vo);let{children:m,loc:q}=A,T=[],N=[],f=M.scopes.vSlot>0||M.scopes.vFor>0,y=_t(A,"slot",!0);if(y){let{arg:V,exp:B}=y;V&&!ut(V)&&(f=!0),T.push(Be(V||ae("default",!0),h(B,void 0,m,q)))}let v=!1,k=!1,S=[],x=new Set,I=0;for(let V=0;V<m.length;V++){let B,z,H,X,ne=m[V];if(!sr(ne)||!(B=_t(ne,"slot",!0))){ne.type!==3&&S.push(ne);continue}if(y){M.onError(be(37,B.loc));break}v=!0;let{children:ue,loc:he}=ne,{arg:ye=ae("default",!0),exp:ze,loc:tt}=B;ut(ye)?z=ye?ye.content:"default":f=!0;let oe=_t(ne,"for"),se=h(ze,oe,ue,he);if(H=_t(ne,"if"))f=!0,N.push(qa(H.exp,qs(ye,se,I++),Cl));else if(X=_t(ne,/^else(?:-if)?$/,!0)){let ke,qe=V;for(;qe--&&Ed(ke=m[qe]););if(ke&&sr(ke)&&_t(ke,/^(?:else-)?if$/)){let b=N[N.length-1];for(;b.alternate.type===19;)b=b.alternate;b.alternate=X.exp?qa(X.exp,qs(ye,se,I++),Cl):qs(ye,se,I++)}else M.onError(be(30,X.loc))}else if(oe){f=!0;let ke=oe.forParseResult;ke?(Fd(ke),N.push(Fe(M.helper(fo),[ke.source,ui(Ra(ke),qs(ye,se),!0)]))):M.onError(be(32,oe.loc))}else{if(z){if(x.has(z)){M.onError(be(38,tt));continue}x.add(z),z==="default"&&(k=!0)}T.push(Be(ye,se))}}if(!y){let V=(B,z)=>Be("default",h(B,void 0,z,q));v?S.length&&!S.every(xo)&&(k?M.onError(be(39,S[0].loc)):T.push(V(void 0,S))):T.push(V(void 0,m))}let R=f?2:function V(B){for(let z=0;z<B.length;z++){let H=B[z];switch(H.type){case 1:if(H.tagType===2||V(H.children))return!0;break;case 9:if(V(H.branches))return!0;break;case 10:case 11:if(V(H.children))return!0}}return!1}(A.children)?3:1,E=St(T.concat(Be("_",ae(R+"",!1))),q);return N.length&&(E=Fe(M.helper(_d),[E,In(N)])),{slots:E,hasDynamicSlots:f}}(e,t);i=g,_&&(p|=1024)}else if(e.children.length===1&&d!==Bi){let g=e.children[0],_=g.type,A=_===5||_===8;A&&mt(g,t)===0&&(p|=1),i=A||_===2?g:e.children}else i=e.children;r&&r.length&&(s=function(g){let _="[";for(let A=0,M=g.length;A<M;A++)_+=JSON.stringify(g[A]),A<M-1&&(_+=", ");return _+"]"}(r)),e.codegenNode=Ji(t,d,n,i,p===0?void 0:p,s,a,!!w,!1,c,e.loc)};function Ud(e,t,n=e.props,i,s,r=!1){let a,{tag:o,loc:l,children:c}=e,d=[],u=[],p=[],w=c.length>0,g=!1,_=0,A=!1,M=!1,h=!1,m=!1,q=!1,T=!1,N=[],f=k=>{d.length&&(u.push(St(Tl(d),l)),d=[]),k&&u.push(k)},y=()=>{t.scopes.vFor>0&&d.push(Be(ae("ref_for",!0),ae("true")))},v=({key:k,value:S})=>{if(ut(k)){let x=k.content,I=Fn(x);I&&(!i||s)&&x.toLowerCase()!=="onclick"&&x!=="onUpdate:modelValue"&&!Ht(x)&&(m=!0),I&&Ht(x)&&(T=!0),I&&S.type===14&&(S=S.arguments[0]),S.type===20||(S.type===4||S.type===8)&&mt(S,t)>0||(x==="ref"?A=!0:x==="class"?M=!0:x==="style"?h=!0:x==="key"||N.includes(x)||N.push(x),i&&(x==="class"||x==="style")&&!N.includes(x)&&N.push(x))}else q=!0};for(let k=0;k<n.length;k++){let S=n[k];if(S.type===6){let{loc:x,name:I,nameLoc:R,value:E}=S;if(I==="ref"&&(A=!0,y()),I==="is"&&(Oa(o)||E&&E.content.startsWith("vue:")))continue;d.push(Be(ae(I,!0,R),ae(E?E.content:"",!0,E?E.loc:x)))}else{let{name:x,arg:I,exp:R,loc:E,modifiers:V}=S,B=x==="bind",z=x==="on";if(x==="slot"){i||t.onError(be(40,E));continue}if(x==="once"||x==="memo"||x==="is"||B&&Gn(I,"is")&&Oa(o)||z&&r)continue;if((B&&Gn(I,"key")||z&&w&&Gn(I,"vue:before-update"))&&(g=!0),B&&Gn(I,"ref")&&y(),!I&&(B||z)){q=!0,R?B?(y(),f(),u.push(R)):f({type:14,loc:E,callee:t.helper(go),arguments:i?[R]:[R,"true"]}):t.onError(be(B?34:35,E));continue}B&&V.some(X=>X.content==="prop")&&(_|=32);let H=t.directiveTransforms[x];if(H){let{props:X,needRuntime:ne}=H(S,e,t);r||X.forEach(v),z&&I&&!ut(I)?f(St(X,l)):d.push(...X),ne&&(p.push(S),Ze(ne)&&jd.set(S,ne))}else!Mu(x)&&(p.push(S),w&&(g=!0))}}if(u.length?(f(),a=u.length>1?Fe(t.helper(tr),u,l):u[0]):d.length&&(a=St(Tl(d),l)),q?_|=16:(M&&!i&&(_|=2),h&&!i&&(_|=4),N.length&&(_|=8),m&&(_|=32)),!g&&(_===0||_===32)&&(A||T||p.length>0)&&(_|=512),!t.inSSR&&a)switch(a.type){case 15:let k=-1,S=-1,x=!1;for(let E=0;E<a.properties.length;E++){let V=a.properties[E].key;ut(V)?V.content==="class"?k=E:V.content==="style"&&(S=E):V.isHandlerKey||(x=!0)}let I=a.properties[k],R=a.properties[S];x?a=Fe(t.helper(Wi),[a]):(I&&!ut(I.value)&&(I.value=Fe(t.helper(ho),[I.value])),R&&(h||R.value.type===4&&R.value.content.trim()[0]==="["||R.value.type===17)&&(R.value=Fe(t.helper(mo),[R.value])));break;case 14:break;default:a=Fe(t.helper(Wi),[Fe(t.helper(as),[a])])}return{props:a,directives:p,patchFlag:_,dynamicPropNames:N,shouldUseBlock:g}}function Tl(e){let t=new Map,n=[];for(let r=0;r<e.length;r++){var i,s;let a=e[r];if(a.key.type===8||!a.key.isStatic){n.push(a);continue}let o=a.key.content,l=t.get(o);l?(o==="style"||o==="class"||Fn(o))&&(i=l,s=a,i.value.type===17?i.value.elements.push(s.value):i.value=In([i.value,s.value],i.loc)):(t.set(o,a),n.push(a))}return n}function Oa(e){return e==="component"||e==="Component"}var kh=(e,t)=>{if(rr(e)){let{children:n,loc:i}=e,{slotName:s,slotProps:r}=function(l,c){let d,u='"default"',p=[];for(let w=0;w<l.props.length;w++){let g=l.props[w];if(g.type===6)g.value&&(g.name==="name"?u=JSON.stringify(g.value.content):(g.name=xe(g.name),p.push(g)));else if(g.name==="bind"&&Gn(g.arg,"name")){if(g.exp)u=g.exp;else if(g.arg&&g.arg.type===4){let _=xe(g.arg.content);u=g.exp=ae(_,!1,g.arg.loc)}}else g.name==="bind"&&g.arg&&ut(g.arg)&&(g.arg.content=xe(g.arg.content)),p.push(g)}if(p.length>0){let{props:w,directives:g}=Ud(l,c,p,!1,!1);d=w,g.length&&c.onError(be(36,g[0].loc))}return{slotName:u,slotProps:d}}(e,t),a=[t.prefixIdentifiers?"_ctx.$slots":"$slots",s,"{}","undefined","true"],o=2;r&&(a[2]=r,o=3),n.length&&(a[3]=ui([],n,!1,!1,i),o=4),t.scopeId&&!t.slotted&&(o=5),a.splice(o),e.codegenNode=Fe(t.helper(kd),a,i)}},$d=(e,t,n,i)=>{let s,{loc:r,modifiers:a,arg:o}=e;if(!e.exp&&a.length,o.type===4)if(o.isStatic){let u=o.content;u.startsWith("vue:")&&(u=`vnode-${u.slice(4)}`),s=ae(t.tagType!==0||u.startsWith("vnode")||!/[A-Z]/.test(u)?Zn(xe(u)):`on:${u}`,!0,o.loc)}else s=Mt([`${n.helperString(Sa)}(`,o,")"]);else(s=o).children.unshift(`${n.helperString(Sa)}(`),s.children.push(")");let l=e.exp;l&&!l.content.trim()&&(l=void 0);let c=n.cacheHandlers&&!l&&!n.inVOnce;if(l){let u,p=Nd(l),w=!(p||(u=l,dh.test(Ad(u)))),g=l.content.includes(";");(w||c&&p)&&(l=Mt([`${w?"$event":"(...args)"} => ${g?"{":"("}`,l,g?"}":")"]))}let d={props:[Be(s,l||ae("() => {}",!1,r))]};return i&&(d=i(d)),c&&(d.props[0].value=n.cache(d.props[0].value)),d.props.forEach(u=>u.key.isHandlerKey=!0),d},_h=(e,t,n)=>{let{modifiers:i}=e,s=e.arg,{exp:r}=e;return r&&r.type===4&&!r.content.trim()&&(r=void 0),s.type!==4?(s.children.unshift("("),s.children.push(') || ""')):s.isStatic||(s.content=s.content?`${s.content} || ""`:'""'),i.some(a=>a.content==="camel")&&(s.type===4?s.isStatic?s.content=xe(s.content):s.content=`${n.helperString(_a)}(${s.content})`:(s.children.unshift(`${n.helperString(_a)}(`),s.children.push(")"))),!n.inSSR&&(i.some(a=>a.content==="prop")&&Al(s,"."),i.some(a=>a.content==="attr")&&Al(s,"^")),{props:[Be(s,r)]}},Al=(e,t)=>{e.type===4?e.isStatic?e.content=t+e.content:e.content=`\`${t}\${${e.content}}\``:(e.children.unshift(`'${t}' + (`),e.children.push(")"))},Sh=(e,t)=>{if(e.type===0||e.type===1||e.type===11||e.type===10)return()=>{let n,i=e.children,s=!1;for(let r=0;r<i.length;r++){let a=i[r];if(Zr(a)){s=!0;for(let o=r+1;o<i.length;o++){let l=i[o];if(Zr(l))n||(n=i[r]=Mt([a],a.loc)),n.children.push(" + ",l),i.splice(o,1),o--;else{n=void 0;break}}}}if(s&&(i.length!==1||e.type!==0&&(e.type!==1||e.tagType!==0||e.props.find(r=>r.type===7&&!t.directiveTransforms[r.name]))))for(let r=0;r<i.length;r++){let a=i[r];if(Zr(a)||a.type===8){let o=[];(a.type!==2||a.content!==" ")&&o.push(a),t.ssr||mt(a,t)!==0||o.push("1"),i[r]={type:12,content:a,loc:a.loc,codegenNode:Fe(t.helper(lo),o)}}}}},Nl=new WeakSet,qh=(e,t)=>{if(e.type===1&&_t(e,"once",!0)&&!Nl.has(e)&&!t.inVOnce&&!t.inSSR)return Nl.add(e),t.inVOnce=!0,t.helper(nr),()=>{t.inVOnce=!1;let n=t.currentNode;n.codegenNode&&(n.codegenNode=t.cache(n.codegenNode,!0,!0))}},Vd=(e,t,n)=>{let i,{exp:s,arg:r}=e;if(!s)return n.onError(be(41,e.loc)),Cs();let a=s.loc.source.trim(),o=s.type===4?s.content:a,l=n.bindingMetadata[a];if(l==="props"||l==="props-aliased"||l==="literal-const"||l==="setup-const")return s.loc,Cs();if(!o.trim()||!Nd(s))return n.onError(be(42,s.loc)),Cs();let c=r||ae("modelValue",!0),d=r?ut(r)?`onUpdate:${xe(r.content)}`:Mt(['"onUpdate:" + ',r]):"onUpdate:modelValue",u=n.isTS?"($event: any)":"$event";i=Mt([`${u} => ((`,s,") = $event)"]);let p=[Be(c,e.exp),Be(d,i)];if(e.modifiers.length&&t.tagType===1){let w=e.modifiers.map(_=>_.content).map(_=>(Ta.test(_)?JSON.stringify(_):_)+": true").join(", "),g=r?ut(r)?`${r.content}Modifiers`:Mt([r,' + "Modifiers"']):"modelModifiers";p.push(Be(g,ae(`{ ${w} }`,!1,e.loc,2)))}return Cs(p)};function Cs(e=[]){return{props:e}}var Ml=new WeakSet,Ch=(e,t)=>{if(e.type===1){let n=_t(e,"memo");if(!(!n||Ml.has(e))&&!t.inSSR)return Ml.add(e),()=>{let i=e.codegenNode||t.currentNode.codegenNode;i&&i.type===13&&(e.tagType!==1&&yo(i,t),e.codegenNode=Fe(t.helper(bo),[n.exp,ui(void 0,i),"_cache",String(t.cached.length)]),t.cached.push(null))}}},Th=(e,t)=>{if(e.type===1){for(let n of e.props)if(n.type===7&&n.name==="bind"&&(!n.exp||n.exp.type===4&&!n.exp.content.trim())&&n.arg){let i=n.arg;if(i.type===4&&i.isStatic){let s=xe(i.content);(Td.test(s[0])||s[0]==="-")&&(n.exp=ae(s,!1,i.loc))}else t.onError(be(53,i.loc)),n.exp=ae("",!0,i.loc)}}},zd=Symbol(""),Hd=Symbol(""),Kd=Symbol(""),Qd=Symbol(""),Pa=Symbol(""),Wd=Symbol(""),Jd=Symbol(""),Gd=Symbol(""),Yd=Symbol(""),Xd=Symbol("");Object.getOwnPropertySymbols(dl={[zd]:"vModelRadio",[Hd]:"vModelCheckbox",[Kd]:"vModelText",[Qd]:"vModelSelect",[Pa]:"vModelDynamic",[Wd]:"withModifiers",[Jd]:"withKeys",[Gd]:"vShow",[Yd]:"Transition",[Xd]:"TransitionGroup"}).forEach(e=>{di[e]=dl[e]});var Ah={parseMode:"html",isVoidTag:Uu,isNativeTag:e=>Du(e)||Fu(e)||ju(e),isPreTag:e=>e==="pre",isIgnoreNewlineTag:e=>e==="pre"||e==="textarea",decodeEntities:function(e,t=!1){return Vn||(Vn=document.createElement("div")),t?(Vn.innerHTML=`<div foo="${e.replace(/"/g,"&quot;")}">`,Vn.children[0].getAttribute("foo")):(Vn.innerHTML=e,Vn.textContent)},isBuiltInComponent:e=>e==="Transition"||e==="transition"?Yd:e==="TransitionGroup"||e==="transition-group"?Xd:void 0,getNamespace(e,t,n){let i=t?t.ns:n;if(t&&i===2)if(t.tag==="annotation-xml"){if(e==="svg")return 1;t.props.some(s=>s.type===6&&s.name==="encoding"&&s.value!=null&&(s.value.content==="text/html"||s.value.content==="application/xhtml+xml"))&&(i=0)}else/^m(?:[ions]|text)$/.test(t.tag)&&e!=="mglyph"&&e!=="malignmark"&&(i=0);else t&&i===1&&(t.tag==="foreignObject"||t.tag==="desc"||t.tag==="title")&&(i=0);if(i===0){if(e==="svg")return 1;if(e==="math")return 2}return i}},Nh=bt("passive,once,capture"),Mh=bt("stop,prevent,self,ctrl,shift,alt,meta,exact,middle"),Eh=bt("left,right"),El=bt("onkeyup,onkeydown,onkeypress"),Il=(e,t)=>ut(e)&&e.content.toLowerCase()==="onclick"?ae(t,!0):e.type!==4?Mt(["(",e,`) === "onClick" ? "${t}" : (`,e,")"]):e,Ih=(e,t)=>{e.type===1&&e.tagType===0&&(e.tag==="script"||e.tag==="style")&&t.removeNode()},Rh=[e=>{e.type===1&&e.props.forEach((t,n)=>{let i,s;t.type===6&&t.name==="style"&&t.value&&(e.props[n]={type:7,name:"bind",arg:ae("style",!0,t.loc),exp:(i=t.value.content,s=t.loc,ae(JSON.stringify(Pl(i)),!1,s,3)),modifiers:[],loc:t.loc})})}],Oh={cloak:()=>({props:[]}),html:(e,t,n)=>{let{exp:i,loc:s}=e;return i||n.onError(be(54,s)),t.children.length&&(n.onError(be(55,s)),t.children.length=0),{props:[Be(ae("innerHTML",!0,s),i||ae("",!0))]}},text:(e,t,n)=>{let{exp:i,loc:s}=e;return i||n.onError(be(56,s)),t.children.length&&(n.onError(be(57,s)),t.children.length=0),{props:[Be(ae("textContent",!0),i?mt(i,n)>0?i:Fe(n.helperString(Cr),[i],s):ae("",!0))]}},model:(e,t,n)=>{let i=Vd(e,t,n);if(!i.props.length||t.tagType===1)return i;e.arg&&n.onError(be(59,e.arg.loc));let{tag:s}=t,r=n.isCustomElement(s);if(s==="input"||s==="textarea"||s==="select"||r){let a=Kd,o=!1;if(s==="input"||r){let l=Tr(t,"type");if(l){if(l.type===7)a=Pa;else if(l.value)switch(l.value.content){case"radio":a=zd;break;case"checkbox":a=Hd;break;case"file":o=!0,n.onError(be(60,e.loc))}}else t.props.some(c=>c.type===7&&c.name==="bind"&&(!c.arg||c.arg.type!==4||!c.arg.isStatic))&&(a=Pa)}else s==="select"&&(a=Qd);o||(i.needRuntime=n.helper(a))}else n.onError(be(58,e.loc));return i.props=i.props.filter(a=>a.key.type!==4||a.key.content!=="modelValue"),i},on:(e,t,n)=>$d(e,t,n,i=>{let{modifiers:s}=e;if(!s.length)return i;let{key:r,value:a}=i.props[0],{keyModifiers:o,nonKeyModifiers:l,eventOptionModifiers:c}=((d,u,p,w)=>{let g=[],_=[],A=[];for(let M=0;M<u.length;M++){let h=u[M].content;Nh(h)?A.push(h):Eh(h)?ut(d)?El(d.content.toLowerCase())?g.push(h):_.push(h):(g.push(h),_.push(h)):Mh(h)?_.push(h):g.push(h)}return{keyModifiers:g,nonKeyModifiers:_,eventOptionModifiers:A}})(r,s,0,e.loc);if(l.includes("right")&&(r=Il(r,"onContextmenu")),l.includes("middle")&&(r=Il(r,"onMouseup")),l.length&&(a=Fe(n.helper(Wd),[a,JSON.stringify(l)])),o.length&&(!ut(r)||El(r.content.toLowerCase()))&&(a=Fe(n.helper(Jd),[a,JSON.stringify(o)])),c.length){let d=c.map(jn).join("");r=ut(r)?ae(`${r.content}${d}`,!0):Mt(["(",r,`) + "${d}"`])}return{props:[Be(r,a)]}}),show:(e,t,n)=>{let{exp:i,loc:s}=e;return i||n.onError(be(62,s)),{props:[],needRuntime:n.helper(Gd)}}},Rl=Object.create(null);function Ph(e,t){if(!ie(e))if(e.nodeType)e=e.innerHTML;else return He;let n=e+JSON.stringify(t,(o,l)=>typeof l=="function"?l.toString():l),i=Rl[n];if(i)return i;if(e[0]==="#"){let o=document.querySelector(e);e=o?o.innerHTML:""}let s=le({hoistStatic:!0,onError:void 0,onWarn:He},t);!s.isCustomElement&&"u">typeof customElements&&(s.isCustomElement=o=>!!customElements.get(o));let{code:r}=function(o,l={}){return function(c,d={}){var u;let p,w=d.onError||Ca,g=d.mode==="module";d.prefixIdentifiers===!0?w(be(48)):g&&w(be(49)),d.cacheHandlers&&w(be(50)),d.scopeId&&!g&&w(be(51));let _=le({},d,{prefixIdentifiers:!1}),A=ie(c)?function(m,q){if(Re.reset(),Ge=null,ge=null,ft="",Ft=-1,qn=-1,Ce.length=0,Jt=m,_e=le({},Id),q){let f;for(f in q)q[f]!=null&&(_e[f]=q[f])}Re.mode=_e.parseMode==="html"?1:2*(_e.parseMode==="sfc"),Re.inXML=_e.ns===1||_e.ns===2;let T=q&&q.delimiters;T&&(Re.delimiterOpen=ir(T[0]),Re.delimiterClose=ir(T[1]));let N=or=function(f,y=""){return{type:0,source:y,children:f,helpers:new Set,components:[],directives:[],hoists:[],imports:[],cached:[],temps:0,codegenNode:void 0,loc:vt}}([],m);return Re.parse(Jt),N.loc=Ie(0,m.length),N.children=Od(N.children),or=null,N}(c,_):c,[M,h]=[[Th,qh,bh,Ch,yh,kh,wh,xh,Sh],{on:$d,bind:_h,model:Vd}];return p=function(m,{filename:q="",prefixIdentifiers:T=!1,hoistStatic:N=!1,hmr:f=!1,cacheHandlers:y=!1,nodeTransforms:v=[],directiveTransforms:k={},transformHoist:S=null,isBuiltInComponent:x=He,isCustomElement:I=He,expressionPlugins:R=[],scopeId:E=null,slotted:V=!0,ssr:B=!1,inSSR:z=!1,ssrCssVars:H="",bindingMetadata:X=de,inline:ne=!1,isTS:ue=!1,onError:he=Ca,onWarn:ye=qd,compatConfig:ze}){let tt=q.replace(/\?.*$/,"").match(/([^/\\]+)\.\w+$/),oe={filename:q,selfName:tt&&jn(xe(tt[1])),prefixIdentifiers:T,hoistStatic:N,hmr:f,cacheHandlers:y,nodeTransforms:v,directiveTransforms:k,transformHoist:S,isBuiltInComponent:x,isCustomElement:I,expressionPlugins:R,scopeId:E,slotted:V,ssr:B,inSSR:z,ssrCssVars:H,bindingMetadata:X,inline:ne,isTS:ue,onError:he,onWarn:ye,compatConfig:ze,root:m,helpers:new Map,components:new Set,directives:new Set,hoists:[],imports:[],cached:[],constantCache:new WeakMap,vForMemoKeyedNodes:new WeakSet,temps:0,identifiers:Object.create(null),scopes:{vFor:0,vSlot:0,vPre:0,vOnce:0},parent:null,grandParent:null,currentNode:m,childIndex:0,inVOnce:!1,helper(se){let ke=oe.helpers.get(se)||0;return oe.helpers.set(se,ke+1),se},removeHelper(se){let ke=oe.helpers.get(se);if(ke){let qe=ke-1;qe?oe.helpers.set(se,qe):oe.helpers.delete(se)}},helperString:se=>`_${di[oe.helper(se)]}`,replaceNode(se){oe.parent.children[oe.childIndex]=oe.currentNode=se},removeNode(se){let ke=oe.parent.children,qe=se?ke.indexOf(se):oe.currentNode?oe.childIndex:-1;se&&se!==oe.currentNode?oe.childIndex>qe&&(oe.childIndex--,oe.onNodeRemoved()):(oe.currentNode=null,oe.onNodeRemoved()),oe.parent.children.splice(qe,1)},onNodeRemoved:He,addIdentifiers(se){},removeIdentifiers(se){},hoist(se){ie(se)&&(se=ae(se)),oe.hoists.push(se);let ke=ae(`_hoisted_${oe.hoists.length}`,!1,se.loc,2);return ke.hoisted=se,ke},cache(se,ke=!1,qe=!1){let b=function(C,O,$=!1,F=!1){return{type:20,index:C,value:O,needPauseTracking:$,inVOnce:F,needArraySpread:!1,loc:vt}}(oe.cached.length,se,ke,qe);return oe.cached.push(b),b}};return oe}(A,u=le({},_,{nodeTransforms:[...M,...d.nodeTransforms||[]],directiveTransforms:le({},h,d.directiveTransforms||{})})),lr(A,p),u.hoistStatic&&function m(q,T,N,f=!1,y=!1){let{children:v}=q,k=[];for(let R=0;R<v.length;R++){let E=v[R];if(E.type===1&&E.tagType===0){let V=f?0:mt(E,N);if(V>0){if(V>=2){E.codegenNode.patchFlag=-1,k.push(E);continue}}else{let B=E.codegenNode;if(B.type===13){let z=B.patchFlag;if((z===void 0||z===512||z===1)&&Bd(E,N)>=2){let H=Ld(E);H&&(B.props=N.hoist(H))}B.dynamicProps&&(B.dynamicProps=N.hoist(B.dynamicProps))}}}else if(E.type===12&&(f?0:mt(E,N))>=2){E.codegenNode.type===14&&E.codegenNode.arguments.length>0&&E.codegenNode.arguments.push("-1"),k.push(E);continue}if(E.type===1){let V=E.tagType===1;V&&N.scopes.vSlot++,m(E,q,N,!1,y),V&&N.scopes.vSlot--}else if(E.type===11)m(E,q,N,E.children.length===1,!0);else if(E.type===9)for(let V=0;V<E.branches.length;V++)m(E.branches[V],q,N,E.branches[V].children.length===1,y)}let S=!1;if(k.length===v.length&&q.type===1){if(q.tagType===0&&q.codegenNode&&q.codegenNode.type===13&&J(q.codegenNode.children))q.codegenNode.children=x(In(q.codegenNode.children)),S=!0;else if(q.tagType===1&&q.codegenNode&&q.codegenNode.type===13&&q.codegenNode.children&&!J(q.codegenNode.children)&&q.codegenNode.children.type===15){let R=I(q.codegenNode,"default");R&&(R.returns=x(In(R.returns)),S=!0)}else if(q.tagType===3&&T&&T.type===1&&T.tagType===1&&T.codegenNode&&T.codegenNode.type===13&&T.codegenNode.children&&!J(T.codegenNode.children)&&T.codegenNode.children.type===15){let R=_t(q,"slot",!0),E=R&&R.arg&&I(T.codegenNode,R.arg);E&&(E.returns=x(In(E.returns)),S=!0)}}if(!S)for(let R of k)R.codegenNode=N.cache(R.codegenNode);function x(R){let E=N.cache(R);return E.needArraySpread=!0,E}function I(R,E){if(R.children&&!J(R.children)&&R.children.type===15){let V=R.children.properties.find(B=>B.key===E||B.key.content===E);return V&&V.value}}k.length&&N.transformHoist&&N.transformHoist(v,N,q)}(A,void 0,p,!!bl(A)),u.ssr||function(m,q){let{helper:T}=q,{children:N}=m;if(N.length===1){let f=bl(m);if(f&&f.codegenNode){let y=f.codegenNode;y.type===13&&yo(y,q),m.codegenNode=y}else m.codegenNode=N[0]}else N.length>1&&(m.codegenNode=Ji(q,T(Qi),void 0,m.children,64,void 0,void 0,!0,void 0,!1))}(A,p),A.helpers=new Set([...p.helpers.keys()]),A.components=[...p.components],A.directives=[...p.directives],A.imports=p.imports,A.hoists=p.hoists,A.temps=p.temps,A.cached=p.cached,A.transformed=!0,function(m,q={}){let T=function(B,{mode:z="function",prefixIdentifiers:H=z==="module",sourceMap:X=!1,filename:ne="template.vue.html",scopeId:ue=null,optimizeImports:he=!1,runtimeGlobalName:ye="Vue",runtimeModuleName:ze="vue",ssrRuntimeModuleName:tt="vue/server-renderer",ssr:oe=!1,isTS:se=!1,inSSR:ke=!1}){let qe={mode:z,prefixIdentifiers:H,sourceMap:X,filename:ne,scopeId:ue,optimizeImports:he,runtimeGlobalName:ye,runtimeModuleName:ze,ssrRuntimeModuleName:tt,ssr:oe,isTS:se,inSSR:ke,source:B.source,code:"",column:1,line:1,offset:0,indentLevel:0,pure:!1,map:void 0,helper:C=>`_${di[C]}`,push(C,O=-2,$){qe.code+=C},indent(){b(++qe.indentLevel)},deindent(C=!1){C?--qe.indentLevel:b(--qe.indentLevel)},newline(){b(qe.indentLevel)}};function b(C){qe.push(`
`+"  ".repeat(C),0)}return qe}(m,q);q.onContextCreated&&q.onContextCreated(T);let{mode:N,push:f,prefixIdentifiers:y,indent:v,deindent:k,newline:S,ssr:x}=T,I=Array.from(m.helpers),R=I.length>0,E=!y&&N!=="module";(function(B,z){let{push:H,newline:X,runtimeGlobalName:ne}=z,ue=Array.from(B.helpers);if(ue.length>0&&(H(`const _Vue = ${ne}
`,-1),B.hoists.length)){let he=[pn,fn,rs,lo,wd].filter(ye=>ue.includes(ye)).map(yl).join(", ");H(`const { ${he} } = _Vue
`,-1)}(function(he,ye){if(!he.length)return;ye.pure=!0;let{push:ze,newline:tt}=ye;tt();for(let oe=0;oe<he.length;oe++){let se=he[oe];se&&(ze(`const _hoisted_${oe+1} = `),st(se,ye),tt())}ye.pure=!1})(B.hoists,z),X(),H("return ")})(m,T);let V=(x?["_ctx","_push","_parent","_attrs"]:["_ctx","_cache"]).join(", ");if(f(`function ${x?"ssrRender":"render"}(${V}) {`),v(),E&&(f("with (_ctx) {"),v(),R&&(f(`const { ${I.map(yl).join(", ")} } = _Vue
`,-1),S())),m.components.length&&(xl(m.components,"component",T),(m.directives.length||m.temps>0)&&S()),m.directives.length&&(xl(m.directives,"directive",T),m.temps>0&&S()),m.temps>0){f("let ");for(let B=0;B<m.temps;B++)f(`${B>0?", ":""}_temp${B}`)}return(m.components.length||m.directives.length||m.temps)&&(f(`
`,0),S()),x||f("return "),m.codegenNode?st(m.codegenNode,T):f("null"),E&&(k(),f("}")),k(),f("}"),{ast:m,code:T.code,preamble:"",map:T.map?T.map.toJSON():void 0}}(A,_)}(o,le({},Ah,l,{nodeTransforms:[Ih,...Rh,...l.nodeTransforms||[]],directiveTransforms:le({},Oh,l.directiveTransforms||{}),transformHoist:null}))}(e,s),a=Function("Vue",r)(th);return a._rc=!0,Rl[n]=a}zc(Ph);var hi=function(e,t){let s=e,r=os[t],a=null,o=0,l=null,c=[],d={},u=function(f,y){o=s*4+17,a=function(v){let k=new Array(v);for(let S=0;S<v;S+=1){k[S]=new Array(v);for(let x=0;x<v;x+=1)k[S][x]=null}return k}(o),p(0,0),p(o-7,0),p(0,o-7),_(),g(),M(f,y),s>=7&&A(f),l==null&&(l=q(s,r,c)),h(l,y)},p=function(f,y){for(let v=-1;v<=7;v+=1)if(!(f+v<=-1||o<=f+v))for(let k=-1;k<=7;k+=1)y+k<=-1||o<=y+k||(0<=v&&v<=6&&(k==0||k==6)||0<=k&&k<=6&&(v==0||v==6)||2<=v&&v<=4&&2<=k&&k<=4?a[f+v][y+k]=!0:a[f+v][y+k]=!1)},w=function(){let f=0,y=0;for(let v=0;v<8;v+=1){u(!0,v);let k=gn.getLostPoint(d);(v==0||f>k)&&(f=k,y=v)}return y},g=function(){for(let f=8;f<o-8;f+=1)a[f][6]==null&&(a[f][6]=f%2==0);for(let f=8;f<o-8;f+=1)a[6][f]==null&&(a[6][f]=f%2==0)},_=function(){let f=gn.getPatternPosition(s);for(let y=0;y<f.length;y+=1)for(let v=0;v<f.length;v+=1){let k=f[y],S=f[v];if(a[k][S]==null)for(let x=-2;x<=2;x+=1)for(let I=-2;I<=2;I+=1)x==-2||x==2||I==-2||I==2||x==0&&I==0?a[k+x][S+I]=!0:a[k+x][S+I]=!1}},A=function(f){let y=gn.getBCHTypeNumber(s);for(let v=0;v<18;v+=1){let k=!f&&(y>>v&1)==1;a[Math.floor(v/3)][v%3+o-8-3]=k}for(let v=0;v<18;v+=1){let k=!f&&(y>>v&1)==1;a[v%3+o-8-3][Math.floor(v/3)]=k}},M=function(f,y){let v=r<<3|y,k=gn.getBCHTypeInfo(v);for(let S=0;S<15;S+=1){let x=!f&&(k>>S&1)==1;S<6?a[S][8]=x:S<8?a[S+1][8]=x:a[o-15+S][8]=x}for(let S=0;S<15;S+=1){let x=!f&&(k>>S&1)==1;S<8?a[8][o-S-1]=x:S<9?a[8][15-S-1+1]=x:a[8][15-S-1]=x}a[o-8][8]=!f},h=function(f,y){let v=-1,k=o-1,S=7,x=0,I=gn.getMaskFunction(y);for(let R=o-1;R>0;R-=2)for(R==6&&(R-=1);;){for(let E=0;E<2;E+=1)if(a[k][R-E]==null){let V=!1;x<f.length&&(V=(f[x]>>>S&1)==1),I(k,R-E)&&(V=!V),a[k][R-E]=V,S-=1,S==-1&&(x+=1,S=7)}if(k+=v,k<0||o<=k){k-=v,v=-v;break}}},m=function(f,y){let v=0,k=0,S=0,x=new Array(y.length),I=new Array(y.length);for(let B=0;B<y.length;B+=1){let z=y[B].dataCount,H=y[B].totalCount-z;k=Math.max(k,z),S=Math.max(S,H),x[B]=new Array(z);for(let he=0;he<x[B].length;he+=1)x[B][he]=255&f.getBuffer()[he+v];v+=z;let X=gn.getErrorCorrectPolynomial(H),ue=ls(x[B],X.getLength()-1).mod(X);I[B]=new Array(X.getLength()-1);for(let he=0;he<I[B].length;he+=1){let ye=he+ue.getLength()-I[B].length;I[B][he]=ye>=0?ue.getAt(ye):0}}let R=0;for(let B=0;B<y.length;B+=1)R+=y[B].totalCount;let E=new Array(R),V=0;for(let B=0;B<k;B+=1)for(let z=0;z<y.length;z+=1)B<x[z].length&&(E[V]=x[z][B],V+=1);for(let B=0;B<S;B+=1)for(let z=0;z<y.length;z+=1)B<I[z].length&&(E[V]=I[z][B],V+=1);return E},q=function(f,y,v){let k=Zd.getRSBlocks(f,y),S=eu();for(let I=0;I<v.length;I+=1){let R=v[I];S.put(R.getMode(),4),S.put(R.getLength(),gn.getLengthInBits(R.getMode(),f)),R.write(S)}let x=0;for(let I=0;I<k.length;I+=1)x+=k[I].dataCount;if(S.getLengthInBits()>x*8)throw"code length overflow. ("+S.getLengthInBits()+">"+x*8+")";for(S.getLengthInBits()+4<=x*8&&S.put(0,4);S.getLengthInBits()%8!=0;)S.putBit(!1);for(;!(S.getLengthInBits()>=x*8||(S.put(236,8),S.getLengthInBits()>=x*8));)S.put(17,8);return m(S,k)};d.addData=function(f,y){y=y||"Byte";let v=null;switch(y){case"Numeric":v=Bh(f);break;case"Alphanumeric":v=Lh(f);break;case"Byte":v=Dh(f);break;case"Kanji":v=Fh(f);break;default:throw"mode:"+y}c.push(v),l=null},d.isDark=function(f,y){if(f<0||o<=f||y<0||o<=y)throw f+","+y;return a[f][y]},d.getModuleCount=function(){return o},d.make=function(){if(s<1){let f=1;for(;f<40;f++){let y=Zd.getRSBlocks(f,r),v=eu();for(let S=0;S<c.length;S++){let x=c[S];v.put(x.getMode(),4),v.put(x.getLength(),gn.getLengthInBits(x.getMode(),f)),x.write(v)}let k=0;for(let S=0;S<y.length;S++)k+=y[S].dataCount;if(v.getLengthInBits()<=k*8)break}s=f}u(!1,w())},d.createTableTag=function(f,y){f=f||2,y=typeof y>"u"?f*4:y;let v="";v+='<table style="',v+=" border-width: 0px; border-style: none;",v+=" border-collapse: collapse;",v+=" padding: 0px; margin: "+y+"px;",v+='">',v+="<tbody>";for(let k=0;k<d.getModuleCount();k+=1){v+="<tr>";for(let S=0;S<d.getModuleCount();S+=1)v+='<td style="',v+=" border-width: 0px; border-style: none;",v+=" border-collapse: collapse;",v+=" padding: 0px; margin: 0px;",v+=" width: "+f+"px;",v+=" height: "+f+"px;",v+=" background-color: ",v+=d.isDark(k,S)?"#000000":"#ffffff",v+=";",v+='"/>';v+="</tr>"}return v+="</tbody>",v+="</table>",v},d.createSvgTag=function(f,y,v,k){let S={};typeof arguments[0]=="object"&&(S=arguments[0],f=S.cellSize,y=S.margin,v=S.alt,k=S.title),f=f||2,y=typeof y>"u"?f*4:y,v=typeof v=="string"?{text:v}:v||{},v.text=v.text||null,v.id=v.text?v.id||"qrcode-description":null,k=typeof k=="string"?{text:k}:k||{},k.text=k.text||null,k.id=k.text?k.id||"qrcode-title":null;let x=d.getModuleCount()*f+y*2,I,R,E,V,B="",z;for(z="l"+f+",0 0,"+f+" -"+f+",0 0,-"+f+"z ",B+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',B+=S.scalable?"":' width="'+x+'px" height="'+x+'px"',B+=' viewBox="0 0 '+x+" "+x+'" ',B+=' preserveAspectRatio="xMinYMin meet"',B+=k.text||v.text?' role="img" aria-labelledby="'+T([k.id,v.id].join(" ").trim())+'"':"",B+=">",B+=k.text?'<title id="'+T(k.id)+'">'+T(k.text)+"</title>":"",B+=v.text?'<description id="'+T(v.id)+'">'+T(v.text)+"</description>":"",B+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',B+='<path d="',E=0;E<d.getModuleCount();E+=1)for(V=E*f+y,I=0;I<d.getModuleCount();I+=1)d.isDark(E,I)&&(R=I*f+y,B+="M"+R+","+V+z);return B+='" stroke="transparent" fill="black"/>',B+="</svg>",B},d.createDataURL=function(f,y){f=f||2,y=typeof y>"u"?f*4:y;let v=d.getModuleCount()*f+y*2,k=y,S=v-y;return Vh(v,v,function(x,I){if(k<=x&&x<S&&k<=I&&I<S){let R=Math.floor((x-k)/f),E=Math.floor((I-k)/f);return d.isDark(E,R)?0:1}else return 1})},d.createImgTag=function(f,y,v){f=f||2,y=typeof y>"u"?f*4:y;let k=d.getModuleCount()*f+y*2,S="";return S+="<img",S+=' src="',S+=d.createDataURL(f,y),S+='"',S+=' width="',S+=k,S+='"',S+=' height="',S+=k,S+='"',v&&(S+=' alt="',S+=T(v),S+='"'),S+="/>",S};let T=function(f){let y="";for(let v=0;v<f.length;v+=1){let k=f.charAt(v);switch(k){case"<":y+="&lt;";break;case">":y+="&gt;";break;case"&":y+="&amp;";break;case'"':y+="&quot;";break;default:y+=k;break}}return y},N=function(f){f=typeof f>"u"?1*2:f;let v=d.getModuleCount()*1+f*2,k=f,S=v-f,x,I,R,E,V,B={"\u2588\u2588":"\u2588","\u2588 ":"\u2580"," \u2588":"\u2584","  ":" "},z={"\u2588\u2588":"\u2580","\u2588 ":"\u2580"," \u2588":" ","  ":" "},H="";for(x=0;x<v;x+=2){for(R=Math.floor((x-k)/1),E=Math.floor((x+1-k)/1),I=0;I<v;I+=1)V="\u2588",k<=I&&I<S&&k<=x&&x<S&&d.isDark(R,Math.floor((I-k)/1))&&(V=" "),k<=I&&I<S&&k<=x+1&&x+1<S&&d.isDark(E,Math.floor((I-k)/1))?V+=" ":V+="\u2588",H+=f<1&&x+1>=S?z[V]:B[V];H+=`
`}return v%2&&f>0?H.substring(0,H.length-v-1)+Array(v+1).join("\u2580"):H.substring(0,H.length-1)};return d.createASCII=function(f,y){if(f=f||1,f<2)return N(y);f-=1,y=typeof y>"u"?f*2:y;let v=d.getModuleCount()*f+y*2,k=y,S=v-y,x,I,R,E,V=Array(f+1).join("\u2588\u2588"),B=Array(f+1).join("  "),z="",H="";for(x=0;x<v;x+=1){for(R=Math.floor((x-k)/f),H="",I=0;I<v;I+=1)E=1,k<=I&&I<S&&k<=x&&x<S&&d.isDark(R,Math.floor((I-k)/f))&&(E=0),H+=E?V:B;for(R=0;R<f;R+=1)z+=H+`
`}return z.substring(0,z.length-1)},d.renderTo2dContext=function(f,y){y=y||2;let v=d.getModuleCount();for(let k=0;k<v;k++)for(let S=0;S<v;S++)f.fillStyle=d.isDark(k,S)?"black":"white",f.fillRect(S*y,k*y,y,y)},d};hi.stringToBytes=function(e){let t=[];for(let n=0;n<e.length;n+=1){let i=e.charCodeAt(n);t.push(i&255)}return t};hi.createStringToBytes=function(e,t){let n=function(){let s=Uh(e),r=function(){let l=s.read();if(l==-1)throw"eof";return l},a=0,o={};for(;;){let l=s.read();if(l==-1)break;let c=r(),d=r(),u=r(),p=String.fromCharCode(l<<8|c),w=d<<8|u;o[p]=w,a+=1}if(a!=t)throw a+" != "+t;return o}(),i=63;return function(s){let r=[];for(let a=0;a<s.length;a+=1){let o=s.charCodeAt(a);if(o<128)r.push(o);else{let l=n[s.charAt(a)];typeof l=="number"?(l&255)==l?r.push(l):(r.push(l>>>8),r.push(l&255)):r.push(i)}}return r}};var et={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},os={L:1,M:0,Q:3,H:2},mn={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},gn=function(){let e=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],t=1335,n=7973,i=21522,s={},r=function(a){let o=0;for(;a!=0;)o+=1,a>>>=1;return o};return s.getBCHTypeInfo=function(a){let o=a<<10;for(;r(o)-r(t)>=0;)o^=t<<r(o)-r(t);return(a<<10|o)^i},s.getBCHTypeNumber=function(a){let o=a<<12;for(;r(o)-r(n)>=0;)o^=n<<r(o)-r(n);return a<<12|o},s.getPatternPosition=function(a){return e[a-1]},s.getMaskFunction=function(a){switch(a){case mn.PATTERN000:return function(o,l){return(o+l)%2==0};case mn.PATTERN001:return function(o,l){return o%2==0};case mn.PATTERN010:return function(o,l){return l%3==0};case mn.PATTERN011:return function(o,l){return(o+l)%3==0};case mn.PATTERN100:return function(o,l){return(Math.floor(o/2)+Math.floor(l/3))%2==0};case mn.PATTERN101:return function(o,l){return o*l%2+o*l%3==0};case mn.PATTERN110:return function(o,l){return(o*l%2+o*l%3)%2==0};case mn.PATTERN111:return function(o,l){return(o*l%3+(o+l)%2)%2==0};default:throw"bad maskPattern:"+a}},s.getErrorCorrectPolynomial=function(a){let o=ls([1],0);for(let l=0;l<a;l+=1)o=o.multiply(ls([1,vn.gexp(l)],0));return o},s.getLengthInBits=function(a,o){if(1<=o&&o<10)switch(a){case et.MODE_NUMBER:return 10;case et.MODE_ALPHA_NUM:return 9;case et.MODE_8BIT_BYTE:return 8;case et.MODE_KANJI:return 8;default:throw"mode:"+a}else if(o<27)switch(a){case et.MODE_NUMBER:return 12;case et.MODE_ALPHA_NUM:return 11;case et.MODE_8BIT_BYTE:return 16;case et.MODE_KANJI:return 10;default:throw"mode:"+a}else if(o<41)switch(a){case et.MODE_NUMBER:return 14;case et.MODE_ALPHA_NUM:return 13;case et.MODE_8BIT_BYTE:return 16;case et.MODE_KANJI:return 12;default:throw"mode:"+a}else throw"type:"+o},s.getLostPoint=function(a){let o=a.getModuleCount(),l=0;for(let u=0;u<o;u+=1)for(let p=0;p<o;p+=1){let w=0,g=a.isDark(u,p);for(let _=-1;_<=1;_+=1)if(!(u+_<0||o<=u+_))for(let A=-1;A<=1;A+=1)p+A<0||o<=p+A||_==0&&A==0||g==a.isDark(u+_,p+A)&&(w+=1);w>5&&(l+=3+w-5)}for(let u=0;u<o-1;u+=1)for(let p=0;p<o-1;p+=1){let w=0;a.isDark(u,p)&&(w+=1),a.isDark(u+1,p)&&(w+=1),a.isDark(u,p+1)&&(w+=1),a.isDark(u+1,p+1)&&(w+=1),(w==0||w==4)&&(l+=3)}for(let u=0;u<o;u+=1)for(let p=0;p<o-6;p+=1)a.isDark(u,p)&&!a.isDark(u,p+1)&&a.isDark(u,p+2)&&a.isDark(u,p+3)&&a.isDark(u,p+4)&&!a.isDark(u,p+5)&&a.isDark(u,p+6)&&(l+=40);for(let u=0;u<o;u+=1)for(let p=0;p<o-6;p+=1)a.isDark(p,u)&&!a.isDark(p+1,u)&&a.isDark(p+2,u)&&a.isDark(p+3,u)&&a.isDark(p+4,u)&&!a.isDark(p+5,u)&&a.isDark(p+6,u)&&(l+=40);let c=0;for(let u=0;u<o;u+=1)for(let p=0;p<o;p+=1)a.isDark(p,u)&&(c+=1);let d=Math.abs(100*c/o/o-50)/5;return l+=d*10,l},s}(),vn=function(){let e=new Array(256),t=new Array(256);for(let i=0;i<8;i+=1)e[i]=1<<i;for(let i=8;i<256;i+=1)e[i]=e[i-4]^e[i-5]^e[i-6]^e[i-8];for(let i=0;i<255;i+=1)t[e[i]]=i;let n={};return n.glog=function(i){if(i<1)throw"glog("+i+")";return t[i]},n.gexp=function(i){for(;i<0;)i+=255;for(;i>=256;)i-=255;return e[i]},n}(),ls=function(e,t){if(typeof e.length>"u")throw e.length+"/"+t;let n=function(){let s=0;for(;s<e.length&&e[s]==0;)s+=1;let r=new Array(e.length-s+t);for(let a=0;a<e.length-s;a+=1)r[a]=e[a+s];return r}(),i={};return i.getAt=function(s){return n[s]},i.getLength=function(){return n.length},i.multiply=function(s){let r=new Array(i.getLength()+s.getLength()-1);for(let a=0;a<i.getLength();a+=1)for(let o=0;o<s.getLength();o+=1)r[a+o]^=vn.gexp(vn.glog(i.getAt(a))+vn.glog(s.getAt(o)));return ls(r,0)},i.mod=function(s){if(i.getLength()-s.getLength()<0)return i;let r=vn.glog(i.getAt(0))-vn.glog(s.getAt(0)),a=new Array(i.getLength());for(let o=0;o<i.getLength();o+=1)a[o]=i.getAt(o);for(let o=0;o<s.getLength();o+=1)a[o]^=vn.gexp(vn.glog(s.getAt(o))+r);return ls(a,0).mod(s)},i},Zd=function(){let e=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],t=function(s,r){let a={};return a.totalCount=s,a.dataCount=r,a},n={},i=function(s,r){switch(r){case os.L:return e[(s-1)*4+0];case os.M:return e[(s-1)*4+1];case os.Q:return e[(s-1)*4+2];case os.H:return e[(s-1)*4+3];default:return}};return n.getRSBlocks=function(s,r){let a=i(s,r);if(typeof a>"u")throw"bad rs block @ typeNumber:"+s+"/errorCorrectionLevel:"+r;let o=a.length/3,l=[];for(let c=0;c<o;c+=1){let d=a[c*3+0],u=a[c*3+1],p=a[c*3+2];for(let w=0;w<d;w+=1)l.push(t(u,p))}return l},n}(),eu=function(){let e=[],t=0,n={};return n.getBuffer=function(){return e},n.getAt=function(i){let s=Math.floor(i/8);return(e[s]>>>7-i%8&1)==1},n.put=function(i,s){for(let r=0;r<s;r+=1)n.putBit((i>>>s-r-1&1)==1)},n.getLengthInBits=function(){return t},n.putBit=function(i){let s=Math.floor(t/8);e.length<=s&&e.push(0),i&&(e[s]|=128>>>t%8),t+=1},n},Bh=function(e){let t=et.MODE_NUMBER,n=e,i={};i.getMode=function(){return t},i.getLength=function(a){return n.length},i.write=function(a){let o=n,l=0;for(;l+2<o.length;)a.put(s(o.substring(l,l+3)),10),l+=3;l<o.length&&(o.length-l==1?a.put(s(o.substring(l,l+1)),4):o.length-l==2&&a.put(s(o.substring(l,l+2)),7))};let s=function(a){let o=0;for(let l=0;l<a.length;l+=1)o=o*10+r(a.charAt(l));return o},r=function(a){if("0"<=a&&a<="9")return a.charCodeAt(0)-48;throw"illegal char :"+a};return i},Lh=function(e){let t=et.MODE_ALPHA_NUM,n=e,i={};i.getMode=function(){return t},i.getLength=function(r){return n.length},i.write=function(r){let a=n,o=0;for(;o+1<a.length;)r.put(s(a.charAt(o))*45+s(a.charAt(o+1)),11),o+=2;o<a.length&&r.put(s(a.charAt(o)),6)};let s=function(r){if("0"<=r&&r<="9")return r.charCodeAt(0)-48;if("A"<=r&&r<="Z")return r.charCodeAt(0)-65+10;switch(r){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+r}};return i},Dh=function(e){let t=et.MODE_8BIT_BYTE,n=e,i=hi.stringToBytes(e),s={};return s.getMode=function(){return t},s.getLength=function(r){return i.length},s.write=function(r){for(let a=0;a<i.length;a+=1)r.put(i[a],8)},s},Fh=function(e){let t=et.MODE_KANJI,n=e,i=hi.stringToBytes;(function(a,o){let l=i(a);if(l.length!=2||(l[0]<<8|l[1])!=o)throw"sjis not supported."})("\u53CB",38726);let s=i(e),r={};return r.getMode=function(){return t},r.getLength=function(a){return~~(s.length/2)},r.write=function(a){let o=s,l=0;for(;l+1<o.length;){let c=(255&o[l])<<8|255&o[l+1];if(33088<=c&&c<=40956)c-=33088;else if(57408<=c&&c<=60351)c-=49472;else throw"illegal char at "+(l+1)+"/"+c;c=(c>>>8&255)*192+(c&255),a.put(c,13),l+=2}if(l<o.length)throw"illegal char at "+(l+1)},r},tu=function(){let e=[],t={};return t.writeByte=function(n){e.push(n&255)},t.writeShort=function(n){t.writeByte(n),t.writeByte(n>>>8)},t.writeBytes=function(n,i,s){i=i||0,s=s||n.length;for(let r=0;r<s;r+=1)t.writeByte(n[r+i])},t.writeString=function(n){for(let i=0;i<n.length;i+=1)t.writeByte(n.charCodeAt(i))},t.toByteArray=function(){return e},t.toString=function(){let n="";n+="[";for(let i=0;i<e.length;i+=1)i>0&&(n+=","),n+=e[i];return n+="]",n},t},jh=function(){let e=0,t=0,n=0,i="",s={},r=function(o){i+=String.fromCharCode(a(o&63))},a=function(o){if(o<0)throw"n:"+o;if(o<26)return 65+o;if(o<52)return 97+(o-26);if(o<62)return 48+(o-52);if(o==62)return 43;if(o==63)return 47;throw"n:"+o};return s.writeByte=function(o){for(e=e<<8|o&255,t+=8,n+=1;t>=6;)r(e>>>t-6),t-=6},s.flush=function(){if(t>0&&(r(e<<6-t),e=0,t=0),n%3!=0){let o=3-n%3;for(let l=0;l<o;l+=1)i+="="}},s.toString=function(){return i},s},Uh=function(e){let t=e,n=0,i=0,s=0,r={};r.read=function(){for(;s<8;){if(n>=t.length){if(s==0)return-1;throw"unexpected end of file./"+s}let l=t.charAt(n);if(n+=1,l=="=")return s=0,-1;if(l.match(/^\s$/))continue;i=i<<6|a(l.charCodeAt(0)),s+=6}let o=i>>>s-8&255;return s-=8,o};let a=function(o){if(65<=o&&o<=90)return o-65;if(97<=o&&o<=122)return o-97+26;if(48<=o&&o<=57)return o-48+52;if(o==43)return 62;if(o==47)return 63;throw"c:"+o};return r},$h=function(e,t){let n=e,i=t,s=new Array(e*t),r={};r.setPixel=function(c,d,u){s[d*n+c]=u},r.write=function(c){c.writeString("GIF87a"),c.writeShort(n),c.writeShort(i),c.writeByte(128),c.writeByte(0),c.writeByte(0),c.writeByte(0),c.writeByte(0),c.writeByte(0),c.writeByte(255),c.writeByte(255),c.writeByte(255),c.writeString(","),c.writeShort(0),c.writeShort(0),c.writeShort(n),c.writeShort(i),c.writeByte(0);let d=2,u=o(d);c.writeByte(d);let p=0;for(;u.length-p>255;)c.writeByte(255),c.writeBytes(u,p,255),p+=255;c.writeByte(u.length-p),c.writeBytes(u,p,u.length-p),c.writeByte(0),c.writeString(";")};let a=function(c){let d=c,u=0,p=0,w={};return w.write=function(g,_){if(g>>>_)throw"length over";for(;u+_>=8;)d.writeByte(255&(g<<u|p)),_-=8-u,g>>>=8-u,p=0,u=0;p=g<<u|p,u=u+_},w.flush=function(){u>0&&d.writeByte(p)},w},o=function(c){let d=1<<c,u=(1<<c)+1,p=c+1,w=l();for(let h=0;h<d;h+=1)w.add(String.fromCharCode(h));w.add(String.fromCharCode(d)),w.add(String.fromCharCode(u));let g=tu(),_=a(g);_.write(d,p);let A=0,M=String.fromCharCode(s[A]);for(A+=1;A<s.length;){let h=String.fromCharCode(s[A]);A+=1,w.contains(M+h)?M=M+h:(_.write(w.indexOf(M),p),w.size()<4095&&(w.size()==1<<p&&(p+=1),w.add(M+h)),M=h)}return _.write(w.indexOf(M),p),_.write(u,p),_.flush(),g.toByteArray()},l=function(){let c={},d=0,u={};return u.add=function(p){if(u.contains(p))throw"dup key:"+p;c[p]=d,d+=1},u.size=function(){return d},u.indexOf=function(p){return c[p]},u.contains=function(p){return typeof c[p]<"u"},u};return r},Vh=function(e,t,n){let i=$h(e,t);for(let o=0;o<t;o+=1)for(let l=0;l<e;l+=1)i.setPixel(l,o,n(l,o));let s=tu();i.write(s);let r=jh(),a=s.toByteArray();for(let o=0;o<a.length;o+=1)r.writeByte(a[o]);return r.flush(),"data:image/gif;base64,"+r},nu=hi,hm=hi.stringToBytes;var Ar=null;function iu(e){Ar=e}async function zh(e,t){if(!Ar||!Ar.invoke)throw new Error("\u63D2\u4EF6\u8FD0\u884C\u65F6\u672A\u5C31\u7EEA");return await Ar.invoke(e,t||{})}async function Ct(e,t){let n=await zh(e,t);return n&&typeof n=="object"&&"data"in n&&n.data!==null&&n.data!==void 0?n.data:n}var W=hn({ready:!1,err:"",uin:"",sessions:[],sid:"",msgs:[],loading:!1,loadingMore:!1,hasMore:!0,keyword:"",msgKeyword:"",viewer:"",pageSize:50,cap:600,atBottom:!0});async function su(){try{let e=await Ct("qqbot.account.info");W.uin=String(e&&(e.uin||e.self_id)||"")}catch{}}async function mi(e){W.err="";try{let t=await Ct("qqbot.chat.sessions",{limit:200,kw:e||""}),n=t&&t.items||[];W.sessions=n.filter(i=>i&&i.target_id),!W.sid&&W.sessions.length&&(W.sid=W.sessions[0].session_id),W.ready=!0}catch(t){W.err=String(t&&t.message||t)}}async function gi(e,t){e&&(W.sid=e,W.msgKeyword=String(t||""),W.msgs=[],W.hasMore=!0,W.atBottom=!0,await Nr(!1))}async function Nr(e){if(W.sid&&!(e&&(W.loadingMore||!W.hasMore))){e?W.loadingMore=!0:W.loading=!0;try{let t={session_id:W.sid,limit:W.pageSize};W.msgKeyword&&(t.kw=W.msgKeyword),e&&W.msgs.length&&(t.before_id=W.msgs[0].id);let n=await Ct("qqbot.chat.messages",t),i=n&&n.items||[];e?(W.msgs=i.concat(W.msgs),W.msgs.length>W.cap&&(W.msgs=W.msgs.slice(-W.cap))):W.msgs=i,W.hasMore=i.length>=W.pageSize}catch(t){W.err=String(t&&t.message||t)}finally{W.loading=!1,W.loadingMore=!1}}}function ru(){return W.sessions.find(e=>e.session_id===W.sid)||null}function au(e){if(!e)return!1;if(e.role==="assistant")return!0;let t=String(e.sender_id||"");return!!(W.uin&&t&&t===W.uin)}var ou="rcq.im.read";function lu(){try{return JSON.parse(localStorage.getItem(ou)||"{}")||{}}catch{return{}}}function Mr(e){let t=W.sessions.find(n=>n.session_id===e);return t&&Number(t.last_read_id||0)>0?Number(t.last_read_id):Number(lu()[e]||0)}function cu(e,t){if(!e||!t)return;let n=lu();if(!(Number(n[e]||0)>=Number(t))){n[e]=Number(t);try{localStorage.setItem(ou,JSON.stringify(n))}catch{}try{let i=Ct("qqbot.chat.session_ui",{session_id:e,last_read_id:Number(t)});i&&i.catch&&i.catch(()=>{})}catch{}}}var du=e=>e<10?"0"+e:""+e;function Ir(e){if(!e)return"";let t=new Date(e*1e3);return du(t.getHours())+":"+du(t.getMinutes())}function Er(e){let t=new Date(e);return t.setHours(0,0,0,0),t.getTime()}function uu(e){if(!e)return"";let t=new Date(e*1e3),n=Er(Date.now()),i=Er(t),s=Math.round((n-i)/864e5);return s===0?Ir(e):s===1?"\u6628\u5929":t.getFullYear()===new Date().getFullYear()?t.getMonth()+1+"\u6708"+t.getDate()+"\u65E5":t.getFullYear()+"/"+(t.getMonth()+1)+"/"+t.getDate()}function pu(e){if(!e)return"";let t=new Date(e*1e3),n=Math.round((Er(Date.now())-Er(t))/864e5),i=Ir(e);return n===0?i:n===1?"\u6628\u5929 "+i:(t.getFullYear()===new Date().getFullYear()?t.getMonth()+1+"\u6708"+t.getDate()+"\u65E5 ":t.getFullYear()+"\u5E74"+(t.getMonth()+1)+"\u6708"+t.getDate()+"\u65E5 ")+i}function vi(e){if(!e)return"";if(e._url)return e._url;let t=e.abs||(e.rel?"/opt/rcbot/media/"+e.rel:"");return t?"/api/fm/preview?path="+encodeURIComponent(t):""}function bi(e){return!e||!e.local?!1:e.exists!==0}function Rr(e){let t=String(e===0?0:e||"").trim();return/^\d+$/.test(t)?"https://qzonestyle.gtimg.cn/qzone/em/e"+t+".gif":""}function Or(e){return e=Number(e)||0,e>=1073741824?(e/1073741824).toFixed(2)+" GB":e>=1048576?(e/1048576).toFixed(1)+" MB":e>=1024?(e/1024).toFixed(0)+" KB":e+" B"}function fu(e){return e=Number(e)||0,e>=1e8?(e/1e8).toFixed(1)+"\u4EBF":e>=1e4?(e/1e4).toFixed(1)+"\u4E07":String(e)}function cs(e){let t=Array.isArray(e&&e.segs)?e.segs:[],n=[],i="",s=!1;for(let a of t){let o=a&&a.type,l=a&&a.data||{};if(o){if(o==="reply"){i=l.text||"[\u5F15\u7528\u4E86\u4E00\u6761\u6D88\u606F]";continue}switch(o){case"text":l.text&&n.push({t:"text",v:l.text});break;case"at":n.push({t:"at",v:l.qq==="all"?"@\u5168\u4F53\u6210\u5458":"@"+(l.name||l.qq||"\u67D0\u4EBA")});break;case"face":n.push({t:"face",v:l.id});break;case"markdown":n.push({t:"text",v:l.content||"[Markdown \u6D88\u606F]"});break;case"image":case"video":case"record":case"file":case"mface":case"json":case"xml":case"forward":case"node":case"location":case"contact":case"music":case"rps":case"dice":case"shake":case"poke":break;default:n.push({t:"unknown",name:o});break}}}let r=Array.isArray(e&&e.media)?e.media:[];return!n.length&&!r.length&&e&&e.text&&n.push({t:"text",v:e.text}),e&&e.role==="system"&&(s=!0),{quote:i,parts:n,system:s}}function hu(e){let t={image:[],video:[],record:[],file:[],face:[],other:[]};for(let n of e||[]){if(!n||!n.local)continue;let i=n.kind==="mface"?"face":n.kind;(t[i]||t.other).push(n)}return t}function Pr(e){return e<=1?"g1":e===2||e===4?"g2":"g3"}function mu(e){let t=Math.max(1,Math.min(60,Number(e)||1));return Math.round(96+t*3.2)}function gu(e){let t=Number(e&&e.bytes||0);return t?Math.max(1,Math.min(60,Math.round(t/3e3))):2}function ds(e){let t=Array.isArray(e&&e.segs)?e.segs:[];for(let n of t)if(n&&n.type==="forward"){let i=(n.data||{}).id;if(i)return String(i)}return""}var bn=null;function Hh(e){for(let t of e||[]){let n=t&&t.type,i=t&&t.data||{};if(n==="json")try{let s=JSON.parse(i.data),r=s.meta||{},a=s.prompt||r.detail&&r.detail.title||r.news&&r.news.title||"\u5361\u7247\u6D88\u606F",o=r.detail&&r.detail.desc||r.desc||"",l=r.news&&r.news.jumpUrl||r.detail&&r.detail.qqdocurl||"";return{kind:"card",title:a,desc:o,jump:l}}catch{return{kind:"card",title:"\u5361\u7247\u6D88\u606F",desc:"",jump:""}}if(n==="xml")return{kind:"card",title:"\u5361\u7247\u6D88\u606F",desc:String(i.data||"").slice(0,90),jump:""};if(n==="forward"||n==="node")return{kind:"forward",title:"\u5408\u5E76\u8F6C\u53D1",desc:"\u70B9\u51FB\u67E5\u770B\u5185\u5BB9",jump:""}}return null}var Kh={props:{m:Object,me:Boolean},data(){return{playing:!1}},computed:{sec(){return gu(this.m)},w(){return mu(this.sec)},src(){return vi(this.m)},bars(){let e=this.sec,t=Math.max(6,Math.min(22,Math.round(e*1.6))),n=[];for(let i=0;i<t;i++)n.push(6+Math.round(Math.abs(Math.sin(i*1.7+e))*12));return n}},beforeUnmount(){this.stop()},methods:{stop(){if(bn)try{bn.pause()}catch{}this.playing=!1},toggle(){if(this.src){if(this.playing){this.stop();return}if(bn)try{bn.pause()}catch{}bn=new Audio(this.src),bn.onended=()=>{this.playing=!1},bn.onerror=()=>{this.playing=!1},bn.play().then(()=>{this.playing=!0}).catch(()=>{this.playing=!1})}}},template:`
  <div class="im-voice" :style="{ width: w + 'px' }" @click="toggle" :title="playing ? '\u505C\u6B62' : '\u64AD\u653E\u8BED\u97F3'">
    <span class="wave">
      <i v-for="(h,i) in bars" :key="i" :style="{ height: h + 'px', opacity: playing ? .95 : .5 }"></i>
    </span>
    <span class="sec">{{ sec }}"</span>
  </div>`},vu={components:{ImVoice:Kh},props:{m:Object,compact:Boolean,showTime:String},data(){return{viewer:"",badAva:!1}},computed:{me(){return au(this.m)},recalled(){return!!this.m.recalled},parsed(){return cs(this.m)},parts(){return this.parsed.parts},quote(){let e=this.m&&this.m.quote;return e&&(e.sender||e.text)?(e.sender?e.sender+"\uFF1A":"")+(e.text||"[\u6D88\u606F]"):this.parsed.quote},media(){return this.m.media||[]},groups(){return hu(this.media)},card(){let e=Hh(this.m.segs);return e&&e.kind==="forward"&&this.m._fwdCount&&(e.desc=this.m._fwdCount+" \u6761\u6D88\u606F"),e},forwardId(){return ds(this.m)},hasMedia(){return!!(this.groups.image.length||this.groups.video.length||this.groups.record.length||this.groups.file.length)},mediaOnly(){return!this.quote&&!this.parts.filter(e=>e.t!=="face").length&&this.hasMedia},name(){return this.m.sender_name||this.m.sender_id||"\u672A\u77E5"},avatar(){if(this.m.sender_avatar)return this.m.sender_avatar;let e=String(this.m.sender_id||"");return/^\d{5,12}$/.test(e)?"https://q1.qlogo.cn/g?b=qq&nk="+e+"&s=100":""},time(){return Ir(this.m.created_at)},recalledBy(){let e=String(this.m&&this.m.recalled_by||"");if(!e)return"";let t=W.msgs.find(n=>String(n.sender_id||"")===e);return t&&t.sender_name||""},recalledTip(){let e=this.recalledBy;return e?"\u7531 "+e+" \u64A4\u56DE":"\u6D88\u606F\u5DF2\u88AB\u64A4\u56DE"},initial(){return String(this.name||"?").trim().slice(0,1)},showAva(){return!!this.avatar&&!this.badAva},canRecall(){return this.me&&!!this.m.msg_id},images(){return this.groups.image.filter(bi)},videos(){return this.groups.video.filter(bi)},voices(){return this.groups.record.filter(bi)},files(){return this.groups.file.filter(bi)}},methods:{faceUrl:Rr,mediaUrl:vi,bytes:Or,gridCls:Pr,mediaAlive:bi,openImg(e){this.viewer=vi(e)},faceErr(e){let t=e&&e.target;t&&(t.style.visibility="hidden")}},template:`
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
  </div>`};var Qh=[{id:"im",title:"\u6D88\u606F",d:"M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-4 4V16H6.5A2.5 2.5 0 014 13.5v-8z"},{id:"contacts",title:"\u8054\u7CFB\u4EBA",d:"M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8a8 8 0 0116 0v1H4v-1z"},{id:"star",title:"\u6536\u85CF",d:"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z"}],bu={components:{ImMessageRow:vu},props:{},data(){return{S:W,rail:"im",railItems:Qh,showJump:!1,dragging:!1,sideWidth:268,badAva:{},menu:null,readAt:0,toastMsg:"",fwd:null,fwdStack:[],sessMenu:null,searchOpen:!1,msgKw:"",busy:""}},computed:{cur(){return ru()},filtered(){let e=(W.keyword||"").trim().toLowerCase();return e?W.sessions.filter(t=>(t.display||"").toLowerCase().includes(e)||String(t.target_id||"").includes(e)):W.sessions},rows(){let e=[],t=0,n="",i=!1;for(let s of W.msgs){if(!s)continue;let r=String(s.text||""),a=s.role==="system"||!(s.segs||[]).length&&r.indexOf("\u64A4\u56DE")>=0,o=s.created_at-t,l=!t||o>300?pu(s.created_at):"";if(a){let p=(r||"\u6709\u4EBA\u64A4\u56DE\u4E86\u4E00\u6761\u6D88\u606F").replace(/^\[/,"").replace(/\]$/,"");e.push({type:"sys",key:"s"+s.id,text:p}),t=s.created_at,n="";continue}let c=String(s.sender_id||s.role||""),d=!l&&c===n&&o<300,u={type:"msg",key:s.id,m:s,compact:d,showTime:l};!i&&this.readAt&&Number(s.id)>this.readAt&&(u.divider=!0,i=!0),e.push(u),t=s.created_at,n=c}return e},total(){return this.cur&&this.cur.msg_count||W.msgs.length}},async mounted(){await su(),await mi(),W.sid&&(await gi(W.sid),this.readAt=Mr(W.sid),this.scheduleRead()),this.$nextTick(()=>this.toBottom(!1)),window.addEventListener("keydown",this.onKey),window.addEventListener("click",this.closeMenu),document.documentElement.style.overflow="hidden"},beforeUnmount(){window.removeEventListener("keydown",this.onKey),window.removeEventListener("click",this.closeMenu),document.documentElement.style.overflow=""},methods:{fmtListTime:uu,fmtNum:fu,partsOf:cs,gridCls:Pr,mediaUrl:vi,faceUrl:Rr,bytes:Or,forwardIdOf:ds,onKey(e){e.key==="Escape"&&(e.stopPropagation(),this.close())},close(){this.$emit("close")},closeMenu(){this.menu=null,this.sessMenu=null},onKwInput(){clearTimeout(this._kwTimer),this._kwTimer=setTimeout(()=>{mi(W.keyword)},350)},toggleSearch(){this.searchOpen=!this.searchOpen,!this.searchOpen&&this.msgKw&&this.onSearch(""),this.$nextTick(()=>{let e=this.$refs.msgSearch;e&&this.searchOpen&&e.focus()})},onSearch(e){let t=String(e||"").trim();this.msgKw=t,t!==W.msgKeyword&&gi(W.sid,t).then(()=>{this.$nextTick(()=>this.toBottom(!1)),this.schedulePendingRefresh()})},async exportSession(e){let t=e&&e.session_id||W.sid;if(this.sessMenu=null,!!t){this.busy="exp";try{let n=await Ct("qqbot.chat.export",{session_id:t}),i=new Blob([JSON.stringify(n,null,2)],{type:"application/json"}),s=document.createElement("a");s.href=URL.createObjectURL(i),s.download="chat-"+String(t).replace(/[^\w-]/g,"_")+"-"+Date.now()+".json",s.click(),setTimeout(()=>URL.revokeObjectURL(s.href),3e3),this.toast("\u5DF2\u5BFC\u51FA\u4F1A\u8BDD\u8BB0\u5F55")}catch(n){this.toast(String(n&&n.message||n))}finally{this.busy=""}}},async clearSession(e){let t=e&&e.session_id||W.sid,n=e?e.display||e.target_id:"\u8FD9\u4E2A\u4F1A\u8BDD";if(this.sessMenu=null,!t||!confirm("\u6E05\u7A7A\u4F1A\u8BDD\u300C"+n+`\u300D\u7684\u5168\u90E8\u804A\u5929\u8BB0\u5F55\uFF1F

\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`))return;let i=confirm(`\u8981\u8FDE\u56FE\u7247/\u89C6\u9891/\u8BED\u97F3\u8FD9\u4E9B\u5A92\u4F53\u6587\u4EF6\u4E00\u8D77\u5220\u6389\u5417\uFF1F

\u786E\u5B9A = \u4E00\u8D77\u5220
\u53D6\u6D88 = \u53EA\u5220\u6587\u5B57\u8BB0\u5F55\uFF08\u5A92\u4F53\u4FDD\u7559\uFF09`);this.busy="clear";try{let s=await Ct("qqbot.chat.clear_session",{session_id:t,with_media:i,confirm:!0});this.toast("\u5DF2\u6E05\u7A7A "+(s&&s.messages||0)+" \u6761\u6D88\u606F"),await mi(),await gi(W.sid,W.msgKeyword)}catch(s){this.toast(String(s&&s.message||s))}finally{this.busy=""}},hasPending(){for(let e of W.msgs)for(let t of e.media||[])if(t&&t.transcode==="pending")return!0;return!1},schedulePendingRefresh(){clearTimeout(this._pendTimer),this.hasPending()&&(this._pendTimer=setTimeout(async()=>{this._pendTimer=null,await Nr(!1),this.schedulePendingRefresh()},6e3))},openSessMenu(e,t){this.sessMenu={x:e.clientX,y:e.clientY,s:t}},async togglePin(e){if(this.sessMenu=null,!!e)try{let t=await Ct("qqbot.chat.session_ui",{session_id:e.session_id,pinned:!e.pinned});e.pinned=t&&typeof t.pinned<"u"?t.pinned:e.pinned?0:1,this.toast(e.pinned?"\u5DF2\u7F6E\u9876":"\u5DF2\u53D6\u6D88\u7F6E\u9876"),await mi()}catch(t){this.toast(String(t&&t.message||t))}},async toggleMute(e){if(this.sessMenu=null,!!e)try{let t=await Ct("qqbot.chat.session_ui",{session_id:e.session_id,muted:!e.muted});e.muted=t&&typeof t.muted<"u"?t.muted:e.muted?0:1,this.toast(e.muted?"\u5DF2\u514D\u6253\u6270":"\u5DF2\u53D6\u6D88\u514D\u6253\u6270")}catch(t){this.toast(String(t&&t.message||t))}},markReadNow(e){if(this.sessMenu=null,!e)return;let t=Mr(e.session_id);t&&Ct("qqbot.chat.session_ui",{session_id:e.session_id,last_read_id:t}).catch(()=>{}),e.unread=0},async openForward(e){if(e){this.fwd&&this.fwdStack.push(this.fwd),this.fwd={id:e,loading:!0,nodes:[],total:0,error:""};try{let t=await Ct("qqbot.chat.forward",{id:e}),n=t&&t.total||0;this.fwd={id:e,loading:!1,nodes:t&&t.nodes||[],total:n,error:""};for(let i of W.msgs)if(ds(i)===e){i._fwdCount=n;break}}catch(t){this.fwd={id:e,loading:!1,nodes:[],total:0,error:String(t&&t.message||t)}}}},backForward(){this.fwd=this.fwdStack.pop()||null},closeForward(){this.fwd=null,this.fwdStack=[]},fwdParts(e){return cs({segs:e&&e.segs||[]}).parts},fwdImgs(e){return(e&&e.media||[]).filter(t=>t.kind==="image"&&t.local)},fwdOther(e){return(e&&e.media||[]).filter(t=>t.kind!=="image"&&t.local)},openCtx(e,t){this.menu={x:e.clientX,y:e.clientY,m:t}},canRecall(e){return!!(e&&e.msg_id&&e.role==="assistant"&&!e.recalled)},copyMsg(e){let t=String(e&&(e.text||(e.segs||[]).map(n=>(n.data||{}).text||"").join(""))||"");try{navigator.clipboard.writeText(t),this.toast("\u5DF2\u590D\u5236")}catch{this.toast("\u590D\u5236\u5931\u8D25\uFF08\u6D4F\u89C8\u5668\u4E0D\u5141\u8BB8\uFF09")}this.menu=null},async doRecall(e){if(this.menu=null,!(!e||!e.msg_id))try{await Ct("qqbot.chat.recall",{msg_id:e.msg_id}),e.recalled=1,this.toast("\u5DF2\u64A4\u56DE")}catch(t){this.toast(String(t&&t.message||t))}},jump(e){let t=String(e||"");if(!t)return;let n=t.replace(/"/g,'\\"'),i=document.querySelector('.rcq-im [data-msgid="'+n+'"]')||document.querySelector('.rcq-im [data-mid="'+n+'"]');if(!i){this.toast("\u88AB\u5F15\u7528\u7684\u6D88\u606F\u4E0D\u5728\u5F53\u524D\u9875");return}i.scrollIntoView({block:"center",behavior:"smooth"}),i.classList.add("im-flash"),setTimeout(()=>i.classList.remove("im-flash"),1200)},toast(e){this.toastMsg=String(e||""),clearTimeout(this._tt),this._tt=setTimeout(()=>{this.toastMsg=""},1800)},scheduleRead(){clearTimeout(this._rt),this._rt=setTimeout(()=>{W.msgs.length&&cu(W.sid,W.msgs[W.msgs.length-1].id)},1200)},avatarOf(e){return e&&e.avatar?e.avatar:""},initialOf(e){return String(e&&(e.display||e.target_id)||"?").trim().slice(0,1)},pick(e){!e||e.session_id===W.sid||(e.unread=0,gi(e.session_id).then(()=>{this.readAt=Mr(e.session_id),this.$nextTick(()=>this.toBottom(!1)),this.scheduleRead(),this.schedulePendingRefresh()}))},toBottom(e=!0){let t=this.$refs.flow;t&&(t.scrollTo({top:t.scrollHeight,behavior:e?"smooth":"auto"}),W.atBottom=!0,this.showJump=!1)},async onScroll(){let e=this.$refs.flow;if(!e)return;let t=e.scrollHeight-e.scrollTop-e.clientHeight<40;if(W.atBottom=t,this.showJump=!t,e.scrollTop<160&&W.hasMore&&!W.loadingMore){let n=e.scrollHeight,i=e.scrollTop;await Nr(!0),this.$nextTick(()=>{let s=this.$refs.flow;s&&(s.scrollTop=s.scrollHeight-n+i)})}},async reload(){await mi(),W.sid&&(await gi(W.sid),this.$nextTick(()=>this.toBottom(!1)))}},template:`
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

      <!-- \u53EA\u8BFB\u680F\uFF1A\u672C\u9875\u53EA\u505A\u6D4F\u89C8\uFF0C\u53D1\u9001\u8BF7\u7528 QQ \u5BA2\u6237\u7AEF -->
      <div class="im-readonly">
        <svg viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg>
        <span>\u53EA\u8BFB\u6A21\u5F0F \xB7 \u672C\u9875\u4EC5\u7528\u4E8E\u6D4F\u89C8\u6D88\u606F\uFF0C\u53D1\u9001\u4E0E\u56DE\u590D\u8BF7\u4F7F\u7528 QQ \u5BA2\u6237\u7AEF</span>
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
  </div>`};var yu="rcq-im-style",Wh=`
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
`;function xu(){if(typeof document>"u"||document.getElementById(yu))return;let e=document.createElement("style");e.id=yu,e.textContent=Wh,document.head.appendChild(e)}var Jh="qqbot",wu="rcq-style",ku="rcq.tab",Br=null,yt=hn({toast:"",toastKind:"",conn:null}),ko=null;function Z(e,t){yt.toast=String(e??""),yt.toastKind=t||"",ko&&clearTimeout(ko),ko=setTimeout(()=>{yt.toast=""},t==="err"?5200:2600)}async function je(e,t){if(!Br||!Br.invoke)throw new Error("\u63D2\u4EF6\u8FD0\u884C\u65F6\u672A\u5C31\u7EEA");return await Br.invoke(e,t||{})}async function we(e,t){let n=await je(e,t);return n&&typeof n=="object"&&"data"in n&&n.data!==null&&n.data!==void 0?n.data:n}function ce(e){return e?String(e&&e.message||e):"\u672A\u77E5\u9519\u8BEF"}var yn=e=>e<10?"0"+e:""+e;function Gh(e){if(!e)return"\u2014";let t=new Date(e*1e3);return t.getMonth()+1+"-"+yn(t.getDate())+" "+yn(t.getHours())+":"+yn(t.getMinutes())}function qu(e){if(!e)return"\u2014";let t=new Date(e*1e3);return t.getFullYear()+"-"+yn(t.getMonth()+1)+"-"+yn(t.getDate())+" "+yn(t.getHours())+":"+yn(t.getMinutes())+":"+yn(t.getSeconds())}function Lr(e){return e==null||e===""||(e=Number(e),isNaN(e))?"\u2014":e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e4?(e/1e4).toFixed(1)+"\u4E07":String(e)}function _o(e){return String(e||"").split(/[,，\s]+/).map(t=>t.trim()).filter(Boolean)}function Cu(e){if(!e)return"";let t=e.abs||(e.rel?"/opt/rcbot/media/"+e.rel:"");return t?"/api/fm/preview?path="+encodeURIComponent(t):""}function Tu(e){return!e||!e.local?!1:e.exists!==0}function _u(e){if(!e)return"";try{let t=nu(0,"M");return t.addData(e),t.make(),t.createSvgTag({cellSize:5,margin:0,scalable:!0})}catch{return""}}var Yh=`
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
`;function Xh(){if(document.getElementById(wu))return;let e=document.createElement("style");e.id=wu,e.textContent=Yh,document.head.appendChild(e)}var Zh={data(){return{S:yt,ov:null,busy:!1,err:"",timer:null}},computed:{acc(){return this.ov&&this.ov.account||{}},ver(){return this.ov&&this.ov.versions||{}},sysinfo(){return this.ov&&this.ov.sys||{}},cpu(){return this.sysinfo.cpu||{}},mem(){return this.sysinfo.memory||{}},cnt(){return this.ov&&this.ov.counters||{}},botst(){return this.ov&&this.ov.bot||null},isSnow(){return(this.ov&&this.ov.backend||"")==="snowluma"},vers(){let e=this.ver;return this.isSnow?[["\u6846\u67B6\u7248\u672C",e.napcat],["QQ \u7248\u672C",e.qq],["OneBot \u7248\u672C",e.webui]]:[["NapCat \u7248\u672C",e.napcat],["QQ \u7248\u672C",e.qq],["WebUI \u7248\u672C",e.webui]]},cpuPct(){let e=parseFloat((this.cpu.usage||{}).system);return isNaN(e)?0:Math.min(100,Math.round(e))},memPct(){let e=parseFloat(this.mem.total),t=parseFloat((this.mem.usage||{}).system);return!e||!t?0:Math.min(100,Math.round(t/e*100))},online(){return!!this.acc.login&&!this.acc.offline}},async mounted(){await this.load(),this.timer=setInterval(()=>this.load(!0),5e3)},beforeUnmount(){this.timer&&clearInterval(this.timer)},methods:{fmtNum:Lr,async load(e){e||(this.busy=!0);try{this.ov=await je("qqbot.nc.overview"),this.err=(this.ov.errors||[]).join("\uFF1B")}catch(t){this.err=ce(t)}finally{this.busy=!1}},dash(e){return 264-264*e/100},accAvatar(e){if(e.avatar)return e.avatar;let t=String(e&&e.uin||"");return/^\d{5,12}$/.test(t)?"https://q1.qlogo.cn/g?b=qq&nk="+t+"&s=100":""}},template:`
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
  </div>`},em={data(){return{S:yt,acc:null,busy:"",err:"",qr:"",qrErr:"",qrBusy:!1,qrOpen:!1,msg:"",be:null,novncUrl:"",novncPw:"",switching:!1}},computed:{login(){return!!(this.acc&&this.acc.login)},isSL(){return this.acc&&this.acc.backend==="snowluma"},beKind(){return this.be&&this.be.kind||this.acc&&this.acc.backend||"napcat"},beOpts(){let e=this.be&&this.be.options||[];return e.length?e:[{value:"napcat",label:"NapCat\uFF08\u539F\u751F\u5B89\u88C5\uFF09"},{value:"snowluma",label:"SnowLuma\uFF08Docker\uFF09"}]},napcatOk(){return(this.beOpts.find(e=>e.value==="napcat")||{}).installed!==!1},ready(){return!!(this.acc&&this.acc.core_ready)},online(){return!!(this.acc&&(this.acc.online||this.acc.connected))},uin(){return this.acc&&this.acc.uin||""},nick(){return this.acc&&this.acc.nick||""},avatar(){if(this.acc&&this.acc.avatar)return this.acc.avatar;let e=this.uin;return/^\d{5,12}$/.test(e)?"https://q1.qlogo.cn/g?b=qq&nk="+e+"&s=100":""},statusText(){if(!this.acc)return"\u672A\u77E5";if(this.online&&this.ready)return"\u5DF2\u767B\u5F55";if(this.acc.login)return"\u5DF2\u767B\u5F55\uFF08\u521D\u59CB\u5316\u4E2D\uFF09";if(this.acc.accepted)return"\u624B\u673A\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u767B\u5F55\u2026";let e=this.acc.state||"";return e==="failed"?"\u542F\u52A8\u5931\u8D25":e==="inactive"||e==="exited"?"\u5DF2\u505C\u6B62":e==="active"||e==="running"?"\u8FD0\u884C\u4E2D\uFF08\u672A\u767B\u5F55\uFF09":e==="absent"?"\u672A\u90E8\u7F72":e||"\u672A\u77E5"},statusCls(){return this.online&&this.ready?"ok":this.acc&&this.acc.state==="failed"?"off":""}},async mounted(){await this.loadBackend(),await this.load(),this.timer=setInterval(()=>this.load(!0),5e3)},beforeUnmount(){this.timer&&clearInterval(this.timer)},methods:{async load(e){e||(this.busy="load");try{this.acc=await we("qqbot.account.info"),this.err=this.acc&&this.acc.error||"",this.qrOpen&&this.acc&&!this.acc.login&&this.pollStatus(0)}catch(t){this.err=ce(t)}finally{this.busy=""}},async loadBackend(){try{this.be=await we("qqbot.backend.get")}catch{this.be=null}},optLabel(e){let t=String(e&&e.label||e&&e.value||"").split("\uFF08")[0];return e&&e.installed===!1?t+"\uFF08\u672A\u5B89\u88C5\uFF09":t},buildNovnc(e){if(!e||!e.novnc_path)return"";let t=this.be&&this.be.snowluma&&this.be.snowluma.public_host||"";return t||(t=location.hostname),(!t||t==="localhost")&&(t="127.0.0.1"),location.protocol+"//"+t+":"+(e.novnc_port||6081)+e.novnc_path},async switchBackend(e){if(e===this.beKind)return;let t=e==="snowluma"?"SnowLuma\uFF08Docker\uFF09":"NapCat\uFF08\u539F\u751F\uFF09";if(confirm("\u5207\u6362\u5230 "+t+`\uFF1F

\u4E24\u5957\u73AF\u5883\u4E92\u4E0D\u5F71\u54CD\uFF0C\u968F\u65F6\u53EF\u4EE5\u518D\u5207\u56DE\u6765\u3002
\u5207\u6362\u540E rcbot \u4F1A\u6539\u8FDE\u53E6\u4E00\u4E2A OneBot \u7AEF\u53E3\u3002`)){this.switching=!0;try{await we("qqbot.backend.set",{kind:e}),Z("\u5DF2\u5207\u6362\u5230 "+t,"ok"),this.qrOpen=!1,this.novncUrl="",await this.loadBackend(),await this.load(!0)}catch(n){Z(ce(n),"err")}finally{this.switching=!1}}},async showQr(){this.qrBusy=!0,this.qr="",this.qrErr="",this.msg="",this.novncUrl="",this.qrOpen=!0;try{let e=await we("qqbot.account.qrcode",{});if(e&&e.login){this.msg="\u5DF2\u7ECF\u767B\u5F55\u4E86\uFF1A"+(e.nick||e.uin),await this.load(!0);return}e&&e.mode==="novnc"?(this.novncUrl=this.buildNovnc(e),this.novncPw=e.novnc_password||"",this.novncUrl||(this.qrErr="\u8FDC\u7A0B\u684C\u9762\u5730\u5740\u6CA1\u62FC\u51FA\u6765\uFF08\u7F3A noVNC \u7AEF\u53E3\u6216\u5BC6\u7801\uFF09"),this.pollStatus(0)):e&&e.qrcode?(this.qr=_u(e.qrcode),this.pollStatus(0)):this.qrErr="\u4E8C\u7EF4\u7801\u8FD8\u6CA1\u51FA\u6765\uFF0C\u7A0D\u540E\u518D\u70B9\u4E00\u6B21"}catch(e){this.qrErr=ce(e)}finally{this.qrBusy=!1}},async refreshQr(){try{let e=await we("qqbot.account.refresh_qrcode",{});e&&e.qrcode&&(this.qr=_u(e.qrcode))}catch(e){this.qrErr=ce(e)}},pollStatus(e){e>100||!this.qrOpen||setTimeout(async()=>{if(this.qrOpen){try{let t=await we("qqbot.account.status",{});if(t&&t.done){this.msg="\u767B\u5F55\u6210\u529F\uFF1A"+(t.nick||t.uin)+"\uFF08"+t.uin+"\uFF09",this.qr="",Z("\u5DF2\u767B\u5F55 "+t.uin,"ok"),await this.load(!0),setTimeout(()=>{this.qrOpen=!1},1200);return}t&&t.accepted&&!t.logged?this.msg="\u624B\u673A\u5DF2\u786E\u8BA4\uFF0C\u6B63\u5728\u767B\u5F55 QQ\u2026":t&&t.logged&&!t.core_ready&&(this.msg="QQ \u5DF2\u767B\u5F55\uFF0C\u6B63\u5728\u521D\u59CB\u5316 NapCat\u2026"),t&&t.error&&(this.msg=t.error)}catch(t){this.msg=ce(t)}this.pollStatus(e+1)}},3e3)},async act(e){this.busy=e;try{let t={start:"\u5DF2\u542F\u52A8",stop:"\u5DF2\u505C\u6B62",restart:"\u5DF2\u91CD\u542F",quick_login:"\u5DF2\u53D1\u8D77\u5FEB\u767B",logout:"\u5DF2\u9000\u51FA\u767B\u5F55"}[e]||"\u5DF2\u6267\u884C";if(e==="logout"&&!confirm("\u9000\u51FA\u767B\u5F55\u4F1A\u6E05\u6389\u672C\u673A\u7684\u767B\u5F55\u6001\uFF0C\u4E0B\u6B21\u8981\u91CD\u65B0\u626B\u7801\u3002\u786E\u5B9A\uFF1F"))return;await je("qqbot.account.action",{action:e}),Z(t,"ok"),this.qrOpen=!1,this.qr="",await this.load(!0)}catch(t){Z(ce(t),"err")}finally{this.busy=""}},closeQr(){this.qrOpen=!1,this.qr="",this.msg="",this.novncUrl=""}},template:`
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
  </div>`},tm={data(){return{S:yt,items:[],stats:null,kind:"",sender:"",kw:"",limit:60,offset:0,hasMore:!1,busy:"",err:"",light:"",lightKind:"",picked:{}}},computed:{kindStats(){let e={};for(let t of(this.stats||{}).items||[])e[t.kind]=t;return e},totalBytes(){return(this.stats||{}).total_bytes||0},totalFiles(){return(this.stats||{}).total_files||0},pickedIds(){return Object.keys(this.picked).filter(e=>this.picked[e]).map(e=>Number(e))},pendingCount(){return this.items.filter(e=>e.transcode==="pending").length}},async mounted(){await this.load()},methods:{fmtFull:qu,fmtNum:Lr,mediaAlive:Tu,bytes(e){return e=Number(e)||0,e>=1073741824?(e/1073741824).toFixed(2)+" G":e>=1048576?(e/1048576).toFixed(1)+" M":e>=1024?(e/1024).toFixed(0)+" K":e+" B"},mediaUrl(e){return Cu(e)},kindLabel(e){return{image:"\u56FE\u7247",video:"\u89C6\u9891",record:"\u8BED\u97F3",face:"\u8868\u60C5",file:"\u6587\u4EF6"}[e]||e||"\u5176\u5B83"},kindIcon(e){return{image:"\u{1F5BC}",video:"\u{1F3AC}",record:"\u{1F3A4}",face:"\u{1F600}",file:"\u{1F4CE}"}[e]||"\u{1F4C4}"},async load(e){this.busy="load";try{let t=await we("qqbot.chat.media_list",{kind:this.kind,sender:this.sender,kw:this.kw,limit:this.limit,offset:e?this.offset:0}),n=t&&t.items||[];this.items=e?this.items.concat(n):n,this.stats=t&&t.stats||this.stats,this.offset=this.items.length,this.hasMore=n.length>=this.limit}catch(t){this.err=ce(t)}finally{this.busy=""}},async reload(){this.offset=0,this.picked={},await this.load(!1)},async purgeAll(){if(confirm(`\u6E05\u7406\u5A92\u4F53\u526F\u672C\uFF1F

\u53EA\u5220\u56FE\u7247/\u8BED\u97F3/\u89C6\u9891\u8FD9\u4E9B\u5A92\u4F53\u6587\u4EF6\uFF0C\u804A\u5929\u8BB0\u5F55\u6587\u5B57\u4E00\u6761\u4E0D\u5220\u3002`)){this.busy="purge";try{let e=await we("qqbot.chat.purge_media",{confirm:!0});Z("\u5DF2\u6E05\u7406 "+(e&&e.files||0)+" \u4E2A\u6587\u4EF6\uFF0C\u91CA\u653E "+this.bytes(e&&e.bytes||0),"ok"),await this.reload()}catch(e){Z(ce(e),"err")}finally{this.busy=""}}},async loadMore(){await this.load(!0)},toggle(e){this.picked[e]=!this.picked[e]},pickAll(){let e=this.items.every(n=>this.picked[n.id]),t={};if(!e)for(let n of this.items)t[n.id]=!0;this.picked=t},open(e){this.lightKind=e.kind,this.light=this.mediaUrl(e)},async transcode(){let e=this.pickedIds.length?this.pickedIds:null;if(!(!e&&!confirm(`\u628A\u5A92\u4F53\u5E93\u91CC\u6240\u6709\u300C\u6D4F\u89C8\u5668\u653E\u4E0D\u4E86\u300D\u7684\u89C6\u9891/\u8BED\u97F3\u8F6C\u6210\u53EF\u64AD\u653E\u683C\u5F0F\uFF1F

\u89C6\u9891\u7F16\u7801\u8F6C\u6362\u6BD4\u8F83\u6162\uFF0C\u8BF7\u52FF\u4E2D\u65AD\u9762\u677F\u3002`))){this.busy="transcode";try{let t=await we("qqbot.chat.media_transcode",e?{ids:e}:{});Z("\u8F6C\u7801\u5B8C\u6210\uFF1A\u6210\u529F "+(t.ok||0)+"\uFF0C\u5931\u8D25 "+(t.failed||0),"ok"),await this.reload()}catch(t){Z(ce(t),"err")}finally{this.busy=""}}},async remove(){let e=this.pickedIds;if(!e.length){Z("\u5148\u52FE\u9009\u8981\u5220\u9664\u7684\u5A92\u4F53","err");return}if(confirm("\u5220\u9664\u9009\u4E2D\u7684 "+e.length+` \u4E2A\u5A92\u4F53\u6587\u4EF6\uFF1F

\u78C1\u76D8\u4E0A\u7684\u6587\u4EF6\u4F1A\u771F\u7684\u5220\u6389\uFF0C\u804A\u5929\u8BB0\u5F55\u91CC\u7684\u4F4D\u7F6E\u4F1A\u53D8\u6210\u300C\u5DF2\u5931\u6548\u300D\u3002`)){this.busy="del";try{let t=await we("qqbot.chat.media_delete",{ids:e,confirm:!0});Z("\u5DF2\u5220\u9664 "+(t.files||0)+" \u4E2A\u6587\u4EF6\uFF0C\u91CA\u653E "+this.bytes(t.bytes||0),"ok"),await this.reload()}catch(t){Z(ce(t),"err")}finally{this.busy=""}}},async reindex(){this.busy="reindex";try{let e=await we("qqbot.chat.media_reindex",{});Z("\u5DF2\u91CD\u5EFA\u7D22\u5F15\uFF1A"+(e.indexed||0)+" \u4E2A\u5A92\u4F53"+(e.cleaned?"\uFF0C\u6E05\u7406\u50F5\u5C38 "+e.cleaned:""),"ok"),await this.reload()}catch(e){Z(ce(e),"err")}finally{this.busy=""}},async repair(){this.busy="repair";try{let e=await we("qqbot.chat.media_repair",{});Z("\u5DF2\u4FEE\u590D "+(e.fixed||0)+" \u6761\u6D88\u606F\u7684\u5A92\u4F53\u5F15\u7528","ok"),await this.reload()}catch(e){Z(ce(e),"err")}finally{this.busy=""}}},template:`
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
  </div>`},nm={data(){return{S:yt,items:[],senders:[],total:0,sender:"",recalled:"",kind:"",kw:"",limit:50,beforeId:0,more:!1,busy:"",err:"",light:"",lightKind:"",showSenders:!1}},computed:{filtersOn(){return!!(this.sender||this.recalled||this.kind||this.kw)},recalledOpts(){return[{v:"",t:"\u5168\u90E8"},{v:"no",t:"\u672A\u64A4\u56DE"},{v:"yes",t:"\u5DF2\u64A4\u56DE"}]},kindOpts(){return[{v:"",t:"\u5168\u90E8"},{v:"text",t:"\u6587\u672C"},{v:"image",t:"\u56FE\u7247"},{v:"video",t:"\u89C6\u9891"},{v:"record",t:"\u8BED\u97F3"},{v:"face",t:"\u8868\u60C5"},{v:"file",t:"\u6587\u4EF6"}]},suggest(){let e=String(this.sender||"").trim().toLowerCase();return e?this.senders.filter(t=>{let n=String(t.sender_id||""),i=String(t.sender_name||"");return n.indexOf(e)>=0||i.toLowerCase().indexOf(e)>=0}).slice(0,8):[]}},async mounted(){await this.loadSenders(),await this.search(!1)},methods:{fmtFull:qu,fmtNum:Lr,mediaAlive:Tu,bytes(e){return e=Number(e)||0,e>=1048576?(e/1048576).toFixed(1)+" M":e>=1024?(e/1024).toFixed(0)+" K":e+" B"},mediaUrl(e){return Cu(e)},kindLabel(e){return{image:"\u56FE\u7247",video:"\u89C6\u9891",record:"\u8BED\u97F3",face:"\u8868\u60C5",file:"\u6587\u4EF6"}[e]||e||"\u5176\u5B83"},async loadSenders(){try{let e=await we("qqbot.chat.senders",{});this.senders=e&&e.items||[]}catch{}},async search(e){this.busy="search";try{let t=await we("qqbot.chat.query",{sender:this.sender,recalled:this.recalled,kind:this.kind,kw:this.kw,limit:this.limit,before_id:e?this.beforeId:0}),n=t&&t.items||[];this.items=e?this.items.concat(n):n,this.total=t&&t.total||this.items.length,this.beforeId=n.length?n[n.length-1].id:0,this.more=n.length>=this.limit}catch(t){this.err=ce(t)}finally{this.busy=""}},async reload(){this.beforeId=0,await this.search(!1)},async loadMore(){await this.search(!0)},pickSender(e){this.sender=e.sender_id||e.sender_name||"",this.showSenders=!1,this.reload()},clearFilters(){this.sender="",this.recalled="",this.kind="",this.kw="",this.reload()},openMedia(e){this.lightKind=e.kind,this.light=this.mediaUrl(e)},kindsOf(e){let t=[];for(let n of e.media||[]){let i=n.kind||"";i&&t.indexOf(i)<0&&t.push(i)}return t}},template:`
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
  </div>`},im={data(){return{S:yt,list:[],def:"",cur:null,busy:"",err:"",dirty:!1}},computed:{isNew(){return!!(this.cur&&this.cur.__new)}},async mounted(){await this.load()},methods:{async load(){try{let e=await we("rcbot.personas");if(this.list=e&&e.items||[],this.def=e&&e.default||"",!this.cur||this.cur.__new)this.cur||this.pick(this.list[0]||null);else{let t=this.list.find(n=>n.id===this.cur.id);t&&!this.dirty&&this.pick(t)}}catch(e){this.err=ce(e)}},pick(e){this.cur=e?Object.assign({},e):null,this.dirty=!1},add(){this.cur={id:"",name:"\u65B0\u4EBA\u683C",prompt:"",__new:!0},this.dirty=!0},async save(){if(!this.cur)return;let e=this.cur;if(!String(e.name||"").trim()){Z("\u4EBA\u683C\u540D\u5B57\u4E0D\u80FD\u4E3A\u7A7A","err");return}this.busy="save";try{let t=await we("rcbot.persona.save",{id:e.__new?"":e.id,name:e.name,prompt:e.prompt});Z("\u5DF2\u4FDD\u5B58","ok"),this.dirty=!1,await this.load(),t&&t.id&&this.pick(this.list.find(n=>n.id===t.id)||null)}catch(t){Z(ce(t),"err")}finally{this.busy=""}},async setDefault(e){this.busy="def"+e.id;try{await je("rcbot.persona.save",{id:e.id,name:e.name,prompt:e.prompt,set_default:!0}),Z("\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u4EBA\u683C","ok"),await this.load()}catch(t){Z(ce(t),"err")}finally{this.busy=""}},async del(e){if(confirm("\u5220\u9664\u4EBA\u683C\u300C"+(e.name||e.id)+"\u300D\uFF1F\u7528\u5230\u5B83\u7684\u4F1A\u8BDD\u4F1A\u56DE\u843D\u5230\u9ED8\u8BA4\u4EBA\u683C\u3002")){this.busy="del"+e.id;try{await je("rcbot.persona.delete",{id:e.id}),Z("\u5DF2\u5220\u9664","ok"),this.cur=null,await this.load()}catch(t){Z(ce(t),"err")}finally{this.busy=""}}}},template:`
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
  </div>`},sm={data(){return{S:yt,list:[],stats:{},defPersona:"",defProvider:"",personas:[],providers:[],cur:null,detail:null,ctx:null,filter:"all",kw:"",busy:"",err:"",limit:60}},computed:{shown(){let e=this.kw.trim().toLowerCase();return this.list.filter(t=>this.filter==="group"&&t.kind!=="group"||this.filter==="private"&&t.kind==="group"?!1:e?((t.display||"")+" "+(t.id||"")+" "+(t.target_id||"")).toLowerCase().indexOf(e)>=0:!0)},usedPct(){let e=this.ctx;return!e||!e.budget?0:Math.min(100,Math.round(e.est_tokens/e.budget*100))},barClass(){return this.usedPct>=90?"max":this.usedPct>=70?"hi":""}},async mounted(){await this.load()},methods:{fmtTime:Gh,fmtNum:Lr,async load(){this.busy="load";try{let e=await we("rcbot.sessions");this.list=e&&e.items||[],this.stats=e&&e.stats||{},this.defPersona=e&&e.default_persona||"",this.defProvider=e&&e.default_provider||"";let t=await we("rcbot.personas");this.personas=t&&t.items||[];let n=await we("rcbot.providers");if(this.providers=n&&n.items||[],this.cur){let i=this.list.find(s=>s.id===this.cur.id);i&&(this.cur=i)}}catch(e){this.err=ce(e)}finally{this.busy=""}},async open(e){this.cur=e,this.busy="open";try{this.detail=await we("rcbot.session.get",{id:e.id,limit:this.limit}),this.ctx=await we("rcbot.context",{id:e.id})}catch(t){Z(ce(t),"err")}finally{this.busy=""}},async reloadDetail(){if(this.cur)try{this.detail=await we("rcbot.session.get",{id:this.cur.id,limit:this.limit}),this.ctx=await we("rcbot.context",{id:this.cur.id})}catch(e){Z(ce(e),"err")}},async patch(e,t){if(this.cur){this.busy="p"+e;try{let n={id:this.cur.id};n[e]=t,await je("rcbot.session.save",n),Z("\u5DF2\u66F4\u65B0","ok"),await this.load(),await this.reloadDetail()}catch(n){Z(ce(n),"err")}finally{this.busy=""}}},async clear(){if(this.cur&&confirm("\u6E05\u7A7A\u300C"+(this.cur.display||this.cur.id)+"\u300D\u7684\u4E0A\u4E0B\u6587\uFF1F\u6D88\u606F\u4F1A\u5220\u6389\uFF0C\u4F1A\u8BDD\u4FDD\u7559\u3002")){this.busy="clear";try{await je("rcbot.session.clear",{id:this.cur.id}),Z("\u4E0A\u4E0B\u6587\u5DF2\u6E05\u7A7A","ok"),await this.load(),await this.reloadDetail()}catch(e){Z(ce(e),"err")}finally{this.busy=""}}},async del(){if(this.cur&&confirm("\u5220\u9664\u4F1A\u8BDD\u300C"+(this.cur.display||this.cur.id)+"\u300D\uFF1F\u6D88\u606F\u548C\u6458\u8981\u4E00\u8D77\u5220\u3002")){this.busy="del";try{await je("rcbot.session.delete",{id:this.cur.id}),Z("\u5DF2\u5220\u9664","ok"),this.cur=null,this.detail=null,this.ctx=null,await this.load()}catch(e){Z(ce(e),"err")}finally{this.busy=""}}},personaName(e){if(!e)return"\u9ED8\u8BA4";let t=this.personas.find(n=>n.id===e);return t?t.name:e},providerName(e){if(!e)return"\u9ED8\u8BA4";let t=this.providers.find(n=>n.id===e);return t?t.label||t.id:e}},template:`
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
  </div>`},rm={data(){return{S:yt,list:[],def:"",cur:null,busy:"",err:"",dirty:!1,test:null,models:[],showKey:!1}},computed:{isNew(){return!!(this.cur&&this.cur.__new)}},async mounted(){await this.load()},methods:{async load(){try{let e=await we("rcbot.providers");if(this.list=e&&e.items||[],this.def=e&&e.default||"",!this.cur)this.pick(this.list[0]||null);else if(!this.cur.__new&&!this.dirty){let t=this.list.find(n=>n.id===this.cur.id);t&&this.pick(t)}}catch(e){this.err=ce(e)}},pick(e){this.cur=e?Object.assign({type:"openai",timeout:120,enable:!0},e):null,this.dirty=!1,this.test=null,this.models=[]},add(){this.cur={id:"",label:"",type:"openai",api_base:"https://api.openai.com/v1",api_key:"",model:"",timeout:120,enable:!0,__new:!0},this.dirty=!0,this.test=null,this.models=[]},async save(){let e=this.cur;if(e){if(!String(e.label||"").trim()){Z("\u7ED9\u63D0\u4F9B\u5546\u8D77\u4E2A\u540D\u5B57","err");return}if(!String(e.api_base||"").trim()){Z("api_base \u4E0D\u80FD\u4E3A\u7A7A","err");return}this.busy="save";try{await je("rcbot.provider.save",{id:e.__new?"":e.id,label:e.label,type:e.type,api_base:e.api_base,api_key:e.api_key,model:e.model,timeout:Number(e.timeout)||120,enable:!!e.enable}),Z("\u5DF2\u4FDD\u5B58","ok"),this.dirty=!1,this.cur=null,await this.load()}catch(t){Z(ce(t),"err")}finally{this.busy=""}}},async setDefault(e){this.busy="def"+e.id;try{await je("rcbot.provider.save",{id:e.id,label:e.label,type:e.type,api_base:e.api_base,api_key:e.api_key,model:e.model,timeout:e.timeout,enable:e.enable,set_default:!0}),Z("\u5DF2\u8BBE\u4E3A\u9ED8\u8BA4\u63D0\u4F9B\u5546","ok"),await this.load()}catch(t){Z(ce(t),"err")}finally{this.busy=""}},async del(e){if(confirm("\u5220\u9664\u63D0\u4F9B\u5546\u300C"+(e.label||e.id)+"\u300D\uFF1F")){this.busy="del"+e.id;try{await je("rcbot.provider.delete",{id:e.id}),Z("\u5DF2\u5220\u9664","ok"),this.cur=null,await this.load()}catch(t){Z(ce(t),"err")}finally{this.busy=""}}},async doTest(e){this.busy="test"+e.id,this.test=null;try{let t=await we("rcbot.provider.test",{id:e.id});this.test=Object.assign({id:e.id},t||{}),Z(t.ok?"\u901A\u4E86\uFF0C"+t.ms+"ms":"\u4E0D\u901A\uFF1A"+(t.error||""),t.ok?"ok":"err")}catch(t){Z(ce(t),"err")}finally{this.busy=""}},async fetchModels(){let e=this.cur;if(!e||e.__new){Z("\u5148\u4FDD\u5B58\u518D\u62C9\u6A21\u578B\u5217\u8868","err");return}this.busy="models";try{let t=await we("rcbot.provider.models",{id:e.id});this.models=t&&(t.items||t.models)||[],this.models.length||Z("\u6CA1\u62C9\u5230\u6A21\u578B","err")}catch(t){Z(ce(t),"err")}finally{this.busy=""}}},template:`
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
  </div>`},am={data(){return{S:yt,items:[],mode:"live",level:"",lines:400,follow:!0,source:"",connected:!1,hint:"",busy:!1,timer:null,err:""}},computed:{filtered(){return this.items}},async mounted(){await this.load(),this.tick()},beforeUnmount(){this.timer&&clearTimeout(this.timer)},methods:{tick(){this.timer&&clearTimeout(this.timer),this.mode==="live"&&this.follow&&(this.timer=setTimeout(async()=>{await this.load(!0),this.tick()},2e3))},async load(e){e||(this.busy=!0);try{let t=await je("qqbot.account.logs",{mode:this.mode,level:this.level,lines:Number(this.lines)||400}),n=t.items.length!==this.items.length;this.items=t.items||[],this.source=t.source,this.connected=!!t.connected,this.hint=t.hint||"",this.err="",n&&this.follow&&this.$nextTick(this.scrollBottom)}catch(t){this.err=ce(t)}finally{this.busy=!1}},scrollBottom(){let e=this.$refs.box;e&&(e.scrollTop=e.scrollHeight)},async switchMode(e){this.mode=e,this.items=[],await this.load(),this.tick()},async setLevel(e){this.level=this.level===e?"":e,await this.load()},async clear(){try{await je("qqbot.account.logs.clear"),this.items=[],Z("\u7F13\u51B2\u5DF2\u6E05\u7A7A","ok")}catch(e){Z(ce(e),"err")}},download(){let e=this.items.map(i=>"["+String(i.level).toUpperCase()+"] "+i.text).join(`
`),t=new Blob([e],{type:"text/plain;charset=utf-8"}),n=document.createElement("a");n.href=URL.createObjectURL(t),n.download="napcat-"+Date.now()+".log",n.click(),setTimeout(()=>URL.revokeObjectURL(n.href),3e3)},lineClass(e){return"rcq-ln rcq-lv-"+(e.level||"info")},lvText(e){return"["+String(e.level||"info").toUpperCase()+"]"}},template:`
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
  </div>`},om={data(){return{S:yt,cfg:null,conn:null,busy:"",err:"",searchQ:"",searchOut:null,tab:"ctx"}},computed:{ctx(){return this.cfg&&this.cfg.context||{}},bot(){return this.cfg&&this.cfg.bot||{}},feats(){return this.cfg&&this.cfg.features||{}},ws(){return this.feats.web_search||{}},vis(){return this.feats.vision||{}}},async mounted(){await this.load()},methods:{async load(){this.busy="load";try{this.cfg=await we("rcbot.config.get"),this.conn=await je("qqbot.conn.get"),this.err=""}catch(e){this.err=ce(e)}finally{this.busy=""}},async saveCtx(){this.busy="ctx";try{await je("rcbot.config.save",{context:{max_tokens:Number(this.ctx.max_tokens)||128e3,max_output_tokens:Number(this.ctx.max_output_tokens)||4096,keep_recent_ratio:Number(this.ctx.keep_recent_ratio)||.15,max_history_messages:Number(this.ctx.max_history_messages)||200,compress_enabled:!!this.ctx.compress_enabled,compress_provider:this.ctx.compress_provider||""}}),Z("\u4E0A\u4E0B\u6587\u8BBE\u7F6E\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(ce(e),"err")}finally{this.busy=""}},async saveBot(){this.busy="bot";try{await je("rcbot.config.save",{bot:{enabled:!!this.bot.enabled,group_need_at:!!this.bot.group_need_at,private_always_reply:!!this.bot.private_always_reply,reply_with_mention:!!this.bot.reply_with_mention,wake_prefix:_o(this.bot.__prefixText!=null?this.bot.__prefixText:(this.bot.wake_prefix||[]).join(",")),allowed_groups:_o(this.bot.__allowText!=null?this.bot.__allowText:(this.bot.allowed_groups||[]).join(",")),blocked_groups:_o(this.bot.__blockText!=null?this.bot.__blockText:(this.bot.blocked_groups||[]).join(",")),rate_limit:{window:Number((this.bot.rate_limit||{}).window)||60,max:Number((this.bot.rate_limit||{}).max)||30}}}),Z("\u89E6\u53D1\u89C4\u5219\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(ce(e),"err")}finally{this.busy=""}},async saveFeat(){this.busy="feat";try{await je("rcbot.config.save",{features:{web_search:{enabled:!!this.ws.enabled,max_results:Number(this.ws.max_results)||5},vision:{enabled:!!this.vis.enabled,max_images:Number(this.vis.max_images)||3}}}),Z("\u80FD\u529B\u5F00\u5173\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(ce(e),"err")}finally{this.busy=""}},async saveConn(){this.busy="conn";try{await je("qqbot.conn.save",{config:{api:this.conn.config.api,timeout:Number(this.conn.config.timeout)||90,napcat:{base:this.conn.config.napcat.base,token:this.conn.config.napcat.token,unit:this.conn.config.napcat.unit}}}),Z("\u8FDE\u63A5\u8BBE\u7F6E\u5DF2\u4FDD\u5B58","ok"),await this.load()}catch(e){Z(ce(e),"err")}finally{this.busy=""}},async testSearch(){let e=this.searchQ.trim();if(e){this.busy="search",this.searchOut=null;try{let t=await we("rcbot.tools.search",{q:e});this.searchOut=t||{}}catch(t){Z(ce(t),"err")}finally{this.busy=""}}}},template:`
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
  </div>`},Su=[{id:"im",label:"\u6D88\u606F",comp:bu,fullscreen:!0},{id:"overview",label:"\u6982\u89C8",comp:Zh},{id:"account",label:"QQ \u8D26\u6237",comp:em},{id:"query",label:"\u67E5\u8BE2",comp:nm},{id:"media",label:"\u5A92\u4F53\u5E93",comp:tm},{id:"persona",label:"\u4EBA\u683C",comp:im},{id:"sessions",label:"\u4F1A\u8BDD\u7BA1\u7406",comp:sm},{id:"providers",label:"\u6A21\u578B\u63D0\u4F9B\u5546",comp:rm},{id:"logs",label:"\u8FD0\u884C\u65E5\u5FD7",comp:am},{id:"settings",label:"\u8BBE\u7F6E",comp:om}],lm={data(){let e="overview";try{let t=localStorage.getItem(ku);t&&Su.some(n=>n.id===t)&&(e=t)}catch{}return{S:yt,tab:e,TABS:Su,conn:null,key:0}},computed:{cur(){return(this.TABS.find(e=>e.id===this.tab)||this.TABS[0]).comp},isFull(){let e=this.TABS.find(t=>t.id===this.tab);return!!(e&&e.fullscreen)},ncOn(){return!!(this.conn&&this.conn.napcat&&this.conn.napcat.ok)},rbOn(){return!!(this.conn&&this.conn.rcbot&&this.conn.rcbot.ok)}},async mounted(){await this.check()},methods:{async check(){try{this.conn=await je("qqbot.conn.get")}catch{}},go(e){this.tab=e;try{localStorage.setItem(ku,e)}catch{}this.check()},onImClose(){this.go("overview")},refresh(){this.key++,this.check()}},template:`
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
  </div>`};function cm(e,t){Xh(),xu(),Br=t,iu(t);let n=Ki(lm),i=()=>{try{n.unmount()}catch{}};return n.mount(e),i}function dm(e){e.__rcPluginV4__=e.__rcPluginV4__||{},e.__rcPluginV4__[Jh]={pages:[{path:"",title:"QQ Bot"}],mount:cm}}typeof window<"u"&&dm(window);})();
