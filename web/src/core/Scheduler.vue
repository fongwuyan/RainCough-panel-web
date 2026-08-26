<script setup>
// 定时任务 — 干净重写, 对接 /api/scheduler/jobs(样式复刻旧 Scheduler 布局)
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { request } from '../api/client'

const jobs = ref([])
const error = ref('')
const loading = ref(false)
const showForm = ref(false)
const editingId = ref(null)
const search = ref('')

const form = reactive({ name: '', cron: '0 3 * * *', action: 'shell', params: { cmd: '' } })
const ACTIONS = [{ key: 'shell', label: 'Shell 命令' }]

const now = ref(Date.now())
let clock = null

const filtered = computed(() => {
  let list = jobs.value
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter((j) => j.name.toLowerCase().includes(q))
  }
  return list
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const d = await request.get('/api/scheduler/jobs')
    jobs.value = d.jobs || []
  } catch (e) { error.value = e.message }
  loading.value = false
}

function fmtTime(ts) { return ts ? new Date(ts * 1000).toLocaleString() : '-' }
function relTime(ts) {
  if (!ts) return '—'
  const diff = Math.floor((now.value - ts * 1000) / 1000)
  if (diff < 60) return diff + ' 秒前'
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前'
  return Math.floor(diff / 86400) + ' 天前'
}
function fmtCron(cron) {
  if (!cron) return '-'
  const p = cron.split(' ')
  if (p.length !== 5) return cron
  const [m, h, d, mo, dow] = p
  if (d === '*' && mo === '*' && dow === '*') {
    if (m === '*') return '每分钟'
    if (h === '*') return '每小时 ' + m + ' 分'
    return '每天 ' + h + ':' + String(m).padStart(2, '0')
  }
  return cron
}
function paramsSummary(j) {
  const p = j.params || {}
  return j.action === 'shell' ? (p.cmd ? '命令: ' + p.cmd : '未设置命令') : ''
}

function openNew() {
  editingId.value = null
  Object.assign(form, { name: '', cron: '0 3 * * *', action: 'shell', params: { cmd: '' } })
  showForm.value = true
}
function openEdit(j) {
  editingId.value = j.id
  Object.assign(form, {
    name: j.name || '', cron: j.cron || '0 3 * * *', action: j.action || 'shell',
    params: { cmd: (j.params && j.params.cmd) || '' },
  })
  showForm.value = true
}
async function save() {
  try {
    if (editingId.value) await request.put('/api/scheduler/jobs/' + editingId.value, form)
    else await request.post('/api/scheduler/jobs', form)
    showForm.value = false
    load()
  } catch (e) { error.value = e.message }
}
async function runNow(j) {
  try { await request.post('/api/scheduler/jobs/' + j.id); load() }
  catch (e) { alert(e.message) }
}
async function toggle(j) {
  try { await request.put('/api/scheduler/jobs/' + j.id, { enabled: !j.enabled }); load() }
  catch (e) { alert(e.message) }
}
async function remove(j) {
  if (!confirm('删除任务 ' + j.name + ' ?')) return
  try { await request.del('/api/scheduler/jobs/' + j.id); load() }
  catch (e) { alert(e.message) }
}

onMounted(() => { load(); clock = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => clearInterval(clock))
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>定时任务</h1>
        <p class="subtitle">共 {{ jobs.length }} 个任务</p>
      </div>
      <div class="toolbar">
        <input v-model="search" class="input" placeholder="搜索任务..." style="width:180px" />
        <button class="btn btn-primary" @click="openNew">新建任务</button>
      </div>
    </div>

    <div class="page-body">
      <div v-if="error" class="error" style="padding:10px">{{ error }}</div>
      <div class="result-item" v-for="j in filtered" :key="j.id">
        <div style="display:flex;align-items:center;gap:12px;width:100%;">
          <div style="flex:1;min-width:0;">
            <div class="name">{{ j.name }} <span v-if="!j.enabled" class="tag-chip">暂停</span></div>
            <div class="meta">
              <span class="mono">{{ j.cron }}</span> → {{ fmtCron(j.cron) }}
              <span v-if="paramsSummary(j)" class="note" style="margin-left:10px;">{{ paramsSummary(j) }}</span>
            </div>
            <div class="note faint">
              上次: {{ relTime(j.last_run) }} ·
              状态: <b :class="j.last_status === 'ok' ? 'ok' : (j.last_status === 'fail' ? 'err' : '')">{{ j.last_status || '-' }}</b>
            </div>
          </div>
          <div class="ops">
            <button class="btn btn-sm" @click="runNow(j)">立即执行</button>
            <button class="btn btn-sm" @click="toggle(j)">{{ j.enabled ? '暂停' : '启用' }}</button>
            <button class="btn btn-sm" @click="openEdit(j)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="remove(j)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="!loading && !filtered.length" class="hint" style="padding:20px">暂无任务</div>
    </div>

    <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
      <div class="card" style="width:560px;max-width:92vw;padding:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <b>{{ editingId ? '编辑任务' : '新建任务' }}</b>
          <button class="btn btn-sm btn-ghost" @click="showForm = false">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <label>任务名称
            <input v-model="form.name" class="input" placeholder="例如：每日备份" />
          </label>
          <label>动作
            <select v-model="form.action" class="input">
              <option v-for="a in ACTIONS" :key="a.key" :value="a.key">{{ a.label }}</option>
            </select>
          </label>
          <label>Cron 表达式(分 时 日 月 周)
            <input v-model="form.cron" class="input mono" placeholder="0 3 * * *" />
          </label>
          <label>Shell 命令
            <input v-model="form.params.cmd" class="input mono" placeholder="echo hello" />
          </label>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.toolbar { display: flex; gap: 8px; align-items: center; }
.ops { display: flex; gap: 6px; flex-shrink: 0; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.ok { color: var(--success); } .err { color: var(--danger); }
</style>