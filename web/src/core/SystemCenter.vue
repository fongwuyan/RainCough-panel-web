<script setup>
// 系统中心 — 20 子 tab(复用旧前端样式类名, 逻辑对接新后端 sysfunc API)
import { ref, onMounted } from 'vue'
import { request } from '../api/client'
import '../styles/syscenter.css'

const sub = ref('svc')
const loading = ref({})
const err = ref({})
const data = ref({})
const notice = ref('')
function toast(m) { notice.value = m; setTimeout(() => { notice.value = '' }, 3000) }

const SUBS = [
  { key: 'svc', label: '服务管理' },
  { key: 'processes', label: '进程管理' },
  { key: 'fw', label: '防火墙' },
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
  { key: 'boot', label: '启动历史' },
  { key: 'logs', label: '系统日志' },
]

async function call(key, fn) {
  loading.value[key] = true
  err.value[key] = ''
  try { data.value[key] = await fn() } catch (e) { err.value[key] = e.message }
  loading.value[key] = false
}
function loadSection(k) {
  const jobs = {
    svc: () => request.get('/api/sysfunc/service/list'),
    fw: () => request.get('/api/sysfunc/fw/status'),
    hw: () => request.get('/api/sysfunc/hardware'),
    up: () => request.get('/api/sysfunc/updates/list'),
    cron: () => request.get('/api/sysfunc/cron/get?user=f'),
    disk: () => request.get('/api/sysfunc/disks/fs'),
    snap: () => request.get('/api/sysfunc/snapshot/cap'),
    usr: () => request.get('/api/sysfunc/users'),
    clean: () => request.get('/api/sysfunc/clean/scan'),
    pwr: () => request.get('/api/sysfunc/pwr/state'),
    kern: () => request.get('/api/sysfunc/kernels'),
    tz: () => request.get('/api/sysfunc/time/status'),
    health: () => request.get('/api/sysfunc/health/check'),
    events: () => request.get('/api/sysfunc/events/timeline?limit=100'),
    lr: () => request.get('/api/sysfunc/logrotate/list'),
    boot: () => request.get('/api/sysfunc/boot/history'),
    processes: () => request.get('/api/sysfunc/process/list'),
    logs: () => request.get('/api/sysfunc/log?path=/var/log/touchgal.log&lines=100'),
  }
  if (jobs[k]) call(k, jobs[k])
}
function switchSub(k) {
  sub.value = k
  if (!data.value[k]) loadSection(k)
}

