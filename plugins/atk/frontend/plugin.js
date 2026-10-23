// atk 插件前端(接口库 v4): 顶部模块条 + 六个作业模块 + 任务 + 环境
//
// 设计约束(见 docs/网络攻防工具库/插件设计.md 11.1):
//  · 不自带左侧栏 —— 宿主已有主导航
//  · 导航在顶部, 可收成图标, 状态存 localStorage
//  · 颜色全部走宿主 CSS 变量, 不覆盖宿主主题
//  · ctx.invoke 已解包: 成功返回 result, 失败抛异常 → 用 try/catch, 不判 ok
import { createApp } from 'vue'

const NAME = 'atk'
const LS_MINI = 'rcat.mini'
const LS_TASK = 'rcat.task'

const STYLE_ID = 'rc-atk-style'
const CSS = `
.rcat-app{--t:var(--text,#1d1d1b);--m:var(--text-muted,#6e6d68);--f:var(--text-faint,#9a9994);
 --bd:var(--border,#e7e6e2);--bd2:var(--border-strong,#d8d7d2);--sf:var(--surface,#fff);
 --sf2:var(--surface-2,#fafaf9);--sf3:var(--surface-3,#f1efe8);--ac:var(--accent,#185fa5);
 --acbg:var(--accent-soft,#e6f1fb);--ok:var(--success,#639922);--warn:var(--warning,#ef9f27);
 --bad:var(--danger,#e24b4a);color:var(--t);font-size:13px;line-height:1.6}
.rcat-app *{box-sizing:border-box}

/* 顶部模块条: 插件内唯一导航, 吸附在滚动容器顶部 */
.rcat-head{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:6px;
 padding:8px 12px;background:var(--sf);border-bottom:1px solid var(--bd);min-height:50px}
.rcat-brand{font-size:13px;font-weight:600;white-space:nowrap;padding-right:10px;
 border-right:1px solid var(--bd);margin-right:2px}
.rcat-mods{display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none}
.rcat-mods::-webkit-scrollbar{display:none}
.rcat-mod{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:7px;color:var(--m);
 cursor:pointer;white-space:nowrap;user-select:none;font-size:12.5px;border:1px solid transparent;flex:0 0 auto}
.rcat-mod:hover{background:var(--sf2);color:var(--t)}
.rcat-mod.on{background:var(--acbg);color:var(--ac);font-weight:500}
.rcat-mod.off{opacity:.45;cursor:not-allowed}
.rcat-sep{width:1px;height:18px;background:var(--bd);margin:0 5px;flex:0 0 1px}
.rcat-head-r{margin-left:auto;display:flex;align-items:center;gap:8px;flex:0 0 auto}
.rcat-task{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--m);cursor:pointer;
 white-space:nowrap;padding:5px 8px;border-radius:7px;max-width:220px}
.rcat-task:hover{background:var(--sf2)}
.rcat-task b{color:var(--t);font-weight:500;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.rcat-mini .rcat-mod span{display:none}
.rcat-mini .rcat-mod{padding:7px 8px}
.rcat-mini .rcat-brand{display:none}
.rcat-mini .rcat-task span{display:none}

.rcat-btn{border:1px solid var(--bd2);background:var(--sf);color:var(--t);border-radius:7px;
 padding:5px 11px;font-size:12px;cursor:pointer;font-family:inherit;white-space:nowrap}
.rcat-btn:hover{background:var(--sf2)}
.rcat-btn.p{background:var(--ac);border-color:var(--ac);color:#fff}
.rcat-btn.p:hover{filter:brightness(.92)}
.rcat-btn:disabled{opacity:.4;cursor:not-allowed}
.rcat-btn.s{padding:3px 8px;font-size:11.5px}
.rcat-btn.d{color:var(--bad);border-color:var(--bad)}
.rcat-ico{border:1px solid var(--bd);background:transparent;border-radius:6px;width:24px;height:24px;
 cursor:pointer;color:var(--m);font-size:11px;line-height:1;padding:0;flex:0 0 24px}
.rcat-ico:hover{background:var(--sf2);color:var(--t)}

.rcat-body{padding:16px 18px 8px}
.rcat-panel{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;margin-bottom:12px}
.rcat-ph{display:flex;align-items:baseline;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.rcat-ph h2{font-size:14px;font-weight:600;margin:0}
.rcat-ph p{font-size:12px;color:var(--m);margin:0}
.rcat-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.rcat-grow{flex:1;min-width:120px}
.rcat-inp{width:100%;border:1px solid var(--bd);border-radius:7px;padding:7px 10px;font-size:12px;
 font-family:inherit;background:var(--sf);color:var(--t);outline:none}
.rcat-inp:focus{border-color:var(--ac)}
select.rcat-inp{width:auto;min-width:110px}
textarea.rcat-inp{font-family:ui-monospace,Consolas,monospace;resize:vertical}
.rcat-chks{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--m)}
.rcat-chks label{display:flex;align-items:center;gap:5px;cursor:pointer}

.rcat-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
.rcat-stat{background:var(--sf);border:1px solid var(--bd);border-radius:10px;padding:11px 13px}
.rcat-stat-l{font-size:11px;color:var(--f);margin:0}
.rcat-stat-v{font-size:20px;font-weight:600;margin:1px 0 0}
.rcat-stat-v small{font-size:11px;color:var(--m);font-weight:400;margin-left:3px}

.rcat-tblwrap{border:1px solid var(--bd);border-radius:10px;overflow:auto;background:var(--sf);max-height:520px}
.rcat-tbl{width:100%;border-collapse:collapse;font-size:12px}
.rcat-tbl th{text-align:left;font-weight:400;color:var(--f);font-size:11px;padding:7px 10px;
 border-bottom:1px solid var(--bd);white-space:nowrap;background:var(--sf2);position:sticky;top:0}
.rcat-tbl td{padding:7px 10px;border-bottom:1px solid var(--bd);vertical-align:middle}
.rcat-tbl tr:last-child td{border-bottom:none}
.rcat-tbl tbody tr:hover{background:var(--sf2)}
.rcat-mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px}
.rcat-badge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:5px;white-space:nowrap}
.rcat-b-high{background:#fcebeb;color:#a32d2d}
.rcat-b-mid{background:#faeeda;color:#854f0b}
.rcat-b-low{background:#eaf3de;color:#3b6d11}
.rcat-b-info{background:var(--acbg);color:var(--ac)}
.rcat-b-gray{background:var(--sf3);color:var(--m)}
.rcat-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;vertical-align:middle}
.rcat-bar{display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;
 border-top:1px solid var(--bd);flex-wrap:wrap}
.rcat-hint{font-size:12px;color:var(--m)}
.rcat-hint b{color:var(--ac);font-weight:600}
.rcat-split{display:grid;grid-template-columns:250px 1fr;gap:12px;align-items:start}
@media (max-width:900px){.rcat-split{grid-template-columns:1fr}}
.rcat-list{background:var(--sf);border:1px solid var(--bd);border-radius:10px;overflow:auto;max-height:520px}
.rcat-list-h{padding:9px 12px;border-bottom:1px solid var(--bd);font-size:11px;color:var(--f);background:var(--sf2)}
.rcat-list-i{padding:9px 12px;border-bottom:1px solid var(--bd);cursor:pointer;font-size:12px}
.rcat-list-i:last-child{border-bottom:none}
.rcat-list-i:hover{background:var(--sf2)}
.rcat-list-i.on{background:var(--acbg);box-shadow:inset 2px 0 0 var(--ac)}
.rcat-list-i .sub{font-size:11px;color:var(--f);margin-top:2px;font-family:ui-monospace,Consolas,monospace;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcat-code{background:#1c1c1a;color:#d6d5d0;border-radius:8px;padding:11px 13px;
 font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.7;overflow:auto;
 white-space:pre-wrap;word-break:break-all;margin:0;max-height:360px}
.rcat-tabs{display:flex;gap:2px;margin-bottom:10px;border-bottom:1px solid var(--bd);flex-wrap:wrap}
.rcat-tab{padding:6px 11px;font-size:12px;color:var(--m);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.rcat-tab.on{color:var(--ac);border-bottom-color:var(--ac);font-weight:500}
.rcat-ops{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.rcat-op{border:1px solid var(--bd);background:var(--sf);border-radius:6px;padding:4px 9px;
 font-size:11.5px;cursor:pointer;color:var(--m)}
.rcat-op:hover{border-color:var(--ac);color:var(--ac);background:var(--acbg)}
.rcat-op.on{border-color:var(--ac);color:var(--ac);background:var(--acbg)}
.rcat-kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:12px}
@media (max-width:900px){.rcat-kv{grid-template-columns:repeat(2,minmax(0,1fr))}}
.rcat-kv div{background:var(--sf2);border-radius:7px;padding:7px 10px}
.rcat-kv span{color:var(--f);font-size:11px;display:block}
.rcat-kv b{font-weight:600;font-size:12px}
.rcat-drop{border:1px dashed var(--bd2);border-radius:10px;padding:24px 16px;text-align:center;
 color:var(--m);background:var(--sf);cursor:pointer}
.rcat-drop:hover{border-color:var(--ac);background:var(--acbg)}
.rcat-drop b{display:block;font-size:13px;font-weight:600;color:var(--t);margin-bottom:2px}
.rcat-empty{padding:28px 16px;text-align:center;color:var(--f);font-size:12px}
.rcat-faint{color:var(--f)}
.rcat-muted{color:var(--m)}
.rcat-mt8{margin-top:8px}.rcat-mt12{margin-top:12px}
.rcat-progress{height:3px;background:var(--bd);border-radius:2px;overflow:hidden;margin-top:10px}
.rcat-progress i{display:block;height:100%;background:var(--ac);transition:width .3s}
.rcat-err{background:rgba(217,82,78,.08);border:1px solid rgba(217,82,78,.35);color:#a32d2d;
 border-radius:8px;padding:8px 11px;font-size:12px;margin-bottom:12px}
.rcat-ok{background:rgba(99,153,34,.08);border:1px solid rgba(99,153,34,.35);color:#3b6d11;
 border-radius:8px;padding:8px 11px;font-size:12px;margin-bottom:12px}
.rcat-chain{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--m)}
.rcat-chip{background:var(--sf2);border:1px solid var(--bd);border-radius:6px;padding:2px 8px;
 font-size:11.5px;color:var(--t);display:inline-flex;align-items:center;gap:5px}
.rcat-chip i{cursor:pointer;color:var(--f);font-style:normal}
.rcat-chip i:hover{color:var(--bad)}

/* 日志条: 吸附底部, 点开成抽屉(对应宿主 log.tail) */
.rcat-logbox{background:var(--sf);border:1px solid var(--bd);border-bottom:none;
 border-radius:10px 10px 0 0;max-height:200px;overflow:auto;padding:8px 12px;
 font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.8;margin-top:8px}
.rcat-log{position:sticky;bottom:0;z-index:5;display:flex;align-items:center;gap:10px;
 padding:0 12px;height:32px;font-size:11.5px;color:var(--m);background:var(--sf);
 border-top:1px solid var(--bd);cursor:pointer}
.rcat-log:hover{background:var(--sf2)}
.rcat-log .lg{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--f);
 overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1}
.rcat-logline{display:flex;gap:9px;white-space:pre-wrap;word-break:break-all}
.rcat-logline .tm{color:var(--f);flex:0 0 auto}
`

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

