// QQ Bot 插件前端 —— NapCat + RainCough Bot 统一控制台
//
// 形态约束（对齐 atk / docker 等插件的做法）：
//  · 不自带左侧栏 —— 宿主已有主导航，插件内导航放顶部横向选项卡
//  · 不套外层边框/固定高度 —— 直接铺在面板内容区里
//  · 颜色、圆角、按钮、输入框全走宿主 CSS 变量与 .btn/.input/.switch 等既有类
//  · ctx.invoke 已解包：成功直接返回 result，失败抛异常 → try/catch
import { createApp, reactive } from 'vue'
import qrcode from './qrcode.mjs'
// 消息页（仿 QQ 桌面端）：整屏 overlay，独立样式与数据层
import { IM } from './im/shell.js'
import { injectIMStyle } from './im/tokens.js'
import { setCtx as setIMCtx } from './im/store.js'

const NAME = 'qqbot'
const STYLE_ID = 'rcq-style'
const LS_TAB = 'rcq.tab'

let CTX = null

const S = reactive({ toast: '', toastKind: '', conn: null })

let toastTimer = null
function toast(msg, kind) {
  S.toast = String(msg == null ? '' : msg)
  S.toastKind = kind || ''
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { S.toast = '' }, kind === 'err' ? 5200 : 2600)
}

async function call(iface, params) {
  if (!CTX || !CTX.invoke) throw new Error('插件运行时未就绪')
  return await CTX.invoke(iface, params || {})
}

// rcbot.* 接口统一返回 {ok, data}，这里解包成 data；没有 data 字段就原样返回
async function callData(iface, params) {
  const r = await call(iface, params)
  return (r && typeof r === 'object' && 'data' in r && r.data !== null && r.data !== undefined)
    ? r.data : r
}

function errText(e) {
  if (!e) return '未知错误'
  return String((e && e.message) || e)
}

const p2 = (n) => (n < 10 ? '0' + n : '' + n)
function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return (d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes())
}
function fmtFull(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
    p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds())
}
function fmtNum(n) {
  if (n == null || n === '') return '—'
  n = Number(n)
  if (isNaN(n)) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万'
  return String(n)
}
function splitList(s) {
  return String(s || '').split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
}
// 媒体文件 URL：走面板的文件预览通道（能读任意路径，且 http.ServeFile 支持 Range）
//
// ★ 优先用后端给的绝对路径（m.abs）：媒体根目录是配置项（config.chat.media_dir），
//   在前端硬编码 /opt/rcbot/media 的话，改了配置就全找不到文件了。
function mediaFileUrl(m) {
  if (!m) return ''
  const p = m.abs || (m.rel ? '/opt/rcbot/media/' + m.rel : '')
  if (!p) return ''
  return '/api/fm/preview?path=' + encodeURIComponent(p)
}

// 媒体文件在本机是否还可用（被删/被清过就是 false）。
// false 就不该再去发请求 —— 发了就是一片 404。
function mediaAlive(md) {
  if (!md || !md.local) return false
  return md.exists !== 0
}

function makeQr(text) {
  if (!text) return ''
  try {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    return qr.createSvgTag({ cellSize: 5, margin: 0, scalable: true })
  } catch (e) {
    return ''
  }
}

// ------------------------------------------------------------------ 样式

const CSS = `
.rcq{--t:var(--text);--m:var(--text-muted);--f:var(--text-faint);--bd:var(--border);
 --bd2:var(--border-strong);--sf:var(--surface);--sf2:var(--surface-2);--sf3:var(--surface-3);
 --ac:var(--accent);--acbg:var(--accent-soft);--ok:var(--success);--warn:var(--warning);
 --bad:var(--danger);--r:var(--radius-md);
 color:var(--t);font-size:13px;line-height:1.6;font-family:var(--font)}
.rcq *{box-sizing:border-box}

/* 顶部选项卡（插件内唯一导航） */
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

/* 卡片 */
.rcq-pnl{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);
 padding:14px 16px;margin-bottom:12px}
.rcq-pnl.flat{padding:0}
.rcq-ph{display:flex;align-items:center;gap:8px;margin-bottom:12px;min-height:24px;flex-wrap:wrap}
.rcq-ph b{font-size:13px;font-weight:600}
.rcq-ph .sp{margin-left:auto}
.rcq-sec{border-top:1px solid var(--bd);margin:12px -16px;padding:12px 16px 0}
/* .rcq-pnl.flat 自身 padding 为 0，负边距会把内容顶到边框上（概览的「系统信息」就是），
   这种卡片里的分隔段改成正常内边距，分隔线仍然横贯整张卡 */
.rcq-pnl.flat > .rcq-sec{margin-left:0;margin-right:0;padding:12px 16px 0}

/* 键值 */
.rcq-kv{display:grid;grid-template-columns:88px 1fr;gap:7px 12px;font-size:12.5px;align-items:baseline}
.rcq-kv .k{color:var(--m)}
.rcq-kv .v{color:var(--t);font-family:var(--font-mono);word-break:break-all}
.rcq-fld{display:flex;align-items:baseline;gap:7px;font-size:12.5px;min-width:0}
.rcq-fld .k{color:var(--m);flex:none}
.rcq-fld .v{color:var(--t);font-family:var(--font-mono);word-break:break-all}
.rcq-fld.full{grid-column:1/-1}
.rcq-row2{display:grid;grid-template-columns:1fr 1fr;gap:9px 16px;margin-top:9px}
.rcq-row2 > .full{grid-column:1/-1}

/* 概览三栏 */
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

/* 仪表 */
.rcq-gauges{display:flex;flex-direction:column;gap:12px}
.rcq-gauge{position:relative;display:flex;align-items:center;justify-content:center;
 padding:12px 6px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r)}
.rcq-gauge svg{width:96px;height:96px;display:block}
.rcq-gauge .lbl{position:absolute;inset:0;display:flex;flex-direction:column;
 align-items:center;justify-content:center;pointer-events:none}
.rcq-gauge .lbl b{font-size:17px;font-weight:700;line-height:1.1}
.rcq-gauge .lbl span{font-size:10px;color:var(--m);margin-top:1px}

/* 计数条 */
.rcq-counters{display:grid;grid-template-columns:repeat(5,1fr);background:var(--sf);
 border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;margin-bottom:12px}
.rcq-ct{padding:13px 6px;text-align:center;border-left:1px solid var(--bd)}
.rcq-ct:first-child{border-left:0}
.rcq-ct b{display:block;font-size:23px;font-weight:700;line-height:1.2}
.rcq-ct span{font-size:11px;color:var(--m)}

/* 列表 */
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

/* 二维码 */
.rcq-qr{width:196px;height:196px;background:#fff;border:1px solid var(--bd);
 border-radius:var(--r);padding:9px;display:flex;align-items:center;justify-content:center;flex:none}
.rcq-qr svg{width:100%;height:100%;display:block}
.rcq-qr .ph{color:#999;font-size:12px;text-align:center;padding:0 10px}

/* 日志（NapCat 猫猫日志风格：纯文本行，按级别着色） */
.rcq-log{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);
 padding:11px 13px;font-family:var(--font-mono);font-size:11.5px;line-height:1.85;
 max-height:min(64vh,640px);overflow:auto;white-space:pre-wrap;word-break:break-word}
/* 级别类名一律加 rcq-lv- 前缀：面板全局有 .error{padding:24px;text-align:center}，
   直接写 class="error" 会把日志行搞成居中的大块 */
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

/* 表单 */
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
/* 报错原文可能很长（模型返回的 JSON），两行截断，悬停看全文 */
.rcq-err{color:var(--bad);white-space:normal;word-break:break-word;
 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* 会话详情 */
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

/* ---- 多实例（QQ 账户） ---- */
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


/* ---- 媒体库 ---- */
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

/* ---- 查询 ---- */
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

/* 大图查看 */
.rcq-light{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.82);
 display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.rcq-light img{max-width:100%;max-height:100%;border-radius:8px}
.rcq-light .x{position:absolute;top:16px;right:20px;color:#fff;font-size:24px;
 background:none;border:none;cursor:pointer;line-height:1}

/* 水位条 */
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

/* ---- 角色卡片 ---- */
.cd-row{align-items:center}
.cd-thumb{position:relative;width:46px;height:46px;flex:none}
.cd-thumb .cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  border-radius:8px;opacity:.5}
.cd-thumb .ava{position:relative;width:34px;height:34px;border-radius:8px;object-fit:cover;
  border:2px solid var(--sf);margin:6px;display:block}
.cd-thumb .ava.ph{display:flex;align-items:center;justify-content:center;font-size:15px;
  font-weight:600;color:var(--m);background:var(--sf3)}
.cd-tag{display:inline-block;margin-left:6px;font-size:10px;padding:0 6px;border-radius:999px;
  border:1px solid var(--bd2);color:var(--m);vertical-align:1px}
.cd-tag.draft{border-color:var(--warn);color:var(--warn)}
.cd-preview{position:relative;border:1px solid var(--bd);border-radius:10px;overflow:hidden;
  margin:10px 0;min-height:86px;display:flex;align-items:flex-end;background:var(--sf2)}
.cd-preview .cp-bg{position:absolute;inset:0;background-size:cover;background-position:center;
  opacity:.5}
.cd-preview .cp-body{position:relative;display:flex;align-items:center;gap:10px;padding:10px 12px;
  width:100%}
.cd-preview .cp-ava{width:40px;height:40px;border-radius:8px;object-fit:cover;background:var(--sf3)}
.cd-preview .cp-ava.ph{display:flex;align-items:center;justify-content:center;font-size:16px;
  color:var(--m)}
.cd-preview .cp-name{font-size:14px;font-weight:600}
.cd-preview .cp-tag{font-size:12px;color:var(--m);margin-top:2px}
.cd-tabs{display:flex;gap:4px;margin:10px 0 0;border-bottom:1px solid var(--bd)}
.cd-tabs button{border:none;background:none;padding:7px 12px;font-size:12.5px;color:var(--m);
  cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
.cd-tabs button.on{color:var(--t);border-bottom-color:var(--ac)}
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
.cd-x:hover{background:var(--sf3);color:var(--t)}
.rcq-ta.tall{min-height:140px}
`

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}


// ------------------------------------------------------------------ 概览（仿 NapCat 基础信息）

