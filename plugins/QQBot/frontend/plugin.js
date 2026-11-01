// QQ Bot 插件前端 —— NapCat + RainCough Bot 统一控制台
//
// 形态约束（对齐 atk / docker 等插件的做法）：
//  · 不自带左侧栏 —— 宿主已有主导航，插件内导航放顶部横向选项卡
//  · 不套外层边框/固定高度 —— 直接铺在面板内容区里
//  · 颜色、圆角、按钮、输入框全走宿主 CSS 变量与 .btn/.input/.switch 等既有类
//  · ctx.invoke 已解包：成功直接返回 result，失败抛异常 → try/catch
import { createApp, reactive } from 'vue'
import qrcode from './qrcode.mjs'

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
  },
  template: `
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-ov">
      <div>
        <div class="rcq-pnl flat">
          <div class="rcq-acct">
            <img class="rcq-ava" :src="acc.avatar" alt="" v-if="acc.avatar" />
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
              <div class="k">NapCat 版本</div><div class="v">{{ ver.napcat || '—' }}</div>
              <div class="k">QQ 版本</div><div class="v">{{ ver.qq || '—' }}</div>
              <div class="k">WebUI 版本</div><div class="v">{{ ver.webui || '—' }}</div>
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

    <div class="rcq-counters">
      <div class="rcq-ct"><b>{{ cnt.configs || 0 }}</b><span>网络配置</span></div>
      <div class="rcq-ct"><b>{{ cnt.httpServers || 0 }}</b><span>HTTP 服务器</span></div>
      <div class="rcq-ct"><b>{{ cnt.httpClients || 0 }}</b><span>HTTP 客户端</span></div>
      <div class="rcq-ct"><b>{{ cnt.wsServers || 0 }}</b><span>WS 服务器</span></div>
      <div class="rcq-ct"><b>{{ cnt.wsClients || 0 }}</b><span>WS 客户端</span></div>
    </div>

    <div class="rcq-pnl">
      <div class="rcq-ph"><b>RainCough Bot</b><span class="sp"></span>
        <span class="rcq-lamp" v-if="botst"><b :class="botst.onebot && botst.onebot.connected ? 'on' : 'off'"></b>
          {{ botst.onebot && botst.onebot.connected ? '已连 NapCat' : '未连接' }}</span>
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

// ------------------------------------------------------------------ QQ 账户（NapCat 账号登录）

const Account = {
  data() {
    return { S, d: null, busy: '', qr: '', lastUrl: '', err: '', timer: null, tick: 0 }
  },
  computed: {
    st() { return (this.d && this.d.status) || {} },
    quick() { return (this.d && this.d.quick) || [] },
    login() { return !!this.st.login && !this.st.offline },
    phaseText() {
      const p = this.st.phase || ''
      if (this.login) return '已登录'
      if (p === 'waiting_qrcode') return '等待扫码'
      if (p === 'waiting_confirm') return '已扫码，等待手机确认'
      if (p === 'restarting') return '登录服务重启中'
      return p || '未登录'
    },
  },
  async mounted() {
    await this.load()
    this.timer = setInterval(() => {
      if (!this.login) this.load(true)
    }, 2600)
  },
  beforeUnmount() { if (this.timer) clearInterval(this.timer) },
  methods: {
    async load(silent) {
      if (!silent) this.busy = 'load'
      try {
        const d = await call('qqbot.nc.account')
        this.d = d
        this.err = (d.errors || []).join('；')
        if (d.qrcode && d.qrcode !== this.lastUrl) {
          this.lastUrl = d.qrcode
          this.qr = makeQr(d.qrcode)
        }
      } catch (e) {
        this.err = errText(e)
      } finally {
        this.busy = ''
      }
    },
    async act(a, extra) {
      this.busy = a
      try {
        await call('qqbot.nc.action', Object.assign({ action: a }, extra || {}))
        const msg = { refresh: '已刷新二维码', restart: '已重启 NapCat 登录',
          restart_process: '已重启 NapCat 进程' }[a] || '已执行'
        toast(msg, 'ok')
        this.lastUrl = ''
        setTimeout(() => this.load(true), a === 'refresh' ? 1200 : 600)
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
    async quickLogin(q) {
      this.busy = 'q' + q.uin
      try {
        await call('qqbot.nc.action', { action: 'quick_login', uin: q.uin })
        toast('已发起快速登录：' + (q.nick || q.uin), 'ok')
        setTimeout(() => this.load(true), 2500)
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        this.busy = ''
      }
    },
    copy(text) {
      if (!text) return
      try {
        navigator.clipboard.writeText(text)
        toast('链接已复制', 'ok')
      } catch (e) {
        toast('复制失败，手动选中吧', 'err')
      }
    },
  },
  template: `
  <div>
    <div v-if="err" class="rcq-pnl rcq-warn" style="font-size:12px">{{ err }}</div>

    <div class="rcq-split">
      <div>
        <div class="rcq-pnl">
          <div class="rcq-ph"><b>账号状态</b><span class="sp"></span>
            <span class="rcq-pill" :class="login ? 'ok' : ''">{{ phaseText }}</span>
          </div>
          <div class="rcq-acct" style="padding:0 0 12px">
            <img class="rcq-ava" :src="st.avatar" alt="" v-if="st.avatar" />
            <div class="rcq-ava" v-else></div>
            <div style="min-width:0">
              <div class="rcq-nick">{{ st.nick || '未登录' }}
                <span class="rcq-dot" :class="login ? 'on' : 'off'"></span></div>
              <div class="rcq-uin">{{ st.uin || '—' }}</div>
            </div>
          </div>
          <div class="rcq-kv">
            <div class="k">核心</div><div class="v">{{ st.coreReady ? '就绪' : '未就绪' }}</div>
            <div class="k">登录错误</div><div class="v">{{ st.err || '无' }}</div>
          </div>
          <div class="rcq-flex" style="margin-top:14px">
            <button class="btn btn-sm" :disabled="!!busy" @click="load()">刷新状态</button>
            <button class="btn btn-sm" :disabled="!!busy" @click="act('refresh')">刷新二维码</button>
            <button class="btn btn-sm" :disabled="!!busy" @click="act('restart')">重启登录</button>
          </div>
        </div>

        <div class="rcq-pnl">
          <div class="rcq-ph"><b>快速登录</b><span class="sp"></span>
            <span class="rcq-hint">{{ quick.length }} 个已保存账号</span></div>
          <div v-if="!quick.length" class="rcq-empty"><b>⇥</b>没有保存过的账号</div>
          <div class="rcq-list" v-else>
            <div class="rcq-row" v-for="q in quick" :key="q.uin">
              <img class="rcq-ava" :src="q.avatar" alt="" style="width:34px;height:34px" v-if="q.avatar" />
              <div class="rcq-ava" v-else style="width:34px;height:34px"></div>
              <div class="main">
                <div class="t">{{ q.nick || q.uin }}</div>
                <div class="d">{{ q.uin }}</div>
              </div>
              <div class="acts">
                <button class="btn btn-sm btn-primary" :disabled="!!busy" @click="quickLogin(q)">登录</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="rcq-pnl">
        <div class="rcq-ph"><b>扫码登录</b><span class="sp"></span>
          <span class="rcq-hint" v-if="!login">二维码 2 秒自动刷新</span>
          <span class="rcq-pill ok" v-else>已登录，无需扫码</span>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
          <div class="rcq-qr" v-if="!login">
            <div v-html="qr" v-if="qr" style="width:100%;height:100%"></div>
            <div class="ph" v-else>二维码加载中…</div>
          </div>
          <div class="rcq-qr" v-else style="background:var(--sf2)">
            <div class="rcq-qr-ok"><b>✓</b>已登录<br />{{ st.nick || st.uin }}</div>
          </div>
          <div style="flex:1;min-width:200px">
            <div class="rcq-kv">
              <div class="k">登录方式</div><div class="v">手机 QQ 扫码</div>
              <div class="k">状态</div><div class="v">{{ phaseText }}</div>
            </div>
            <div class="rcq-flex" style="margin-top:12px">
              <button class="btn btn-sm" :disabled="!!busy" @click="act('refresh')">换一张</button>
              <button class="btn btn-sm" :disabled="!!busy || !(d && d.qrcode)" @click="copy(d && d.qrcode)">复制链接</button>
            </div>
            <div class="rcq-note">
              二维码是本地画的（NapCat 只给跳转链接，不是图片）。
              扫码后手机会弹确认，确认完这里会自动变成「已登录」。
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`,
}

// ------------------------------------------------------------------ 人格

const Persona = {
  data() {
    return { S, list: [], def: '', cur: null, busy: '', err: '', dirty: false }
  },
  computed: {
    isNew() { return !!(this.cur && this.cur.__new) },
  },
  async mounted() { await this.load() },
  methods: {
    async load() {
      try {
        const d = await callData('rcbot.personas')
        this.list = (d && d.items) || []
        this.def = (d && d.default) || ''
        if (!this.cur || this.cur.__new) {
          if (!this.cur) this.pick(this.list[0] || null)
        } else {
          const same = this.list.find((x) => x.id === this.cur.id)
          if (same && !this.dirty) this.pick(same)
        }
      } catch (e) { this.err = errText(e) }
    },
    pick(p) {
      this.cur = p ? Object.assign({}, p) : null
      this.dirty = false
    },
    add() {
      this.cur = { id: '', name: '新人格', prompt: '', __new: true }
      this.dirty = true
    },
    async save() {
      if (!this.cur) return
      const c = this.cur
      if (!String(c.name || '').trim()) { toast('人格名字不能为空', 'err'); return }
      this.busy = 'save'
      try {
        const r = await callData('rcbot.persona.save', {
          id: c.__new ? '' : c.id, name: c.name, prompt: c.prompt,
        })
        toast('已保存', 'ok')
        this.dirty = false
        await this.load()
        if (r && r.id) this.pick(this.list.find((x) => x.id === r.id) || null)
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async setDefault(p) {
      this.busy = 'def' + p.id
      try {
        await call('rcbot.persona.save', { id: p.id, name: p.name, prompt: p.prompt, set_default: true })
        toast('已设为默认人格', 'ok')
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
    async del(p) {
      if (!confirm('删除人格「' + (p.name || p.id) + '」？用到它的会话会回落到默认人格。')) return
      this.busy = 'del' + p.id
      try {
        await call('rcbot.persona.delete', { id: p.id })
        toast('已删除', 'ok')
        this.cur = null
        await this.load()
      } catch (e) { toast(errText(e), 'err') } finally { this.busy = '' }
    },
  },
  template: `
  <div class="rcq-split">
    <div class="rcq-pnl flat">
      <div class="rcq-ph" style="padding:14px 16px 0;margin-bottom:10px">
        <b>人格</b><span class="sp"></span>
        <button class="btn btn-sm btn-primary" @click="add">新建</button>
      </div>
      <div class="rcq-list">
        <div class="rcq-row click" v-for="p in list" :key="p.id"
          :class="{ on: cur && cur.id === p.id }" @click="pick(p)">
          <div class="main">
            <div class="t">{{ p.name || p.id }}
              <span class="tag-chip tag-chip-sm" v-if="p.id === def">默认</span>
            </div>
            <div class="d">{{ (p.prompt || '（空提示词）').slice(0, 80) }}</div>
          </div>
        </div>
        <div v-if="!list.length" class="rcq-empty"><b>☺</b>还没有人格，点「新建」加一个</div>
      </div>
    </div>

    <div class="rcq-pnl" v-if="cur">
      <div class="rcq-ph"><b>{{ isNew ? '新建人格' : '编辑人格' }}</b><span class="sp"></span>
        <span class="tag-chip tag-chip-sm" v-if="cur.id && cur.id === def">默认</span>
      </div>
      <div class="rcq-form">
        <label class="rcq-fi wide"><span>名称</span>
          <input class="input" v-model="cur.name" @input="dirty = true" placeholder="例如：默认人格 / 客服小助手" />
        </label>
        <label class="rcq-fi wide"><span>系统提示词</span>
          <textarea class="rcq-ta" v-model="cur.prompt" @input="dirty = true"
            placeholder="描述它的身份、语气、边界。例如：你叫小雨，说话简短自然，不用敬语，不主动提自己是 AI。"></textarea>
        </label>
      </div>
      <div class="rcq-flex" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="save">保存</button>
        <button class="btn btn-sm" v-if="cur.id && cur.id !== def" :disabled="!!busy"
          @click="setDefault(cur)">设为默认</button>
        <button class="btn btn-sm btn-danger" v-if="cur.id && !isNew" :disabled="!!busy"
          @click="del(cur)">删除</button>
        <span class="rcq-hint" v-if="dirty">有未保存的修改</span>
      </div>
      <div class="rcq-note">
        人格就是每轮对话的系统提示词。会话可以在「会话管理」里单独指定人格，没指定就用默认人格。
      </div>
    </div>
    <div class="rcq-pnl" v-else>
      <div class="rcq-empty"><b>☺</b>左边选一个，或者新建</div>
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
            <label class="rcq-fi"><span>人格</span>
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
        const d = await call('qqbot.nc.logs', {
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
        await call('qqbot.nc.logs.clear')
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
  { id: 'overview', label: '概览', comp: Overview },
  { id: 'account', label: 'QQ 账户', comp: Account },
  { id: 'persona', label: '人格', comp: Persona },
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
    refresh() {
      this.key++
      this.check()
    },
  },
  template: `
  <div class="rcq">
    <div class="rcq-bar">
      <div class="rcq-tab" v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }"
        @click="go(t.id)">{{ t.label }}</div>
      <div class="rcq-bar-r">
        <span class="rcq-lamp"><b :class="ncOn ? 'on' : 'off'"></b>NapCat</span>
        <span class="rcq-lamp"><b :class="rbOn ? 'on' : 'off'"></b>Bot</span>
        <button class="btn btn-sm" @click="refresh">刷新</button>
      </div>
    </div>

    <component :is="cur" :key="tab + '-' + key" />

    <div class="rcq-toast" v-if="S.toast" :class="S.toastKind">{{ S.toast }}</div>
  </div>`,
}

function mount(container, ctx) {
  injectStyle()
  CTX = ctx
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
