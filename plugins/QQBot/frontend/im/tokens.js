// 消息页（仿 QQ 桌面端）—— 样式与设计 token
//
// ★ 只在这里出现颜色：所有值都从面板下发的 CSS 变量派生，
//   深浅色切换时面板换变量、这里自动跟随，组件里不写裸 hex。
// ★ 整屏用 position:fixed 覆盖面板（方案 A），z-index 900 ——
//   要低于面板自己的 toast（9999），否则提示会被盖住。

export const IM_STYLE_ID = 'rcq-im-style'

export const IM_CSS = `
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

/* ---------------- 左侧 rail ---------------- */
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

/* ---------------- 会话列表 ---------------- */
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
/* 置顶小旗标（QQ 在头像右上角） */
.im-row .pin{position:absolute;right:-3px;top:-3px;width:15px;height:15px;border-radius:50%;
  background:var(--im-self);display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 0 2px var(--im-list)}
.im-row .pin svg{width:9px;height:9px;fill:#fff}
/* 未读：红点 / 数字气泡 */
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

/* ---------------- 聊天区 ---------------- */
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
/* 撤回标记：内容照常显示，只是淡一点 + 一个角标 */
.im-msg.recalled .im-bub{opacity:.62}
.im-msg.recalled .im-grid,.im-msg.recalled .im-video{opacity:.62}
.im-rec-tag{display:inline-block;margin-left:6px;font-size:10.5px;color:#e8a33d;
  border:1px solid #e8a33d;border-radius:999px;padding:0 6px;vertical-align:1px}
.im-meta{font-size:11px;color:var(--im-t3);margin-top:3px;padding:0 2px}

/* 媒体 */
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

/* 悬停操作条 / 右键菜单 / 高亮 / 未读分割 / 引用条 / 轻提示 */
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

/* 合并转发展开抽屉 */
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

/* 聊天区搜索框（会话内搜索） */
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

/* 大图查看 */
.im-viewer{position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.82);display:flex;
  align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.im-viewer img{max-width:100%;max-height:100%;border-radius:8px}
.im-viewer .x{position:absolute;top:16px;right:22px;color:#fff;font-size:26px;cursor:pointer;
  line-height:1;background:none;border:none}
`

export function injectIMStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById(IM_STYLE_ID)) return
  const el = document.createElement('style')
  el.id = IM_STYLE_ID
  el.textContent = IM_CSS
  document.head.appendChild(el)
}
