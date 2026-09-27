<script setup>
import { ref, onMounted, computed, watch, onErrorCaptured } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api'
import Logs from '../logs/Logs.vue'
import BackupMain from '../backup/BackupMain.vue'
import Processes from '../processes/Processes.vue'
import ServiceHealth from '../ServiceHealth.vue'
import EnvPkgMain from '../envpkg/EnvPkgMain.vue'
import Ifaces from '../Ifaces.vue'

// 子级选项卡(父级为「系统中心」; 支持侧边栏深链 /sysfunc/<key>)
const route = useRoute()
const router = useRouter()
const SUBKEYS = ['logs','processes','svc','sh','hw','up','disk','snap','usr','clean','env','pwr','kern','tz','health','events','lr','backup','boot','api','ifa']
// 页面型子组件(自带取数, 不走 loadSection)
const COMP_SUBS = ['logs', 'processes', 'backup', 'sh', 'env', 'ifa']
const sub = ref('logs')
function activate(k) {
  if (!SUBKEYS.includes(k)) k = 'logs'
  sub.value = k
  if (!COMP_SUBS.includes(k) && !data.value[k]) loadSection(k)
  apiPoll(k)
}
const appErr = ref('')
onErrorCaptured((e) => { appErr.value = String((e && (e.message || e)) || '渲染错误') })
const open = ref({})
const loading = ref({})
const err = ref({})
const data = ref({})
const notice = ref('')
function toast(m) { notice.value = m; setTimeout(() => { notice.value = '' }, 3000) }
async function call(key, fn) {
  loading.value[key] = true; err.value[key] = ''
  try { data.value[key] = await fn() } catch (e) { err.value[key] = e.message }
  finally { loading.value[key] = false }
}
function loadSection(k) {
  const jobs = {
    svc: () => api.sysfServiceList(),
    hw: () => api.sysfHardware(),
    up: () => api.sysfUpdatesList(),
    disk: () => api.sysfDisks(),
    snap: () => api.sysfSnapCap(),
    usr: () => api.sysfUsers(),
    clean: () => api.sysfCleanScan(),
    pwr: () => api.sysfPwrState(),
    kern: () => api.sysfKernels(),
    tz: () => api.sysfTime(),
    health: () => api.sysfHealth(),
    events: () => api.sysfEvents(150),
    lr: () => api.sysfLogrotateList(),
    boot: () => api.sysfBootHistory(),
    api: () => loadApi(),
  };
  if (jobs[k]) call(k, jobs[k])
  if (k === 'snap') call('snapList', api.sysfSnapList) // 已有快照列表(此前从未拉取)
}
async function svcAct(u, act) {
  try { const r = await api.sysfServiceAction(u.unit, act); data.value.svcMsg = (r && (r.out || r.error)) || 'ok' } catch (e) { data.value.svcMsg = e.message }
  loadSection('svc')
}
async function updRefresh() { data.value.upMsg = '更新索引中...'; try { const r = await api.sysfUpdatesRefresh(); data.value.upMsg = (r && (r.out || r.error)) || 'ok' } catch (e) { data.value.upMsg = e.message }
  loadSection('up')
}
async function updRun() {
  if (!confirm('确认执行 apt upgrade 升级全部软件包？\n此操作需要几分钟。')) return
  data.value.upMsg = '升级中(可能数分钟)...';
  try { const r = await api.sysfUpdatesRun(); data.value.upMsg = (r && (r.out || r.error)) || 'done' } catch (e) { data.value.upMsg = e.message }
  loadSection('up')
}
const snapName = ref('')
async function snapCreate() {
  if (!snapName.value.trim()) return
  try { const r = await api.sysfSnapCreate(snapName.value.trim()); toast(r && r.ok ? '快照已创建' : ((r && r.error) || '创建失败')) } catch (e) { toast(e.message) }
  snapName.value = ''
  loadSection('snap')
}
const sshUser = ref('')
const sshKeys = ref('')
async function sshLoad(u) { sshUser.value = u; await call('keys', () => api.sysfSshKeys(u)); const d = data.value.keys || {}; sshKeys.value = d.keys || d.error || '' }
async function sshSave() { try { const r = await api.sysfSshKeysSave(sshUser.value, sshKeys.value); toast(r && r.ok ? '已保存(sshd 立即生效)' : ((r && r.error) || '失败')) } catch (e) { toast(e.message) } }
const svcFilter = ref('')
onMounted(() => {
  activate(route.params.sub || 'logs')
  if (!route.params.sub) router.replace('/sysfunc/logs')
})
watch(() => route.params.sub, (v) => {
  const k = SUBKEYS.includes(v) ? v : 'logs'
  if (k !== sub.value) activate(k)
})