// ── 小工具 ────────────────────────────────────────────────
const LV_CLASS = { '高危': 'rcat-b-high', '中危': 'rcat-b-mid', '低危': 'rcat-b-low' }
const LV_DOT = { '高危': 'var(--bad)', '中危': 'var(--warn)', '低危': 'var(--ok)' }
const KIND_CLASS = { 'Web': 'rcat-b-info', 'Host': 'rcat-b-gray', 'Sub': 'rcat-b-gray', 'Path': 'rcat-b-mid', 'Service': 'rcat-b-gray' }

function tsText(v) {
  if (!v) return '—'
  const d = new Date(v * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes())
}

function download(name, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 800)
}

const TPL = `
<div class="rcat-app" :class="{ 'rcat-mini': mini }">

  <div class="rcat-head">
    <div class="rcat-brand">网络攻防工具库</div>
    <nav class="rcat-mods">
      <div v-for="m in MODULES" :key="m.id" class="rcat-mod"
           :class="{ on: cur === m.id, off: !m.ready }" :title="m.ready ? m.label : (m.label + ' · ' + (m.note || '未开放'))"
           @click="cur = m.id; onEnter(m.id)">
        <svg width="15" height="15" viewBox="0 0 16 16" v-html="m.icon"></svg>
        <span>{{ m.label }}</span>
      </div>
      <div class="rcat-sep"></div>
      <div class="rcat-mod" :class="{ on: cur === 'tasks' }" title="任务记录" @click="cur = 'tasks'; onEnter('tasks')">
        <svg width="15" height="15" viewBox="0 0 16 16" v-html="ICON.task"></svg><span>任务</span>
      </div>
      <div class="rcat-mod" :class="{ on: cur === 'env' }" title="环境与工具" @click="cur = 'env'; onEnter('env')">
        <svg width="15" height="15" viewBox="0 0 16 16" v-html="ICON.cfg"></svg><span>环境</span>
      </div>
    </nav>
    <div class="rcat-head-r">
      <div class="rcat-task" title="切换任务" @click="cur = 'tasks'">
        任务 <b>{{ task ? task.name : '未选择' }}</b><span class="rcat-faint">▾</span>
      </div>
      <button class="rcat-btn" @click="exportTask('md')">导出</button>
      <button class="rcat-ico" :title="mini ? '展开模块条' : '收起模块条'" @click="toggleMini">{{ mini ? '»' : '«' }}</button>
    </div>
  </div>

  <div class="rcat-body">
    <div v-if="err" class="rcat-err">{{ err }}<span style="float:right;cursor:pointer" @click="err=''">×</span></div>
    <div v-if="ok" class="rcat-ok">{{ ok }}</div>

    <!-- ══════════════ 侦察 ══════════════ -->
    <template v-if="cur === 'recon'">
      <div class="rcat-panel">
        <div class="rcat-ph"><h2>侦察</h2><p>输入目标，产出资产清单</p></div>
        <div class="rcat-row">
          <input class="rcat-inp rcat-grow" v-model="target" placeholder="域名、IP 或公司名，如 example.com / 192.168.2.0"
                 @keyup.enter="startRecon">
          <select class="rcat-inp" v-model="intensity">
            <option value="fast">快速</option>
            <option value="normal">标准</option>
            <option value="deep">深度</option>
          </select>
          <button class="rcat-btn p" :disabled="runBusy" @click="startRecon">{{ runBusy ? '执行中…' : '开始' }}</button>
          <button v-if="runBusy" class="rcat-btn" @click="stopRecon">停止</button>
        </div>
        <div class="rcat-chks">
          <label><input type="checkbox" v-model="modes.subdomain"> 子域枚举</label>
          <label><input type="checkbox" v-model="modes.port"> 端口扫描</label>
          <label><input type="checkbox" v-model="modes.dir"> 目录探测</label>
          <label><input type="checkbox" v-model="modes.fingerprint"> 技术栈指纹</label>
        </div>
        <div v-if="run" class="rcat-mt8">
          <div class="rcat-hint">
            {{ run.stage }} · {{ run.status === 'running' ? '进行中' : run.status }}
            <span v-if="run.total"> · {{ run.done }}/{{ run.total }}</span>
            <span v-if="run.error" style="color:var(--bad)"> · {{ run.error }}</span>
          </div>
          <div class="rcat-progress"><i :style="{ width: pct(run) + '%' }"></i></div>
        </div>
      </div>

      <div class="rcat-stats">
        <div class="rcat-stat"><p class="rcat-stat-l">资产总数</p><p class="rcat-stat-v">{{ assets.length }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">子域</p><p class="rcat-stat-v">{{ countKind('Sub') }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">端口/服务</p><p class="rcat-stat-v">{{ countKind('Web') + countKind('Service') }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">隐藏路径</p><p class="rcat-stat-v">{{ countKind('Path') }}</p></div>
      </div>

      <div class="rcat-panel" style="padding:10px 12px">
        <div class="rcat-row">
          <input class="rcat-inp rcat-grow" v-model="assetQ" placeholder="筛选地址 / 技术栈 / 来源">
          <select class="rcat-inp" v-model="assetKind">
            <option value="">全部类型</option>
            <option value="Host">目标</option>
            <option value="Sub">子域</option>
            <option value="Web">Web</option>
            <option value="Service">服务</option>
            <option value="Path">路径</option>
          </select>
          <span class="rcat-hint">共 <b>{{ filteredAssets.length }}</b> 条</span>
        </div>
      </div>

      <div class="rcat-tblwrap">
        <table class="rcat-tbl">
          <thead><tr><th>地址</th><th>端口</th><th>类型</th><th>技术栈 / 详情</th><th>来源</th><th></th></tr></thead>
          <tbody>
            <tr v-for="a in filteredAssets" :key="a.id">
              <td class="rcat-mono">{{ a.addr }}</td>
              <td class="rcat-mono">{{ a.port || '—' }}</td>
              <td><span class="rcat-badge" :class="KIND_CLASS[a.kind] || 'rcat-b-gray'">{{ a.kind }}</span></td>
              <td class="rcat-muted" style="max-width:420px;overflow:hidden;text-overflow:ellipsis">{{ a.stack || '—' }}</td>
              <td><span class="rcat-badge rcat-b-gray">{{ a.source }}</span></td>
              <td style="text-align:right;white-space:nowrap">
                <button class="rcat-btn s" @click="probeAsset(a)">验证</button>
                <button class="rcat-btn s d" @click="delAsset(a)">删</button>
              </td>
            </tr>
            <tr v-if="!filteredAssets.length"><td colspan="6" class="rcat-empty">还没有资产，先跑一次侦察</td></tr>
          </tbody>
        </table>
      </div>
      <div class="rcat-bar">
        <span class="rcat-hint">选中一条资产的「验证」可把地址带到验证模块</span>
        <div style="flex:1"></div>
        <button class="rcat-btn p" :disabled="!assets.length" @click="cur = 'detect'; onEnter('detect')">送入检测</button>
      </div>
    </template>

    <!-- ══════════════ 检测 ══════════════ -->
    <template v-if="cur === 'detect'">
      <div class="rcat-panel">
        <div class="rcat-ph"><h2>检测</h2><p>对资产做配置与暴露面核查，产出风险列表</p></div>
        <div class="rcat-row">
          <button class="rcat-btn p" :disabled="dRunBusy || !assets.length" @click="startDetect">
            {{ dRunBusy ? '核查中…' : '开始核查' }}
          </button>
          <span class="rcat-hint" v-if="!assets.length">先跑一次侦察，检测需要资产</span>
          <span class="rcat-hint" v-else>核查项：安全响应头 / TLS / 版本泄露 / 组件已知漏洞 / 暴露路径</span>
        </div>
        <div v-if="dRun" class="rcat-mt8">
          <div class="rcat-hint">{{ dRun.stage }} · {{ dRun.status }}<span v-if="dRun.total"> · {{ dRun.done }}/{{ dRun.total }}</span></div>
          <div class="rcat-progress"><i :style="{ width: pct(dRun) + '%' }"></i></div>
        </div>
      </div>

      <div class="rcat-stats">
        <div class="rcat-stat"><p class="rcat-stat-l">高危</p><p class="rcat-stat-v" style="color:var(--bad)">{{ countLevel('高危') }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">中危</p><p class="rcat-stat-v" style="color:var(--warn)">{{ countLevel('中危') }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">低危</p><p class="rcat-stat-v">{{ countLevel('低危') }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">待确认</p><p class="rcat-stat-v">{{ risks.filter(r => r.status === '待确认').length }}</p></div>
      </div>

      <div class="rcat-panel" style="padding:10px 12px">
        <div class="rcat-row">
          <select class="rcat-inp" v-model="riskLevel">
            <option value="">全部等级</option><option>高危</option><option>中危</option><option>低危</option>
          </select>
          <select class="rcat-inp" v-model="riskStatus">
            <option value="">全部状态</option><option>待确认</option><option>已确认</option><option>误报</option>
          </select>
          <span class="rcat-hint">共 <b>{{ filteredRisks.length }}</b> 条</span>
        </div>
      </div>

      <div class="rcat-tblwrap">
        <table class="rcat-tbl">
          <thead><tr><th>等级</th><th>类型</th><th>目标</th><th>证据</th><th>状态</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in filteredRisks" :key="r.id">
              <td style="white-space:nowrap"><span class="rcat-dot" :style="{ background: LV_DOT[r.level] }"></span>{{ r.level }}</td>
              <td>{{ r.kind }}</td>
              <td class="rcat-mono" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">{{ r.target }}</td>
              <td class="rcat-muted" style="max-width:320px;overflow:hidden;text-overflow:ellipsis" :title="r.evidence">{{ r.evidence }}</td>
              <td><span class="rcat-badge" :class="r.status === '已确认' ? 'rcat-b-low' : r.status === '误报' ? 'rcat-b-gray' : 'rcat-b-info'">{{ r.status }}</span></td>
              <td style="text-align:right;white-space:nowrap">
                <button v-if="r.status !== '误报'" class="rcat-btn s" @click="toVerify(r)">验证</button>
                <span v-else class="rcat-faint" style="font-size:11px">已排除</span>
              </td>
            </tr>
            <tr v-if="!filteredRisks.length"><td colspan="6" class="rcat-empty">还没有风险，先跑一次核查</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ══════════════ 验证 ══════════════ -->
    <template v-if="cur === 'verify'">
      <div class="rcat-panel"><div class="rcat-ph"><h2>验证</h2><p>单点确认，把疑似变成结论</p></div></div>
      <div class="rcat-split">
        <div class="rcat-list">
          <div class="rcat-list-h">待验证 {{ risks.filter(r => r.status === '待确认').length }} · 已确认 {{ risks.filter(r => r.status === '已确认').length }}</div>
          <div v-for="r in risks.filter(x => x.status !== '误报')" :key="r.id" class="rcat-list-i"
               :class="{ on: vRisk && vRisk.id === r.id }" @click="pickRisk(r)">
            <span class="rcat-dot" :style="{ background: LV_DOT[r.level] }"></span>{{ r.kind }}
            <div class="sub">{{ r.target }}</div>
          </div>
          <div v-if="!risks.filter(x => x.status !== '误报').length" class="rcat-empty">没有待验证项</div>
        </div>
        <div>
          <div class="rcat-panel" style="margin-bottom:12px">
            <div class="rcat-row" style="margin-bottom:8px">
              <select class="rcat-inp" v-model="vMethod" style="width:92px">
                <option v-for="m in METHODS" :key="m">{{ m }}</option>
              </select>
              <input class="rcat-inp rcat-grow rcat-mono" v-model="vUrl" placeholder="https://目标/路径">
              <button class="rcat-btn p" :disabled="vBusy" @click="sendReq">{{ vBusy ? '发送中…' : '发送' }}</button>
            </div>
            <div class="rcat-tabs">
              <div class="rcat-tab" :class="{ on: vTab === 'body' }" @click="vTab = 'body'">请求体</div>
              <div class="rcat-tab" :class="{ on: vTab === 'headers' }" @click="vTab = 'headers'">请求头</div>
              <div class="rcat-tab" :class="{ on: vTab === 'payload' }" @click="vTab = 'payload'">载荷库</div>
            </div>
            <textarea v-if="vTab === 'body'" class="rcat-inp" rows="5" v-model="vBody" placeholder="请求体（JSON / 表单 / 原始文本）"></textarea>
            <textarea v-else-if="vTab === 'headers'" class="rcat-inp" rows="5" v-model="vHeaders"
                      placeholder="每行一个：Content-Type: application/json"></textarea>
            <template v-else>
              <div class="rcat-ops">
                <span v-for="k in payloadKinds" :key="k.kind" class="rcat-op" :class="{ on: pKind === k.kind }"
                      @click="loadPayloads(k.kind)">{{ k.kind }} ({{ k.count }})</span>
              </div>
              <div class="rcat-ops">
                <span v-for="p in payloads" :key="p.name" class="rcat-op" :title="p.value"
                      @click="insertPayload(p.value)">{{ p.name }}</span>
              </div>
            </template>
          </div>

          <div class="rcat-panel">
            <div class="rcat-ph"><h2>响应</h2>
              <p v-if="vResp">{{ vResp.ok ? (vResp.status + ' · ' + vResp.ms + 'ms · ' + vResp.size + 'B') : ('失败: ' + vResp.error) }}</p>
              <p v-else>还没发送</p>
            </div>
            <pre class="rcat-code" v-if="vResp && vResp.ok">{{ respText }}</pre>
            <pre class="rcat-code" v-else-if="vResp">{{ vResp.error }}</pre>
            <div class="rcat-bar" v-if="vResp">
              <span class="rcat-hint">判定</span>
              <div style="flex:1"></div>
              <button class="rcat-btn" @click="saveConclusion('误报')">标为误报</button>
              <button class="rcat-btn p" @click="saveConclusion('确认')">确认并生成 POC</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════ 分析 ══════════════ -->
    <template v-if="cur === 'analyze'">
      <div class="rcat-panel">
        <div class="rcat-ph"><h2>分析</h2><p>ELF / PE 结构、保护机制、导入导出与入口反汇编</p></div>
        <div v-if="!aInfo" class="rcat-drop" @click="$refs.bin.click()" @dragover.prevent @drop.prevent="onBinDrop">
          <b>拖入 ELF / PE 或点击选择</b>
          结构解析与反汇编都是自研实现，不依赖 capstone / ghidra
        </div>
        <div v-else class="rcat-row">
          <span class="rcat-mono">{{ aInfo.filename }}</span>
          <span class="rcat-badge rcat-b-info">{{ aInfo.format }} {{ aInfo.bits }}-bit</span>
          <span class="rcat-muted">{{ aInfo.arch }}</span>
          <span class="rcat-faint">{{ fmtSize(aInfo.size) }}</span>
          <div style="flex:1"></div>
          <button class="rcat-btn s" @click="aInfo = null">换一个</button>
        </div>
        <input ref="bin" type="file" style="display:none" @change="onBinPick">
        <div v-if="aBusy" class="rcat-hint rcat-mt8">解析中…</div>
      </div>

      <template v-if="aInfo">
        <div class="rcat-panel">
          <div class="rcat-kv">
            <div><span>类型</span><b>{{ aInfo.type }}</b></div>
            <div><span>入口</span><b class="rcat-mono">{{ hex(aInfo.entry) }}</b></div>
            <div><span>节区</span><b>{{ aInfo.sections.length }}</b></div>
            <div><span>导入 / 导出</span><b>{{ aInfo.imports.length }} / {{ aInfo.exports.length }}</b></div>
          </div>
          <div class="rcat-mt12" style="display:flex;gap:8px;flex-wrap:wrap">
            <span v-for="(v, k) in aInfo.protections" :key="k" class="rcat-badge"
                  :class="protClass(k, v)">{{ protLabel(k) }}: {{ protVal(v) }}</span>
          </div>
          <div v-if="aInfo.suspicious && aInfo.suspicious.length" class="rcat-mt12">
            <span class="rcat-hint">能力提示（来自导入表，非判定）：</span>
            <span v-for="c in aInfo.suspicious" :key="c.api" class="rcat-badge"
                  :class="c.level === '高危' ? 'rcat-b-high' : c.level === '中危' ? 'rcat-b-mid' : 'rcat-b-low'"
                  style="margin-left:6px" :title="c.api">{{ c.cap }}</span>
          </div>
          <div v-if="aInfo.notes && aInfo.notes.length" class="rcat-mt8">
            <div v-for="(n, i) in aInfo.notes" :key="i" class="rcat-faint" style="font-size:11.5px">· {{ n }}</div>
          </div>
        </div>

        <div class="rcat-tabs">
          <div class="rcat-tab" :class="{ on: aTab === 'sections' }" @click="aTab = 'sections'">节区</div>
          <div class="rcat-tab" :class="{ on: aTab === 'imports' }" @click="aTab = 'imports'">导入 {{ aInfo.imports.length }}</div>
          <div class="rcat-tab" :class="{ on: aTab === 'exports' }" @click="aTab = 'exports'">导出 {{ aInfo.exports.length }}</div>
          <div class="rcat-tab" :class="{ on: aTab === 'strings' }" @click="aTab = 'strings'; loadStrings()">字符串</div>
        </div>

        <div class="rcat-tblwrap" v-if="aTab === 'sections'" style="max-height:320px">
          <table class="rcat-tbl">
            <thead><tr><th>节区</th><th>地址</th><th>大小</th><th>属性</th><th>熵</th></tr></thead>
            <tbody>
              <tr v-for="sec in aInfo.sections" :key="sec.name">
                <td class="rcat-mono">{{ sec.name }}</td>
                <td class="rcat-mono rcat-muted">{{ hex(sec.addr) }}</td>
                <td class="rcat-mono">{{ fmtSize(sec.size) }}</td>
                <td>
                  <span v-if="sec.exec" class="rcat-badge rcat-b-mid">X</span>
                  <span v-if="sec.write" class="rcat-badge rcat-b-low" style="margin-left:4px">W</span>
                </td>
                <td>
                  <span class="rcat-mono" :style="{ color: sec.entropy >= 7.2 ? 'var(--bad)' : sec.entropy >= 6 ? 'var(--warn)' : 'var(--muted)' }">{{ sec.entropy }}</span>
                  <span class="rcat-faint" style="font-size:11px"> / 8</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rcat-tblwrap" v-else-if="aTab === 'imports'" style="max-height:320px">
          <table class="rcat-tbl">
            <thead><tr><th>导入符号</th><th>能力</th></tr></thead>
            <tbody>
              <tr v-for="(im, i) in aInfo.imports" :key="i">
                <td class="rcat-mono">{{ im }}</td>
                <td><span v-if="capOf(im)" class="rcat-badge rcat-b-mid">{{ capOf(im) }}</span></td>
              </tr>
              <tr v-if="!aInfo.imports.length"><td colspan="2" class="rcat-empty">无导入（静态链接或已加壳）</td></tr>
            </tbody>
          </table>
        </div>

        <div class="rcat-tblwrap" v-else-if="aTab === 'exports'" style="max-height:320px">
          <table class="rcat-tbl">
            <thead><tr><th>导出符号</th><th>地址</th><th>大小</th></tr></thead>
            <tbody>
              <tr v-for="(ex, i) in aInfo.exports" :key="i">
                <td class="rcat-mono">{{ ex.name }}</td>
                <td class="rcat-mono rcat-muted">{{ hex(ex.addr) }}</td>
                <td class="rcat-mono">{{ ex.size || '—' }}</td>
              </tr>
              <tr v-if="!aInfo.exports.length"><td colspan="3" class="rcat-empty">无导出符号</td></tr>
            </tbody>
          </table>
        </div>

        <div v-else class="rcat-panel">
          <div v-if="!aStrings" class="rcat-faint">加载中…</div>
          <template v-else>
            <div class="rcat-hint" style="margin-bottom:8px">共提取 {{ aStrings.total }} 条可打印字符串</div>
            <div v-for="(arr, k) in aStrings.groups" :key="k" class="rcat-mt8">
              <div class="rcat-ph"><h2 style="font-size:12.5px">{{ k }}</h2><p>{{ arr.length }} 条</p></div>
              <pre class="rcat-code" style="max-height:140px">{{ arr.join('\\n') }}</pre>
            </div>
            <div v-if="!Object.keys(aStrings.groups).length" class="rcat-empty">没有命中分类特征的字符串</div>
          </template>
        </div>

        <div class="rcat-split" style="margin-top:12px">
          <div class="rcat-list">
            <div class="rcat-list-h">函数 / 符号 {{ aFuncs.length }}</div>
            <div v-for="(f, i) in aFuncs.slice(0, 300)" :key="i" class="rcat-list-i"
                 :class="{ on: aDisasm && aDisasm.base === f.addr }" @click="disasmAt(f.addr)">
              {{ f.name }}
              <div class="sub">{{ hex(f.addr) }}<span v-if="f.size"> · {{ f.size }}B</span></div>
            </div>
            <div v-if="!aFuncs.length" class="rcat-empty">无符号表（已 strip）</div>
          </div>
          <div class="rcat-panel">
            <div class="rcat-ph">
              <h2>反汇编</h2>
              <p v-if="aDisasm">{{ hex(aDisasm.base) }} · {{ aDisasm.count }} 条<span v-if="aDisasm.unknown"> · 未覆盖 {{ aDisasm.unknown }}</span></p>
              <p v-else>点左侧函数，或</p>
              <button class="rcat-btn s" style="margin-left:6px" @click="disasmAt(aInfo.entry)">从入口开始</button>
            </div>
            <pre class="rcat-code" style="max-height:420px" v-if="aDisasm">{{ disasmText }}</pre>
            <div v-else class="rcat-empty">尚未反汇编</div>
            <div class="rcat-faint" style="font-size:11px;margin-top:6px">
              自研解码器：覆盖整数/跳转/常用 SSE，已用 objdump 对照验证（真实二进制 100% 对齐）。
              未覆盖的指令显示为 db，可能影响后续对齐。
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- ══════════════ 解码 ══════════════ -->
    <template v-if="cur === 'decode'">
      <div class="rcat-panel">
        <div class="rcat-ph"><h2>解码</h2><p>编码转换、哈希与求解流水线</p></div>
        <div class="rcat-row">
          <input class="rcat-inp rcat-grow rcat-mono" v-model="dInput" placeholder="粘贴待处理内容">
          <button class="rcat-btn p" @click="identify">识别</button>
          <button class="rcat-btn" @click="runChain">执行操作链</button>
        </div>
        <div class="rcat-ops">
          <span v-for="o in OPS" :key="o[0]" class="rcat-op" @click="addOp(o[0])">{{ o[1] }}</span>
        </div>
        <div class="rcat-bar" style="border-top:none;padding-top:0;margin-top:2px">
          <div class="rcat-chain">
            操作链
            <span v-for="(c, i) in dChain" :key="i" class="rcat-chip">
              {{ opLabel(c) }}<i @click="dChain.splice(i, 1)">×</i>
            </span>
            <span v-if="!dChain.length" class="rcat-faint">（空）</span>
          </div>
          <div style="flex:1"></div>
          <button class="rcat-btn s" @click="dChain = []">清空</button>
        </div>
      </div>

      <div class="rcat-panel" v-if="dCands.length">
        <div class="rcat-ph"><h2>识别结果</h2><p>{{ dInput.length }} 字符</p></div>
        <div class="rcat-tblwrap" style="max-height:none">
          <table class="rcat-tbl">
            <thead><tr><th>类型</th><th>置信度</th><th>预览</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(c, i) in dCands" :key="i">
                <td>{{ c.kind }}</td>
                <td class="rcat-mono">{{ c.confidence }}%</td>
                <td class="rcat-mono rcat-muted" style="max-width:520px;overflow:hidden;text-overflow:ellipsis">{{ c.preview }}</td>
                <td style="text-align:right"><button class="rcat-btn s" @click="dInput = c.preview">用这个</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rcat-panel" v-if="dSteps.length || dOut">
        <div class="rcat-ph"><h2>输出</h2><p>{{ dSteps.length }} 步 · {{ dOut.length }} 字符</p></div>
        <pre class="rcat-code">{{ dOut }}</pre>
        <div class="rcat-bar">
          <span class="rcat-hint">
            <span v-for="(s, i) in dSteps" :key="i">
              {{ opLabel(s.op) }}<span :style="{ color: s.ok ? 'var(--ok)' : 'var(--bad)' }">{{ s.ok ? ' ✓' : ' ✗' }}</span>
              <span v-if="i < dSteps.length - 1"> → </span>
            </span>
          </span>
          <div style="flex:1"></div>
          <button class="rcat-btn" @click="copy(dOut)">复制</button>
        </div>
      </div>

      <div class="rcat-panel">
        <div class="rcat-ph"><h2>求解</h2><p>古典密码 / RSA 弱参数 / JWT 拆解</p></div>
        <div class="rcat-row">
          <button class="rcat-btn" @click="solve('caesar')">凯撒爆破</button>
          <button class="rcat-btn" @click="solve('jwt')">JWT 拆解</button>
          <button class="rcat-btn" @click="rsaOpen = !rsaOpen">RSA 小 e 开方</button>
        </div>
        <div v-if="rsaOpen" class="rcat-row rcat-mt8">
          <input class="rcat-inp" v-model="rsaN" placeholder="n">
          <input class="rcat-inp" v-model="rsaE" placeholder="e" style="max-width:90px">
          <input class="rcat-inp" v-model="rsaC" placeholder="c">
          <button class="rcat-btn p" @click="solve('rsa')">求解</button>
        </div>
        <pre class="rcat-code rcat-mt12" v-if="dSolve">{{ solveText }}</pre>
      </div>
    </template>

    <!-- ══════════════ 取证 ══════════════ -->
    <template v-if="cur === 'forensic'">
      <div class="rcat-panel">
        <div class="rcat-ph"><h2>取证</h2><p>从文件里提取类型、内嵌数据、元数据与字符串</p></div>
        <div class="rcat-drop" @click="$refs.file.click()" @dragover.prevent @drop.prevent="onDrop">
          <b>拖入文件或点击选择</b>
          单个不超过 3MB（宿主单帧上限 8MB，base64 会再涨 1/3）
        </div>
        <input ref="file" type="file" style="display:none" @change="onPick">
        <div v-if="fBusy" class="rcat-hint rcat-mt8">解析中…</div>
      </div>

      <div class="rcat-stats">
        <div class="rcat-stat"><p class="rcat-stat-l">提取物</p><p class="rcat-stat-v">{{ artifacts.length }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">含附加数据</p><p class="rcat-stat-v">{{ artifacts.filter(a => (a.findings || '').includes('附加')).length }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">有 EXIF</p><p class="rcat-stat-v">{{ artifacts.filter(a => (a.findings || '').includes('EXIF')).length }}</p></div>
        <div class="rcat-stat"><p class="rcat-stat-l">时间线条目</p><p class="rcat-stat-v">{{ timeline.length }}</p></div>
      </div>

      <div class="rcat-tabs">
        <div class="rcat-tab" :class="{ on: fView === 'list' }" @click="fView = 'list'">提取物</div>
        <div class="rcat-tab" :class="{ on: fView === 'timeline' }" @click="fView = 'timeline'; loadTimeline()">时间线</div>
      </div>

      <div class="rcat-tblwrap" v-if="fView === 'list'">
        <table class="rcat-tbl">
          <thead><tr><th>文件</th><th>类型</th><th>大小</th><th>发现</th><th>MD5</th></tr></thead>
          <tbody>
            <tr v-for="a in artifacts" :key="a.id">
              <td class="rcat-mono">{{ a.filename }}</td>
              <td><span class="rcat-badge rcat-b-info">{{ a.kind }}</span></td>
              <td class="rcat-mono">{{ fmtSize(a.size) }}</td>
              <td class="rcat-muted">{{ a.findings }}</td>
              <td class="rcat-mono rcat-faint" style="font-size:11px">{{ (a.md5 || '').slice(0, 12) }}…</td>
            </tr>
            <tr v-if="!artifacts.length"><td colspan="5" class="rcat-empty">还没有样本</td></tr>
          </tbody>
        </table>
      </div>

      <div class="rcat-panel" v-else style="font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.9">
        <div v-for="(t, i) in timeline" :key="i">
          <span class="rcat-faint">{{ t.ts }}</span> · {{ t.filename }} · {{ t.kind }} · {{ t.findings }}
        </div>
        <div v-if="!timeline.length" class="rcat-empty">没有时间线数据</div>
      </div>
    </template>

    <!-- ══════════════ 任务 ══════════════ -->
    <template v-if="cur === 'tasks'">
      <div class="rcat-panel">
        <div class="rcat-ph"><h2>任务记录</h2><p>每次作业的产出都归在任务下</p></div>
        <div class="rcat-row">
          <input class="rcat-inp rcat-grow" v-model="newName" placeholder="任务名称，如 客户 A 外网资产排查">
          <input class="rcat-inp" v-model="newTarget" placeholder="目标（可选）" style="max-width:220px">
          <button class="rcat-btn p" @click="createTask">新建任务</button>
        </div>
      </div>

      <div class="rcat-tblwrap">
        <table class="rcat-tbl">
          <thead><tr><th>任务</th><th>目标</th><th>资产</th><th>风险</th><th>提取物</th><th>更新</th><th></th></tr></thead>
          <tbody>
            <tr v-for="t in tasks" :key="t.id">
              <td>
                <span v-if="taskId === t.id" class="rcat-badge rcat-b-info">当前</span>
                {{ t.name }}
              </td>
              <td class="rcat-mono rcat-muted">{{ t.target || '—' }}</td>
              <td class="rcat-mono">{{ t.counts.assets }}</td>
              <td class="rcat-mono">{{ t.counts.risks }}</td>
              <td class="rcat-mono">{{ t.counts.artifacts }}</td>
              <td class="rcat-faint" style="font-size:11px">{{ tsText(t.updated_at) }}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="rcat-btn s" @click="selectTask(t.id)">切换</button>
                <button class="rcat-btn s" @click="exportTask('md', t.id)">导出</button>
                <button class="rcat-btn s d" @click="removeTask(t)">删</button>
              </td>
            </tr>
            <tr v-if="!tasks.length"><td colspan="7" class="rcat-empty">还没有任务，先新建一个</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ══════════════ 环境 ══════════════ -->
    <template v-if="cur === 'env'">
      <div class="rcat-panel">
        <div class="rcat-ph"><h2>环境与工具</h2>
          <p v-if="env">外部工具 {{ env.external_ok }}/{{ env.external_total }} 就绪 · Python {{ env.python }}</p>
        </div>
        <div class="rcat-hint">
          侦察/检测/解码/取证全部由内置引擎完成，外部工具装了只是加速，没装不影响功能。
        </div>
      </div>

      <div class="rcat-panel">
        <div class="rcat-ph"><h2>内置引擎</h2><p>不依赖任何外部命令</p></div>
        <div class="rcat-kv">
          <div v-for="b in (env ? env.builtin : [])" :key="b.name">
            <span>{{ b.name }}</span><b>{{ b.how }}</b>
          </div>
        </div>
      </div>

      <div class="rcat-tblwrap" style="max-height:none">
        <table class="rcat-tbl">
          <thead><tr><th>外部工具</th><th>用途</th><th>状态</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="t in (env ? env.external : [])" :key="t.name">
              <td class="rcat-mono">{{ t.name }}</td>
              <td class="rcat-muted">{{ t.use }}</td>
              <td><span class="rcat-badge" :class="t.ok ? 'rcat-b-low' : 'rcat-b-gray'">{{ t.ok ? '已安装' : '未安装' }}</span></td>
              <td class="rcat-faint" style="font-size:11px">{{ t.hint || t.path }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rcat-panel rcat-mt12">
        <div class="rcat-ph"><h2>目标范围</h2><p>决定哪些地址可以被扫描或请求</p></div>
        <label v-for="o in scopeOptions" :key="o.v" style="display:flex;gap:9px;align-items:flex-start;padding:7px 0;cursor:pointer">
          <input type="radio" name="rcat-scope" :value="o.v" :checked="scope === o.v" @change="setScope(o.v)" style="margin-top:4px">
          <span>
            <b :style="{ fontWeight: scope === o.v ? 600 : 400 }">{{ o.label }}</b>
            <span class="rcat-faint" style="display:block;font-size:11.5px">{{ o.desc }}</span>
          </span>
        </label>
      </div>

      <div class="rcat-panel" v-if="info">
        <div class="rcat-ph"><h2>插件信息</h2></div>
        <div class="rcat-kv">
          <div><span>插件名</span><b>{{ info.name }}</b></div>
          <div><span>版本</span><b>{{ info.version }}</b></div>
          <div><span>后端</span><b>{{ info.lang }} {{ info.python }}</b></div>
          <div><span>数据库</span><b class="rcat-mono" style="font-size:11px">{{ (info.db || '').split('/').pop() }}</b></div>
        </div>
      </div>
    </template>
  </div>

  <div class="rcat-logbox" v-if="logOpen">
    <div v-for="(l, i) in logs" :key="i" class="rcat-logline">
      <span class="tm">{{ l.tm }}</span><span>{{ l.msg }}</span>
    </div>
    <div v-if="!logs.length" class="rcat-logline rcat-faint">暂无记录</div>
  </div>
  <div class="rcat-log" @click="logOpen = !logOpen">
    <span>执行日志</span>
    <span class="lg">{{ logs.length ? logs[0].msg : '就绪' }}</span>
    <span class="rcat-faint">{{ logOpen ? '▾' : '▴' }}</span>
  </div>
</div>
`

