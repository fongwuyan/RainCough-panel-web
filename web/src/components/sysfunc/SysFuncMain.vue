<script setup>
import { ref, onMounted, computed, onErrorCaptured } from 'vue'
import { api } from '../../api'
import Logs from '../logs/Logs.vue'
import BackupMain from '../backup/BackupMain.vue'
import Processes from '../processes/Processes.vue'

// 子级选项卡(父级为「系统中心」)
const sub = ref('logs')
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
    fw: () => api.sysfFw(),
    hw: () => api.sysfHardware(),
    up: () => api.sysfUpdatesList(),
    cron: () => api.sysfCronGet('f'),
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
}
function switchSub(k) { sub.value = k; if (k !== 'logs' && k !== 'processes' && k !== 'backup' && !data.value[k]) loadSection(k); apiPoll(k) }
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
const cronUser = ref('f')
const cronText = ref('')
async function cronLoad() { await call('cron', () => api.sysfCronGet(cronUser.value)); const d = data.value.cron || {}; cronText.value = d.content || '' }
async function cronSave() { try { const r = await api.sysfCronSave(cronUser.value, cronText.value); toast(r && r.ok !== false ? '已保存' : ((r && r.error) || '失败')) } catch (e) { toast('保存失败: ' + e.message) } }
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
onMounted(() => { loadSection('svc') })

const SUBS = [
  { key: 'logs', label: '系统日志' },
  { key: 'processes', label: '进程管理' },
  { key: 'svc', label: '服务管理' },
  { key: 'fw', label: '防火墙/监听' },
  { key: 'hw', label: '硬件' },
  { key: 'up', label: '系统更新' },
  { key: 'cron', label: '定时任务' },
  { key: 'disk', label: '磁盘' },
  { key: 'snap', label: '快照' },
  { key: 'usr', label: '用户/密钥' },
  { key: 'clean', label: '存储清理' },
  { key: 'pwr', label: '关机/重启' },
  { key: 'kern', label: '内核管理' },
  { key: 'tz', label: '时间/NTP' },
  { key: 'health', label: '健康检查' },
  { key: 'events', label: '事件时间线' },
  { key: 'lr', label: '日志保留' },
  { key: 'backup', label: '系统备份' },
  { key: 'boot', label: '启动历史' },
  { key: 'api', label: '接口监控' },
];