const SUBS = [
  { key: 'logs', label: '系统日志' },
  { key: 'processes', label: '进程管理' },
  { key: 'svc', label: '服务管理' },
  { key: 'sh', label: '服务健康' },
  { key: 'hw', label: '硬件' },
  { key: 'up', label: '系统更新' },
  { key: 'disk', label: '磁盘' },
  { key: 'snap', label: '快照' },
  { key: 'usr', label: '用户/密钥' },
  { key: 'clean', label: '存储清理' },
  { key: 'env', label: '环境包' },
  { key: 'pwr', label: '关机/重启' },
  { key: 'kern', label: '内核管理' },
  { key: 'tz', label: '时间/NTP' },
  { key: 'health', label: '健康检查' },
  { key: 'events', label: '事件时间线' },
  { key: 'lr', label: '日志保留' },
  { key: 'backup', label: '系统备份' },
  { key: 'boot', label: '启动历史' },
  { key: 'api', label: '接口监控' },
  { key: 'ifa', label: '接口总览' },
];

const subLabel = computed(() => (SUBS.find((s) => s.key === sub.value) || { label: '' }).label)
const paneLoading = computed(() =>
  loading.value[sub.value] && !data.value[sub.value] && !COMP_SUBS.includes(sub.value))
const svcUnits = computed(() => (data.value.svc || {}).units || [])
const healthChecks = computed(() => (data.value.health || {}).checks || [])
const healthOk = computed(() => healthChecks.value.filter((x) => x.ok).length)
const healthFail = computed(() => healthChecks.value.length - healthOk.value)
const maxDiskUse = computed(() => {
  let m = 0
  for (const d of (data.value.disk || {}).df || []) {
    const v = parseInt(d.use)
    if (!isNaN(v) && v > m) m = v
  }
  return m
})
function parseSize(s) {
  const m = /^([\d.]+)\s*([KMGT])?/.exec(String(s || ''))
  if (!m) return 0
  const n = parseFloat(m[1]) || 0
  const mult = { K: 1, M: 1024, G: 1048576, T: 1073741824 }[m[2]] || 1
  return n * mult
}
function topBar(s) {
  const rows = (data.value.clean || {}).dirs || []
  let max = 1
  for (const d of rows) { const v = parseSize(d.size); if (v > max) max = v }
  return Math.max(3, Math.round((parseSize(s) / max) * 100))
}
function eventActCls(a) {
  const s = String(a || '')
  if (/stop|reboot|shutdown|remove|delete|fail|error|kill/i.test(s)) return 'chip-err'
  if (/start|create|save|sync|add/i.test(s)) return 'chip-ok'
  return 'chip-info'
}

// ---- 第三批功能动作 ----
async function healthRestart() {
  if (!confirm('确认重启面板服务(raincough)？连接会闪断几秒。')) return
  try { const r = await api.sysfHealthRestart(); toast((r && r.ok !== false) ? '已发送重启' : ((r && r.error) || '失败')) } catch (e) { toast(e.message) }
}
const lrEdit = ref(null)
function lrSelect(f) { lrEdit.value = { name: f.name, content: f.content } }
async function lrSave() {
  if (!lrEdit.value) return
  try { const r = await api.sysfLogrotateSave(lrEdit.value.name, lrEdit.value.content); toast((r && r.ok !== false) ? '已保存' : ((r && r.error) || '失败')) } catch (e) { toast(e.message) }
  loadSection('lr')
}


let apiTimer = null
const apiPollOn = ref(true)
async function loadApi() {
  const [st, cl] = await Promise.all([api.sysfApiStats(), api.sysfApiCalls(300)])
  data.value.apiStats = st
  data.value.apiCalls = (cl && cl.calls) || []
}
function apiPoll(k) {
  if (apiTimer) { clearInterval(apiTimer); apiTimer = null }
  if (k === 'api' && apiPollOn.value) apiTimer = setInterval(() => { loadApi().catch(() => {}) }, 3000)
}
function toggleApiPoll() {
  apiPollOn.value = !apiPollOn.value
  if (sub.value === 'api') apiPoll('api')
}
async function clearApiCalls() { try { await api.sysfApiClear(); data.value.apiCalls = [] } catch (e) {} }
// (原 codeCls 已随状态码芯片内联化移除)


// ---- 补充动作函数(模板引用, 旧源码缺) ----
async function cleanDo(item) {
  // 逐项确认: 常驻类数据给出不可恢复警告
  let msg = '清理「' + (item.label || item.key) + '」' + (item.path ? ' (' + item.path + ')' : '') + ' ?'
  if (item.key === 'workspace') {
    msg = '确定清除【工作台常驻历史】？\n\n' +
      '· 该数据永久保存、从不自动过期，「存储清理」是唯一删除入口\n' +
      '· 清除后不可恢复，工作台图表将从零重新累积\n\n继续？'
  }
  if (!confirm(msg)) return
  try {
    const r = await api.sysfCleanDo(item.key)
    if (r && r.ok !== false) toast(r && r.output ? String(r.output).trim() : '已清理')
    else toast((r && r.error) || '清理失败')
  } catch (e) { toast('清理失败: ' + e.message) }
  loadSection('clean')
}
async function kernRemove(pkg) {
  if (!confirm('删除内核 ' + pkg + ' ?')) return
  try { const r = await api.sysfKernelRemove(pkg); toast(r && r.ok !== false ? '已删除' : ((r && r.error) || '删除失败')) } catch (e) { toast(e.message) }
  loadSection('kern')
}
async function timeSyncDo() {
  try { const r = await api.sysfTimeSync(); toast(r && r.ok !== false ? '已同步' : ((r && r.error) || '同步失败')) } catch (e) { toast(e.message) }
  loadSection('tz')
}
const pwrAction = ref('reboot')
const pwrMin = ref(1)
const pwrEpoch = computed(() => {
  const s = (data.value.pwr || {}).state
  return (!s || s === 'none') ? '' : s
})
async function pwrPlan() {
  const action = pwrAction.value
  const minutes = Number(pwrMin.value) || 1
  if (!confirm((action === 'reboot' ? '重启' : '关机') + ' ' + minutes + ' 分钟后?')) return
  try { const r = await api.sysfPwrPlan(action, minutes); toast(r && r.ok !== false ? '已计划' : ((r && r.error) || '失败')) } catch (e) { toast(e.message) }
  loadSection('pwr')
}
async function pwrCancel() {
  try { const r = await api.sysfPwrCancel(); toast(r && r.ok !== false ? '已取消' : ((r && r.error) || '失败')) } catch (e) { toast(e.message) }
  loadSection('pwr')
}