async function svcAct(unit, act) {
  try {
    const r = await request.post('/api/sysfunc/service/action', { name: unit, action: act })
    toast((r && r.status) ? '已' + act + ' ' + unit : ((r && r.output) || 'ok'))
  } catch (e) { toast('操作失败: ' + e.message, false) }
  loadSection('svc')
}
async function updRefresh() {
  try { const r = await request.post('/api/sysfunc/updates/refresh', {}); toast(r.message || '已刷新') } catch (e) { toast(e.message, false) }
  loadSection('up')
}
async function updRun() {
  if (!confirm('确认执行 apt upgrade 升级全部软件包?')) return
  try { const r = await request.post('/api/sysfunc/updates/run', { confirm: 'yes' }); toast(r.message || '已开始') } catch (e) { toast(e.message, false) }
}
const cronText = ref('')
async function cronSave() {
  if (!cronText.value) return
  try { await request.post('/api/sysfunc/cron/save', { user: 'f', content: cronText.value }); toast('已保存') } catch (e) { toast('保存失败: ' + e.message, false) }
}
const snapName = ref('')
async function snapCreate() {
  if (!snapName.value) return
  try { await request.post('/api/sysfunc/snapshot/create', { name: snapName.value }); toast('快照已创建'); snapName.value = ''; loadSection('snap') } catch (e) { toast(e.message, false) }
}
const sshUser = ref('f')
const sshKeys = ref('')
async function sshLoad() {
  try { const d = await request.get('/api/sysfunc/ssh/keys?user=' + encodeURIComponent(sshUser.value)); sshKeys.value = d.keys || '' } catch (e) { toast(e.message, false) }
}
async function sshSave() {
  try { await request.post('/api/sysfunc/ssh/keys/save', { user: sshUser.value, keys: sshKeys.value }); toast('已保存') } catch (e) { toast(e.message, false) }
}
async function cleanDo(item) {
  if (!confirm('清理 ' + item.label + ' ?')) return
  try { await request.post('/api/sysfunc/clean/do', { item: item.key }); toast('已清理'); loadSection('clean') } catch (e) { toast(e.message, false) }
}
async function pwrPlan(action) {
  const mins = prompt('多少分钟后执行?', '1')
  if (mins === null) return
  if (!confirm('确认 ' + (action === 'reboot' ? '重启' : '关机') + '?')) return
  try { await request.post('/api/sysfunc/pwr/plan', { action, minutes: parseInt(mins) || 1 }); toast('已计划'); loadSection('pwr') } catch (e) { toast(e.message, false) }
}
async function pwrCancel() {
  try { await request.post('/api/sysfunc/pwr/cancel', {}); toast('已取消'); loadSection('pwr') } catch (e) { toast(e.message, false) }
}
async function kernRemove(pkg) {
  if (!confirm('删除内核 ' + pkg + '?')) return
  try { await request.post('/api/sysfunc/kernels/remove', { pkg, confirm: 'yes' }); toast('已删除'); loadSection('kern') } catch (e) { toast(e.message, false) }
}
async function tzSync() {
  try { await request.post('/api/sysfunc/time/sync', {}); toast('已同步'); loadSection('tz') } catch (e) { toast(e.message, false) }
}
async function healthRestart() {
  if (!confirm('确认重启面板服务(raincough)?')) return
  try { await request.post('/api/sysfunc/health/restart', { confirm: 'yes' }); toast('已发送重启') } catch (e) { toast(e.message, false) }
}
const lrEdit = ref(null)
function lrSelect(f) { lrEdit.value = { name: f.name, content: f.content } }
async function lrSave() {
  if (!lrEdit.value) return
  try { await request.post('/api/sysfunc/logrotate/save', { name: lrEdit.value.name, content: lrEdit.value.content }); toast('已保存'); loadSection('lr') } catch (e) { toast(e.message, false) }
}
async function confirmKill(p) {
  if (!confirm('结束进程 ' + p.pid + '?')) return
  try { await request.post('/api/sys/processes/kill', { pid: p.pid }); loadSection('processes') } catch (e) { toast(e.message, false) }
}
function fmtBytes(b) {
  if (!b) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = b
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return v.toFixed(1) + ' ' + u[i]
}

onMounted(() => loadSection('svc'))
</script>