function mount(container, ctx) {
  injectStyle()

  const App = {
    template: TPL,
    data() {
      let mini = false, tid = 0
      try {
        mini = localStorage.getItem(LS_MINI) === '1'
        tid = parseInt(localStorage.getItem(LS_TASK) || '0', 10) || 0
      } catch (e) {}
      return {
        // 框架
        cur: 'recon', mini, err: '', ok: '', logs: [], logOpen: false,
        // 任务
        tasks: [], taskId: tid, task: null,
        newName: '', newTarget: '',
        // 侦察
        target: '', intensity: 'normal',
        modes: { subdomain: true, port: true, dir: true, fingerprint: true },
        run: null, assets: [], assetQ: '', assetKind: '',
        // 检测
        dRun: null, risks: [], riskLevel: '', riskStatus: '',
        // 验证
        risks2: [], vRisk: null, vMethod: 'POST', vUrl: '', vHeaders: '', vBody: '',
        vResp: null, vBusy: false, vTab: 'body', payloadKinds: [], payloads: [], pKind: '',
        // 分析
        aInfo: null, aFuncs: [], aDisasm: null, aStrings: null, aBusy: false, aTab: 'sections',
        // 解码
        dInput: '', dCands: [], dChain: [], dOut: '', dSteps: [], dSolve: null,
        rsaOpen: false, rsaN: '', rsaE: '3', rsaC: '',
        // 取证
        artifacts: [], timeline: [], fBusy: false, fView: 'list',
        // 环境
        env: null, info: null, scope: 'all', scopeOptions: [],
        // 常量
        MODULES: [
          { id: 'recon', label: '侦察', ready: true, icon: '<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' },
          { id: 'detect', label: '检测', ready: true, icon: '<path d="M8 1.8l5 2v4.1c0 3-2.1 5.1-5 6.3-2.9-1.2-5-3.3-5-6.3V3.8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' },
          { id: 'verify', label: '验证', ready: true, icon: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/>' },
          { id: 'analyze', label: '分析', ready: true, icon: '<path d="M6 3.5L2 8l4 4.5M10 3.5L14 8l-4 4.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' },
          { id: 'decode', label: '解码', ready: true, icon: '<circle cx="5.2" cy="8" r="2.7" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.9 8H14M11.2 8v3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' },
          { id: 'forensic', label: '取证', ready: true, icon: '<path d="M4 1.8h5l3 3v9.4H4z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 1.8v3h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' },
        ],
        ICON: {
          task: '<rect x="2.5" y="3" width="11" height="10.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 6.5h5M5.5 9.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
          cfg: '<circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
        },
        METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        OPS: [
          ['base64_decode', 'Base64 解码'], ['base64_encode', 'Base64 编码'],
          ['url_decode', 'URL 解码'], ['url_encode', 'URL 编码'],
          ['hex_decode', 'Hex 解码'], ['hex_encode', 'Hex 编码'],
          ['unicode_decode', 'Unicode'], ['html_decode', 'HTML 实体'],
          ['md5', 'MD5'], ['sha1', 'SHA1'], ['sha256', 'SHA256'],
          ['rot13', 'ROT13'], ['reverse', '反转'], ['strip', '去空白'], ['json_pretty', 'JSON 美化'],
        ],
        LV_CLASS, LV_DOT, KIND_CLASS,
      }
    },

    computed: {
      runBusy() { return !!(this.run && ['queued', 'running'].includes(this.run.status)) },
      dRunBusy() { return !!(this.dRun && ['queued', 'running'].includes(this.dRun.status)) },
      filteredAssets() {
        const q = (this.assetQ || '').trim().toLowerCase()
        return this.assets.filter(a => {
          if (this.assetKind && a.kind !== this.assetKind) return false
          if (!q) return true
          return (a.addr + ' ' + a.stack + ' ' + a.source).toLowerCase().includes(q)
        })
      },
      filteredRisks() {
        return this.risks.filter(r => {
          if (this.riskLevel && r.level !== this.riskLevel) return false
          if (this.riskStatus && r.status !== this.riskStatus) return false
          return true
        })
      },
      respText() {
        if (!this.vResp || !this.vResp.ok) return ''
        const h = Object.entries(this.vResp.headers || {}).map(([k, v]) => k + ': ' + v).join('\n')
        return 'HTTP ' + this.vResp.status + '  (' + this.vResp.ms + 'ms, ' + this.vResp.size + 'B)\n' +
          h + '\n\n' + (this.vResp.body || '')
      },
      solveText() {
        return this.dSolve ? JSON.stringify(this.dSolve, null, 2) : ''
      },
      disasmText() {
        if (!this.aDisasm) return ''
        return this.aDisasm.insns.map((i) =>
          this.hex(i.addr).padEnd(12) + i.bytes.padEnd(20) + i.text).join('\n')
      },
    },

    watch: {
      taskId(v) {
        try { localStorage.setItem(LS_TASK, String(v || 0)) } catch (e) {}
      },
    },

    async mounted() {
      await this.loadTasks()
      await this.loadEnvLite()
      // 没有记住的任务时自动选最近一个 —— 否则进来一片空白, 像是插件坏了
      const tid = this.taskId || (this.tasks.length ? this.tasks[0].id : 0)
      if (tid) await this.selectTask(tid, true)
      this.log('插件已挂载 · 6 个模块 · 宿主提供左侧导航，本插件不自带侧栏')
    },

    beforeUnmount() { this.clearTimers() },

    methods: {
      // ── 基础 ──
      tsText, pct(run) {
        if (!run || !run.total) return run && run.status === 'completed' ? 100 : 4
        return Math.max(2, Math.min(100, Math.round(run.done / run.total * 100)))
      },
      fmtSize(n) {
        n = Number(n || 0)
        if (n < 1024) return n + ' B'
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
        return (n / 1024 / 1024).toFixed(2) + ' MB'
      },
      log(msg) {
        const d = new Date()
        const p = (x) => String(x).padStart(2, '0')
        this.logs.unshift({ tm: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()), msg: String(msg) })
        if (this.logs.length > 80) this.logs.pop()
      },
      flash(msg, isErr) {
        if (isErr) { this.err = msg; setTimeout(() => { if (this.err === msg) this.err = '' }, 6000) }
        else { this.ok = msg; setTimeout(() => { if (this.ok === msg) this.ok = '' }, 2500) }
      },
      copy(t) {
        try {
          navigator.clipboard.writeText(t)
          this.flash('已复制')
        } catch (e) { this.flash('复制失败：' + e.message, true) }
      },
      clearTimers() {
        if (this._t1) { clearInterval(this._t1); this._t1 = null }
        if (this._t2) { clearInterval(this._t2); this._t2 = null }
      },
      toggleMini() {
        this.mini = !this.mini
        try { localStorage.setItem(LS_MINI, this.mini ? '1' : '0') } catch (e) {}
      },
      opLabel(op) {
        const f = this.OPS.find(x => x[0] === op)
        return f ? f[1] : op
      },

      // ── 任务 ──
      async loadTasks() {
        try {
          const r = await ctx.invoke('atk.task.list')
          this.tasks = r.tasks || []
        } catch (e) { this.flash('读取任务失败：' + e.message, true) }
      },
      async createTask() {
        const name = (this.newName || '').trim() || (this.newTarget || '').trim()
        if (!name) { this.flash('填个任务名，或者填目标自动命名', true); return }
        try {
          const r = await ctx.invoke('atk.task.create', { name, target: this.newTarget || '' })
          this.newName = ''; this.newTarget = ''
          await this.loadTasks()
          await this.selectTask(r.task.id)
          this.flash('任务已创建')
        } catch (e) { this.flash('创建失败：' + e.message, true) }
      },
      async selectTask(id, quiet) {
        try {
          const r = await ctx.invoke('atk.task.get', { task_id: id })
          this.taskId = id
          this.task = r.task
          if (!this.target) this.target = r.task.target || ''
          await Promise.all([this.loadAssets(), this.loadRisks()])
          if (!quiet) { this.cur = 'recon'; this.flash('已切换到「' + r.task.name + '」') }
        } catch (e) { this.flash('切换任务失败：' + e.message, true) }
      },
      async removeTask(t) {
        if (!confirm('删除任务「' + t.name + '」？资产与风险会一并删除，不可恢复。')) return
        try {
          await ctx.invoke('atk.task.delete', { task_id: t.id })
          if (this.taskId === t.id) { this.taskId = 0; this.task = null; this.assets = []; this.risks = [] }
          await this.loadTasks()
          this.flash('任务已删除')
        } catch (e) { this.flash('删除失败：' + e.message, true) }
      },
      async exportTask(fmt, id) {
        const tid = id || this.taskId
        if (!tid) { this.flash('先选一个任务', true); return }
        try {
          const r = await ctx.invoke('atk.task.export', { task_id: tid, format: fmt })
          download(r.filename, r.content, fmt === 'json' ? 'application/json' : 'text/markdown')
          this.log('已导出 ' + r.filename)
        } catch (e) { this.flash('导出失败：' + e.message, true) }
      },

      // ── 侦察 ──
      async onEnter(m) {
        if (m === 'recon') await this.loadAssets()
        if (m === 'detect') { await this.loadAssets(); await this.loadRisks() }
        if (m === 'verify') await this.loadRisks()
        if (m === 'forensic') await this.loadArtifacts()
        if (m === 'env') await this.loadEnv()
        if (m === 'tasks') await this.loadTasks()
      },
      async startRecon() {
        if (!this.taskId) { this.flash('先新建或选择一个任务', true); this.cur = 'tasks'; return }
        const t = (this.target || '').trim()
        if (!t) { this.flash('填写目标', true); return }
        try {
          const r = await ctx.invoke('atk.recon.start', {
            task_id: this.taskId, target: t, modes: this.modes, intensity: this.intensity,
          })
          this.run = r.run
          this.log('侦察已启动 ' + r.run_id)
          this.pollRecon(r.run_id)
        } catch (e) { this.flash('启动失败：' + e.message, true) }
      },
      async stopRecon() {
        try {
          await ctx.invoke('atk.recon.stop', { run_id: this.run && this.run.id })
          this.log('已请求停止')
        } catch (e) { this.flash(e.message, true) }
      },
      pollRecon(runId) {
        if (this._t1) clearInterval(this._t1)
        const tick = async () => {
          try {
            const [s, a] = await Promise.all([
              ctx.invoke('atk.recon.status', { run_id: runId }),
              ctx.invoke('atk.recon.assets', { task_id: this.taskId }),
            ])
            this.run = s.run
            this.assets = a.assets || []
            if (this.run && !['queued', 'running'].includes(this.run.status)) {
              clearInterval(this._t1); this._t1 = null
              this.log('侦察结束：' + this.run.status + '，资产 ' + this.assets.length + ' 条')
              this.loadTasks()
            }
          } catch (e) {
            clearInterval(this._t1); this._t1 = null
            this.flash('轮询失败：' + e.message, true)
          }
        }
        tick()
        this._t1 = setInterval(tick, 900)
      },
      async loadAssets() {
        if (!this.taskId) { this.assets = []; return }
        try {
          const r = await ctx.invoke('atk.recon.assets', { task_id: this.taskId })
          this.assets = r.assets || []
          const last = await ctx.invoke('atk.recon.status', { task_id: this.taskId }).catch(() => null)
          if (last && last.run) this.run = last.run
        } catch (e) { /* 静默：没任务时不必吵 */ }
      },
      countKind(k) { return this.assets.filter(a => a.kind === k).length },
      countLevel(l) { return this.risks.filter(r => r.level === l).length },
      async delAsset(a) {
        if (!confirm('删除资产 ' + a.addr + '？')) return
        try {
          await ctx.invoke('atk.recon.assets.delete', { asset_id: a.id })
          await this.loadAssets()
        } catch (e) { this.flash(e.message, true) }
      },
      probeAsset(a) {
        this.vUrl = a.addr.startsWith('http') ? a.addr : ('https://' + a.addr + (a.port && a.port !== 443 ? ':' + a.port : ''))
        this.vRisk = null
        this.vTab = 'body'
        this.cur = 'verify'
        this.onEnter('verify')
        this.log('已把 ' + a.addr + ' 带到验证模块')
      },

      // ── 检测 ──
      async startDetect() {
        if (!this.taskId) { this.flash('先选任务', true); return }
        try {
          const r = await ctx.invoke('atk.detect.start', { task_id: this.taskId })
          this.dRun = r.run
          this.log('检测已启动 ' + r.run_id)
          this.pollDetect(r.run_id)
        } catch (e) { this.flash('启动失败：' + e.message, true) }
      },
      pollDetect(runId) {
        if (this._t2) clearInterval(this._t2)
        const tick = async () => {
          try {
            const [s, r] = await Promise.all([
              ctx.invoke('atk.detect.status', { run_id: runId }),
              ctx.invoke('atk.detect.risks', { task_id: this.taskId }),
            ])
            this.dRun = s.run
            this.risks = r.risks || []
            if (this.dRun && !['queued', 'running'].includes(this.dRun.status)) {
              clearInterval(this._t2); this._t2 = null
              this.log('检测结束：' + this.dRun.status + '，风险 ' + this.risks.length + ' 条')
              this.loadTasks()
            }
          } catch (e) {
            clearInterval(this._t2); this._t2 = null
            this.flash('轮询失败：' + e.message, true)
          }
        }
        tick()
        this._t2 = setInterval(tick, 900)
      },
      async loadRisks() {
        if (!this.taskId) { this.risks = []; return }
        try {
          const r = await ctx.invoke('atk.detect.risks', { task_id: this.taskId })
          this.risks = r.risks || []
          const last = await ctx.invoke('atk.detect.status', { task_id: this.taskId }).catch(() => null)
          if (last && last.run) this.dRun = last.run
        } catch (e) {}
      },

      // ── 验证 ──
      pickRisk(r) {
        this.vRisk = r
        this.vUrl = r.target.startsWith('http') ? r.target : 'https://' + r.target
        this.vTab = 'payload'
        if (!this.payloadKinds.length) this.loadPayloads('')
        this.log('已选择风险：' + r.kind)
      },
      async loadPayloads(kind) {
        try {
          const r = await ctx.invoke('atk.verify.payloads', kind ? { kind } : {})
          if (kind) { this.payloads = r.items || []; this.pKind = kind }
          else { this.payloadKinds = r.kinds || [] }
        } catch (e) { this.flash(e.message, true) }
      },
      insertPayload(v) {
        if (this.vTab === 'payload') this.vTab = 'body'
        this.vBody = (this.vBody ? this.vBody + '\n' : '') + v
        this.log('已插入载荷')
      },
      async sendReq() {
        if (!this.vUrl) { this.flash('填 URL', true); return }
        this.vBusy = true
        try {
          this.vResp = await ctx.invoke('atk.verify.request', {
            method: this.vMethod, url: this.vUrl, headers: this.vHeaders, body: this.vBody, timeout: 12,
          })
          this.log(this.vMethod + ' ' + this.vUrl + ' → ' + (this.vResp.ok ? this.vResp.status + ' ' + this.vResp.ms + 'ms' : '失败'))
        } catch (e) { this.flash('请求失败：' + e.message, true) }
        this.vBusy = false
      },
      async saveConclusion(kind) {
        try {
          let poc = ''
          if (kind === '确认') {
            const p = await ctx.invoke('atk.verify.poc', {
              request: { method: this.vMethod, url: this.vUrl, headers: this.parseHeaders(), body: this.vBody },
            })
            poc = p.poc || ''
          }
          await ctx.invoke('atk.verify.save', {
            risk_id: this.vRisk ? this.vRisk.id : 0,
            task_id: this.taskId,
            conclusion: kind,
            request: { method: this.vMethod, url: this.vUrl, headers: this.parseHeaders(), body: this.vBody },
            response: this.vResp || {},
            poc,
          })
          if (poc) download('poc.sh', poc, 'text/x-shellscript')
          await this.loadRisks()
          this.flash('已' + (kind === '确认' ? '确认并归档 POC' : '标记为误报'))
        } catch (e) { this.flash('保存失败：' + e.message, true) }
      },
      parseHeaders() {
        const out = {}
        ;(this.vHeaders || '').split('\n').forEach((l) => {
          const i = l.indexOf(':')
          if (i > 0) out[l.slice(0, i).trim()] = l.slice(i + 1).trim()
        })
        return out
      },

      // ── 分析 ──
      onBinPick(e) {
        const f = e.target.files && e.target.files[0]
        if (f) this.readBin(f)
        e.target.value = ''
      },
      onBinDrop(e) {
        const f = e.dataTransfer.files && e.dataTransfer.files[0]
        if (f) this.readBin(f)
      },
      readBin(f) {
        if (f.size > 32 * 1024 * 1024) { this.flash('样本超过 32MB', true); return }
        this.aBusy = true
        const fr = new FileReader()
        fr.onload = async () => {
          try {
            const b64 = String(fr.result).split(',')[1] || ''
            const r = await ctx.invoke('atk.analyze.upload', {
              task_id: this.taskId, filename: f.name, data_b64: b64,
            })
            this.aInfo = r.info
            this.aInfo.id = r.sample_id        // ★ 后续接口都用这个 id
            this.aInfo.filename = r.filename
            this.aInfo.size = r.size
            this.aFuncs = []; this.aDisasm = null; this.aStrings = null
            this.aTab = 'sections'
            this.log('已解析 ' + f.name + ' → ' + r.kind + ' ' + (r.info.bits || '') + '-bit')
            await this.loadFuncs()
            this.disasmAt(this.aInfo.entry)
          } catch (e) { this.flash('解析失败：' + e.message, true) }
          this.aBusy = false
        }
        fr.onerror = () => { this.aBusy = false; this.flash('读文件失败', true) }
        fr.readAsDataURL(f)
      },
      async loadFuncs() {
        if (!this.aInfo) return
        try {
          const r = await ctx.invoke('atk.analyze.functions', { sample_id: this.aInfo.id })
          this.aFuncs = r.functions || []
        } catch (e) { /* 无符号表不算错误 */ }
      },
      async disasmAt(addr) {
        if (!this.aInfo) return
        try {
          this.aDisasm = await ctx.invoke('atk.analyze.disasm', {
            sample_id: this.aInfo.id, addr: Number(addr) || 0, count: 60,
          })
        } catch (e) { this.flash('反汇编失败：' + e.message, true) }
      },
      async loadStrings() {
        if (this.aStrings || !this.aInfo) return
        try {
          this.aStrings = await ctx.invoke('atk.analyze.strings', { sample_id: this.aInfo.id })
        } catch (e) { this.flash(e.message, true) }
      },
      hex(v) {
        if (v === null || v === undefined) return '—'
        const n = Number(v)
        return '0x' + (n < 0 ? 0 : n).toString(16).padStart(8, '0')
      },
      protLabel(k) {
        return { pie: 'PIE', nx: 'NX', canary: 'Canary', relro: 'RELRO', stack_exec: '可执行栈',
                 aslr: 'ASLR', dep: 'DEP', cfg: 'CFG', high_entropy_va: '高熵VA' }[k] || k
      },
      protVal(v) {
        if (typeof v === 'boolean') return v ? '是' : '否'
        return v
      },
      protClass(k, v) {
        const good = (k === 'stack_exec') ? !v : (typeof v === 'boolean' ? v : v !== '无')
        if (typeof v === 'string') return v === '全' ? 'rcat-b-low' : v === '部分' ? 'rcat-b-mid' : 'rcat-b-gray'
        return good ? 'rcat-b-low' : 'rcat-b-high'
      },
      capOf(name) {
        if (!this.aInfo || !this.aInfo.suspicious) return ''
        const base = String(name).split('!').pop().split('@')[0]
        const hit = this.aInfo.suspicious.find((x) => String(x.api).split('!').pop().split('@')[0] === base)
        return hit ? hit.cap : ''
      },

      // ── 解码 ──
      async identify() {
        if (!this.dInput) return
        try {
          const r = await ctx.invoke('atk.decode.identify', { input: this.dInput })
          this.dCands = r.candidates || []
          this.log('识别完成：' + (this.dCands[0] ? this.dCands[0].kind + ' ' + this.dCands[0].confidence + '%' : '无结论'))
        } catch (e) { this.flash(e.message, true) }
      },
      addOp(op) {
        this.dChain.push(op)
        this.runChain()
      },
      async runChain() {
        if (!this.dInput || !this.dChain.length) return
        try {
          const r = await ctx.invoke('atk.decode.chain', {
            input: this.dInput, ops: this.dChain.map(x => ({ op: x })),
          })
          this.dSteps = r.steps || []
          this.dOut = r.output || ''
          const bad = this.dSteps.find(s => !s.ok)
          if (bad) this.flash('第 ' + (this.dSteps.indexOf(bad) + 1) + ' 步失败：' + bad.error, true)
        } catch (e) { this.flash(e.message, true) }
      },
      async solve(kind) {
        try {
          const p = { kind, input: this.dInput }
          if (kind === 'rsa') { p.n = this.rsaN; p.e = this.rsaE; p.c = this.rsaC }
          this.dSolve = await ctx.invoke('atk.decode.solve', p)
          this.log('求解完成：' + kind)
        } catch (e) { this.flash(e.message, true) }
      },

      // ── 取证 ──
      onPick(e) {
        const f = e.target.files && e.target.files[0]
        if (f) this.readFile(f)
        e.target.value = ''
      },
      onDrop(e) {
        const f = e.dataTransfer.files && e.dataTransfer.files[0]
        if (f) this.readFile(f)
      },
      readFile(f) {
        if (f.size > 3 * 1024 * 1024) {
          this.flash('文件 ' + this.fmtSize(f.size) + ' 超过 3MB 上限（宿主单帧 8MB，base64 会再涨 1/3）', true)
          return
        }
        this.fBusy = true
        const fr = new FileReader()
        fr.onload = async () => {
          try {
            const b64 = String(fr.result).split(',')[1] || ''
            const r = await ctx.invoke('atk.forensic.upload', {
              task_id: this.taskId, filename: f.name, data_b64: b64,
            })
            this.log('已解析 ' + f.name + ' → ' + r.kind)
            await this.loadArtifacts()
            this.flash('解析完成：' + r.kind)
          } catch (e) { this.flash('解析失败：' + e.message, true) }
          this.fBusy = false
        }
        fr.onerror = () => { this.fBusy = false; this.flash('读文件失败', true) }
        fr.readAsDataURL(f)
      },
      async loadArtifacts() {
        if (!this.taskId) { this.artifacts = []; return }
        try {
          const r = await ctx.invoke('atk.forensic.extract', { task_id: this.taskId })
          this.artifacts = r.artifacts || []
        } catch (e) {}
      },
      async loadTimeline() {
        if (!this.taskId) { this.timeline = []; return }
        try {
          const r = await ctx.invoke('atk.forensic.timeline', { task_id: this.taskId })
          this.timeline = r.items || []
        } catch (e) {}
      },

      // ── 环境 ──
      async loadEnvLite() {
        try {
          const s = await ctx.invoke('atk.env.scope')
          this.scope = s.scope
          this.scopeOptions = s.options || []
        } catch (e) {}
      },
      async loadEnv() {
        try {
          const [t, i, s] = await Promise.all([
            ctx.invoke('atk.env.tools'), ctx.invoke('atk.env.info'), ctx.invoke('atk.env.scope'),
          ])
          this.env = t; this.info = i
          this.scope = s.scope; this.scopeOptions = s.options || []
        } catch (e) { this.flash(e.message, true) }
      },
      async setScope(v) {
        try {
          const r = await ctx.invoke('atk.env.setScope', { scope: v })
          this.scope = r.scope
          this.log('目标范围已设为 ' + v)
        } catch (e) { this.flash(e.message, true) }
      },
    },
  }

  const vm = createApp(App)
  const stop = () => { try { vm.unmount() } catch (e) {} }
  vm.mount(container)
  return stop
}

export function register(g) {
  g.__rcPluginV4__ = g.__rcPluginV4__ || {}
  g.__rcPluginV4__[NAME] = { pages: [{ path: '', title: '网络攻防工具库' }], mount }
}
if (typeof window !== 'undefined') register(window)