</script>

<template>
  <div class="sys-page">
    <div v-if="notice" class="notice">{{ notice }}</div>
    <div v-if="appErr" class="error" style="margin-bottom:10px">运行/渲染错误: {{ appErr }}</div>
    <div v-if="paneLoading" class="pane-load">⟳ 正在加载 {{ subLabel }} …</div>

    <!-- 页面型子组件(自带取数): 日志/进程/备份 + 融入的服务健康/环境包/接口总览 -->
    <Logs v-if="sub === 'logs'" />
    <Processes v-if="sub === 'processes'" />
    <BackupMain v-if="sub === 'backup'" />
    <ServiceHealth v-if="sub === 'sh'" />
    <EnvPkgMain v-if="sub === 'env'" />
    <Ifaces v-if="sub === 'ifa'" />

    
      <template v-if="sub === 'boot'">
        <div class="pane-head">
          <span class="pane-title">启动历史</span>
          <span class="pane-sub">本次启动 {{ (data.boot || {}).boot_started || '—' }}</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('boot')">⟳ 刷新</button>
        </div>
        <table class="table"><thead><tr><th>动作</th><th>时间</th></tr></thead>
          <tbody><tr v-for="(r,i) in (data.boot || {}).rows || []" :key="i">
            <td><span class="tag-chip" :class="r.action === 'current' ? 'chip-ok' : 'chip-dim'">{{ r.action }}</span></td><td class="mono faint">{{ r.when }}</td></tr></tbody></table>
        <div v-if="!((data.boot || {}).rows || []).length" class="hint">无记录(或 last 无法读取)</div>
      </template>
      <template v-if="sub === 'api'">
        <div class="pane-head">
          <span class="pane-title">接口监控</span>
          <span class="pane-sub">路由统计 · 实时请求流水</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadApi">⟳ 刷新</button>
          <button class="btn btn-sm" @click="toggleApiPoll">{{ apiPollOn ? '⏸ 暂停' : '▶ 轮询' }}</button>
          <button class="btn btn-sm btn-ghost" @click="clearApiCalls">清空</button>
        </div>
        <div class="stat-row">
          <div class="tile"><span class="k">路由总数</span><span class="v">{{ (data.apiStats || {}).routes_total || 0 }}</span></div>
          <div class="tile"><span class="k">累计调用</span><span class="v">{{ (data.apiStats || {}).calls_total || 0 }}</span></div>
          <div class="tile" :class="(data.apiStats || {}).calls_4xx ? 'tile-warn' : ''"><span class="k">4xx</span><span class="v" :class="(data.apiStats||{}).calls_4xx ? 'txt-warn' : ''">{{ (data.apiStats || {}).calls_4xx || 0 }}</span></div>
          <div class="tile" :class="(data.apiStats || {}).calls_5xx ? 'tile-danger' : ''"><span class="k">5xx</span><span class="v" :class="(data.apiStats||{}).calls_5xx ? 'txt-danger' : ''">{{ (data.apiStats || {}).calls_5xx || 0 }}</span></div>
        </div>
        <div class="flex" style="margin-bottom:8px;flex-wrap:wrap;gap:6px">
          <span v-for="(n,m) in (data.apiStats||{}).methods || {}" :key="m" class="tag-chip chip-info">{{ m }} {{ n }}</span>
        </div>
        <table class="table">
          <thead><tr><th>时间</th><th>方法</th><th>路径</th><th>状态</th><th>耗时</th><th>来源</th></tr></thead>
          <tbody>
            <tr v-for="(c,i) in data.apiCalls || []" :key="i">
              <td class="mono faint">{{ c.ts }}</td>
              <td><span class="tag-chip" :class="c.method==='POST' ? 'chip-err' : (c.method==='DELETE' ? 'chip-warn' : 'chip-ok')">{{ c.method }}</span></td>
              <td class="mono">{{ c.path }}</td>
              <td><span class="tag-chip" :class="c.code < 400 ? 'chip-ok' : (c.code < 500 ? 'chip-warn' : 'chip-err')">{{ c.code }}</span></td>
              <td class="mono" :class="(c.ms || 0) >= 1000 ? 'txt-danger' : ''">{{ c.ms }}ms</td>
              <td class="mono faint">{{ c.ip }}</td>
            </tr>
            <tr v-if="!(data.apiCalls || []).length"><td colspan="6" class="hint">暂无记录(有请求后出现; 轮询 3s 自动刷新)</td></tr>
          </tbody>
        </table>
      </template>

