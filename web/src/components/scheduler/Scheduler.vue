<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const jobs = ref([])
const actions = ref([])
const error = ref('')
const loading = ref(false)
const showForm = ref(false)
const editingId = ref(null)
const filter = ref('all')
const actionFilter = ref('')
const search = ref('')
const now = ref(Date.now())
let clock = null
let refresher = null

const ACT_META = {
  gen_img: { color: 'var(--accent)' },
  grab_setu: { color: 'var(--success)' },
  rebuild_library: { color: 'var(--warning)' },
  clean_tmp: { color: 'var(--text-muted)' },
  shell: { color: 'var(--text-muted)' },
}

const form = reactive({
  name: '',
  action: 'gen_img',
  trigger: 'interval',
  interval: 3600,
  minute: '0',
  hour: '*',
  day: '*',
  month: '*',
  day_of_week: '*',
  params: {},
})

const filtered = computed(() => {
  let list = jobs.value
  if (actionFilter.value) list = list.filter((j) => j.action === actionFilter.value)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter((j) => j.name.toLowerCase().includes(q))
  }
  switch (filter.value) {
    case 'running': list = list.filter((j) => !j.paused); break
    case 'paused': list = list.filter((j) => j.paused); break
    case 'failed': list = list.filter((j) => j.last && j.last.status === 'error'); break
  }
  return list
})

const stats = computed(() => {
  const s = { total: jobs.value.length, running: 0, paused: 0, failed: 0 }
  for (const j of jobs.value) {
    if (j.paused) s.paused++
    else s.running++
    if (j.last && j.last.status === 'error') s.failed++
  }
  return s
})

function fmtTime(ts) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

