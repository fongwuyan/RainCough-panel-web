<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const tasks = ref([])
const stats = ref({ total: 0, running: 0, queued: 0, failed: 0, done: 0 })
const loading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref(false)
const includeDone = ref(true)
const filter = ref('all')
const search = ref('')
const LIMIT = 300

let pollTimer = null
let noticeTimer = null
let lastSig = ''
let pending = false

// 签名覆盖 status/progress/message/error/phase: 任一变化都触发重渲染
function taskSig(d) {
  const list = d.tasks || []
  let s = ''
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    s += t.id + '|' + t.status + '|' + t.progress + '|' + (t.message || '') + '|' + (t.error || '') + '|' + (t.phase || '') + '\n'
  }
  return s
}

async function load() {
  if (pending) return
  pending = true
  if (!tasks.value.length) loading.value = true
  try {
    const d = await api.taskQueue(includeDone.value, LIMIT)
    error.value = ''
    const sig = taskSig(d)
    if (sig !== lastSig) {
      lastSig = sig
      tasks.value = d.tasks || []
      stats.value = d
    }
  } catch (err) {
    // 轮询失败也要暴露出来, 不再只在列表为空时才提示
    error.value = (err && err.message) || String(err)
  } finally {
    pending = false
    loading.value = false
  }
}

function refresh() {
  lastSig = ''
  return load()
}

function toggleDone() {
  includeDone.value = !includeDone.value
  lastSig = ''
  load()
}

function setNotice(msg) {
  notice.value = msg
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 4000)
}

async function purgeDone() {
  if (busy.value) return
  busy.value = true
  try {
    // 后端回 {removed,status}, 不是任务列表: 必须重新拉取, 否则列表会被清空
    const d = await api.taskQueuePurge()
    setNotice(`已清理 ${d.removed || 0} 条已完成与失败任务`)
    lastSig = ''
    await load()
  } catch (err) {
    error.value = (err && err.message) || String(err)
  } finally { busy.value = false }
}

function schedulePoll() {
  if (pollTimer) return
  pollTimer = setInterval(() => { if (!document.hidden) load() }, 3000)
}

function pausePoll() {
  clearInterval(pollTimer); pollTimer = null
}

function onVis() {
  if (document.hidden) return
  load()
  schedulePoll()
}

onMounted(() => {
  load()
  schedulePoll()
  document.addEventListener('visibilitychange', onVis)
})
onBeforeUnmount(() => {
  pausePoll()
  if (noticeTimer) clearTimeout(noticeTimer)
  document.removeEventListener('visibilitychange', onVis)
})

const FILTERS = [
  { key: 'all', label: '全部', desc: '所有任务' },
  { key: 'running', label: '进行中', desc: '运行中 / 排队中' },
  { key: 'download', label: '下载安装', desc: '下载 / 安装 / 拉取' },
  { key: 'generate', label: '生成', desc: '生图 / 重绘 / 文生皮肤' },
  { key: 'batch', label: '批量 / 调度', desc: '批量下载 / 定时任务' },
  { key: 'backup', label: '备份', desc: '备份与恢复任务' },
  { key: 'failed', label: '失败', desc: '出错 / 中断' },
]

const SOURCE_LABEL = {
  store: '插件市场',
  backup: '备份',
  envpkg: '环境包',
  'mcserver-core': 'MC 服务器',
  aigen: 'AI 生图',
  'mcskin-paint': '图片转皮肤',
  'mcskin-text2skin': '文生皮肤',
  jmcomic: 'JMComic',
  scheduler: '定时任务',
  docker: 'Docker',
  yulotool: '工具箱',
  plugins: '插件安装',
}

const KIND_LABEL = {
  download: '下载', install: '安装', generate: '生图',
  repaint: '重绘', batch: '批量', schedule: '定时', process: '任务',
  backup: '备份', upload: '上传', shell: '命令',
}

const STATUS_LABEL = {
  queued: '排队中', running: '运行中', downloading: '下载中',
  collecting: '收集中', loading: '加载中', idle: '空闲',
  done: '已完成', error: '失败', cancelled: '已取消',
  interrupted: '中断', skipped: '跳过', failed: '失败',
}