<template>
  <div>
    <div class="parent-tabs">
      <div class="pt"><span class="pt-badge"></span><b>系统中心</b><span class="faint" style="font-size:12px">服务 · 进程 · 硬件 · 更新 · 磁盘 · 快照 · 用户 · 更多</span></div>
    </div>

    <div class="sub-tabs">
      <button v-for="s in SUBS" :key="s.key" class="tab" :class="{ active: sub === s.key }" @click="switchSub(s.key)">{{ s.label }}</button>
      <span class="sf-load" v-if="loading[sub]">加载中…</span>
    </div>

    <div v-if="notice" class="notice">{{ notice }}</div>
    <div v-if="err[sub]" class="error" style="margin-bottom:10px">{{ err[sub] }}</div>

    <!-- 服务管理 -->
    <div v-if="sub === 'svc'">
      <div class="svc-grid">
        <div v-for="s in ((data.svc || {}).services || [])" :key="s.name" class="svc-card">
          <div class="svc-name">{{ s.name }}</div>
          <div class="svc-sub"><span :class="s.active === 'active' ? 'ok' : ''">{{ s.active }}</span> — {{ s.desc }}</div>
          <div style="display:flex;gap:6px;">
            <button v-if="s.active !== 'active'" class="btn btn-sm" @click="svcAct(s.name, 'start')">启动</button>
            <template v-else>
              <button class="btn btn-sm" @click="svcAct(s.name, 'restart')">重启</button>
              <button class="btn btn-sm btn-danger" @click="svcAct(s.name, 'stop')">停止</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 进程 -->
    <div v-if="sub === 'processes'">
      <table class="table">
        <thead><tr><th>PID</th><th>用户</th><th>CPU%</th><th>内存%</th><th>命令</th><th></th></tr></thead>
        <tbody>
          <tr v-for="p in ((data.processes || {}).processes || [])" :key="p.pid">
            <td class="mono">{{ p.pid }}</td><td class="mono">{{ p.user }}</td>
            <td class="mono">{{ p.cpu }}</td><td class="mono">{{ p.mem }}</td>
            <td class="mono faint" style="max-width:45vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ p.cmd }}</td>
            <td><button class="btn btn-sm btn-danger" @click="confirmKill(p)">结束</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 防火墙 -->
    <div v-if="sub === 'fw'">
      <p>启用: <b :class="(data.fw || {}).enabled ? 'ok' : ''">{{ (data.fw || {}).enabled ? '是' : '否' }}</b></p>
      <div v-for="r in ((data.fw || {}).rules || [])" :key="r" class="mono" style="padding:3px 0;">{{ r }}</div>
    </div>

    <!-- 硬件 -->
    <div v-if="sub === 'hw'">
      <div class="hv-grid">
        <div class="stat"><span class="st-k">CPU 核数</span><b class="mono">{{ (data.hw || {}).cpu_count || '-' }}</b></div>
        <div class="stat"><span class="st-k">机型</span><b class="mono">{{ (data.hw || {}).product || '-' }}</b></div>
      </div>
      <pre class="pre mono" style="font-size:12px;">{{ ((data.hw || {}).meminfo || '') }}</pre>
    </div>

    <!-- 更新 -->
    <div v-if="sub === 'up'">
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button class="btn btn-sm" @click="updRefresh">刷新索引</button>
        <button class="btn btn-sm btn-danger" @click="updRun">升级全部</button>
      </div>
      <table class="table"><thead><tr><th>可更新包</th></tr></thead>
        <tbody><tr v-for="u in ((data.up || {}).updates || [])" :key="u"><td class="mono">{{ u }}</td></tr></tbody></table>
      <div v-if="!((data.up || {}).updates || []).length" class="hint">已是最新</div>
    </div>

    <!-- cron -->
    <div v-if="sub === 'cron'">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <span class="muted mono">crontab (f)</span>
        <button class="btn btn-sm btn-primary" @click="cronSave">保存</button>
      </div>
      <textarea v-model="cronText" class="input mono" style="width:100%;min-height:240px;font-family:var(--font-mono);"></textarea>
    </div>

    <!-- 磁盘 -->
    <div v-if="sub === 'disk'">
      <div v-for="d in ((data.disk || {}).disks || [])" :key="d.path" class="svc-card" style="margin-bottom:8px;">
        <b class="mono">{{ d.path }}</b> <span class="faint">{{ d.name }}</span>
        <div v-for="p in (d.partitions || [])" :key="p.path"><span class="mono faint">{{ p.path }}</span> {{ p.fstype }} {{ p.mountpoint }}</div>
      </div>
    </div>

    <!-- 快照 -->
    <div v-if="sub === 'snap'">
      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input v-model="snapName" class="input" placeholder="快照名" style="width:200px" />
        <button class="btn btn-sm btn-primary" @click="snapCreate">创建快照</button>
        <button class="btn btn-sm" @click="loadSection('snap')">刷新</button>
      </div>
      <table class="table"><thead><tr><th>卷</th><th>大小</th><th>属性</th></tr></thead>
        <tbody><tr v-for="v in ((data.snap || {}).volumes || [])" :key="v.name">
          <td class="mono">{{ v.name }}</td><td class="mono">{{ v.size }}</td><td class="mono">{{ v.attr }}</td></tr></tbody></table>
    </div>

    <!-- 用户/密钥 -->
    <div v-if="sub === 'usr'">
      <div class="hv-grid">
        <div v-for="u in ((data.usr || {}).users || [])" :key="u.name" class="stat">
          <span class="st-k">{{ u.uid }}</span><b class="mono">{{ u.name }}</b><span class="faint" style="font-size:11px;">{{ u.home }}</span>
        </div>
      </div>
      <div class="lr-layout" style="margin-top:12px;">
        <div>
          <select v-model="sshUser" class="input" style="width:100%;margin-bottom:6px;" @change="sshLoad">
            <option v-for="u in ((data.usr || {}).users || [])" :key="u.name" :value="u.name">{{ u.name }}</option>
          </select>
          <button class="btn btn-sm" @click="sshLoad">读取密钥</button>
        </div>
        <div>
          <textarea v-model="sshKeys" class="input mono" style="width:100%;min-height:160px;font-family:var(--font-mono);"></textarea>
          <button class="btn btn-sm btn-primary" style="margin-top:6px;" @click="sshSave">保存 authorized_keys</button>
        </div>
      </div>
    </div>

    <!-- 清理 -->
    <div v-if="sub === 'clean'">
      <div v-for="it in ((data.clean || {}).items || [])" :key="it.key" class="svc-card" style="margin-bottom:8px;">
        <span>{{ it.label }} — <b class="mono">{{ fmtBytes(it.size) }}</b></span>
        <button class="btn btn-sm btn-danger" style="float:right;" @click="cleanDo(it)">清理</button>
      </div>
    </div>

    <!-- 关机/重启 -->
    <div v-if="sub === 'pwr'">
      <p>状态: <span class="mono">{{ (data.pwr || {}).state || '-' }}</span></p>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-danger" @click="pwrPlan('poweroff')">关机</button>
        <button class="btn" @click="pwrPlan('reboot')">重启</button>
        <button class="btn btn-ghost" @click="pwrCancel">取消计划</button>
      </div>
    </div>

    <!-- 内核 -->
    <div v-if="sub === 'kern'">
      <table class="table"><thead><tr><th>内核</th><th></th></tr></thead>
        <tbody><tr v-for="k in ((data.kern || {}).kernels || [])" :key="k">
          <td class="mono">{{ k }}</td><td><button class="btn btn-sm btn-danger" @click="kernRemove(k)">删除</button></td></tr></tbody></table>
    </div>

    <!-- 时间 -->
    <div v-if="sub === 'tz'">
      <pre class="pre mono" style="font-size:12px;">{{ (data.tz || {}).status || '' }}</pre>
      <button class="btn btn-sm" @click="tzSync">同步 NTP</button>
    </div>

    <!-- 健康 -->
    <div v-if="sub === 'health'">
      <div class="hv-grid">
        <div v-for="c in ((data.health || {}).checks || [])" :key="c.name" class="stat">
          <span class="st-k">{{ c.name }}</span>
          <b :class="c.ok ? 'ok' : 'err'">{{ c.ok ? '正常' : '异常' }}</b>
        </div>
      </div>
      <button class="btn btn-sm btn-danger" @click="healthRestart">重启面板服务</button>
    </div>

    <!-- 事件 -->
    <div v-if="sub === 'events'">
      <div class="tl"><div v-for="(e, i) in ((data.events || {}).events || [])" :key="i" class="tl-item"><span class="tl-act">事件</span><span class="tl-msg mono">{{ e.line }}</span></div></div>
    </div>

    <!-- 日志保留 -->
    <div v-if="sub === 'lr'">
      <div class="lr-layout">
        <div>
          <button v-for="f in ((data.lr || {}).list || [])" :key="f.name" class="lr-file" @click="lrSelect(f)">{{ f.name }}</button>
        </div>
        <div class="lr-edit">
          <div class="flex" style="margin-bottom:6px"><b class="mono">{{ lrEdit ? lrEdit.name : '(选择左侧配置)' }}</b>
            <button class="btn btn-sm btn-primary" :disabled="!lrEdit" @click="lrSave">保存</button></div>
          <textarea v-if="lrEdit" v-model="lrEdit.content" class="input mono" rows="12" style="font-family:var(--font-mono);width:100%;"></textarea>
          <div v-else class="hint">← 选择左侧配置后编辑</div>
        </div>
      </div>
    </div>

    <!-- 启动历史 -->
    <div v-if="sub === 'boot'">
      <div style="margin-bottom:8px;"><span class="muted mono" v-if="(data.boot || {}).boot_started">本次启动: {{ (data.boot || {}).boot_started }}</span></div>
      <table class="table"><thead><tr><th>动作</th><th>时间</th></tr></thead>
        <tbody><tr v-for="r in ((data.boot || {}).rows || [])" :key="r.when">
          <td><span :class="r.action === 'reboot' ? 'ok' : 'err'">{{ r.action }}</span></td><td class="mono faint">{{ r.when }}</td></tr></tbody></table>
    </div>

    <!-- 日志 -->
    <div v-if="sub === 'logs'">
      <pre class="pre mono" style="font-size:12px;white-space:pre-wrap;">{{ ((data.logs || {}).logs || []).join('\n') }}</pre>
      <button class="btn btn-sm" @click="loadSection('logs')">刷新</button>
    </div>
  </div>
</template>

<style scoped>
@import '../styles/syscenter.css';
</style>