// ---- 第三批功能动作 ----
async function healthRestart() {
  if (!confirm('确认重启面板服务(touchgal)？连接会闪断几秒。')) return
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
function codeCls(c) { return c < 400 ? 'ok' : (c < 500 ? 'run' : 'err') }

</script>

<template>
  <div>
    <!-- 父级选项卡 -->
    <div class="parent-tabs">
      <div class="pt item active">
        <span class="pt-badge"></span>
        <b>系统中心</b>
        <span class="faint" style="font-size:12px">日志 · 进程 · 服务 · 防火墙 · 硬件 · 更新 · 定时 · 磁盘 · 快照 · 用户</span>
      </div>
    </div>
    <!-- 子级选项卡 -->
    <div class="sub-tabs">
      <button v-for="s in SUBS" :key="s.key" class="tab" :class="{ active: sub === s.key }" @click="switchSub(s.key)">{{ s.label }}</button>
      <span class="grow"></span>
      <span v-if="loading[sub]" class="sf-load">加载中…</span>
    </div>
    <div v-if="notice" class="notice">{{ notice }}</div>
    <div v-if="appErr" class="error" style="margin-bottom:10px">运行/渲染错误: {{ appErr }}</div>

    <!-- 原属系统选项卡: 日志 / 进程(父级下以子选项卡形式) -->
    <Logs v-if="sub === 'logs'" />
    <Processes v-if="sub === 'processes'" />
    <BackupMain v-if="sub === 'backup'" />

    
      <template v-if="sub === 'boot'">
        <div class="flex" style="margin-bottom:8px">
          <button class="btn btn-sm" @click="loadSection('boot')">刷新</button>
          <span v-if="(data.boot || {}).boot_started" class="muted mono">本次启动: {{ (data.boot || {}).boot_started }}</span>
        </div>
        <table class="table"><thead><tr><th>动作</th><th>时间</th></tr></thead>
          <tbody><tr v-for="(r,i) in (data.boot || {}).rows || []" :key="i">
            <td><span :class="r.action === 'reboot' ? 'ok' : 'err'">{{ r.action }}</span></td><td class="mono faint">{{ r.when }}</td></tr></tbody></table>
        <div v-if="!((data.boot || {}).rows || []).length" class="hint">无记录(或 last 无法读取)</div>
      </template>
      <template v-if="sub === 'api'">
        <div class="flex" style="margin-bottom:8px">
          <button class="btn btn-sm" @click="loadApi">刷新</button>
          <button class="btn btn-sm" @click="toggleApiPoll">{{ apiPollOn ? '暂停轮询' : '开启轮询' }}</button>
          <button class="btn btn-sm btn-ghost" @click="clearApiCalls">清空记录</button>
          <span class="muted">后端路由: <b class="mono">{{ (data.apiStats || {}).routes_total || 0 }}</b> · 累计调用: <b class="mono">{{ (data.apiStats || {}).calls_total || 0 }}</b> · 4xx: <b class="mono" :class="((data.apiStats||{}).calls_4xx||0)>0?'err':''">{{ (data.apiStats||{}).calls_4xx||0 }}</b> · 5xx: <b class="mono" :class="((data.apiStats||{}).calls_5xx||0)>0?'err':''">{{ (data.apiStats||{}).calls_5xx||0 }}</b></span>
        </div>
        <div class="flex" style="margin-bottom:6px;flex-wrap:wrap;gap:6px">
          <span v-for="(n,m) in (data.apiStats||{}).methods || {}" :key="m" class="tag-chip">{{ m }} {{ n }}</span>
        </div>
        <table class="table">
          <thead><tr><th>时间</th><th>方法</th><th>路径</th><th>状态</th><th>耗时</th><th>来源</th></tr></thead>
          <tbody>
            <tr v-for="(c,i) in data.apiCalls || []" :key="i">
              <td class="mono faint">{{ c.ts }}</td>
              <td><span :class="c.method==='POST' ? 'err' : (c.method==='DELETE' ? 'run' : 'ok')">{{ c.method }}</span></td>
              <td class="mono">{{ c.path }}</td>
              <td><span :class="codeCls(c.code)">{{ c.code }}</span></td>
              <td class="mono">{{ c.ms }}ms</td>
              <td class="mono faint">{{ c.ip }}</td>
            </tr>
            <tr v-if="!(data.apiCalls || []).length"><td colspan="6" class="hint">暂无记录(有请求后出现; 轮询 3s 自动刷新)</td></tr>
          </tbody>
        </table>
      </template>

<div v-if="sub !== 'logs' && sub !== 'processes' && sub !== 'backup'" class="sf-body">
      <div v-if="err[sub]" class="error">{{ err[sub] }}</div>

      <template v-if="sub === 'svc'">
        <div v-if="data.svcMsg" class="mono-block" style="margin-bottom:8px">{{ data.svcMsg }}</div>
        <input v-model="svcFilter" class="input" style="max-width:260px;margin-bottom:10px" placeholder="过滤服务名" />
        <div class="svc-grid">
          <div v-for="u in (data.svc || {}).units || []" :key="u.unit" v-show="!svcFilter || u.unit.indexOf(svcFilter) >= 0" class="svc-card">
            <div class="svc-name mono">{{ u.unit }}</div>
            <div class="svc-sub"><span :class="u.active === 'active' ? 'ok' : (u.active === 'failed' ? 'err' : 'faint')">{{ u.active }}/{{ u.sub }}</span></div>
            <div class="flex">
              <button class="btn btn-sm btn-primary" @click="svcAct(u, 'start')">启动</button>
              <button class="btn btn-sm" @click="svcAct(u, 'stop')">停止</button>
              <button class="btn btn-sm" @click="svcAct(u, 'restart')">重启</button>
              <button class="btn btn-sm btn-ghost" @click="svcAct(u, 'enable')">自启开</button>
              <button class="btn btn-sm btn-ghost" @click="svcAct(u, 'disable')">自启关</button>
            </div>
          </div>
        </div>
      </template>

      <template v-if="sub === 'fw'">
        <div class="section-title">防火墙 ({{ ((data.fw || {}).firewall || {}).tool || '-' }})</div>
        <pre class="mono-block pre">{{ ((data.fw || {}).firewall || {}).text || '' }}</pre>
        <div class="section-title">监听端口 ({{ ((data.fw || {}).listen || []).length }})</div>
        <table class="table"><thead><tr><th>协议</th><th>本地地址</th><th>对端</th><th>进程</th></tr></thead>
          <tbody><tr v-for="(l,i) in (data.fw || {}).listen || []" :key="i"><td class="mono">{{ l.proto }}</td><td class="mono">{{ l.local }}</td><td class="mono faint">{{ l.peer }}</td><td class="mono" style="font-size:11px">{{ l.proc }}</td></tr></tbody></table>
      </template>

      <template v-if="sub === 'hw'">
        <div class="hv-grid">
          <div class="stat"><span class="st-k">CPU</span><b class="mono" style="font-size:13px">{{ ((data.hw || {}).cpu || {}).model || '-' }}</b><span class="faint">核数: {{ ((data.hw || {}).cpu || {}).cores || '-' }}</span></div>
          <div class="stat"><span class="st-k">内存条</span><b class="mono">{{ (((data.hw || {}).memory || {}).sticks || []).length }} 条</b><span class="faint mono">{{ (((data.hw || {}).memory || {}).sticks || []).map(x => x.size + '@' + (x.speed || '?')).join(', ') }}</span></div>
          <div class="stat"><span class="st-k">主板</span><b class="mono" style="font-size:13px">{{ ((data.hw || {}).board || {}).vendor || '' }} {{ ((data.hw || {}).board || {}).model || '' }}</b></div>
          <div class="stat"><span class="st-k">温度传感器</span><b class="mono">{{ ((data.hw || {}).temps || []).length }} 个</b><span class="faint mono">{{ ((data.hw || {}).temps || []).map(t => t.chip + ':' + Object.values(t.values || {}).join('/')).join(' ').slice(0, 120) }}</span></div>
        </div>
        <div class="section-title">磁盘 S.M.A.R.T</div>
        <table class="table"><thead><tr><th>设备</th><th>状态</th></tr></thead>
          <tbody><tr v-for="(sd,i) in (data.hw || {}).smart || []" :key="i"><td class="mono">{{ sd.dev }}</td><td :class="(sd.status || '').indexOf('OK') >= 0 ? 'ok' : 'err'">{{ sd.status }}</td></tr></tbody></table>
      </template>

      <template v-if="sub === 'up'">
        <div class="flex" style="margin-bottom:10px">
          <button class="btn btn-sm" @click="updRefresh">更新索引</button>
          <button class="btn btn-sm btn-danger" @click="updRun">立即升级</button>
          <span v-if="(data.up || {}).count != null" class="muted">可升级 {{ (data.up || {}).count }} 个 · 涉及安全 {{ (data.up || {}).security }} 处</span>
        </div>
        <div v-if="data.upMsg" class="mono-block" style="margin-bottom:8px">{{ data.upMsg }}</div>
        <table class="table"><thead><tr><th>软件包</th><th>新版本</th><th>架构</th></tr></thead>
          <tbody><tr v-for="(p,i) in (data.up || {}).packages || []" :key="i"><td class="mono">{{ p.pkg }}</td><td class="mono">{{ p.new }}</td><td class="mono faint">{{ p.arch }}</td></tr></tbody></table>
      </template>

      <template v-if="sub === 'cron'">
        <div class="flex" style="margin-bottom:8px">
          <input v-model="cronUser" class="input" style="max-width:140px" placeholder="用户" />
          <button class="btn btn-sm" @click="cronLoad">读取</button>
          <button class="btn btn-sm btn-primary" @click="cronSave">保存</button>
        </div>
        <textarea v-model="cronText" class="input mono" rows="12" style="font-family:var(--font-mono)" placeholder="# 分钟 小时 日 月 星期 命令"></textarea>
      </template>

      <template v-if="sub === 'disk'">
        <div class="section-title">df 用量</div>
        <table class="table"><thead><tr><th>文件系统</th><th>类型</th><th>容量</th><th>已用</th><th>可用</th><th>使用率</th><th>挂载点</th></tr></thead>
          <tbody><tr v-for="(d,i) in (data.disk || {}).df || []" :key="i"><td class="mono">{{ d.fs }}</td><td class="mono faint">{{ d.type }}</td><td>{{ d.size }}</td><td>{{ d.used }}</td><td>{{ d.avail }}</td><td :class="parseInt(d.use) >= 85 ? 'err' : ''">{{ d.use }}</td><td class="mono">{{ d.mount }}</td></tr></tbody></table>
        <details class="doc-section" style="margin-top:10px"><summary class="muted">lsblk 拓扑</summary><pre class="mono-block pre">{{ JSON.stringify((data.disk || {}).lsblk, null, 2) }}</pre></details>
      </template>

      <template v-if="sub === 'snap'">
        <div class="stat" style="margin-bottom:10px">
          <span class="st-k">根文件系统</span><b class="mono">{{ (data.snap || {}).fstype || '-' }}</b>
          <span :class="(data.snap || {}).supported ? 'ok' : 'err'">{{ (data.snap || {}).supported ? '支持在线快照' : '不支持' }}</span>
          <span class="faint">{{ (data.snap || {}).hint || '' }}</span>
        </div>
        <div class="flex"><input v-model="snapName" class="input" placeholder="快照名" /><button class="btn btn-sm btn-primary" :disabled="!(data.snap || {}).supported" @click="snapCreate">创建只读快照</button></div>
        <div class="section-title">已有快照</div>
        <pre class="mono-block pre">{{ ((data.snapList || {}).snapshots || []).join('\n') || '(无)' }}</pre>
      </template>

      <template v-if="sub === 'usr'">
        <div class="section-title">系统用户</div>
        <table class="table"><thead><tr><th>用户</th><th>UID</th><th>主目录</th><th>Shell</th><th>sudo</th><th>密钥</th></tr></thead>
          <tbody><tr v-for="u in data.usr || []" :key="u.name">
            <td class="mono">{{ u.name }}</td><td>{{ u.uid }}</td><td class="mono faint">{{ u.home }}</td><td class="mono faint">{{ u.shell }}</td>
            <td><span :class="u.sudo ? 'ok' : 'faint'">{{ u.sudo ? '是' : '-' }}</span></td>
            <td><button class="btn btn-sm" @click="sshLoad(u.name)">管理密钥</button></td></tr></tbody></table>
        <div v-if="sshUser" style="margin-top:12px">
          <div class="section-title">authorized_keys · {{ sshUser }}</div>
          <div class="flex" style="margin-bottom:6px"><button class="btn btn-sm btn-primary" @click="sshSave">保存</button><span class="faint">保存即生效</span></div>
          <textarea v-model="sshKeys" class="input mono" rows="8" style="font-family:var(--font-mono)"></textarea>
        </div>
      </template>

      <template v-if="sub === 'clean'">
        <div class="flex" style="margin-bottom:8px">
          <button class="btn btn-sm btn-primary" @click="loadSection('clean')">重新扫描</button>
          <span class="muted">Top 占用目录(全盘 du, 可能 30s+) · 缓存 90s</span>
        </div>
        <div v-if="data.cleanMsg" class="mono-block" style="margin-bottom:8px">{{ data.cleanMsg }}</div>
        <div class="section-title">清理项</div>
        <table class="table"><thead><tr><th>项目</th><th>大小</th><th>操作</th></tr></thead>
          <tbody><tr v-for="it in (data.clean || {}).items || []" :key="it.key">
            <td>{{ it.label }}</td><td class="mono">{{ it.size }}</td>
            <td><button class="btn btn-sm" @click="cleanDo(it)">清理</button></td></tr></tbody></table>
        <div class="section-title">磁盘占用 Top 15</div>
        <table class="table"><thead><tr><th>大小</th><th>路径</th></tr></thead>
          <tbody><tr v-for="(d,i) in (data.clean || {}).dirs || []" :key="i"><td class="mono">{{ d.size }}</td><td class="mono" style="word-break:break-all">{{ d.path }}</td></tr></tbody></table>
      </template>

      

      

      <template v-if="sub === 'pwr'">
        <div class="stat" style="margin-bottom:10px">
          <span class="st-k">当前计划</span>
          <b>{{ pwrEpoch ? pwrEpoch : '无(未计划)' }}</b>
        </div>
        <div class="flex">
          <select v-model="pwrAction" class="select">
            <option value="reboot">重启</option><option value="shutdown">关机</option>
          </select>
          <input v-model.number="pwrMin" type="number" class="input" style="max-width:110px" min="1" max="1440" />
          <span class="muted">分钟后执行</span>
          <button class="btn btn-sm btn-primary" @click="pwrPlan">计划</button>
          <button class="btn btn-sm btn-danger" @click="pwrCancel">取消</button>
        </div>
        <div class="hint" style="text-align:left;padding:8px 0">注意：计划生效后到点自动执行；取消请在到点前操作。</div>
      </template>

      <template v-if="sub === 'kern'">
        <div v-if="data.kernMsg" class="mono-block" style="margin-bottom:8px">{{ data.kernMsg }}</div>
        <div class="flex" style="margin-bottom:8px">
          <button class="btn btn-sm" @click="loadSection('kern')">刷新</button>
          <span class="muted mono">当前内核: {{ (data.kern || {}).current || '—' }}</span>
        </div>
        <table class="table"><thead><tr><th>包</th><th>版本</th><th>当前</th><th>操作</th></tr></thead>
          <tbody><tr v-for="k in (data.kern || {}).installed || []" :key="k.pkg">
            <td class="mono">{{ k.pkg }}</td><td class="mono">{{ k.ver }}</td>
            <td><span v-if="k.pkg.indexOf((data.kern || {}).current || 'zzz') >= 0" class="ok">当前</span><span v-else class="faint">—</span></td>
            <td><button class="btn btn-sm btn-danger" v-if="k.pkg.indexOf((data.kern || {}).current || 'zzz') < 0" @click="kernRemove(k)">卸载</button></td></tr></tbody></table>
      </template>

      <template v-if="sub === 'tz'">
        <div class="hv-grid">
          <div class="stat"><span class="st-k">时区</span><b class="mono">{{ ((data.tz || {}).fields || {})['Time zone'] || '—' }}</b></div>
          <div class="stat"><span class="st-k">本地时间</span><b class="mono" style="font-size:13px">{{ ((data.tz || {}).fields || {})['Local time'] || '—' }}</b></div>
          <div class="stat"><span class="st-k">NTP 同步</span><b :class="(data.tz || {}).sync === 'off' ? 'err' : 'ok'">{{ (data.tz || {}).sync || 'off' }}</b></div>
        </div>
        <div class="flex" style="margin-top:10px">
          <button class="btn btn-sm btn-primary" @click="timeSyncDo">启用/同步 NTP</button>
          <button class="btn btn-sm" @click="loadSection('tz')">刷新</button>
        </div>
      </template>

      <template v-if="sub === 'health'">
        <div class="flex" style="margin-bottom:8px">
          <button class="btn btn-sm btn-primary" @click="loadSection('health')">重新检查</button>
          <button class="btn btn-sm btn-danger" @click="healthRestart">重启面板服务</button>
          <span class="muted">健康自检: 磁盘/权限/依赖/服务/负载/端口</span>
        </div>
        <table class="table"><thead><tr><th>检查项</th><th>状态</th><th>详情</th></tr></thead>
          <tbody><tr v-for="(it,i) in (data.health || {}).items || []" :key="i">
            <td>{{ it.name }}</td>
            <td><span :class="it.status === 'ok' ? 'ok' : (it.status === 'warn' ? 'run' : 'err')">{{ it.status === 'ok' ? '正常' : (it.status === 'warn' ? '注意' : '异常') }}</span></td>
            <td class="mono faint" style="font-size:11px">{{ it.detail }}</td></tr></tbody></table>
      </template>

      <template v-if="sub === 'events'">
        <div class="flex" style="margin-bottom:8px">
          <button class="btn btn-sm" @click="loadSection('events')">刷新</button>
          <span class="muted">系统操作留痕 (服务/更新/电源/清理/快照/内核/时间)</span>
        </div>
        <div v-if="!((data.events || {}).events || []).length" class="hint">暂无记录，执行过上述操作后会出现</div>
        <div class="tl">
          <div v-for="(e,i) in (data.events || {}).events || []" :key="i" class="tl-item">
            <span class="tl-time mono">{{ new Date(e.t * 1000).toLocaleString() }}</span>
            <span class="tl-scope mono">{{ e.scope }}</span>
            <span class="tl-act">{{ e.action }}</span>
            <span class="tl-msg">{{ e.msg }}</span>
          </div>
        </div>
      </template>

      <template v-if="sub === 'lr'">
        <div v-if="loading.lr" class="hint">加载中…</div>
        <div v-if="err.lr" class="error">{{ err.lr }}</div>
        <div v-if="!loading.lr && !err.lr && ((data.lr || {}).ok === undefined)" class="hint">数据未就绪，点击「刷新」重新加载</div>
        <div class="flex" style="margin-bottom:8px">
          <button class="btn btn-sm" @click="loadSection('lr')">刷新</button>
          <span class="muted">/etc/logrotate.d 配置 · 修改后保存即生效(下次轮转)</span>
        </div>
        <div class="lr-layout">
          <div class="lr-list">
            <button v-for="f in (data.lr || {}).files || []" :key="f.name" class="lr-file" @click="lrSelect(f)">{{ f.name }}</button>
          </div>
          <div class="lr-edit">
            <div class="flex" style="margin-bottom:6px">
              <b class="mono">{{ lrEdit ? lrEdit.name : '(选择左侧配置)' }}</b>
              <button class="btn btn-sm btn-primary" :disabled="!lrEdit" @click="lrSave">保存</button>
            </div>
            <textarea v-if="lrEdit" v-model="lrEdit.content" class="input mono" rows="14" style="font-family:var(--font-mono)"></textarea>
            <div v-else class="hint" style="text-align:left">← 选择左侧配置后在此编辑</div>
            <div class="muted" style="font-size:11px;margin-top:6px">要点: rotate N(保留份数) · size X(达到大小轮转) · compress(压缩) · daily/weekly</div>
          </div>
        </div>
      </template>
      <template v-if="sub === 'boot'">
        <div class="flex" style="margin-bottom:8px"><button class="btn btn-sm" @click="loadSection('boot')">刷新</button>
          <span v-if="(data.boot || {}).boot_started" class="muted mono">本次启动: {{ (data.boot || {}).boot_started }}</span></div>
        <table class="table"><thead><tr><th>动作</th><th>时间</th></tr></thead>
          <tbody><tr v-for="(r,i) in (data.boot || {}).rows || []" :key="i">
            <td><span :class="r.action === 'reboot' ? 'ok' : 'err'">{{ r.action }}</span></td><td class="mono faint">{{ r.when }}</td></tr></tbody></table>
        <div v-if="!((data.boot || {}).rows || []).length" class="hint">无记录(或 last 无法读取)</div>
      </template>


    </div>
  </div>
</template>

<style scoped>
.notice { padding: 8px 12px; background: var(--success-soft); color: var(--success); margin-bottom: 12px; font-size: 13px; }
.parent-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.pt { display: flex; align-items: center; gap: 10px; padding: 14px 18px; background: var(--accent-soft); border: 1px solid var(--accent-strong, var(--border-strong)); }
.pt-badge { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.sub-tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
.sf-load { color: var(--accent); font-size: 12px; font-family: var(--font-mono); }
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
.tab { border-bottom: 2px solid transparent; }
.tab.active { border-bottom-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.tl { border-left: 2px solid var(--border); padding-left: 12px; }
.tl-item { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 0; border-bottom: 1px dashed var(--border); font-size: 12px; }
.tl-time { color: var(--text-faint); font-size: 11px; width: 170px; }
.tl-scope { color: var(--accent); font-weight: 700; width: 90px; }
.tl-act { color: var(--text-muted); width: 110px; }
.tl-msg { color: var(--text); flex: 1; }
.lr-layout { display: grid; grid-template-columns: 200px 1fr; gap: 12px; }
.lr-file { display: block; width: 100%; text-align: left; padding: 8px 10px; margin-bottom: 4px; background: var(--surface-2); border: 1px solid var(--border); cursor: pointer; font-size: 12px; }
.lr-file:hover { border-color: var(--accent); }
</style>