function statusClass(s) {
  if (['running', 'downloading', 'collecting', 'loading'].includes(s)) return 'ok'
  if (['error', 'failed', 'interrupted'].includes(s)) return 'err'
  if (['done', 'cancelled', 'skipped'].includes(s)) return 'muted'
  return 'status'
}

function matchesFilter(t, key) {
  if (key === 'running') return ['running', 'downloading', 'collecting', 'loading', 'queued', 'idle'].includes(t.status)
  if (key === 'download') return ['download', 'install'].includes(t.kind)
  if (key === 'generate') return ['generate', 'repaint'].includes(t.kind)
  if (key === 'batch') return ['batch', 'schedule'].includes(t.kind)
  if (key === 'backup') return t.kind === 'backup' || t.source === 'backup'
  if (key === 'failed') return ['error', 'failed', 'interrupted'].includes(t.status)
  return true
}

const filterCounts = computed(() => {
  const m = {}
  for (const f of FILTERS) m[f.key] = tasks.value.filter(t => matchesFilter(t, f.key)).length
  return m
})

const filtered = computed(() => {
  let out = tasks.value.filter(t => matchesFilter(t, filter.value))
  const q = search.value.trim().toLowerCase()
  if (q) {
    out = out.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (SOURCE_LABEL[t.source] || t.source || '').toLowerCase().includes(q) ||
      (t.phase || '').toLowerCase().includes(q) ||
      (t.message || '').toLowerCase().includes(q) ||
      (t.error || '').toLowerCase().includes(q))
  }
  return out
})

const emptyText = computed(() => {
  return (search.value.trim() || filter.value !== 'all') ? '没有匹配的任务' : '暂无任务'
})