<div v-if="!COMP_SUBS.includes(sub)" class="sf-body">
      <div v-if="err[sub]" class="error">{{ err[sub] }}</div>

      <template v-if="sub === 'svc'">
        <div class="pane-head">
          <span class="pane-title">服务单元</span>
          <span class="tag-chip" :class="svcUnits.some(u => u.active === 'failed') ? 'chip-err' : 'chip-ok'">{{ svcUnits.filter(u => u.active === 'active').length }}/{{ svcUnits.length }} 运行中</span>
          <span class="grow"></span>
          <input v-model="svcFilter" class="input" style="max-width:220px" placeholder="过滤服务名…" />
          <button class="btn btn-sm" @click="loadSection('svc')">⟳</button>
        </div>
        <div v-if="data.svcMsg" class="mono-block" style="margin-bottom:8px">{{ data.svcMsg }}</div>
        <div class="svc-grid">
          <div v-for="u in svcUnits" :key="u.unit" v-show="!svcFilter || u.unit.indexOf(svcFilter) >= 0" class="svc-card">
            <div class="svc-top">
              <span class="led" :class="u.active === 'active' ? 'on' : (u.active === 'failed' ? 'bad' : '')"></span>
              <span class="svc-name mono">{{ u.unit }}</span>
            </div>
            <div class="svc-sub">
              <span class="tag-chip" :class="u.active === 'active' ? 'chip-ok' : (u.active === 'failed' ? 'chip-err' : 'chip-dim')">{{ u.active }}</span>
              <span class="faint" style="margin-left:6px">自启 {{ u.sub }}</span>
            </div>
            <div class="svc-actions">
              <button class="btn btn-sm btn-primary" @click="svcAct(u, 'start')">启动</button>
              <button class="btn btn-sm" @click="svcAct(u, 'stop')">停止</button>
              <button class="btn btn-sm" @click="svcAct(u, 'restart')">重启</button>
              <span class="grow"></span>
              <button class="btn btn-sm btn-ghost" @click="svcAct(u, 'enable')">自启开</button>
              <button class="btn btn-sm btn-ghost" @click="svcAct(u, 'disable')">自启关</button>
            </div>
          </div>
        </div>
      </template>

      <template v-if="sub === 'hw'">
        <div class="pane-head">
          <span class="pane-title">硬件概览</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('hw')">⟳ 刷新</button>
        </div>
        <div class="hv-grid">
          <div class="stat"><span class="st-k">CPU</span><b class="mono" style="font-size:13px">{{ ((data.hw || {}).cpu || {}).model || '-' }}</b><span class="faint">核数: {{ ((data.hw || {}).cpu || {}).cores || '-' }}</span></div>
          <div class="stat"><span class="st-k">内存</span><template v-if="(((data.hw || {}).memory || {}).sticks || []).length"><b class="mono">{{ ((data.hw || {}).memory || {}).sticks.length }} 条</b><span class="faint mono">{{ (((data.hw || {}).memory || {}).sticks || []).map(x => x.size + (x.speed ? '@' + x.speed : '')).join(', ') }}</span></template><template v-else><b class="mono">{{ ((data.hw || {}).memory || {}).total ? (((data.hw || {}).memory || {}).total / 1073741824).toFixed(1) + ' GB' : '—' }}</b><span class="faint">物理内存总量</span></template></div>
          <div class="stat"><span class="st-k">主板</span><b class="mono" style="font-size:13px">{{ ((data.hw || {}).board || {}).vendor || '' }} {{ ((data.hw || {}).board || {}).model || '' }}</b></div>
          <div class="stat"><span class="st-k">温度传感器</span><b class="mono">{{ ((data.hw || {}).temps || []).length }} 个</b><span class="faint mono">{{ ((data.hw || {}).temps || []).map(t => t.chip + ':' + Object.values(t.values || {}).join('/')).join(' ').slice(0, 120) }}</span></div>
        </div>
        <div class="pane-head"><span class="pane-title">磁盘 S.M.A.R.T</span></div>
        <table class="table"><thead><tr><th>设备</th><th>状态</th></tr></thead>
          <tbody><tr v-for="(sd,i) in (data.hw || {}).smart || []" :key="i"><td class="mono">{{ sd.dev }}</td><td><span class="tag-chip" :class="(sd.status || '').indexOf('OK') >= 0 ? 'chip-ok' : 'chip-err'">{{ sd.status }}</span></td></tr></tbody></table>
        <div v-if="!((data.hw || {}).smart || []).length" class="hint">无 SMART 数据(需 smartmontools)</div>
      </template>

      <template v-if="sub === 'up'">
        <div class="pane-head">
          <span class="pane-title">系统更新</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="updRefresh">更新索引</button>
          <button class="btn btn-sm btn-danger" @click="updRun">立即升级</button>
        </div>
        <div class="stat-row">
          <div class="tile"><span class="k">可升级包</span><span class="v">{{ (data.up || {}).count != null ? (data.up || {}).count : '—' }}</span></div>
          <div class="tile" :class="(data.up || {}).security ? 'tile-warn' : ''"><span class="k">涉安全更新</span><span class="v" :class="(data.up || {}).security ? 'txt-warn' : ''">{{ (data.up || {}).security != null ? (data.up || {}).security : '—' }}</span></div>
          <div class="tile"><span class="k">索引状态</span><span class="v txt-sm">{{ (data.up || {}).count != null ? '已就绪' : '未刷新' }}</span></div>
        </div>
        <div v-if="data.upMsg" class="mono-block" style="margin-bottom:8px">{{ data.upMsg }}</div>
        <table class="table"><thead><tr><th>软件包</th><th>新版本</th><th>架构</th></tr></thead>
          <tbody><tr v-for="(p,i) in (data.up || {}).packages || []" :key="i"><td class="mono">{{ p.pkg }}</td><td class="mono">{{ p.new }}</td><td class="mono faint">{{ p.arch }}</td></tr></tbody></table>
        <div v-if="!((data.up || {}).packages || []).length && !data.upMsg" class="hint">点击「更新索引」获取可升级列表</div>
      </template>

      <template v-if="sub === 'disk'">
        <div class="pane-head">
          <span class="pane-title">磁盘用量</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('disk')">⟳ 刷新</button>
        </div>
        <div class="stat-row">
          <div class="tile"><span class="k">文件系统</span><span class="v">{{ ((data.disk || {}).df || []).length }}</span></div>
          <div class="tile" :class="maxDiskUse >= 85 ? 'tile-danger' : (maxDiskUse >= 70 ? 'tile-warn' : 'tile-ok')">
            <span class="k">最高使用率</span>
            <span class="v">{{ maxDiskUse }}%</span>
          </div>
        </div>
        <div class="disk-rows">
          <div v-for="(d,i) in (data.disk || {}).df || []" :key="i" class="disk-row">
            <div class="disk-row-top">
              <span class="mono disk-mount">{{ d.mount }}</span>
              <span class="tag-chip chip-dim">{{ d.type }}</span>
              <span class="grow"></span>
              <span class="mono">{{ d.used }} / {{ d.size }}</span>
              <span class="mono" style="min-width:46px;text-align:right" :class="parseInt(d.use) >= 85 ? 'txt-danger' : (parseInt(d.use) >= 70 ? 'txt-warn' : 'txt-ok')">{{ d.use }}</span>
            </div>
            <div class="progress" style="margin-top:6px">
              <div :style="{ width: Math.min(100, parseInt(d.use) || 0) + '%', background: (parseInt(d.use) >= 85) ? 'var(--danger)' : (parseInt(d.use) >= 70 ? 'var(--warning)' : 'var(--accent)') }"></div>
            </div>
            <div class="disk-row-sub faint mono">{{ d.fs }} · 可用 {{ d.avail }}</div>
          </div>
        </div>
        <div v-if="!((data.disk || {}).df || []).length" class="hint">无挂载数据</div>
        <details class="doc-section" style="margin-top:10px"><summary class="muted">lsblk 拓扑</summary><pre class="mono-block pre panel-box">{{ JSON.stringify((data.disk || {}).lsblk, null, 2) }}</pre></details>
      </template>

      <template v-if="sub === 'snap'">
        <div class="pane-head">
          <span class="pane-title">只读快照</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('snap')">⟳ 刷新</button>
        </div>
        <div class="stat" style="margin-bottom:10px">
          <span class="st-k">根文件系统</span><b class="mono">{{ (data.snap || {}).fstype || '-' }}</b>
          <span class="tag-chip" :class="(data.snap || {}).supported ? 'chip-ok' : 'chip-err'">{{ (data.snap || {}).supported ? '支持在线快照' : '不支持' }}</span>
          <span class="faint">{{ (data.snap || {}).hint || '' }}</span>
        </div>
        <div class="flex" style="margin-bottom:12px">
          <input v-model="snapName" class="input" placeholder="快照名 (英文/数字)" />
          <button class="btn btn-sm btn-primary" :disabled="!(data.snap || {}).supported" @click="snapCreate">创建只读快照</button>
        </div>
        <div class="pane-head"><span class="pane-title">已有快照</span><span class="tag-chip chip-dim">{{ ((data.snapList || {}).snapshots || []).length }}</span></div>
        <div v-if="((data.snapList || {}).snapshots || []).length" class="snap-chips">
          <span v-for="s in (data.snapList || {}).snapshots" :key="s" class="tag-chip chip-info snap-chip mono">{{ s }}</span>
        </div>
        <div v-else class="hint">(无快照)</div>
      </template>

      <template v-if="sub === 'usr'">
        <div class="pane-head">
          <span class="pane-title">用户 / SSH 密钥</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('usr')">⟳ 刷新</button>
        </div>
        <table class="table"><thead><tr><th>用户</th><th>UID</th><th>主目录</th><th>Shell</th><th>sudo</th><th>密钥</th></tr></thead>
          <tbody><tr v-for="u in data.usr || []" :key="u.name">
            <td><span class="avatar">{{ (u.name || '?').slice(0,1).toUpperCase() }}</span><span class="mono">{{ u.name }}</span></td>
            <td>{{ u.uid }}</td><td class="mono faint">{{ u.home }}</td><td class="mono faint">{{ u.shell }}</td>
            <td><span class="tag-chip" :class="u.sudo ? 'chip-ok' : 'chip-dim'">{{ u.sudo ? 'sudo' : '—' }}</span></td>
            <td><button class="btn btn-sm" @click="sshLoad(u.name)">管理密钥</button></td></tr></tbody></table>
        <div v-if="sshUser" style="margin-top:12px">
          <div class="pane-head"><span class="pane-title">authorized_keys · {{ sshUser }}</span><span class="grow"></span>
            <span class="faint">保存即生效</span>
            <button class="btn btn-sm btn-primary" @click="sshSave">保存</button></div>
          <textarea v-model="sshKeys" class="input mono" rows="8" style="font-family:var(--font-mono)"></textarea>
        </div>
      </template>

      <template v-if="sub === 'clean'">
        <div class="pane-head">
          <span class="pane-title">存储清理</span>
          <span class="pane-sub">全盘 du 可能 30s+ · 结果缓存 90s</span>
          <span class="grow"></span>
          <button class="btn btn-sm btn-primary" @click="loadSection('clean')">⟳ 重新扫描</button>
        </div>
        <div v-if="data.cleanMsg" class="mono-block" style="margin-bottom:8px">{{ data.cleanMsg }}</div>
        <div class="split2">
          <div>
            <div class="pane-head" style="margin-top:0"><span class="pane-title">清理项</span></div>
            <div v-for="it in (data.clean || {}).items || []" :key="it.key" class="clean-row">
              <span>{{ it.label }}</span>
              <span v-if="it.key === 'workspace'" class="tag-chip" title="永久保存, 不自动过期, 仅本页可删">常驻·不限期</span>
              <span class="mono faint" style="font-size:11px;word-break:break-all">{{ it.path }}</span>
              <span class="grow"></span>
              <span class="mono">{{ it.size }}</span>
              <button class="btn btn-sm btn-danger" @click="cleanDo(it)">清理</button>
            </div>
            <div v-if="!((data.clean || {}).items || []).length" class="hint">暂无数据, 点击「重新扫描」</div>
          </div>
          <div>
            <div class="pane-head" style="margin-top:0"><span class="pane-title">磁盘占用 Top 15</span></div>
            <div v-for="(d,i) in (data.clean || {}).dirs || []" :key="i" class="top-row">
              <div class="top-row-top">
                <span class="mono" style="font-size:11px;word-break:break-all">{{ d.path }}</span>
                <span class="mono" style="flex:none">{{ d.size }}</span>
              </div>
              <div class="progress"><div :style="{ width: topBar(d.size) + '%' }"></div></div>
            </div>
          </div>
        </div>
      </template>

      

      

      <template v-if="sub === 'pwr'">
        <div class="pane-head">
          <span class="pane-title">关机 / 重启</span>
          <span class="pane-sub">电源计划 · 危险操作</span>
        </div>
        <div class="danger-panel">
          <div class="flex" style="margin-bottom:12px">
            <span class="faint" style="flex:none">当前计划</span>
            <span class="tag-chip" :class="pwrEpoch ? 'chip-err' : 'chip-dim'" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ pwrEpoch || '无计划' }}</span>
          </div>
          <div class="flex" style="flex-wrap:wrap">
            <select v-model="pwrAction" class="select">
              <option value="reboot">重启</option><option value="shutdown">关机</option>
            </select>
            <input v-model.number="pwrMin" type="number" class="input" style="max-width:110px" min="1" max="1440" />
            <span class="muted">分钟后执行</span>
            <span class="grow"></span>
            <button class="btn btn-sm" @click="pwrCancel">取消计划</button>
            <button class="btn btn-sm btn-danger" @click="pwrPlan">计划执行</button>
          </div>
          <div class="hint" style="margin-top:10px">计划生效后到点自动执行, 请在到点前取消。</div>
        </div>
      </template>

      <template v-if="sub === 'kern'">
        <div class="pane-head">
          <span class="pane-title">内核管理</span>
          <span class="tag-chip chip-ok mono">{{ (data.kern || {}).current || '—' }}</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('kern')">⟳ 刷新</button>
        </div>
        <div v-if="data.kernMsg" class="mono-block" style="margin-bottom:8px">{{ data.kernMsg }}</div>
        <table class="table"><thead><tr><th>包</th><th>版本</th><th>状态</th><th>操作</th></tr></thead>
          <tbody><tr v-for="k in (data.kern || {}).installed || []" :key="k.pkg">
            <td class="mono">{{ k.pkg }}</td><td class="mono">{{ k.ver }}</td>
            <td><span v-if="k.pkg.indexOf((data.kern || {}).current || 'zzz') >= 0" class="tag-chip chip-ok">运行中</span><span v-else class="tag-chip chip-dim">—</span></td>
            <td><button class="btn btn-sm btn-danger" v-if="k.pkg.indexOf((data.kern || {}).current || 'zzz') < 0" @click="kernRemove(k)">卸载</button></td></tr></tbody></table>
      </template>

      <template v-if="sub === 'tz'">
        <div class="pane-head">
          <span class="pane-title">时间 / NTP</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('tz')">⟳ 刷新</button>
          <button class="btn btn-sm btn-primary" @click="timeSyncDo">启用 / 同步 NTP</button>
        </div>
        <div class="stat-row">
          <div class="tile"><span class="k">时区</span><span class="v txt-sm">{{ ((data.tz || {}).fields || {})['Time zone'] || '—' }}</span></div>
          <div class="tile"><span class="k">本地时间</span><span class="v txt-sm">{{ ((data.tz || {}).fields || {})['Local time'] || '—' }}</span></div>
          <div class="tile" :class="(data.tz || {}).sync === 'off' ? 'tile-danger' : 'tile-ok'">
            <span class="k">NTP 同步</span>
            <span class="v txt-sm" :class="(data.tz || {}).sync === 'off' ? 'txt-danger' : 'txt-ok'">{{ (data.tz || {}).sync || 'off' }}</span>
          </div>
        </div>
      </template>

      <template v-if="sub === 'health'">
        <div class="pane-head">
          <span class="pane-title">健康检查</span>
          <span class="pane-sub">磁盘 / 内存 / 面板服务</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('health')">⟳ 重新检查</button>
          <button class="btn btn-sm btn-danger" @click="healthRestart">重启面板服务</button>
        </div>
        <div class="stat-row">
          <div class="tile" :class="healthFail ? 'tile-danger' : 'tile-ok'">
            <span class="k">检查结果</span>
            <span class="v">{{ healthOk }}/{{ healthChecks.length }}</span>
            <span class="faint" style="font-size:11px">{{ healthFail ? healthFail + ' 项异常' : '全部正常' }}</span>
          </div>
          <div class="tile" v-for="it in healthChecks" :key="it.name" :class="it.ok ? 'tile-ok' : 'tile-danger'">
            <span class="k">{{ it.name }}</span>
            <span class="v txt-sm" :class="it.ok ? 'txt-ok' : 'txt-danger'">{{ it.ok ? '正常' : '异常' }}</span>
          </div>
        </div>
        <div class="check-grid">
          <div v-for="(it,i) in healthChecks" :key="i" class="check-row">
            <span class="led" :class="it.ok ? 'on' : 'bad'"></span>
            <span class="mono">{{ it.name }}</span>
            <span class="grow"></span>
            <span class="tag-chip" :class="it.ok ? 'chip-ok' : 'chip-err'">{{ it.ok ? '正常' : '异常' }}</span>
          </div>
        </div>
        <div v-if="!healthChecks.length" class="hint">暂无数据, 点击「重新检查」</div>
      </template>

      <template v-if="sub === 'events'">
        <div class="pane-head">
          <span class="pane-title">事件时间线</span>
          <span class="pane-sub">系统操作留痕 (服务/更新/电源/清理/快照/内核/时间)</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('events')">⟳ 刷新</button>
        </div>
        <div v-if="!((data.events || {}).events || []).length" class="hint">暂无记录, 执行过上述操作后会出现</div>
        <div class="tl">
          <div v-for="(e,i) in (data.events || {}).events || []" :key="i" class="tl-item">
            <span class="tl-time mono">{{ new Date(e.t * 1000).toLocaleString() }}</span>
            <span class="tag-chip tl-scope" :class="eventActCls(e.action)">{{ e.scope }}</span>
            <b class="tl-act">{{ e.action }}</b>
            <span class="tl-msg">{{ e.msg }}</span>
          </div>
        </div>
      </template>

      <template v-if="sub === 'lr'">
        <div class="pane-head">
          <span class="pane-title">日志保留 (logrotate)</span>
          <span class="pane-sub">/etc/logrotate.d · 保存后下次轮转生效</span>
          <span class="grow"></span>
          <button class="btn btn-sm" @click="loadSection('lr')">⟳ 刷新</button>
        </div>
        <div v-if="loading.lr" class="hint">加载中…</div>
        <div v-if="err.lr" class="error">{{ err.lr }}</div>
        <div v-if="!loading.lr && !err.lr && ((data.lr || {}).ok === undefined)" class="hint">数据未就绪，点击「刷新」重新加载</div>
        <div class="lr-layout">
          <div class="lr-list">
            <button v-for="f in (data.lr || {}).files || []" :key="f.name" class="lr-file" @click="lrSelect(f)">{{ f.name }}</button>
          </div>
          <div class="lr-edit">
            <div class="flex" style="margin-bottom:6px">
              <b class="mono">{{ lrEdit ? lrEdit.name : '(选择左侧配置)' }}</b>
              <span class="grow"></span>
              <button class="btn btn-sm btn-primary" :disabled="!lrEdit" @click="lrSave">保存</button>
            </div>
            <textarea v-if="lrEdit" v-model="lrEdit.content" class="input mono" rows="16" style="font-family:var(--font-mono)"></textarea>
            <div v-else class="hint" style="text-align:left">← 选择左侧配置后在此编辑</div>
            <div class="muted" style="font-size:11px;margin-top:6px">要点: rotate N(保留份数) · size X(达到大小轮转) · compress(压缩) · daily/weekly</div>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.notice { padding: 8px 12px; background: var(--success-soft); color: var(--success); margin-bottom: 12px; font-size: 13px; }