function relTime(ts) {
  if (!ts) return '—'
  const diff = Math.floor((now.value - ts * 1000) / 1000)
  if (diff < 0) return fmtTime(ts)
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

function countdown(ts) {
  if (!ts) return '—'
  const diff = Math.floor((ts * 1000 - now.value) / 1000)
  if (diff < 0) return '即将执行'
  if (diff < 60) return `${diff} 秒后`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟 ${diff % 60} 秒后`
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return `${h} 小时 ${m} 分后`
}

function fmtInterval(sec) {
  sec = Number(sec) || 0
  if (sec >= 86400 && sec % 86400 === 0) return `每 ${sec / 86400} 天`
  if (sec >= 3600 && sec % 3600 === 0) return `每 ${sec / 3600} 小时`
  if (sec >= 60 && sec % 60 === 0) return `每 ${sec / 60} 分钟`
  return `每 ${sec} 秒`
}

const DOW = ['日', '一', '二', '三', '四', '五', '六']

function fmtCron(job) {
  const { minute, hour, day, month, day_of_week } = job
  if (day === '*' && month === '*' && day_of_week === '*') {
    if (minute === '*') return '每分钟'
    if (hour === '*') return `每小时 ${minute} 分`
    return `每天 ${hour}:${String(minute).padStart(2, '0')}`
  }
  if (day === '*' && month === '*' && day_of_week !== '*') {
    const days = day_of_week.split(',').map((d) => DOW[Number(d) % 7]).join('、')
    return `每周 ${days} ${hour}:${String(minute).padStart(2, '0')}`
  }
  if (day_of_week === '*' && month === '*' && day !== '*') {
    return `每月 ${day} 日 ${hour}:${String(minute).padStart(2, '0')}`
  }
  return `Cron: ${minute} ${hour} ${day} ${month} ${day_of_week}`
}

function scheduleText(job) {
  return job.trigger === 'interval' ? fmtInterval(job.interval) : fmtCron(job)
}

function actionLabel(key) {
  const a = actions.value.find((x) => x.key === key)
  return a ? a.label : key
}

function paramsSummary(job) {
  const p = job.params || {}
  switch (job.action) {
    case 'gen_img':
      return p.prompt ? `提示词: ${p.prompt}` : (p.width ? `${p.width}×${p.height} ×${p.count || 1} 张` : '默认参数')
    case 'grab_setu':
      return p.tag ? `标签: ${p.tag}` : '随机抓取'
    case 'clean_tmp':
      return p.dir ? `清理 ${p.dir}（保留 ${p.days || 3} 天）` : '清理默认目录'
    case 'shell':
      return p.command ? `命令: ${p.command}` : '未设置命令'
    case 'rebuild_library':
      return '重建媒体库索引'
    default:
      return ''
  }
}

async function load() {
  loading.value = true
  try {
    const d = await api.schedJobs()
    jobs.value = d.jobs || []
    error.value = ''
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    name: '',
    action: 'gen_img',
    trigger: 'interval',
    interval: 3600,
    minute: '0',
    hour: '*',
    day: '*',
    month: '*',
    day_of_week: '*',
    params: {},
  })
  showForm.value = true
}

function openEdit(job) {
  editingId.value = job.id
  Object.assign(form, {
    name: job.name,
    action: job.action,
    trigger: job.trigger,
    interval: job.interval || 3600,
    minute: job.minute || '0',
    hour: job.hour || '*',
    day: job.day || '*',
    month: job.month || '*',
    day_of_week: job.day_of_week || '*',
    params: JSON.parse(JSON.stringify(job.params || {})),
  })
  showForm.value = true
}

function setIntervalPreset(sec) {
  form.interval = sec
}

async function save() {
  error.value = ''
  if (!form.name.trim()) {
    error.value = '请填写任务名称'
    return
  }
  try {
    const payload = {
      name: form.name.trim(),
      action: form.action,
      trigger: form.trigger,
      params: form.params,
    }
    if (form.trigger === 'interval') {
      payload.interval = form.interval
    } else {
      payload.minute = form.minute || '*'
      payload.hour = form.hour || '*'
      payload.day = form.day || '*'
      payload.month = form.month || '*'
      payload.day_of_week = form.day_of_week || '*'
    }
    if (editingId.value) {
      await api.schedUpdate(editingId.value, payload)
    } else {
      await api.schedCreate(payload)
    }
    showForm.value = false
    load()
  } catch (e) {
    error.value = e.message || '保存失败'
  }
}

async function doDelete(job) {
  if (!window.confirm(`确定删除任务「${job.name}」？`)) return
  try {
    await api.schedDelete(job.id)
    load()
  } catch (e) {
    error.value = e.message || '删除失败'
  }
}

async function togglePause(job) {
  try {
    if (job.paused) await api.schedResume(job.id)
    else await api.schedPause(job.id)
    load()
  } catch (e) {
    error.value = e.message || '操作失败'
  }
}

async function runNow(job) {
  try {
    await api.schedRun(job.id)
    load()
  } catch (e) {
    error.value = e.message || '触发失败'
  }
}

onMounted(async () => {
  try {
    const d = await api.schedActions()
    actions.value = d.actions || []
  } catch (e) { error.value = e.message }
  load()
  clock = setInterval(() => { now.value = Date.now() }, 1000)
  refresher = setInterval(load, 15000)
})

onUnmounted(() => {
  if (clock) clearInterval(clock)
  if (refresher) clearInterval(refresher)
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>定时任务</h1>
      <div class="subtitle">APScheduler 定时执行 —— 生图 / 抓涩图 / 重建索引 / 清理 / 命令</div>

      <div class="stats-row">
        <div class="stat" @click="filter = 'all'">
          <div class="stat-num">{{ stats.total }}</div>
          <div class="stat-label">全部任务</div>
        </div>
        <div class="stat" @click="filter = 'running'">
          <div class="stat-num" style="color:var(--success);">{{ stats.running }}</div>
          <div class="stat-label">运行中</div>
        </div>
        <div class="stat" @click="filter = 'paused'">
          <div class="stat-num" style="color:var(--text-muted);">{{ stats.paused }}</div>
          <div class="stat-label">已暂停</div>
        </div>
        <div class="stat" @click="filter = 'failed'">
          <div class="stat-num" style="color:var(--danger);">{{ stats.failed }}</div>
          <div class="stat-label">上次失败</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-tabs">
          <button class="ftab" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
          <button class="ftab" :class="{ active: filter === 'running' }" @click="filter = 'running'">运行中</button>
          <button class="ftab" :class="{ active: filter === 'paused' }" @click="filter = 'paused'">已暂停</button>
          <button class="ftab" :class="{ active: filter === 'failed' }" @click="filter = 'failed'">上次失败</button>
        </div>
        <div class="toolbar-right">
          <input v-model="search" class="input" style="width:180px;" placeholder="搜索任务名称…" />
          <select v-model="actionFilter" class="input" style="width:150px;">
            <option value="">全部动作</option>
            <option v-for="a in actions" :key="a.key" :value="a.key">{{ a.label }}</option>
          </select>
          <button class="btn btn-sm" @click="load">刷新</button>
          <button class="btn btn-sm btn-primary" @click="openCreate">+ 新建任务</button>
        </div>
      </div>
    </div>

    <div class="page-body">
      <div v-if="loading && !jobs.length" class="loading">加载中…</div>
      <div v-else-if="!filtered.length" class="empty">没有匹配的定时任务</div>
      <div v-else>
        <div v-for="job in filtered" :key="job.id" class="job-card" :class="{ paused: job.paused }">
          <div class="job-main">
            <div class="job-title">
              <span class="job-name">{{ job.name }}</span>
              <span class="badge" :class="job.paused ? 'badge-off' : 'badge-on'">
                {{ job.paused ? '已暂停' : '运行中' }}
              </span>
              <span class="act-tag">{{ actionLabel(job.action) }}</span>
            </div>
            <div class="job-meta">
              <span class="meta-item">{{ scheduleText(job) }}</span>
              <span class="meta-item">下次执行: <b>{{ countdown(job.next_run_time) }}</b></span>
              <span class="meta-item">
                上次:
                <span v-if="!job.last || !job.last.time">从未执行</span>
                <span v-else :class="job.last.status === 'ok' ? 'ok' : (job.last.status === 'error' ? 'err' : 'muted')">
                  {{ job.last.status === 'ok' ? '成功' : job.last.status === 'error' ? '失败' : '运行中' }}
                </span>
                <template v-if="job.last && job.last.time">
                  {{ relTime(job.last.time) }}<span v-if="job.last.duration">（{{ job.last.duration }}s）</span>
                </template>
              </span>
            </div>
            <div v-if="paramsSummary(job)" class="job-params mono">{{ paramsSummary(job) }}</div>

            <div v-if="job.last && job.last.status === 'error' && job.last.message" class="job-err mono">
              {{ job.last.message }}
            </div>

            <div v-if="job.history && job.history.length" class="history-block">
              <div class="history-title" @click="job._showHistory = !job._showHistory">
                最近 {{ job.history.length }} 次执行
                <span class="caret">{{ job._showHistory ? '▾' : '▸' }}</span>
              </div>
              <div v-if="job._showHistory" class="history-list">
                <div v-for="(r, i) in job.history" :key="i" class="history-row">
                  <span :class="r.status === 'ok' ? 'ok' : (r.status === 'error' ? 'err' : 'muted')">
                    {{ r.status === 'ok' ? '成功' : r.status === 'error' ? '失败' : '执行中' }}
                  </span>
                  <span class="h-time">{{ fmtTime(r.time) }}</span>
                  <span v-if="r.duration" class="h-dur">{{ r.duration }}s</span>
                  <span class="h-msg mono" :title="r.message">{{ r.message || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="job-ops">
            <button class="btn btn-sm" :disabled="job.paused" @click="runNow(job)">立即执行</button>
            <button class="btn btn-sm" @click="togglePause(job)">{{ job.paused ? '恢复' : '暂停' }}</button>
            <button class="btn btn-sm" @click="openEdit(job)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="doDelete(job)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal sched-modal">
        <div class="sched-modal-header">
          <div class="sched-modal-heading">{{ editingId ? '编辑任务' : '新建任务' }}</div>
          <button class="sched-modal-close" @click="showForm = false" title="关闭">✕</button>
        </div>

        <div class="sched-modal-body">
          <div class="form-section">
            <div class="form-section-title">基本信息</div>
            <div class="form-grid">
              <label class="full">任务名称
                <input v-model="form.name" class="input" placeholder="例如：每日清理临时文件" />
              </label>
              <label class="full">动作
                <select v-model="form.action" class="input">
                  <option v-for="a in actions" :key="a.key" :value="a.key">{{ a.label }}</option>
                </select>
              </label>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">触发方式</div>
            <div class="trig-switch">
              <button class="btn btn-sm" :class="{ 'btn-primary': form.trigger === 'interval' }" @click="form.trigger = 'interval'">间隔</button>
              <button class="btn btn-sm" :class="{ 'btn-primary': form.trigger === 'cron' }" @click="form.trigger = 'cron'">Cron 表达式</button>
            </div>

            <template v-if="form.trigger === 'interval'">
              <div class="preset-row">
                <button v-for="preset in [{s:60,l:'1分钟'},{s:300,l:'5分钟'},{s:900,l:'15分钟'},{s:1800,l:'30分钟'},{s:3600,l:'1小时'},{s:21600,l:'6小时'},{s:86400,l:'1天'}]"
                  :key="preset.s" class="btn btn-sm preset" :class="{ 'btn-primary': form.interval === preset.s }"
                  @click="setIntervalPreset(preset.s)">{{ preset.l }}</button>
              </div>
              <label class="sched-label">自定义间隔（秒，≥10）
                <input v-model.number="form.interval" class="input" type="number" min="10" />
              </label>
            </template>

            <template v-else>
              <div class="cron-grid">
                <label>分
                  <input v-model="form.minute" class="input" placeholder="0" />
                </label>
                <label>时
                  <input v-model="form.hour" class="input" placeholder="*" />
                </label>
                <label>日
                  <input v-model="form.day" class="input" placeholder="*" />
                </label>
                <label>月
                  <input v-model="form.month" class="input" placeholder="*" />
                </label>
                <label>星期 (0-6)
                  <input v-model="form.day_of_week" class="input" placeholder="*" />
                </label>
              </div>
              <div class="cron-preview mono">{{ fmtCron(form) }}</div>
            </template>
          </div>

          <div class="form-section">
            <div class="form-section-title">动作参数</div>
            <div class="form-grid">
              <template v-if="form.action === 'gen_img'">
                <label class="full">提示词
                  <input v-model="form.params.prompt" class="input" placeholder="prompt" />
                </label>
                <label>宽
                  <input v-model.number="form.params.width" class="input" placeholder="512" />
                </label>
                <label>高
                  <input v-model.number="form.params.height" class="input" placeholder="512" />
                </label>
                <label>步数
                  <input v-model.number="form.params.steps" class="input" placeholder="20" />
                </label>
                <label>数量
                  <input v-model.number="form.params.count" class="input" placeholder="1" />
                </label>
              </template>

              <template v-if="form.action === 'grab_setu'">
                <label class="full">标签（&amp; 分隔）
                  <input v-model="form.params.tag" class="input" placeholder="例如：白丝" />
                </label>
              </template>

              <template v-if="form.action === 'clean_tmp'">
                <label class="full">清理目录
                  <input v-model="form.params.dir" class="input" placeholder="/opt/touchgal/plugins" />
                </label>
                <label>保留天数
                  <input v-model.number="form.params.days" class="input" placeholder="3" />
                </label>
              </template>

              <template v-if="form.action === 'shell'">
                <label class="full">Shell 命令
                  <input v-model="form.params.command" class="input" placeholder="例如：echo hello > /tmp/x" />
                </label>
                <label>超时（秒）
                  <input v-model.number="form.params.timeout" class="input" placeholder="60" />
                </label>
              </template>
            </div>
          </div>
        </div>

        <div class="sched-modal-footer">
          <div v-if="error" class="form-err">{{ error }}</div>
          <div class="form-ops">
            <button class="btn btn-sm btn-ghost" @click="showForm = false">取消</button>
            <button class="btn btn-sm btn-primary" @click="save">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.status { margin-left: auto; font-size: 12px; color: var(--text-faint); }

.stats-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.stat {
  flex: 1;
  min-width: 120px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 12px 16px;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition);
}
.stat:hover { border-color: var(--accent); background: var(--surface-2); }
.stat-num { font-size: 22px; font-weight: 800; font-family: var(--font-mono); }
.stat-label { font-size: 11px; color: var(--text-faint); margin-top: 2px; }

.filter-tabs { display: flex; gap: 4px; }
.ftab {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}
.ftab:hover { color: var(--text); }
.ftab.active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }

.job-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 10px;
  background: var(--surface);
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.job-card.paused { opacity: 0.65; }
.job-main { flex: 1; min-width: 0; }
.job-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.job-name { font-weight: 700; }
.badge { font-size: 11px; padding: 1px 7px; border-radius: 4px; }
.badge-on { background: var(--success-soft); color: var(--success); }
.badge-off { background: var(--surface-3); color: var(--text-muted); }
.act-tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
}
.job-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 7px; font-size: 12px; color: var(--text-muted); }
.meta-item b { color: var(--text); font-weight: 600; }
.ok { color: var(--success); }
.err { color: var(--danger); }
.muted { color: var(--text-faint); }
.job-params {
  margin-top: 7px;
  font-size: 11px;
  color: var(--text-faint);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.job-err {
  margin-top: 7px;
  font-size: 11px;
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 8px;
  word-break: break-all;
}
.history-block { margin-top: 9px; border-top: 1px dashed var(--border); padding-top: 7px; }
.history-title {
  font-size: 11px;
  color: var(--text-faint);
  cursor: pointer;
  user-select: none;
}
.caret { margin-left: 4px; }
.history-list { margin-top: 6px; }
.history-row { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 2px 0; }
.h-time { color: var(--text-faint); font-family: var(--font-mono); }
.h-dur { color: var(--text-faint); font-family: var(--font-mono); }
.h-msg {
  flex: 1;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.job-ops { display: flex; gap: 6px; flex-shrink: 0; flex-direction: column; align-items: stretch; }

.sched-modal {
  max-width: 600px;
  display: flex;
  flex-direction: column;
  max-height: 86vh;
}
.sched-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sched-modal-heading { font-size: 15px; font-weight: 800; letter-spacing: 0.5px; }
.sched-modal-close {
  background: none;
  border: none;
  color: var(--text-faint);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  transition: color var(--transition), background var(--transition);
}
.sched-modal-close:hover { color: var(--text); background: var(--surface-2); }
.sched-modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
}
.sched-modal-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--surface-2);
}
.sched-label { font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; }
.form-section { margin-bottom: 18px; }
.form-section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-faint);
  letter-spacing: 1.5px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.form-grid .full { grid-column: 1 / -1; }
.trig-switch { display: flex; gap: 8px; margin-bottom: 12px; }
.preset-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.preset { padding: 3px 10px; }
.cron-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 10px; }
.cron-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.cron-preview {
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 6px 10px;
  border-radius: 4px;
}
.form-err { font-size: 12px; color: var(--danger); padding: 6px 0; }
.form-ops { display: flex; gap: 8px; justify-content: flex-end; }
</style>