const Overview = {
  data() { return { S, ov: null, busy: false, err: '', timer: null } },
  computed: {
    acc() { return (this.ov && this.ov.account) || {} },
    ver() { return (this.ov && this.ov.versions) || {} },
    sysinfo() { return (this.ov && this.ov.sys) || {} },
    cpu() { return this.sysinfo.cpu || {} },
    mem() { return this.sysinfo.memory || {} },
    cnt() { return (this.ov && this.ov.counters) || {} },
    botst() { return (this.ov && this.ov.bot) || null },
    // 框架不同，版本区三行的含义不同（NapCat 有 WebUI，SnowLuma 只有 OneBot）
    isSnow() { return ((this.ov && this.ov.backend) || '') === 'snowluma' },
    vers() {
      const v = this.ver
      return this.isSnow
        ? [['框架版本', v.napcat], ['QQ 版本', v.qq], ['OneBot 版本', v.webui]]
        : [['NapCat 版本', v.napcat], ['QQ 版本', v.qq], ['WebUI 版本', v.webui]]
    },
    cpuPct() {
      const v = parseFloat((this.cpu.usage || {}).system)
      return isNaN(v) ? 0 : Math.min(100, Math.round(v))
    },
    memPct() {
      const t = parseFloat(this.mem.total)
      const u = parseFloat((this.mem.usage || {}).system)
      if (!t || !u) return 0
      return Math.min(100, Math.round((u / t) * 100))
    },
    online() { return !!this.acc.login && !this.acc.offline },
  },
  async mounted() {
    // ★ 这里以前有一句 this.loadBackend()，但那是「QQ 账户」页的方法，
    //   概览页没有 → mounted 直接抛 TypeError，ov 永远不加载，
    //   整页停在"未登录/—"，而且 5 秒轮询也没起来（看着像后端挂了）。
    //   概览的框架信息来自 overview 自己的 backend 字段，不需要单独拉。
    await this.load()
    this.timer = setInterval(() => this.load(true), 5000)
  },
  beforeUnmount() { if (this.timer) clearInterval(this.timer) },
  methods: {
    fmtNum,
    async load(silent) {
      if (!silent) this.busy = true
      try {
        this.ov = await call('qqbot.nc.overview')
        this.err = (this.ov.errors || []).join('；')
      } catch (e) {
        this.err = errText(e)
      } finally {
        this.busy = false
      }
    },
    dash(pct) { return 264 - (264 * pct) / 100 },
    // 头像：后端已按 QQ 号兜底拼好，这里再兜一层（后端没给但有号时）
    accAvatar(a) {
      if (a.avatar) return a.avatar
      const uin = String((a && a.uin) || '')
      if (!/^\d{5,12}$/.test(uin)) return ''
      return 'https://q1.qlogo.cn/g?b=qq&nk=' + uin + '&s=100'
    },
  },
  template: `
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
                {{ acc.nick || '未登录' }}
                <span class="rcq-dot" :class="online ? 'on' : 'off'"></span>
              </div>
              <div class="rcq-uin">{{ acc.uin || '—' }}</div>
            </div>
          </div>
          <div class="rcq-sec">
            <div class="rcq-ph" style="margin-bottom:10px"><b>系统信息</b></div>
            <div class="rcq-kv">
              <template v-for="row in vers" :key="row[0]">
                <div class="k">{{ row[0] }}</div><div class="v">{{ row[1] || '—' }}</div>
              </template>
              <div class="k">系统版本</div><div class="v">{{ sysinfo.arch || '—' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="rcq-pnl">
          <div class="rcq-ph"><b>CPU</b><span class="sp"></span>
            <span class="rcq-hint">{{ busy ? '刷新中…' : '' }}</span></div>
          <div class="rcq-fld full"><span class="k">型号</span><span class="v">{{ cpu.model || '—' }}</span></div>
          <div class="rcq-row2">
            <div class="rcq-fld"><span class="k">内核数</span><span class="v">{{ cpu.core || '—' }}</span></div>
            <div class="rcq-fld"><span class="k">主频</span><span class="v">{{ cpu.speed ? cpu.speed + ' GHz' : '—' }}</span></div>
            <div class="rcq-fld"><span class="k">使用率</span><span class="v">{{ (cpu.usage||{}).system || '—' }}%</span></div>
            <div class="rcq-fld"><span class="k">QQ主线程</span><span class="v">{{ (cpu.usage||{}).qq || '—' }}%</span></div>
          </div>
          <div class="rcq-sec">
            <div class="rcq-ph" style="margin-bottom:10px"><b>内存</b></div>
            <div class="rcq-fld full"><span class="k">总量</span><span class="v">{{ mem.total ? mem.total + ' MB' : '—' }}</span></div>
            <div class="rcq-row2">
              <div class="rcq-fld"><span class="k">使用量</span><span class="v">{{ (mem.usage||{}).system ? (mem.usage||{}).system + ' MB' : '—' }}</span></div>
              <div class="rcq-fld"><span class="k">QQ主线程</span><span class="v">{{ (mem.usage||{}).qq ? (mem.usage||{}).qq + ' MB' : '—' }}</span></div>
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
          <div class="lbl"><b>{{ cpuPct }}%</b><span>CPU 占用</span></div>
        </div>
        <div class="rcq-gauge">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--sf3)" stroke-width="9" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--ac)" stroke-width="9"
              stroke-linecap="round" :stroke-dasharray="264" :stroke-dashoffset="dash(memPct)"
              transform="rotate(-90 50 50)" />
          </svg>
          <div class="lbl"><b>{{ memPct }}%</b><span>内存占用</span></div>
        </div>
      </div>
    </div>

    <div class="rcq-counters" v-if="isSnow" style="grid-template-columns:repeat(4,1fr)">
      <div class="rcq-ct"><b>{{ cnt.groups || 0 }}</b><span>群聊</span></div>
      <div class="rcq-ct"><b>{{ cnt.friends || 0 }}</b><span>好友</span></div>
      <div class="rcq-ct"><b>{{ cnt.sessions || 0 }}</b><span>会话</span></div>
      <div class="rcq-ct"><b>{{ cnt.messages || 0 }}</b><span>消息</span></div>
    </div>
    <div class="rcq-counters" v-else>
      <div class="rcq-ct"><b>{{ cnt.configs || 0 }}</b><span>网络配置</span></div>
      <div class="rcq-ct"><b>{{ cnt.httpServers || 0 }}</b><span>HTTP 服务器</span></div>
      <div class="rcq-ct"><b>{{ cnt.httpClients || 0 }}</b><span>HTTP 客户端</span></div>
      <div class="rcq-ct"><b>{{ cnt.wsServers || 0 }}</b><span>WS 服务器</span></div>
      <div class="rcq-ct"><b>{{ cnt.wsClients || 0 }}</b><span>WS 客户端</span></div>
    </div>

    <div class="rcq-pnl">
      <div class="rcq-ph"><b>RainCough Bot</b><span class="sp"></span>
        <span class="rcq-lamp" v-if="botst"><b :class="botst.onebot && botst.onebot.connected ? 'on' : 'off'"></b>
          {{ botst.onebot && botst.onebot.connected ? (isSnow ? '已连 SnowLuma' : '已连 NapCat') : '未连接' }}</span>
        <span class="rcq-lamp" v-else><b class="off"></b>rcbot 未运行</span>
      </div>
      <div class="rcq-row2" style="margin-top:0">
        <div class="rcq-fld"><span class="k">提供商</span><span class="v">{{ (botst && botst.provider) || '—' }}</span></div>
        <div class="rcq-fld"><span class="k">模型</span><span class="v">{{ (botst && botst.provider_model) || '—' }}</span></div>
        <div class="rcq-fld"><span class="k">会话</span><span class="v">{{ botst && botst.stats ? botst.stats.sessions : '—' }} 个 / 消息 {{ botst && botst.stats ? fmtNum(botst.stats.messages) : '—' }} 条</span></div>
        <div class="rcq-fld"><span class="k">上下文</span><span class="v">{{ (botst && botst.context && botst.context.max_tokens) ? (botst.context.max_tokens + ' tokens 窗口') : '—' }}</span></div>
      </div>
      <div class="rcq-fld" style="margin-top:10px" v-if="botst && botst.last_error">
        <span class="k">最近错误</span>
        <span class="v rcq-err" :title="botst.last_error">{{ botst.last_error }}</span>
      </div>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ QQ 账户（多实例）
//
// 一个 QQ 号 = 一个 NapCat 实例 = 一套 systemd 单元。
// 端口：WebUI = 6099+index，OneBot = 6700+2*index（避开 rcbot 的 6710）。

const Accounts = {
  data() {
    return {
      S,
      // 单账户：只有一个 QQ 号
      acc: null,
      busy: '', err: '', qr: '', qrErr: '', qrBusy: false,
      qrOpen: false, msg: '',
      // 后端（napcat / snowluma）与内嵌远程桌面
      be: null, novncUrl: '', novncPw: '', switching: false,
    }
  },
  computed: {
    login() { return !!(this.acc && this.acc.login) },
    // 当前是不是 SnowLuma（扫码要靠 noVNC 远程桌面，不是二维码图片）
    isSL() { return (this.acc && this.acc.backend === 'snowluma') },
    beKind() { return (this.be && this.be.kind) || (this.acc && this.acc.backend) || 'napcat' },
    // 框架下拉项：后端会告诉我们哪个"没装"（比如 NapCat 已被卸载），
    // 没装的就置灰，免得切过去报"服务不存在"
    beOpts() {
      const list = (this.be && this.be.options) || []
      if (list.length) return list
      return [{ value: 'napcat', label: 'NapCat（原生安装）' },
              { value: 'snowluma', label: 'SnowLuma（Docker）' }]
    },
    napcatOk() { return (this.beOpts.find((o) => o.value === 'napcat') || {}).installed !== false },
    ready() { return !!(this.acc && this.acc.core_ready) },
    online() { return !!(this.acc && (this.acc.online || this.acc.connected)) },
    uin() { return (this.acc && this.acc.uin) || '' },
    nick() { return (this.acc && this.acc.nick) || '' },
    avatar() {
      if (this.acc && this.acc.avatar) return this.acc.avatar
      const u = this.uin
      if (!/^\d{5,12}$/.test(u)) return ''
      return 'https://q1.qlogo.cn/g?b=qq&nk=' + u + '&s=100'
    },
    statusText() {
      if (!this.acc) return '未知'
      if (this.online && this.ready) return '已登录'
      if (this.acc.login) return '已登录（初始化中）'
      if (this.acc.accepted) return '手机已确认，正在登录…'
      // 两个后端的 state 词不一样：
      //   NapCat   : active / inactive / failed
      //   SnowLuma : running / exited / absent（容器状态）
      const st = this.acc.state || ''
      if (st === 'failed') return '启动失败'
      if (st === 'inactive' || st === 'exited') return '已停止'
      if (st === 'active' || st === 'running') return '运行中（未登录）'
      if (st === 'absent') return '未部署'
      return st || '未知'
    },
    statusCls() {
      if (this.online && this.ready) return 'ok'
      if (this.acc && this.acc.state === 'failed') return 'off'
      return ''
    },
  },
  async mounted() {
    // ★ 必须先把后端信息拉回来：框架下拉要用 options（哪个装没装），
    //   不拉的话 beOpts 走兜底，"NapCat（未安装）"就不会出现。
    await this.loadBackend()
    await this.load()
    this.timer = setInterval(() => this.load(true), 5000)
  },
  beforeUnmount() { if (this.timer) clearInterval(this.timer) },
  methods: {
    async load(silent) {
      if (!silent) this.busy = 'load'
      try {
        this.acc = await callData('qqbot.account.info')
        this.err = (this.acc && this.acc.error) || ''
        // 登录中就自动刷新二维码区
        if (this.qrOpen && this.acc && !this.acc.login) {
          this.pollStatus(0)
        }
      } catch (e) {
        this.err = errText(e)
      } finally {
        this.busy = ''
      }
    },
    async loadBackend() {
      try { this.be = await callData('qqbot.backend.get') } catch (e) { this.be = null }
    },
    // 下拉里只显示短名（"NapCat（原生安装）" → "NapCat"），没装的加后缀
    optLabel(o) {
      const short = String((o && o.label) || (o && o.value) || '').split('（')[0]
      return (o && o.installed === false) ? short + '（未安装）' : short
    },
    // noVNC 地址：主机名用当前页面的（后端不知道面板对外的 IP），
    // 端口与路径由后端给（含远程桌面密码，打开即自动连）
    buildNovnc(d) {
      if (!d || !d.novnc_path) return ''
      let host = (this.be && this.be.snowluma && this.be.snowluma.public_host) || ''
      if (!host) host = location.hostname
      if (!host || host === 'localhost') host = '127.0.0.1'
      return location.protocol + '//' + host + ':' + (d.novnc_port || 6081) + d.novnc_path
    },
    async switchBackend(k) {
      if (k === this.beKind) return
      const label = k === 'snowluma' ? 'SnowLuma（Docker）' : 'NapCat（原生）'
      if (!confirm('切换到 ' + label + '？\n\n两套环境互不影响，随时可以再切回来。\n'
        + '切换后 rcbot 会改连另一个 OneBot 端口。')) return
      this.switching = true
      try {
        await callData('qqbot.backend.set', { kind: k })
        toast('已切换到 ' + label, 'ok')
        this.qrOpen = false
        this.novncUrl = ''
        await this.loadBackend()
        await this.load(true)
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.switching = false
      }
    },
    // 扫码 —— 两种后端完全不同的路径：
    //   NapCat  : 调 API 拿二维码 URL，用 qrcode.mjs 画成 SVG
    //   SnowLuma: 没有二维码 API，内嵌 noVNC 远程桌面，用户在桌面里扫
    async showQr() {
      this.qrBusy = true
      this.qr = ''
      this.qrErr = ''
      this.msg = ''
      this.novncUrl = ''
      this.qrOpen = true
      try {
        const d = await callData('qqbot.account.qrcode', {})
        if (d && d.login) {
          this.msg = '已经登录了：' + (d.nick || d.uin)
          await this.load(true)
          return
        }
        if (d && d.mode === 'novnc') {
          this.novncUrl = this.buildNovnc(d)
          this.novncPw = d.novnc_password || ''
          if (!this.novncUrl) {
            this.qrErr = '远程桌面地址没拼出来（缺 noVNC 端口或密码）'
          }
          this.pollStatus(0)
        } else if (d && d.qrcode) {
          this.qr = makeQr(d.qrcode)
          this.pollStatus(0)
        } else {
          this.qrErr = '二维码还没出来，稍后再点一次'
        }
      } catch (e) {
        this.qrErr = errText(e)
      } finally {
        this.qrBusy = false
      }
    },
    async refreshQr() {
      try {
        const d = await callData('qqbot.account.refresh_qrcode', {})
        if (d && d.qrcode) this.qr = makeQr(d.qrcode)
      } catch (e) {
        this.qrErr = errText(e)
      }
    },
    // 轮询登录状态 —— 后端只读 NapCat 的 CheckLoginStatus
    pollStatus(n) {
      if (n > 100 || !this.qrOpen) return
      setTimeout(async () => {
        if (!this.qrOpen) return
        try {
          const d = await callData('qqbot.account.status', {})
          if (d && d.done) {
            this.msg = '登录成功：' + (d.nick || d.uin) + '（' + d.uin + '）'
            this.qr = ''
            toast('已登录 ' + d.uin, 'ok')
            await this.load(true)
            setTimeout(() => { this.qrOpen = false }, 1200)
            return
          }
          if (d && d.accepted && !d.logged) {
            this.msg = '手机已确认，正在登录 QQ…'
          } else if (d && d.logged && !d.core_ready) {
            this.msg = 'QQ 已登录，正在初始化 NapCat…'
          }
          if (d && d.error) this.msg = d.error
        } catch (e) {
          this.msg = errText(e)
        }
        this.pollStatus(n + 1)
      }, 3000)
    },
    async act(action) {
      this.busy = action
      try {
        const msg = {
          start: '已启动', stop: '已停止', restart: '已重启',
          quick_login: '已发起快登', logout: '已退出登录',
        }[action] || '已执行'
        if (action === 'logout' && !confirm('退出登录会清掉本机的登录态，下次要重新扫码。确定？')) return
        await call('qqbot.account.action', { action })
        toast(msg, 'ok')
        this.qrOpen = false
        this.qr = ''
        await this.load(true)
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
    closeQr() {
      this.qrOpen = false
      this.qr = ''
      this.msg = ''
      this.novncUrl = ''
    },
  },
  template: `
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-pnl">
      <div class="rcq-ph">
        <b>QQ 账户</b>
        <span class="rcq-hint">单账户模式</span>
        <span class="sp"></span>
        <span class="rcq-hint">框架</span>
        <select class="input" style="width:auto;font-size:12px" :disabled="switching"
          :value="beKind" @change="switchBackend($event.target.value)">
          <option v-for="o in beOpts" :key="o.value" :value="o.value"
            :disabled="o.installed === false">{{ optLabel(o) }}</option>
        </select>
        <button class="btn btn-sm btn-primary" :disabled="qrBusy" @click="showQr()">
          {{ qrBusy ? '准备中…' : (login ? '重新登录' : '扫码登录') }}
        </button>
        <button class="btn btn-sm" :disabled="!!busy" @click="load()">刷新</button>
      </div>

      <div class="rcq-acct" style="padding:16px">
        <img class="rcq-ava" :src="avatar" alt="" v-if="avatar" />
        <div class="rcq-ava" v-else></div>
        <div style="min-width:0;flex:1">
          <div class="rcq-nick">
            {{ nick || (uin ? 'QQ ' + uin : '未登录') }}
            <span class="rcq-pill" :class="statusCls">{{ statusText }}</span>
          </div>
          <div class="rcq-uin">{{ uin || '还没有登录 QQ 账号' }}</div>
        </div>
      </div>

      <div class="rcq-iacts" style="margin-top:12px">
        <button class="btn btn-sm" :disabled="!!busy" @click="act('restart')">重启</button>
        <button v-if="!isSL" class="btn btn-sm" :disabled="!!busy || !login"
          @click="act('quick_login')">快速登录</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="act('stop')">停止</button>
        <button class="btn btn-sm" :disabled="!!busy || !login" @click="act('logout')">退出登录</button>
      </div>

      <!-- ============ 扫码区：两种后端完全不同的交互 ============ -->
      <div v-if="qrOpen" class="rcq-scan">
        <!-- SnowLuma：没有二维码 API，只能内嵌 noVNC 远程桌面 -->
        <template v-if="isSL || novncUrl">
          <div class="rcq-vncbar">
            <b>远程桌面</b>
            <span class="rcq-hint">在下面的画面里用手机 QQ 扫码登录</span>
            <span class="sp"></span>
            <a v-if="novncUrl" :href="novncUrl" target="_blank" rel="noopener"
              class="btn btn-sm">新窗口打开</a>
            <button class="btn btn-sm" @click="closeQr()">关闭</button>
          </div>
          <div v-if="novncUrl" class="rcq-vncwrap">
            <iframe :src="novncUrl" class="rcq-vnc" allow="clipboard-read; clipboard-write"
              referrerpolicy="no-referrer"></iframe>
          </div>
          <div v-else class="rcq-empty2">
            {{ qrErr || (qrBusy ? '正在启动容器与远程桌面…' : '远程桌面还没准备好') }}
          </div>
          <div class="rcq-note" style="display:block;margin-top:8px">
            画面是 SnowLuma 容器里的 QQ 桌面，可以直接用鼠标操作。
            <br />
            <b>如果二维码显示「已过期」，点画面里那个「刷新」按钮</b>；
            首次启动要等 10~30 秒容器起来。
            <br />
            如果这里是空白，说明浏览器不允许内嵌 —— 点右上角「新窗口打开」。
            <template v-if="novncPw">
              <br />远程桌面密码：<code>{{ novncPw }}</code>（新窗口打开时可能要输）
            </template>
          </div>
        </template>

        <!-- NapCat：调 API 拿二维码，画成 SVG -->
        <template v-else>
          <div style="display:flex;gap:14px;align-items:flex-start">
            <div>
              <!-- ★ 必须用 v-html：makeQr 返回的是 SVG 字符串，
                   塞进 <img src> 是渲染不出来的（img 的 src 要的是 URL）。 -->
              <div v-if="qr" v-html="qr" class="rcq-qr" style="width:180px;height:180px"></div>
              <div v-else class="rcq-empty"
                style="width:180px;height:180px;display:flex;align-items:center;justify-content:center;border-radius:8px">
                {{ qrBusy ? '正在获取二维码…' : (qrErr || '二维码还没出来') }}
              </div>
            </div>
            <div style="flex:1;min-width:0">
              <div class="rcq-note" style="display:block">
                请用手机 QQ 扫描下面的二维码授权登录。<br />
                登录成功后会自动识别出账号并连接机器人。
              </div>
              <div v-if="msg" style="margin-top:10px;font-size:12px">{{ msg }}</div>
              <div v-if="qrErr" style="margin-top:10px;font-size:12px;color:var(--bad)">{{ qrErr }}</div>
              <div style="margin-top:12px;display:flex;gap:8px">
                <button class="btn btn-sm" :disabled="qrBusy" @click="refreshQr()">刷新二维码</button>
                <button class="btn btn-sm" @click="closeQr()">关闭</button>
              </div>
            </div>
          </div>
        </template>

        <div v-if="msg && (isSL || novncUrl)" style="margin-top:8px;font-size:12px">{{ msg }}</div>
      </div>

      <div class="rcq-note" style="margin-top:14px">
        本插件是单账户模式：只管理一个 QQ 号。
        <br />
        <template v-if="isSL">
          <b>SnowLuma</b> 把 QQ 整包跑在 Docker 里，登录要在内嵌的远程桌面里扫码
          （QQ 客户端自己画二维码，没有 API 能单独取出来）。
        </template>
        <template v-else>
          登录用 <b>NapCat</b> 自带的二维码接口（和 QQ 客户端官方扫码一致）。
        </template>
        <br />
        换号时点「退出登录」清掉登录态，再重新扫码即可。
        <template v-if="napcatOk">两套框架的开关在上面的「框架」下拉里，随时可以切回。</template>
        <template v-else>本机只装了 SnowLuma（NapCat 已卸载），框架下拉里 NapCat 显示为不可选。</template>
      </div>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 聊天记录
// ------------------------------------------------------------------ 媒体库
const MediaLib = {
  data() {
    return {
      S, items: [], stats: null,
      kind: '', sender: '', kw: '',
      limit: 60, offset: 0, hasMore: false,
      busy: '', err: '', light: '', lightKind: '',
      picked: {},
    }
  },
  computed: {
    kindStats() {
      const m = {}
      for (const s of ((this.stats || {}).items || [])) m[s.kind] = s
      return m
    },
    totalBytes() { return ((this.stats || {}).total_bytes) || 0 },
    totalFiles() { return ((this.stats || {}).total_files) || 0 },
    pickedIds() {
      return Object.keys(this.picked).filter((k) => this.picked[k]).map((k) => Number(k))
    },
    pendingCount() {
      return this.items.filter((x) => x.transcode === 'pending').length
    },
  },
  async mounted() { await this.load() },
  methods: {
    fmtFull, fmtNum,
    mediaAlive,
    bytes(n) {
      n = Number(n) || 0
      if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' G'
      if (n >= 1048576) return (n / 1048576).toFixed(1) + ' M'
      if (n >= 1024) return (n / 1024).toFixed(0) + ' K'
      return n + ' B'
    },
    mediaUrl(m) { return mediaFileUrl(m) },
    kindLabel(k) {
      return { image: '图片', video: '视频', record: '语音', face: '表情', file: '文件' }[k] || (k || '其它')
    },
    kindIcon(k) {
      return { image: '🖼', video: '🎬', record: '🎤', face: '😀', file: '📎' }[k] || '📄'
    },
    async load(append) {
      this.busy = 'load'
      try {
        const d = await callData('qqbot.chat.media_list', {
          kind: this.kind, sender: this.sender, kw: this.kw,
          limit: this.limit, offset: append ? this.offset : 0,
        })
        const items = (d && d.items) || []
        this.items = append ? this.items.concat(items) : items
        this.stats = (d && d.stats) || this.stats
        this.offset = this.items.length
        this.hasMore = items.length >= this.limit
      } catch (e) {
        this.err = errText(e)
      } finally {
        this.busy = ''
      }
    },
    async reload() { this.offset = 0; this.picked = {}; await this.load(false) },
    // 清理媒体副本（原「聊天记录」页的能力，合并到媒体库）
    async purgeAll() {
      if (!confirm('清理媒体副本？\n\n只删图片/语音/视频这些媒体文件，聊天记录文字一条不删。')) return
      this.busy = 'purge'
      try {
        const r = await callData('qqbot.chat.purge_media', { confirm: true })
        toast('已清理 ' + ((r && r.files) || 0) + ' 个文件，释放 ' + this.bytes((r && r.bytes) || 0), 'ok')
        await this.reload()
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
    async loadMore() { await this.load(true) },
    toggle(id) { this.picked[id] = !this.picked[id] },
    pickAll() {
      const all = this.items.every((x) => this.picked[x.id])
      const next = {}
      if (!all) for (const x of this.items) next[x.id] = true
      this.picked = next
    },
    open(m) {
      this.lightKind = m.kind
      this.light = this.mediaUrl(m)
    },
    async transcode() {
      const ids = this.pickedIds.length ? this.pickedIds : null
      if (!ids && !confirm('把媒体库里所有「浏览器放不了」的视频/语音转成可播放格式？\n\n视频编码转换比较慢，请勿中断面板。')) return
      this.busy = 'transcode'
      try {
        const r = await callData('qqbot.chat.media_transcode', ids ? { ids } : {})
        toast('转码完成：成功 ' + (r.ok || 0) + '，失败 ' + (r.failed || 0), 'ok')
        await this.reload()
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
    async remove() {
      const ids = this.pickedIds
      if (!ids.length) { toast('先勾选要删除的媒体', 'err'); return }
      if (!confirm('删除选中的 ' + ids.length + ' 个媒体文件？\n\n磁盘上的文件会真的删掉，聊天记录里的位置会变成「已失效」。')) return
      this.busy = 'del'
      try {
        const r = await callData('qqbot.chat.media_delete', { ids, confirm: true })
        toast('已删除 ' + (r.files || 0) + ' 个文件，释放 ' + this.bytes(r.bytes || 0), 'ok')
        await this.reload()
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
    async reindex() {
      this.busy = 'reindex'
      try {
        const r = await callData('qqbot.chat.media_reindex', {})
        toast('已重建索引：' + (r.indexed || 0) + ' 个媒体'
          + (r.cleaned ? '，清理僵尸 ' + r.cleaned : ''), 'ok')
        await this.reload()
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
    // 修复引用：转码后文件改名了，消息里还指向旧名 → 前端取不到文件
    async repair() {
      this.busy = 'repair'
      try {
        const r = await callData('qqbot.chat.media_repair', {})
        toast('已修复 ' + (r.fixed || 0) + ' 条消息的媒体引用', 'ok')
        await this.reload()
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
  },
  template: `
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-pnl">
      <div class="rcq-flex">
        <div class="rcq-fld"><span class="k">媒体总数</span>
          <span class="v">{{ fmtNum(totalFiles) }} 个</span></div>
        <div class="rcq-fld"><span class="k">占用空间</span>
          <span class="v">{{ bytes(totalBytes) }}</span></div>
        <div class="rcq-fld" v-for="s in (stats || {}).items || []" :key="s.kind">
          <span class="k">{{ kindLabel(s.kind) }}</span>
          <span class="v">{{ s.count }} 个 · {{ bytes(s.bytes) }}</span></div>
        <span class="sp" style="margin-left:auto"></span>
        <button class="btn btn-sm" :disabled="!!busy" @click="reindex">重建索引</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="repair">修复引用</button>
        <button class="btn btn-sm" :disabled="!!busy" @click="transcode">
          {{ busy === 'transcode' ? '转码中…' : '转成可播放格式' }}
        </button>
        <button class="btn btn-sm" :disabled="!!busy || !pickedIds.length" @click="remove">
          删除选中{{ pickedIds.length ? '（' + pickedIds.length + '）' : '' }}
        </button>
        <button class="btn btn-sm" :disabled="!!busy" @click="purgeAll">
          {{ busy === 'purge' ? '清理中…' : '清理媒体副本' }}
        </button>
      </div>
      <div class="rcq-note">
        媒体库里存的是聊天记录里的图片 / 视频 / 语音副本。
        QQ 的视频多是 HEVC、语音是 AMR，浏览器放不了 ——
        点「转成可播放格式」会自动转成 H.264 视频与 mp3 语音。
      </div>
    </div>

    <div class="rcq-pnl">
      <div class="rcq-flex">
        <label class="rcq-fi" style="margin:0">
          <span>类型</span>
          <select class="input" v-model="kind" @change="reload()">
            <option value="">全部</option>
            <option value="image">图片</option>
            <option value="video">视频</option>
            <option value="record">语音</option>
            <option value="face">表情</option>
            <option value="file">文件</option>
          </select>
        </label>
        <label class="rcq-fi" style="margin:0">
          <span>发送者</span>
          <input class="input" v-model="sender" placeholder="QQ 号或昵称"
            @keyup.enter="reload()" />
        </label>
        <label class="rcq-fi" style="margin:0">
          <span>关键词</span>
          <input class="input" v-model="kw" placeholder="文件名" @keyup.enter="reload()" />
        </label>
        <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="reload">筛选</button>
        <button class="btn btn-sm" @click="pickAll()">
          {{ pickedIds.length === items.length && items.length ? '取消全选' : '全选本页' }}
        </button>
      </div>
    </div>

    <div v-if="!items.length" class="rcq-empty2">还没有媒体文件</div>
    <div v-else class="rcq-mlib">
      <div v-for="m in items" :key="m.id" class="rcq-mcard"
        :class="{ on: picked[m.id], gone: !m.exists }">
        <label class="ck" @click.stop>
          <input type="checkbox" :checked="!!picked[m.id]" @change="toggle(m.id)" />
        </label>
        <div class="th" @click="m.exists ? open(m) : null">
          <img v-if="m.exists && (m.kind === 'image' || m.kind === 'face')" :src="mediaUrl(m)"
            loading="lazy" alt="" />
          <!-- preload="metadata"：只取 moov + 首帧，能显示缩略图又不会拉整个视频 -->
          <video v-else-if="m.exists && m.kind === 'video'" :src="mediaUrl(m)" preload="metadata"
            muted playsinline></video>
          <div v-else class="ph">{{ kindIcon(m.kind) }}</div>
          <span v-if="m.transcode === 'pending'" class="rcq-badge warn">转码中</span>
          <span v-else-if="m.transcode === 'failed'" class="rcq-badge bad">格式不支持</span>
          <span v-else-if="!m.exists" class="rcq-badge bad">已丢失</span>
        </div>
        <div class="meta">
          <div class="n">{{ kindLabel(m.kind) }} · {{ bytes(m.bytes) }}</div>
          <div class="s">{{ m.sender_name || m.sender_id || '未知' }}</div>
          <div class="t">{{ fmtFull(m.created_at) }}</div>
        </div>
        <a class="dl" v-if="m.exists" :href="mediaUrl(m)" download>下载</a>
        <span class="dl gone" v-else>文件已丢失</span>
      </div>
    </div>
    <div v-if="hasMore" class="rcq-loadmore" @click="loadMore()">加载更多</div>

    <div v-if="light" class="rcq-light" @click="light = ''">
      <button class="x" @click.stop="light = ''">×</button>
      <img v-if="lightKind === 'image' || lightKind === 'face'" :src="light" alt="" />
      <video v-else-if="lightKind === 'video'" :src="light" controls autoplay
        style="max-width:100%;max-height:100%"></video>
      <audio v-else-if="lightKind === 'record'" :src="light" controls autoplay
        style="width:min(520px,90vw)"></audio>
      <a v-else :href="light" download style="color:#fff">下载文件</a>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 查询
const Query = {
  data() {
    return {
      S, items: [], senders: [], total: 0,
      sender: '', recalled: '', kind: '', kw: '',
      limit: 50, beforeId: 0, more: false,
      busy: '', err: '', light: '', lightKind: '',
      showSenders: false,
    }
  },
  computed: {
    filtersOn() {
      return !!(this.sender || this.recalled || this.kind || this.kw)
    },
    // 撤回状态：'' 全部 / 'yes' 已撤回 / 'no' 未撤回
    recalledOpts() {
      return [
        { v: '', t: '全部' },
        { v: 'no', t: '未撤回' },
        { v: 'yes', t: '已撤回' },
      ]
    },
    kindOpts() {
      return [
        { v: '', t: '全部' },
        { v: 'text', t: '文本' },
        { v: 'image', t: '图片' },
        { v: 'video', t: '视频' },
        { v: 'record', t: '语音' },
        { v: 'face', t: '表情' },
        { v: 'file', t: '文件' },
      ]
    },
    suggest() {
      const s = String(this.sender || '').trim().toLowerCase()
      if (!s) return []
      return this.senders.filter((x) => {
        const id = String(x.sender_id || '')
        const nm = String(x.sender_name || '')
        return id.indexOf(s) >= 0 || nm.toLowerCase().indexOf(s) >= 0
      }).slice(0, 8)
    },
  },
  async mounted() {
    await this.loadSenders()
    await this.search(false)
  },
  methods: {
    fmtFull, fmtNum,
    mediaAlive,
    bytes(n) {
      n = Number(n) || 0
      if (n >= 1048576) return (n / 1048576).toFixed(1) + ' M'
      if (n >= 1024) return (n / 1024).toFixed(0) + ' K'
      return n + ' B'
    },
    mediaUrl(m) { return mediaFileUrl(m) },
    kindLabel(k) {
      return { image: '图片', video: '视频', record: '语音', face: '表情', file: '文件' }[k] || (k || '其它')
    },
    async loadSenders() {
      try {
        const d = await callData('qqbot.chat.senders', {})
        this.senders = (d && d.items) || []
      } catch (e) { /* 补全拿不到不影响查询 */ }
    },
    async search(append) {
      this.busy = 'search'
      try {
        const d = await callData('qqbot.chat.query', {
          sender: this.sender,
          recalled: this.recalled,
          kind: this.kind,
          kw: this.kw,
          limit: this.limit,
          before_id: append ? this.beforeId : 0,
        })
        const items = (d && d.items) || []
        this.items = append ? this.items.concat(items) : items
        this.total = (d && d.total) || this.items.length
        this.beforeId = items.length ? items[items.length - 1].id : 0
        this.more = items.length >= this.limit
      } catch (e) {
        this.err = errText(e)
      } finally {
        this.busy = ''
      }
    },
    async reload() { this.beforeId = 0; await this.search(false) },
    async loadMore() { await this.search(true) },
    pickSender(x) {
      this.sender = x.sender_id || x.sender_name || ''
      this.showSenders = false
      this.reload()
    },
    clearFilters() {
      this.sender = ''; this.recalled = ''; this.kind = ''; this.kw = ''
      this.reload()
    },
    openMedia(m) {
      this.lightKind = m.kind
      this.light = this.mediaUrl(m)
    },
    // 这条消息里有哪些媒体类型（用于结果行上的标签）
    kindsOf(m) {
      const out = []
      for (const md of (m.media || [])) {
        const k = md.kind || ''
        if (k && out.indexOf(k) < 0) out.push(k)
      }
      return out
    },
  },
  template: `
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-pnl">
      <div class="rcq-flex" style="align-items:flex-end;flex-wrap:wrap;gap:8px">
        <label class="rcq-fi" style="margin:0;position:relative">
          <span>QQ 用户</span>
          <input class="input" v-model="sender" placeholder="QQ 号或昵称"
            @focus="showSenders = true" @keyup.enter="reload()" />
          <div v-if="showSenders && suggest.length" class="rcq-sugg">
            <div v-for="x in suggest" :key="x.sender_id" class="rcq-sugg-i"
              @click="pickSender(x)">
              <img v-if="x.avatar" :src="x.avatar" alt="" />
              <b>{{ x.sender_name || x.sender_id }}</b>
              <span>{{ x.sender_id }}</span>
              <i>{{ x.c }} 条</i>
            </div>
          </div>
        </label>

        <label class="rcq-fi" style="margin:0">
          <span>撤回状态</span>
          <select class="input" v-model="recalled" @change="reload()">
            <option v-for="o in recalledOpts" :key="o.v" :value="o.v">{{ o.t }}</option>
          </select>
        </label>

        <label class="rcq-fi" style="margin:0">
          <span>消息类型</span>
          <select class="input" v-model="kind" @change="reload()">
            <option v-for="o in kindOpts" :key="o.v" :value="o.v">{{ o.t }}</option>
          </select>
        </label>

        <label class="rcq-fi" style="margin:0">
          <span>关键词</span>
          <input class="input" v-model="kw" placeholder="消息内容" @keyup.enter="reload()" />
        </label>

        <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="reload">
          {{ busy === 'search' ? '查询中…' : '查询' }}
        </button>
        <button class="btn btn-sm" v-if="filtersOn" @click="clearFilters">清空条件</button>
      </div>
      <div class="rcq-note">
        各个条件可以叠加使用 —— 比如「查某个 QQ 号的、已撤回的视频」。
        撤回状态、消息类型、QQ 用户、关键词是「与」的关系。
      </div>
    </div>

    <div class="rcq-pnl" v-if="items.length">
      <div class="rcq-flex">
        <span class="rcq-hint">命中 {{ fmtNum(total) }} 条</span>
      </div>
    </div>

    <div v-if="!items.length && !busy" class="rcq-empty2">
      没有符合条件的消息
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
          <span class="rcq-badge" v-if="m.recalled">已撤回</span>
          <span class="rcq-badge" v-for="k in kindsOf(m)" :key="k">{{ kindLabel(k) }}</span>
          <span class="rcq-badge plain" v-if="m.kind === 'group'">群 {{ m.target_id }}</span>
          <span class="rcq-badge plain" v-else>私聊 {{ m.target_id }}</span>
        </div>
        <div class="bd">
          <span v-if="m.text && m.text !== '[一条消息被撤回]'">{{ m.text }}</span>
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
                {{ md.name || (md.kind + ' 文件') }}
              </a>
              <span v-else class="rcq-note">[{{ md.kind }} 已失效]</span>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div v-if="more" class="rcq-loadmore" @click="loadMore()">加载更多</div>

    <div v-if="light" class="rcq-light" @click="light = ''">
      <button class="x" @click.stop="light = ''">×</button>
      <img v-if="lightKind === 'image' || lightKind === 'face'" :src="light" alt="" />
      <video v-else-if="lightKind === 'video'" :src="light" controls autoplay
        style="max-width:100%;max-height:100%"></video>
      <audio v-else-if="lightKind === 'record'" :src="light" controls autoplay
        style="width:min(520px,90vw)"></audio>
      <a v-else :href="light" download style="color:#fff">下载文件</a>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 角色卡片

const Cards = {
  data() {
    return {
      S, list: [], def: '', cur: null, busy: '', err: '', dirty: false,
      section: 'basic', providers: [],
    }
  },
  computed: {
    isNew() { return !!(this.cur && this.cur.__new) },
    // 预览用的气泡背景色（主题色 / 气泡色）
    themeColor() { return (this.cur && this.cur.style && this.cur.style.color) || '' },
    provName(pid) {
      const p = this.providers.find((x) => x.id === pid)
      return p ? (p.name || p.id) : (pid || '（跟随账号默认）')
    },
  },
  async mounted() {
    await this.load()
    try {
      const p = await callData('rcbot.providers')
      this.providers = (p && p.items) || []
    } catch (e) { /* 没有提供商也不影响编辑 */ }
  },
  methods: {
    fmtNum,
    cloneDeep(o) { return JSON.parse(JSON.stringify(o || {})) },
    async load() {
      this.busy = 'load'
      try {
        const d = await callData('rcbot.cards')
        this.list = (d && d.items) || []
        this.def = (d && d.default) || ''
        if (!this.cur || this.cur.__new) {
          if (!this.cur && this.list.length) this.pick(this.list[0])
        } else {
          const same = this.list.find((x) => x.id === this.cur.id)
          if (same && !this.dirty) this.pick(same)
        }
      } catch (e) { this.err = errText(e) } finally { this.busy = '' }
    },
    pick(c) {
      this.cur = c ? this.cloneDeep(c) : null
      this.dirty = false
    },
    add() {
      this.cur = {
        schema: 2, id: '', version: 1, status: 'draft',
        name: '新角色', alias: [], tagline: '', avatar: '', cover: '', portrait: '',
        prompt: '', greetings: [], examples: [], lorebook: [], taboos: [],
        style: { temperature: 0.8, max_tokens: 512, color: '' },
        model: { provider_id: '', model: '' },
        context: { keep_rounds: 20 },
        __new: true,
      }
      this.dirty = true
    },
    // ---------------- 数组类字段的编辑辅助
    addGreeting() { if (this.cur) { this.cur.greetings = this.cur.greetings || []; this.cur.greetings.push('') } },
    rmGreeting(i) { if (this.cur && this.cur.greetings) this.cur.greetings.splice(i, 1) },
    addExample() {
      if (!this.cur) return
      this.cur.examples = this.cur.examples || []
      this.cur.examples.push({ user: '', assistant: '' })
    },
    rmExample(i) { if (this.cur && this.cur.examples) this.cur.examples.splice(i, 1) },
    addLore() {
      if (!this.cur) return
      this.cur.lorebook = this.cur.lorebook || []
      this.cur.lorebook.push({ keys: [], content: '' })
    },
    rmLore(i) { if (this.cur && this.cur.lorebook) this.cur.lorebook.splice(i, 1) },
    loreKeys(l) { return (l.keys || []).join('、') },
    setLoreKeys(l, v) { l.keys = String(v || '').split(/[、,，\s]+/).filter(Boolean) },
    taboosText() { return (this.cur && this.cur.taboos || []).join('\n') },
    setTaboosText(v) { if (this.cur) this.cur.taboos = String(v || '').split('\n').map((x) => x.trim()).filter(Boolean) },
    // ---------------- 保存 / 其它操作
    async save() {
      if (!this.cur) return
      const c = this.cloneDeep(this.cur)
      if (!String(c.name || '').trim()) { toast('角色名字不能为空', 'err'); return }
      delete c.__new
      this.busy = 'save'
      try {
        const r = await callData('rcbot.card.save', { card: c })
        toast('已保存', 'ok')
        this.dirty = false
        this.cur = null
        await this.load()
        if (r && r.id) this.pick(this.list.find((x) => x.id === r.id) || null)
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async setDefault(c) {
      this.busy = 'def' + c.id
      try {
        const card = this.cloneDeep(c)
        card.status = 'published'
        await callData('rcbot.card.save', { card, set_default: true })
        toast('已设为默认角色', 'ok')
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async cloneCard(c) {
      this.busy = 'clone' + c.id
      try {
        const r = await callData('rcbot.card.clone', { id: c.id })
        toast('已复制一份', 'ok')
        await this.load()
        if (r && r.id) this.pick(this.list.find((x) => x.id === r.id) || null)
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async del(c) {
      if (!confirm('删除角色卡片「' + (c.name || c.id) + '」？\n\n用到它的会话会回落到默认角色。')) return
      this.busy = 'del' + c.id
      try {
        await callData('rcbot.card.delete', { id: c.id })
        toast('已删除', 'ok')
        if (this.cur && this.cur.id === c.id) this.cur = null
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async exportJson(c) {
      try {
        const d = await callData('rcbot.card.export', { id: c.id })
        const blob = new Blob([(d && d.json) || JSON.stringify(c, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'card-' + String(c.name || c.id).replace(/[^\w一-龥-]/g, '_') + '.json'
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 3000)
        toast('已导出卡片 JSON', 'ok')
      } catch (e) { toast(errText(e), 'err') }
    },
    importJson() {
      const inp = document.createElement('input')
      inp.type = 'file'
      inp.accept = 'application/json,.json'
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]
        if (!f) return
        try {
          const text = await f.text()
          const r = await callData('rcbot.card.import', { json: text })
          toast('已导入：' + ((r && r.name) || '角色卡片'), 'ok')
          await this.load()
          if (r && r.id) this.pick(this.list.find((x) => x.id === r.id) || null)
        } catch (e) { toast(errText(e), 'err') }
      }
      inp.click()
    },
  },
  template: `
  <div class="rcq-split">
    <!-- 左：卡片列表 -->
    <div class="rcq-pnl flat">
      <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
        <b>角色卡片</b><span class="sp"></span>
        <button class="btn btn-sm" @click="importJson">导入</button>
        <button class="btn btn-sm btn-primary" @click="add">新建</button>
      </div>
      <div class="rcq-list">
        <div class="rcq-row click cd-row" v-for="c in list" :key="c.id"
          :class="{ on: cur && cur.id === c.id }" @click="pick(c)">
          <div class="cd-thumb">
            <img v-if="c.cover" :src="c.cover" class="cover" alt="" />
            <img v-if="c.avatar" :src="c.avatar" class="ava" alt="" />
            <span v-else class="ava ph">{{ (c.name || '?').slice(0, 1) }}</span>
          </div>
          <div class="main">
            <div class="t">
              {{ c.name || '未命名' }}
              <span class="cd-tag" v-if="c.id === def">默认</span>
              <span class="cd-tag draft" v-if="c.status !== 'published'">草稿</span>
            </div>
            <div class="d">{{ c.tagline || ('v' + (c.version || 1) + ' · ' + (c.prompt || '').slice(0, 30)) }}</div>
          </div>
        </div>
        <div v-if="!list.length" class="rcq-empty"><b>☺</b>还没有角色卡片，点「新建」加一个</div>
      </div>
    </div>

    <!-- 右：卡片编辑 -->
    <div class="rcq-pnl" v-if="cur">
      <div class="rcq-ph">
        <b>{{ isNew ? '新建角色卡片' : '编辑角色卡片' }}</b><span class="sp"></span>
        <span class="rcq-hint" v-if="dirty">有未保存的修改</span>
        <button class="btn btn-sm" @click="exportJson(cur)">导出</button>
        <button class="btn btn-sm" @click="cloneCard(cur)">复制一份</button>
        <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="save">
          {{ busy === 'save' ? '保存中…' : '保存' }}
        </button>
      </div>

      <!-- 预览 -->
      <div class="cd-preview">
        <div class="cp-bg" :style="cur.cover ? { backgroundImage: 'url(' + cur.cover + ')' } : {}"></div>
        <div class="cp-body">
          <img v-if="cur.avatar" :src="cur.avatar" class="cp-ava" alt="" />
          <span v-else class="cp-ava ph">{{ (cur.name || '?').slice(0, 1) }}</span>
          <div class="cp-info">
            <div class="cp-name">{{ cur.name || '未命名' }}</div>
            <div class="cp-tag">{{ cur.tagline || '（还没有简介）' }}</div>
          </div>
        </div>
      </div>

      <div class="cd-tabs">
        <button :class="{ on: section === 'basic' }" @click="section = 'basic'">形象</button>
        <button :class="{ on: section === 'content' }" @click="section = 'content'">内容</button>
        <button :class="{ on: section === 'behavior' }" @click="section = 'behavior'">行为</button>
      </div>

      <!-- 形象 -->
      <div class="rcq-form" v-if="section === 'basic'">
        <label class="rcq-fi wide"><span>名称</span>
          <input class="input" v-model="cur.name" @input="dirty = true" placeholder="例如：雨咯" />
        </label>
        <label class="rcq-fi wide"><span>一句话简介</span>
          <input class="input" v-model="cur.tagline" @input="dirty = true"
            placeholder="列表页显示的那句话" />
        </label>
        <label class="rcq-fi wide"><span>封面图 URL</span>
          <input class="input" v-model="cur.cover" @input="dirty = true"
            placeholder="https://… 建议 16:9" />
        </label>
        <label class="rcq-fi wide"><span>头像 URL</span>
          <input class="input" v-model="cur.avatar" @input="dirty = true" placeholder="https://…" />
        </label>
        <label class="rcq-fi wide"><span>立绘 URL</span>
          <input class="input" v-model="cur.portrait" @input="dirty = true"
            placeholder="https://… 建议 3:4" />
        </label>
        <label class="rcq-fi"><span>状态</span>
          <select class="input" v-model="cur.status" @change="dirty = true">
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
        </label>
        <label class="rcq-fi"><span>版本</span>
          <input class="input" v-model.number="cur.version" @input="dirty = true" type="number" min="1" />
        </label>
      </div>

      <!-- 内容 -->
      <div class="rcq-form" v-if="section === 'content'">
        <label class="rcq-fi wide"><span>系统提示词</span>
          <textarea class="rcq-ta tall" v-model="cur.prompt" @input="dirty = true"
            placeholder="描述它的身份、语气、边界。例如：你叫小雨，说话简短自然，不用敬语，不主动提自己是 AI。"></textarea>
        </label>

        <div class="cd-blk">
          <div class="cd-blk-h"><b>开场白</b>
            <button class="btn btn-sm" @click="addGreeting">添加一条</button></div>
          <div class="cd-item" v-for="(g, i) in cur.greetings" :key="'g' + i">
            <textarea class="rcq-ta" v-model="cur.greetings[i]" @input="dirty = true"
              placeholder="进入会话时随机说的一句话"></textarea>
            <button class="cd-x" title="删除" @click="rmGreeting(i)">×</button>
          </div>
          <div class="rcq-hint" v-if="!(cur.greetings || []).length">还没有开场白</div>
        </div>

        <div class="cd-blk">
          <div class="cd-blk-h"><b>示例对话</b>
            <button class="btn btn-sm" @click="addExample">添加一组</button></div>
          <div class="cd-item col" v-for="(ex, i) in cur.examples" :key="'e' + i">
            <div class="cd-row2">
              <input class="input" v-model="cur.examples[i].user" @input="dirty = true" placeholder="用户说" />
              <input class="input" v-model="cur.examples[i].assistant" @input="dirty = true" placeholder="角色回" />
              <button class="cd-x" title="删除" @click="rmExample(i)">×</button>
            </div>
          </div>
          <div class="rcq-hint" v-if="!(cur.examples || []).length">还没有示例</div>
        </div>

        <div class="cd-blk">
          <div class="cd-blk-h"><b>世界书</b>
            <button class="btn btn-sm" @click="addLore">添加一条</button></div>
          <div class="cd-item col" v-for="(l, i) in cur.lorebook" :key="'l' + i">
            <div class="cd-row2">
              <input class="input" :value="loreKeys(l)" @input="setLoreKeys(l, $event.target.value); dirty = true"
                placeholder="触发关键词（顿号分隔）" />
              <button class="cd-x" title="删除" @click="rmLore(i)">×</button>
            </div>
            <textarea class="rcq-ta" v-model="cur.lorebook[i].content" @input="dirty = true"
              placeholder="这条背景设定"></textarea>
          </div>
          <div class="rcq-hint" v-if="!(cur.lorebook || []).length">还没有世界书条目</div>
        </div>

        <label class="rcq-fi wide"><span>禁则（每行一条）</span>
          <textarea class="rcq-ta" :value="taboosText()" @input="setTaboosText($event.target.value); dirty = true"
            placeholder="不要说的话、 不要做的事"></textarea>
        </label>
      </div>

      <!-- 行为 -->
      <div class="rcq-form" v-if="section === 'behavior'">
        <label class="rcq-fi wide"><span>模型提供商</span>
          <select class="input" v-model="cur.model.provider_id" @change="dirty = true">
            <option value="">（跟随账号默认）</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name || p.id }}</option>
          </select>
        </label>
        <label class="rcq-fi wide"><span>模型名</span>
          <input class="input" v-model="cur.model.model" @input="dirty = true" placeholder="留空 = 用提供商的默认模型" />
        </label>
        <label class="rcq-fi"><span>温度</span>
          <input class="input" type="number" step="0.1" min="0" max="2"
            v-model.number="cur.style.temperature" @input="dirty = true" />
        </label>
        <label class="rcq-fi"><span>最大 tokens</span>
          <input class="input" type="number" step="64" min="64"
            v-model.number="cur.style.max_tokens" @input="dirty = true" />
        </label>
        <label class="rcq-fi"><span>上下文轮数</span>
          <input class="input" type="number" min="1"
            v-model.number="cur.context.keep_rounds" @input="dirty = true" />
        </label>
        <label class="rcq-fi"><span>气泡色</span>
          <input class="input" v-model="cur.style.color" @input="dirty = true" placeholder="#12b7f5" />
        </label>
      </div>

      <div class="rcq-flex" style="margin-top:12px">
        <button class="btn btn-sm" @click="setDefault(cur)">设为默认角色</button>
        <button class="btn btn-sm" style="color:var(--err,#f5534f)"
          :disabled="busy === 'del' + cur.id" @click="del(cur)">删除</button>
        <span class="rcq-hint" style="margin-left:auto">卡片 v{{ cur.version || 1 }} · {{ cur.status === 'published' ? '已发布' : '草稿' }}</span>
      </div>
      <div class="rcq-note">
        角色卡片是「定义」，账号和会话只引用它 —— 改卡片不会影响已经产生的历史会话。
        想给别的机器人用，直接「导出」成 JSON 发过去，对方「导入」即可。
      </div>
    </div>

    <div class="rcq-pnl" v-else>
      <div class="rcq-empty"><b>☺</b>左边选一张卡片，或者新建一张</div>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 会话管理

const Sessions = {
  data() {
    return {
      S, list: [], stats: {}, defPersona: '', defProvider: '',
      personas: [], providers: [], cur: null, detail: null, ctx: null,
      filter: 'all', kw: '', busy: '', err: '', limit: 60,
    }
  },
  computed: {
    shown() {
      const k = this.kw.trim().toLowerCase()
      return this.list.filter((s) => {
        if (this.filter === 'group' && s.kind !== 'group') return false
        if (this.filter === 'private' && s.kind === 'group') return false
        if (!k) return true
        return ((s.display || '') + ' ' + (s.id || '') + ' ' + (s.target_id || '')).toLowerCase().indexOf(k) >= 0
      })
    },
    usedPct() {
      const c = this.ctx
      if (!c || !c.budget) return 0
      return Math.min(100, Math.round((c.est_tokens / c.budget) * 100))
    },
    barClass() { return this.usedPct >= 90 ? 'max' : (this.usedPct >= 70 ? 'hi' : '') },
  },
  async mounted() { await this.load() },
  methods: {
    fmtTime, fmtNum,
    async load() {
      this.busy = 'load'
      try {
        const d = await callData('rcbot.sessions')
        this.list = (d && d.items) || []
        this.stats = (d && d.stats) || {}
        this.defPersona = (d && d.default_persona) || ''
        this.defProvider = (d && d.default_provider) || ''
        const p = await callData('rcbot.personas')
        this.personas = (p && p.items) || []
        const pr = await callData('rcbot.providers')
        this.providers = (pr && pr.items) || []
        if (this.cur) {
          const same = this.list.find((x) => x.id === this.cur.id)
          if (same) this.cur = same
        }
      } catch (e) { this.err = errText(e) } finally { this.busy = '' }
    },
    async open(s) {
      this.cur = s
      this.busy = 'open'
      try {
        this.detail = await callData('rcbot.session.get', { id: s.id, limit: this.limit })
        this.ctx = await callData('rcbot.context', { id: s.id })
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async reloadDetail() {
      if (!this.cur) return
      try {
        this.detail = await callData('rcbot.session.get', { id: this.cur.id, limit: this.limit })
        this.ctx = await callData('rcbot.context', { id: this.cur.id })
      } catch (e) { toast(errText(e), 'err') }
    },
    async patch(field, value) {
      if (!this.cur) return
      this.busy = 'p' + field
      try {
        const body = { id: this.cur.id }
        body[field] = value
        await call('rcbot.session.save', body)
        toast('已更新', 'ok')
        await this.load()
        await this.reloadDetail()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async clear() {
      if (!this.cur) return
      if (!confirm('清空「' + (this.cur.display || this.cur.id) + '」的上下文？消息会删掉，会话保留。')) return
      this.busy = 'clear'
      try {
        await call('rcbot.session.clear', { id: this.cur.id })
        toast('上下文已清空', 'ok')
        await this.load(); await this.reloadDetail()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async del() {
      if (!this.cur) return
      if (!confirm('删除会话「' + (this.cur.display || this.cur.id) + '」？消息和摘要一起删。')) return
      this.busy = 'del'
      try {
        await call('rcbot.session.delete', { id: this.cur.id })
        toast('已删除', 'ok')
        this.cur = null; this.detail = null; this.ctx = null
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    personaName(id) {
      if (!id) return '默认'
      const p = this.personas.find((x) => x.id === id)
      return p ? p.name : id
    },
    providerName(id) {
      if (!id) return '默认'
      const p = this.providers.find((x) => x.id === id)
      return p ? (p.label || p.id) : id
    },
  },
  template: `
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-split">
      <div class="rcq-pnl flat">
        <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
          <b>会话</b>
          <span class="rcq-hint">{{ stats.sessions || 0 }} 个 · 消息 {{ fmtNum(stats.messages || 0) }}</span>
          <span class="sp"></span>
          <button class="btn btn-sm" @click="load">刷新</button>
        </div>
        <div class="rcq-flex" style="padding:0 16px 10px">
          <button class="btn btn-sm" :class="filter === 'all' ? 'btn-primary' : ''" @click="filter = 'all'">全部</button>
          <button class="btn btn-sm" :class="filter === 'group' ? 'btn-primary' : ''" @click="filter = 'group'">群聊</button>
          <button class="btn btn-sm" :class="filter === 'private' ? 'btn-primary' : ''" @click="filter = 'private'">私聊</button>
          <input class="input" style="flex:1;min-width:90px;padding:4px 10px;font-size:12px"
            v-model="kw" placeholder="搜会话" />
        </div>
        <div class="rcq-list">
          <div class="rcq-row click" v-for="s in shown" :key="s.id"
            :class="{ on: cur && cur.id === s.id }" @click="open(s)">
            <div class="main">
              <div class="t">
                <span class="tag-chip tag-chip-sm">{{ s.kind === 'group' ? '群' : '私' }}</span>
                {{ s.display || s.target_id || s.id }}
                <span class="tag-chip tag-chip-sm" v-if="s.enabled === 0">已停用</span>
              </div>
              <div class="d">
                {{ s.msg_count || 0 }} 条 · {{ s.mode_label || '' }}
                <template v-if="s.persona_id"> · {{ personaName(s.persona_id) }}</template>
                · {{ fmtTime(s.last_at || s.updated_at) }}
              </div>
            </div>
          </div>
          <div v-if="!shown.length" class="rcq-empty"><b>▤</b>没有会话</div>
        </div>
      </div>

      <div v-if="cur">
        <div class="rcq-pnl">
          <div class="rcq-ph">
            <b>{{ cur.display || cur.target_id }}</b>
            <span class="tag-chip tag-chip-sm">{{ cur.kind === 'group' ? '群聊' : '私聊' }}</span>
            <span class="tag-chip tag-chip-sm">{{ cur.mode_label || '' }}</span>
            <span class="sp"></span>
            <button class="btn btn-sm" :disabled="!!busy" @click="reloadDetail">刷新</button>
          </div>

          <div class="rcq-form">
            <label class="rcq-fi"><span>角色卡片</span>
              <select class="select" :value="cur.persona_id || ''" :disabled="!!busy"
                @change="patch('persona_id', $event.target.value)">
                <option value="">跟随默认（{{ personaName(defPersona) }}）</option>
                <option v-for="p in personas" :key="p.id" :value="p.id">{{ p.name || p.id }}</option>
              </select>
            </label>
            <label class="rcq-fi"><span>模型提供商</span>
              <select class="select" :value="cur.provider_id || ''" :disabled="!!busy"
                @change="patch('provider_id', $event.target.value)">
                <option value="">跟随默认（{{ providerName(defProvider) }}）</option>
                <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.label || p.id }}</option>
              </select>
            </label>
            <div class="rcq-fi"><span>启用</span>
              <label class="switch">
                <input type="checkbox" :checked="cur.enabled !== 0" :disabled="!!busy"
                  @change="patch('enabled', $event.target.checked)" />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <div class="rcq-sec" v-if="ctx">
            <div class="rcq-flex" style="margin-bottom:4px">
              <span class="rcq-hint">上下文占用</span>
              <span class="sp" style="margin-left:auto"></span>
              <span class="rcq-mono">{{ ctx.est_tokens }} / {{ ctx.budget }} tokens（{{ usedPct }}%）</span>
            </div>
            <div class="rcq-bar2"><i :class="barClass" :style="{ width: usedPct + '%' }"></i></div>
            <div class="rcq-note">
              预算 = 上下文窗口 − 最大输出 − 系统提示。超了就按「保留最近比例」压缩成摘要。
            </div>
            <div class="rcq-flex" style="margin-top:10px">
              <button class="btn btn-sm" :disabled="!!busy" @click="clear">清空上下文</button>
              <button class="btn btn-sm btn-danger" :disabled="!!busy" @click="del">删除会话</button>
            </div>
          </div>
        </div>

        <div class="rcq-pnl" v-if="detail">
          <div class="rcq-ph"><b>消息记录</b><span class="sp"></span>
            <span class="rcq-hint">最近 {{ (detail.messages || []).length }} / 共 {{ detail.msg_count || 0 }} 条</span></div>

          <div v-if="detail.summary" class="rcq-pnl" style="background:var(--sf2);margin-bottom:12px">
            <div class="rcq-ph" style="margin-bottom:6px"><b>压缩摘要</b>
              <span class="rcq-hint">旧对话被压成了这段</span></div>
            <div style="font-size:12.5px;white-space:pre-wrap">{{ detail.summary }}</div>
          </div>

          <div class="rcq-msgs">
            <div class="rcq-msg" v-for="m in (detail.messages || [])" :key="m.id"
              :class="{ me: m.role === 'assistant' }">
              <div class="who">{{ m.role === 'assistant' ? '助手' : (m.name || '用户') }}</div>
              <div class="body">{{ m.content }}</div>
            </div>
            <div v-if="!(detail.messages || []).length" class="rcq-empty"><b>▤</b>这个会话还没有消息</div>
          </div>
        </div>
      </div>

      <div class="rcq-pnl" v-else>
        <div class="rcq-empty"><b>▤</b>左边点一个会话看详情</div>
      </div>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 模型提供商

const Providers = {
  data() {
    return {
      S, list: [], def: '', cur: null, busy: '', err: '', dirty: false,
      test: null, models: [], showKey: false,
    }
  },
  computed: { isNew() { return !!(this.cur && this.cur.__new) } },
  async mounted() { await this.load() },
  methods: {
    async load() {
      try {
        const d = await callData('rcbot.providers')
        this.list = (d && d.items) || []
        this.def = (d && d.default) || ''
        if (!this.cur) this.pick(this.list[0] || null)
        else if (!this.cur.__new && !this.dirty) {
          const same = this.list.find((x) => x.id === this.cur.id)
          if (same) this.pick(same)
        }
      } catch (e) { this.err = errText(e) }
    },
    pick(p) {
      this.cur = p ? Object.assign({ type: 'openai', timeout: 120, enable: true }, p) : null
      this.dirty = false; this.test = null; this.models = []
    },
    add() {
      this.cur = {
        id: '', label: '', type: 'openai', api_base: 'https://api.openai.com/v1',
        api_key: '', model: '', timeout: 120, enable: true, __new: true,
      }
      this.dirty = true; this.test = null; this.models = []
    },
    async save() {
      const c = this.cur
      if (!c) return
      if (!String(c.label || '').trim()) { toast('给提供商起个名字', 'err'); return }
      if (!String(c.api_base || '').trim()) { toast('api_base 不能为空', 'err'); return }
      this.busy = 'save'
      try {
        await call('rcbot.provider.save', {
          id: c.__new ? '' : c.id, label: c.label, type: c.type,
          api_base: c.api_base, api_key: c.api_key, model: c.model,
          timeout: Number(c.timeout) || 120, enable: !!c.enable,
        })
        toast('已保存', 'ok'); this.dirty = false
        this.cur = null
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async setDefault(p) {
      this.busy = 'def' + p.id
      try {
        await call('rcbot.provider.save', {
          id: p.id, label: p.label, type: p.type, api_base: p.api_base,
          api_key: p.api_key, model: p.model, timeout: p.timeout, enable: p.enable,
          set_default: true,
        })
        toast('已设为默认提供商', 'ok')
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async del(p) {
      if (!confirm('删除提供商「' + (p.label || p.id) + '」？')) return
      this.busy = 'del' + p.id
      try {
        await call('rcbot.provider.delete', { id: p.id })
        toast('已删除', 'ok'); this.cur = null
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async doTest(p) {
      this.busy = 'test' + p.id
      this.test = null
      try {
        const r = await callData('rcbot.provider.test', { id: p.id })
        this.test = Object.assign({ id: p.id }, r || {})
        toast(r.ok ? ('通了，' + r.ms + 'ms') : ('不通：' + (r.error || '')), r.ok ? 'ok' : 'err')
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async fetchModels() {
      const c = this.cur
      if (!c || c.__new) { toast('先保存再拉模型列表', 'err'); return }
      this.busy = 'models'
      try {
        const r = await callData('rcbot.provider.models', { id: c.id })
        this.models = (r && (r.items || r.models)) || []
        if (!this.models.length) toast('没拉到模型', 'err')
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
  },
  template: `
  <div class="rcq-split">
    <div class="rcq-pnl flat">
      <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
        <b>模型提供商</b><span class="sp"></span>
        <button class="btn btn-sm btn-primary" @click="add">新增</button>
      </div>
      <div class="rcq-list">
        <div class="rcq-row click" v-for="p in list" :key="p.id"
          :class="{ on: cur && cur.id === p.id }" @click="pick(p)">
          <div class="main">
            <div class="t">{{ p.label || p.id }}
              <span class="tag-chip tag-chip-sm" v-if="p.id === def">默认</span>
              <span class="tag-chip tag-chip-sm" v-if="p.enable === false">停用</span>
            </div>
            <div class="d">{{ p.model || '未选模型' }} · {{ p.api_base }}</div>
          </div>
        </div>
        <div v-if="!list.length" class="rcq-empty"><b>✦</b>还没有提供商，点「新增」</div>
      </div>
    </div>

    <div class="rcq-pnl" v-if="cur">
      <div class="rcq-ph"><b>{{ isNew ? '新增提供商' : (cur.label || cur.id) }}</b><span class="sp"></span>
        <span class="tag-chip tag-chip-sm" v-if="cur.id && cur.id === def">默认</span>
      </div>
      <div class="rcq-form">
        <label class="rcq-fi"><span>名称</span>
          <input class="input" v-model="cur.label" @input="dirty = true" placeholder="DeepSeek" /></label>
        <label class="rcq-fi"><span>协议</span>
          <select class="select" v-model="cur.type" @change="dirty = true">
            <option value="openai">OpenAI 兼容</option>
            <option value="anthropic">Anthropic</option>
          </select></label>
        <label class="rcq-fi wide"><span>API 地址</span>
          <input class="input" v-model="cur.api_base" @input="dirty = true"
            placeholder="https://api.deepseek.com/v1" /></label>
        <label class="rcq-fi wide"><span>API Key</span>
          <div style="display:flex;gap:6px">
            <input class="input" style="flex:1" v-model="cur.api_key" @input="dirty = true"
              :type="showKey ? 'text' : 'password'" placeholder="sk-..." />
            <button class="btn btn-sm" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
          </div>
        </label>
        <label class="rcq-fi"><span>模型</span>
          <div style="display:flex;gap:6px">
            <input class="input" style="flex:1" v-model="cur.model" @input="dirty = true"
              placeholder="deepseek-flash" />
            <button class="btn btn-sm" :disabled="!!busy || isNew" @click="fetchModels">拉列表</button>
          </div>
        </label>
        <label class="rcq-fi"><span>超时（秒）</span>
          <input class="input" type="number" min="10" max="600" v-model="cur.timeout" @input="dirty = true" /></label>
        <div class="rcq-fi" v-if="models.length"><span>从列表选（{{ models.length }}）</span>
          <select class="select" :value="cur.model" @change="cur.model = $event.target.value; dirty = true">
            <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>

      <div class="rcq-flex" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="save">保存</button>
        <button class="btn btn-sm" v-if="cur.id && cur.id !== def" :disabled="!!busy"
          @click="setDefault(cur)">设为默认</button>
        <button class="btn btn-sm" v-if="cur.id && !isNew" :disabled="!!busy" @click="doTest(cur)">测试连通</button>
        <button class="btn btn-sm btn-danger" v-if="cur.id && !isNew" :disabled="!!busy"
          @click="del(cur)">删除</button>
        <span class="rcq-hint" v-if="dirty">有未保存的修改</span>
      </div>
      <div class="rcq-note" v-if="test">
        <span :style="{ color: test.ok ? 'var(--success)' : 'var(--danger)' }">
          {{ test.ok ? ('连通 ' + test.ms + 'ms · 回复：' + (test.reply || '')) : ('失败：' + (test.error || '')) }}
        </span>
      </div>
      <div class="rcq-note">
        推理模型（deepseek-flash 等）会先花 token 在思考上，测连通至少给 256 个输出 token，
        所以「测试连通」偶尔慢一点是正常的。
      </div>
    </div>

    <div class="rcq-pnl" v-else>
      <div class="rcq-empty"><b>✦</b>左边选一个，或者新增</div>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 运行日志（仿 NapCat 猫猫日志）

const Logs = {
  data() {
    return {
      S, items: [], mode: 'live', level: '', lines: 400, follow: true,
      source: '', connected: false, hint: '', busy: false, timer: null, err: '',
    }
  },
  computed: {
    filtered() { return this.items },
  },
  async mounted() { await this.load(); this.tick() },
  beforeUnmount() { if (this.timer) clearTimeout(this.timer) },
  methods: {
    tick() {
      if (this.timer) clearTimeout(this.timer)
      if (this.mode === 'live' && this.follow) {
        this.timer = setTimeout(async () => {
          await this.load(true)
          this.tick()
        }, 2000)
      }
    },
    async load(silent) {
      if (!silent) this.busy = true
      try {
        const d = await call('qqbot.account.logs', {
          mode: this.mode, level: this.level, lines: Number(this.lines) || 400,
        })
        const grow = d.items.length !== this.items.length
        this.items = d.items || []
        this.source = d.source
        this.connected = !!d.connected
        this.hint = d.hint || ''
        this.err = ''
        if (grow && this.follow) this.$nextTick(this.scrollBottom)
      } catch (e) {
        this.err = errText(e)
      } finally {
        this.busy = false
      }
    },
    scrollBottom() {
      const el = this.$refs.box
      if (el) el.scrollTop = el.scrollHeight
    },
    async switchMode(m) {
      this.mode = m
      this.items = []
      await this.load()
      this.tick()
    },
    async setLevel(l) {
      this.level = this.level === l ? '' : l
      await this.load()
    },
    async clear() {
      try {
        await call('qqbot.account.logs.clear')
        this.items = []
        toast('缓冲已清空', 'ok')
      } catch (e) { toast(errText(e), 'err') }
    },
    download() {
      const txt = this.items.map((x) => '[' + String(x.level).toUpperCase() + '] ' + x.text).join('\n')
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'napcat-' + Date.now() + '.log'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 3000)
    },
    lineClass(x) { return 'rcq-ln rcq-lv-' + (x.level || 'info') },
    lvText(x) { return '[' + String(x.level || 'info').toUpperCase() + ']' },
  },
  template: `
  <div>
    <div class="rcq-pnl">
      <div class="rcq-ph">
        <button class="btn btn-sm" :class="mode === 'live' ? 'btn-primary' : ''" @click="switchMode('live')">实时日志</button>
        <button class="btn btn-sm" :class="mode === 'history' ? 'btn-primary' : ''" @click="switchMode('history')">历史日志</button>
        <span class="sp"></span>
        <span class="rcq-lamp"><b :class="connected ? 'on' : 'off'"></b>
          {{ mode === 'live' ? (connected ? 'SSE 已连接' : 'SSE 断开') : (source === 'journal' ? 'journalctl' : 'NapCat 缓冲') }}</span>
      </div>
      <div class="rcq-flex">
        <span class="rcq-hint">日志级别</span>
        <button class="btn btn-sm" :class="level === 'debug' ? 'btn-primary' : ''" @click="setLevel('debug')">Debug</button>
        <button class="btn btn-sm" :class="level === 'info' ? 'btn-primary' : ''" @click="setLevel('info')">Info</button>
        <button class="btn btn-sm" :class="level === 'warn' ? 'btn-primary' : ''" @click="setLevel('warn')">Warn</button>
        <button class="btn btn-sm" :class="level === 'error' ? 'btn-primary' : ''" @click="setLevel('error')">Error</button>
        <span style="width:10px"></span>
        <select class="select" style="padding:4px 8px;font-size:12px" v-model.number="lines" @change="load()">
          <option :value="200">200 行</option>
          <option :value="400">400 行</option>
          <option :value="1000">1000 行</option>
          <option :value="2000">2000 行</option>
        </select>
        <label class="switch" title="自动跟随">
          <input type="checkbox" v-model="follow" @change="tick" />
          <span class="slider"></span>
        </label>
        <span class="rcq-hint">跟随</span>
        <span class="sp" style="margin-left:auto"></span>
        <button class="btn btn-sm" :disabled="busy" @click="load()">刷新</button>
        <button class="btn btn-sm" @click="download">下载</button>
        <button class="btn btn-sm" v-if="mode === 'live'" @click="clear">清空</button>
      </div>
    </div>

    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-log" ref="box">
      <div v-for="(x, i) in items" :key="i" :class="lineClass(x)">
        <span class="lv">{{ lvText(x) }}</span>{{ x.text }}
      </div>
      <div v-if="!items.length" style="color:var(--f)">
        {{ hint || '还没有日志' }}
      </div>
    </div>
    <div class="rcq-note">
      实时日志订阅 NapCat 的 SSE 通道（不依赖 systemd，非 root 也能看）；历史日志读
      <code>journalctl -u napcat</code>，读不到时会回落到实时缓冲。
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 设置

const Settings = {
  data() {
    return {
      S, cfg: null, conn: null, busy: '', err: '', searchQ: '', searchOut: null,
      tab: 'ctx',
    }
  },
  computed: {
    ctx() { return (this.cfg && this.cfg.context) || {} },
    bot() { return (this.cfg && this.cfg.bot) || {} },
    feats() { return (this.cfg && this.cfg.features) || {} },
    ws() { return this.feats.web_search || {} },
    vis() { return this.feats.vision || {} },
  },
  async mounted() { await this.load() },
  methods: {
    async load() {
      this.busy = 'load'
      try {
        this.cfg = await callData('rcbot.config.get')
        this.conn = await call('qqbot.conn.get')
        this.err = ''
      } catch (e) { this.err = errText(e) } finally { this.busy = '' }
    },
    async saveCtx() {
      this.busy = 'ctx'
      try {
        await call('rcbot.config.save', {
          context: {
            max_tokens: Number(this.ctx.max_tokens) || 128000,
            max_output_tokens: Number(this.ctx.max_output_tokens) || 4096,
            keep_recent_ratio: Number(this.ctx.keep_recent_ratio) || 0.15,
            max_history_messages: Number(this.ctx.max_history_messages) || 200,
            compress_enabled: !!this.ctx.compress_enabled,
            compress_provider: this.ctx.compress_provider || '',
          },
        })
        toast('上下文设置已保存', 'ok')
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async saveBot() {
      this.busy = 'bot'
      try {
        await call('rcbot.config.save', {
          bot: {
            enabled: !!this.bot.enabled,
            group_need_at: !!this.bot.group_need_at,
            private_always_reply: !!this.bot.private_always_reply,
            reply_with_mention: !!this.bot.reply_with_mention,
            wake_prefix: splitList(this.bot.__prefixText != null ? this.bot.__prefixText : (this.bot.wake_prefix || []).join(',')),
            allowed_groups: splitList(this.bot.__allowText != null ? this.bot.__allowText : (this.bot.allowed_groups || []).join(',')),
            blocked_groups: splitList(this.bot.__blockText != null ? this.bot.__blockText : (this.bot.blocked_groups || []).join(',')),
            rate_limit: {
              window: Number((this.bot.rate_limit || {}).window) || 60,
              max: Number((this.bot.rate_limit || {}).max) || 30,
            },
          },
        })
        toast('触发规则已保存', 'ok')
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async saveFeat() {
      this.busy = 'feat'
      try {
        await call('rcbot.config.save', {
          features: {
            web_search: {
              enabled: !!this.ws.enabled,
              max_results: Number(this.ws.max_results) || 5,
            },
            vision: {
              enabled: !!this.vis.enabled,
              max_images: Number(this.vis.max_images) || 3,
            },
          },
        })
        toast('能力开关已保存', 'ok')
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async saveConn() {
      this.busy = 'conn'
      try {
        await call('qqbot.conn.save', {
          config: {
            api: this.conn.config.api,
            timeout: Number(this.conn.config.timeout) || 90,
            napcat: {
              base: this.conn.config.napcat.base,
              token: this.conn.config.napcat.token,
              unit: this.conn.config.napcat.unit,
            },
          },
        })
        toast('连接设置已保存', 'ok')
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async testSearch() {
      const q = this.searchQ.trim()
      if (!q) return
      this.busy = 'search'
      this.searchOut = null
      try {
        const r = await callData('rcbot.tools.search', { q })
        this.searchOut = r || {}
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
  },
  template: `
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>
    <div class="rcq-pnl" v-if="!cfg"><div class="rcq-empty">读取配置中…</div></div>

    <div class="rcq-pnl" v-if="cfg">
      <div class="rcq-ph">
        <button class="btn btn-sm" :class="tab === 'ctx' ? 'btn-primary' : ''" @click="tab = 'ctx'">上下文与触发</button>
        <button class="btn btn-sm" :class="tab === 'cap' ? 'btn-primary' : ''" @click="tab = 'cap'">能力</button>
        <button class="btn btn-sm" :class="tab === 'conn' ? 'btn-primary' : ''" @click="tab = 'conn'">连接</button>
        <span class="sp"></span>
        <button class="btn btn-sm" :disabled="!!busy" @click="load">重新读取</button>
      </div>

      <!-- 上下文与触发 -->
      <div v-if="tab === 'ctx'">
        <div class="rcq-ph" style="margin-bottom:10px"><b>上下文</b>
          <span class="rcq-hint">决定它记得多少、什么时候压缩</span></div>
        <div class="rcq-form">
          <label class="rcq-fi"><span>模型上下文窗口（tokens）</span>
            <input class="input" type="number" v-model="ctx.max_tokens" /></label>
          <label class="rcq-fi"><span>最大输出（tokens）</span>
            <input class="input" type="number" v-model="ctx.max_output_tokens" /></label>
          <label class="rcq-fi"><span>保留最近比例</span>
            <input class="input" type="number" step="0.05" min="0.05" max="0.9" v-model="ctx.keep_recent_ratio" /></label>
          <label class="rcq-fi"><span>最多带多少条历史</span>
            <input class="input" type="number" v-model="ctx.max_history_messages" /></label>
        </div>
        <div class="switch-row">
          <label>启用上下文压缩（超预算时把旧对话压成摘要）</label>
          <label class="switch"><input type="checkbox" v-model="ctx.compress_enabled" /><span class="slider"></span></label>
        </div>
        <div class="rcq-note">
          预算 = 上下文窗口 − 最大输出 − 系统提示。超了就保留最近 {{ Math.round((ctx.keep_recent_ratio || 0) * 100) }}%，
          更旧的交给模型压成摘要。推理模型建议「最大输出」≥ 4096，否则思考就把预算吃光了。
        </div>
        <div class="rcq-flex" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveCtx">保存</button>
        </div>

        <div class="rcq-sec">
          <div class="rcq-ph" style="margin-bottom:10px"><b>触发规则</b>
            <span class="rcq-hint">什么消息才回</span></div>
          <div class="switch-row">
            <label>机器人总开关</label>
            <label class="switch"><input type="checkbox" v-model="bot.enabled" /><span class="slider"></span></label>
          </div>
          <div class="switch-row">
            <label>群里必须 @ 才回复</label>
            <label class="switch"><input type="checkbox" v-model="bot.group_need_at" /><span class="slider"></span></label>
          </div>
          <div class="switch-row">
            <label>私聊全部回复</label>
            <label class="switch"><input type="checkbox" v-model="bot.private_always_reply" /><span class="slider"></span></label>
          </div>
          <div class="switch-row">
            <label>回复时 @ 对方</label>
            <label class="switch"><input type="checkbox" v-model="bot.reply_with_mention" /><span class="slider"></span></label>
          </div>
          <div class="rcq-form" style="margin-top:8px">
            <label class="rcq-fi"><span>唤醒前缀（逗号分隔，不用 @）</span>
              <input class="input" :value="(bot.wake_prefix || []).join(',')"
                @input="bot.__prefixText = $event.target.value" placeholder="/" /></label>
            <label class="rcq-fi"><span>限流：窗口（秒）</span>
              <input class="input" type="number" v-model="bot.rate_limit.window" /></label>
            <label class="rcq-fi"><span>限流：窗口内最多回复</span>
              <input class="input" type="number" v-model="bot.rate_limit.max" /></label>
            <label class="rcq-fi"><span>只回这些群（留空 = 不限）</span>
              <input class="input" :value="(bot.allowed_groups || []).join(',')"
                @input="bot.__allowText = $event.target.value" placeholder="群号，逗号分隔" /></label>
            <label class="rcq-fi"><span>屏蔽这些群</span>
              <input class="input" :value="(bot.blocked_groups || []).join(',')"
                @input="bot.__blockText = $event.target.value" placeholder="群号，逗号分隔" /></label>
          </div>
          <div class="rcq-flex" style="margin-top:12px">
            <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveBot">保存</button>
          </div>
        </div>
      </div>

      <!-- 能力 -->
      <div v-if="tab === 'cap'">
        <div class="switch-row">
          <label>允许联网搜索
            <div class="rcq-note">模型遇到时效性问题会调用 <code>web_search</code>，走 Bing 抓结果。</div>
          </label>
          <label class="switch"><input type="checkbox" v-model="ws.enabled" /><span class="slider"></span></label>
        </div>
        <div class="rcq-form" style="margin-top:6px">
          <label class="rcq-fi"><span>每次搜索取几条</span>
            <input class="input rcq-num" type="number" min="1" max="10" v-model="ws.max_results" /></label>
        </div>

        <div class="rcq-sec">
          <div class="switch-row">
            <label>允许识图
              <div class="rcq-note">消息里有图片时，把图转成 base64 直接喂给模型（不用另配视觉模型）。</div>
            </label>
            <label class="switch"><input type="checkbox" v-model="vis.enabled" /><span class="slider"></span></label>
          </div>
          <div class="rcq-form" style="margin-top:6px">
            <label class="rcq-fi"><span>单条消息最多看几张</span>
              <input class="input rcq-num" type="number" min="1" max="6" v-model="vis.max_images" /></label>
          </div>
          <div class="rcq-note">
            只有「当前这轮」会带图，历史里只留 [图片] 文本 —— 不然每轮都要重传图片，token 会爆。
          </div>
        </div>

        <div class="rcq-flex" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveFeat">保存</button>
        </div>

        <div class="rcq-sec">
          <div class="rcq-ph" style="margin-bottom:10px"><b>试一下搜索</b>
            <span class="rcq-hint">验证 Bing 通道通不通</span></div>
          <div class="rcq-flex">
            <input class="input" style="flex:1;min-width:160px" v-model="searchQ"
              @keyup.enter="testSearch" placeholder="例如：杭州天气" />
            <button class="btn btn-sm" :disabled="busy === 'search'" @click="testSearch">搜索</button>
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
              <div v-if="!(searchOut.results || []).length" class="rcq-empty">没有结果</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 连接 -->
      <div v-if="tab === 'conn' && conn">
        <div class="rcq-ph" style="margin-bottom:10px"><b>NapCat（协议端）</b><span class="sp"></span>
          <span class="rcq-lamp"><b :class="conn.napcat && conn.napcat.ok ? 'on' : 'off'"></b>
            {{ conn.napcat && conn.napcat.ok ? '已连通' : '连不上' }}</span></div>
        <div class="rcq-form">
          <label class="rcq-fi wide"><span>WebUI 地址</span>
            <input class="input" v-model="conn.config.napcat.base" placeholder="http://127.0.0.1:6099" /></label>
          <label class="rcq-fi"><span>WebUI Token</span>
            <input class="input" type="password" v-model="conn.config.napcat.token" /></label>
          <label class="rcq-fi"><span>systemd 单元名（读历史日志）</span>
            <input class="input" v-model="conn.config.napcat.unit" placeholder="napcat" /></label>
        </div>
        <div class="rcq-note" v-if="conn.napcat && conn.napcat.error">{{ conn.napcat.error }}</div>

        <div class="rcq-sec">
          <div class="rcq-ph" style="margin-bottom:10px"><b>rcbot（机器人）</b><span class="sp"></span>
            <span class="rcq-lamp"><b :class="conn.rcbot && conn.rcbot.ok ? 'on' : 'off'"></b>
              {{ conn.rcbot && conn.rcbot.ok ? '已连通' : '连不上' }}</span></div>
          <div class="rcq-form">
            <label class="rcq-fi wide"><span>HTTP 地址</span>
              <input class="input" v-model="conn.config.api" placeholder="http://127.0.0.1:6710" /></label>
            <label class="rcq-fi"><span>请求超时（秒）</span>
              <input class="input" type="number" v-model="conn.config.timeout" /></label>
          </div>
          <div class="rcq-note" v-if="conn.rcbot && conn.rcbot.error">{{ conn.rcbot.error }}</div>
        </div>

        <div class="rcq-flex" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="saveConn">保存</button>
          <span class="rcq-hint">插件版本 v{{ conn.version }}</span>
        </div>
      </div>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 框架

const TABS = [
  // ★ 「消息」是整屏页（fixed overlay），进去后隐藏插件自己的选项卡 ——
  //   仿 QQ 的第一印象就是"没有外层壳"，这里必须让位。
  { id: 'im', label: '消息', comp: IM, fullscreen: true },
  { id: 'overview', label: '概览', comp: Overview },
  { id: 'account', label: 'QQ 账户', comp: Accounts },
  { id: 'query', label: '查询', comp: Query },
  { id: 'media', label: '媒体库', comp: MediaLib },
  { id: 'cards', label: '角色卡片', comp: Cards },
  { id: 'sessions', label: '会话管理', comp: Sessions },
  { id: 'providers', label: '模型提供商', comp: Providers },
  { id: 'logs', label: '运行日志', comp: Logs },
  { id: 'settings', label: '设置', comp: Settings },
]

const App = {
  data() {
    let tab = 'overview'
    try {
      const t = localStorage.getItem(LS_TAB)
      if (t && TABS.some((x) => x.id === t)) tab = t
    } catch (e) {}
    return { S, tab, TABS, conn: null, key: 0 }
  },
  computed: {
    cur() { return (this.TABS.find((t) => t.id === this.tab) || this.TABS[0]).comp },
    isFull() { const t = this.TABS.find((x) => x.id === this.tab); return !!(t && t.fullscreen) },
    ncOn() { return !!(this.conn && this.conn.napcat && this.conn.napcat.ok) },
    rbOn() { return !!(this.conn && this.conn.rcbot && this.conn.rcbot.ok) },
  },
  async mounted() { await this.check() },
  methods: {
    async check() {
      try { this.conn = await call('qqbot.conn.get') } catch (e) {}
    },
    go(id) {
      this.tab = id
      try { localStorage.setItem(LS_TAB, id) } catch (e) {}
      this.check()
    },
    // 消息页退出：回到概览，并把记忆的 tab 也改掉 ——
    // 否则刷新页面又直接铺满整屏，用户会以为卡住了
    onImClose() { this.go('overview') },
    refresh() {
      this.key++
      this.check()
    },
  },
  template: `
  <div class="rcq">
    <div class="rcq-bar" v-if="!isFull">
      <div class="rcq-tab" v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }"
        @click="go(t.id)">{{ t.label }}</div>
      <div class="rcq-bar-r">
        <span class="rcq-lamp"><b :class="ncOn ? 'on' : 'off'"></b>NapCat</span>
        <span class="rcq-lamp"><b :class="rbOn ? 'on' : 'off'"></b>Bot</span>
        <button class="btn btn-sm" @click="refresh">刷新</button>
      </div>
    </div>

    <component :is="cur" :key="tab + '-' + key" @close="onImClose" />

    <div class="rcq-toast" v-if="S.toast" :class="S.toastKind">{{ S.toast }}</div>
  </div>`,
}

function mount(container, ctx) {
  injectStyle()
  injectIMStyle()
  CTX = ctx
  setIMCtx(ctx)
  const vm = createApp(App)
  const stop = () => { try { vm.unmount() } catch (e) {} }
  vm.mount(container)
  return stop
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: 'QQ Bot' }], mount }
}
if (typeof window !== 'undefined') register(window)