.sf-body { }
.svc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
.svc-card { border: 1px solid var(--border); padding: 10px 12px; background: var(--surface-2); }
.svc-name { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.svc-sub { font-size: 11px; margin-bottom: 8px; }
.hv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-bottom: 12px; }
.stat { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--border); background: var(--surface-2); }
.st-k { font-size: 11px; color: var(--text-faint); }
.pre { max-height: 280px; overflow: auto; }
.bar-row { display: flex; align-items: flex-end; gap: 2px; height: 56px; padding: 4px; background: var(--surface-2); }
.bar-cell { flex: 1; background: var(--accent); min-width: 2px; }
.bar-cell.hot { background: var(--danger); }
.tl { border-left: 2px solid var(--border); padding-left: 12px; }
.tl-item { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 12px; }
.tl-time { color: var(--text-faint); font-size: 11px; width: 170px; }
.tl-scope { color: var(--accent); font-weight: 700; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-act { color: var(--text-muted); width: 110px; }
.tl-msg { color: var(--text); flex: 1; }
.lr-layout { display: grid; grid-template-columns: 200px 1fr; gap: 12px; }
.lr-file { display: block; width: 100%; text-align: left; padding: 8px 10px; margin-bottom: 4px; background: var(--surface-2); border: 1px solid var(--border); cursor: pointer; font-size: 12px; }
.lr-file:hover { border-color: var(--accent); }

/* ================= 系统中心视觉重构 ================= */
/* 加载占位 */
.pane-load {
  padding: 28px; text-align: center; margin-bottom: 12px;
  border: 1px dashed var(--border);
  color: var(--text-faint); font-family: var(--font-mono); font-size: 13px;
}
/* 面板头 */
.pane-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin: 2px 0 10px; padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.pane-title { font-size: 14px; font-weight: 800; }
.pane-sub { font-size: 12px; color: var(--text-faint); }
/* 统计砖 */
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 12px; }
.tile {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--border); background: var(--surface-2);
}
.tile .k { font-size: 11px; color: var(--text-faint); letter-spacing: .5px; }
.tile .v { font-size: 24px; font-weight: 800; font-family: var(--font-mono); line-height: 1.1; }
.tile .v.txt-sm { font-size: 14px; font-weight: 700; word-break: break-all; }
.tile-ok { border-color: var(--success); background: var(--success-soft); }
.tile-warn { border-color: var(--warning); background: var(--warning-soft); }
.tile-danger { border-color: var(--danger); background: var(--danger-soft); }
.txt-ok { color: var(--success); }
.txt-warn { color: var(--warning); }
.txt-danger { color: var(--danger); }
/* 状态芯片 */
.chip-ok { background: var(--success-soft); color: var(--success); border: 1px solid var(--success); }
.chip-warn { background: var(--warning-soft); color: var(--warning); border: 1px solid var(--warning); }
.chip-err { background: var(--danger-soft); color: var(--danger); border: 1px solid var(--danger); }
.chip-dim { background: var(--surface-2); color: var(--text-faint); border: 1px solid var(--border); }
.chip-info { background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent); }
/* LED 指示 */
.led { width: 8px; height: 8px; flex: none; display: inline-block; background: var(--text-faint); }
.led.on { background: var(--success); }
.led.bad { background: var(--danger); }
/* 双栏布局 */
.split2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.panel-box {
  border: 1px solid var(--border); background: var(--surface-2);
  padding: 10px 12px; max-height: 320px; overflow: auto; white-space: pre-wrap;
}
/* 服务卡动作行 */
.svc-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
/* 磁盘行卡 */
.disk-rows { display: flex; flex-direction: column; gap: 10px; }
.disk-row { border: 1px solid var(--border); background: var(--surface-2); padding: 10px 12px; }
.disk-row-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.disk-mount { font-weight: 700; min-width: 110px; }
.disk-row-sub { font-size: 11px; margin-top: 5px; }
/* 清理 */
.clean-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; margin-bottom: 6px;
  border: 1px solid var(--border); background: var(--surface-2);
}
.top-row { padding: 8px 10px; margin-bottom: 6px; border: 1px solid var(--border); background: var(--surface-2); }
.top-row-top { display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px; }
.top-row-top span:first-child { flex: 1; }
/* 危险面板 */
.danger-panel { border: 1px solid var(--danger); border-left-width: 4px; background: var(--danger-soft); padding: 14px 16px; }
/* 健康检查 */
.check-grid { display: flex; flex-direction: column; gap: 6px; }
.check-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; font-size: 13px;
  border: 1px solid var(--border); background: var(--surface-2);
}
/* 快照芯片 */
.snap-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.snap-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 用户头像块 */
.avatar {
  display: inline-flex; width: 22px; height: 22px; margin-right: 8px;
  align-items: center; justify-content: center;
  background: var(--accent-soft); color: var(--accent);
  font-weight: 700; font-size: 12px; vertical-align: middle;
}
@media (max-width: 1000px) { .split2 { grid-template-columns: 1fr; } }
</style>