function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts))
  if (s < 60) return s + ' 秒前'
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前'
  return Math.floor(s / 3600) + ' 小时前'
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1>任务队列</h1>
        <p class="page-sub">汇总所有插件与系统级功能的下载、安装、备份与生成任务</p>
      </div>
      <div class="header-actions">
        <button class="btn" @click="toggleDone">{{ includeDone ? '只看进行中' : '显示全部' }}</button>
        <button class="btn" :disabled="busy" @click="purgeDone()">清理已完成与失败</button>
        <button class="btn" :disabled="busy || loading" @click="refresh()">刷新</button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card"><div class="stat-num accent">{{ stats.running || 0 }}</div><div class="stat-label">进行中</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.queued || 0 }}</div><div class="stat-label">排队中</div></div>
      <div class="stat-card"><div class="stat-num warn">{{ stats.failed || 0 }}</div><div class="stat-label">失败</div></div>
      <div class="stat-card"><div class="stat-num muted">{{ stats.done || 0 }}</div><div class="stat-label">已完成</div></div>
      <div class="stat-card"><div class="stat-num">{{ stats.total || 0 }}</div><div class="stat-label">总计</div></div>
    </div>

    <div class="filter-bar">
      <div
        v-for="f in FILTERS"
        :key="f.key"
        class="filter-chip"
        :class="{ active: filter === f.key }"
        :title="f.desc"
        @click="filter = f.key"
      >
        {{ f.label }} ({{ filterCounts[f.key] }})
      </div>
      <input v-model="search" class="input search-input" placeholder="搜索任务名 / 来源 / 说明" />
    </div>

    <div v-if="error" class="alert-err">
      刷新失败：{{ error }}
      <button class="alert-x" @click="error = ''">关闭</button>
    </div>
    <div v-if="notice" class="alert-ok">{{ notice }}</div>

    <div v-if="loading && !tasks.length" class="hint">加载中...</div>
    <div v-else-if="!filtered.length" class="hint">{{ emptyText }}</div>

    <div v-else class="task-grid">
      <div
        v-for="(t, idx) in filtered"
        :key="t.source + '-' + t.id + '-' + idx"
        class="task-card"
      >
        <div class="task-head">
          <div class="task-badge" :class="'kind-' + t.kind">{{ KIND_LABEL[t.kind] || t.kind || '任务' }}</div>
          <div class="task-source">{{ SOURCE_LABEL[t.source] || t.source }}</div>
          <div class="task-status" :class="'badge-tag ' + statusClass(t.status)">
            {{ STATUS_LABEL[t.status] || t.status }}
          </div>
        </div>
        <div class="task-name">{{ t.name || '未命名任务' }}</div>
        <div v-if="t.phase" class="task-phase">阶段：{{ t.phase }}</div>
        <div v-if="t.error" class="task-error">错误：{{ t.error }}</div>
        <div v-if="t.message && t.message !== t.error" class="task-msg">{{ t.message }}</div>
        <div v-if="t.meta && t.meta.target" class="task-msg">目标：{{ t.meta.target }}</div>
        <div v-if="t.status === 'running' || t.status === 'queued' || t.progress > 0" class="task-progress">
          <div class="progress"><div :style="{ width: Math.min(100, t.progress || 0) + '%' }"></div></div>
          <div class="progress-num">{{ Math.min(100, Math.round(t.progress || 0)) }}%</div>
        </div>
        <div class="task-foot">
          <span class="task-time">{{ timeAgo(t.created) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.page-sub { color: var(--border-strong); font-size: 13px; margin-top: 4px; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px; }
.stat-num { font-size: 26px; font-weight: 700; }
.stat-num.accent { color: var(--accent); }
.stat-num.warn { color: #f0b429; }
.stat-num.muted { color: var(--border-strong); }
.stat-label { font-size: 12px; color: var(--border-strong); margin-top: 2px; }

.filter-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.filter-chip { padding: 6px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; color: var(--border-strong); user-select: none; }
.filter-chip:hover { border-color: var(--border-strong); }
.filter-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.search-input { max-width: 260px; margin-left: auto; }

.alert-err { border: 1px solid rgba(248, 81, 73, 0.45); background: rgba(248, 81, 73, 0.1); color: #ff7b72; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; justify-content: space-between; word-break: break-all; }
.alert-ok { border: 1px solid rgba(63, 185, 80, 0.4); background: rgba(63, 185, 80, 0.1); color: #3fb950; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 10px; }
.alert-x { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 12px; text-decoration: underline; flex-shrink: 0; }

.task-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.task-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; }

.task-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.task-badge { font-size: 11px; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent); flex-shrink: 0; }
.task-badge.kind-download { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
.task-badge.kind-install { background: rgba(109, 92, 255, 0.15); color: var(--accent); }
.task-badge.kind-generate { background: rgba(240, 180, 41, 0.15); color: #f0b429; }
.task-badge.kind-repaint { background: rgba(163, 113, 247, 0.15); color: #a371f7; }
.task-badge.kind-batch, .task-badge.kind-schedule { background: rgba(88, 166, 255, 0.15); color: #58a6ff; }
.task-badge.kind-backup { background: rgba(210, 153, 34, 0.15); color: #d29922; }
.task-source { font-size: 12px; color: var(--border-strong); margin-right: auto; }

.task-status { font-size: 11px; flex-shrink: 0; }
.task-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; word-break: break-all; }
.task-phase { font-size: 12px; color: var(--border-strong); margin-bottom: 4px; word-break: break-all; }
.task-error { font-size: 12px; color: #f0b429; margin-bottom: 4px; word-break: break-all; }
.task-msg { font-size: 12px; color: var(--border-strong); margin-bottom: 4px; word-break: break-all; }

.task-progress { display: flex; align-items: center; gap: 8px; margin: 8px 0 6px; }
.task-progress .progress { flex: 1; }
.progress-num { font-size: 12px; color: var(--border-strong); min-width: 36px; text-align: right; }

.task-foot { display: flex; justify-content: space-between; align-items: center; }
.task-time { font-size: 11px; color: var(--border-strong); }

@media (max-width: 960px) {
  .page-header { flex-direction: column; }
  .header-actions { width: 100%; }
  .task-grid { grid-template-columns: 1fr; }
  .search-input { max-width: none; margin-left: 0; width: 100%; }
}
</style>
