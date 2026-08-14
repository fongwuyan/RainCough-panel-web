<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'

const router = useRouter()

const tasks = ref([])
const stats = ref({ total: 0, running: 0, queued: 0, failed: 0, done: 0 })
const loading = ref(false)
const error = ref('')
const includeDone = ref(true)
const filter = ref('all')
const search = ref('')
const polling = ref(true)
const LIMIT = 300

let pollTimer = null
let lastSig = ''
let pending = false

function taskSig(d) {
  const list = d.tasks || []
  let s = ''
  for (let i = 0; i < list.length; i++) {
    const t = list[i]
    s += t.id + '|' + t.status + '|' + t.progress + '|' + (t.message || '')
  }
  return s
}

async function load() {
  if (pending) return
  pending = true
  error.value = ''
  try {
    const d = await api.taskQueue(includeDone.value, LIMIT)
    const sig = taskSig(d)
    if (sig !== lastSig) {
      lastSig = sig
      tasks.value = d.tasks || []
      stats.value = d
    }
  } catch (err) {
    if (!tasks.value.length) error.value = err.message
  } finally { pending = false }
}

function schedulePoll() {
  if (pollTimer) return
  pollTimer = setInterval(() => { if (polling.value && !document.hidden) load() }, 3000)
}

function pausePoll() {
  clearInterval(pollTimer); pollTimer = null
}

function onVis() {
  if (document.hidden) return
  load()
  schedulePoll()
}

async function purgeDone() {
  try {
    const d = await api.taskQueuePurge()
    const sig = taskSig(d)
    lastSig = sig
    tasks.value = (d.tasks || []).slice(0, LIMIT)
    stats.value = d
  } catch (err) { error.value = err.message }
}

onMounted(() => {
  load()
  schedulePoll()
  document.addEventListener('visibilitychange', onVis)
})
onBeforeUnmount(() => {
  pausePoll()
  document.removeEventListener('visibilitychange', onVis)
})

const FILTERS = [
  { key: 'all', label: '全部', desc: '所有任务' },
  { key: 'running', label: '进行中', desc: '运行中 / 排队中' },
  { key: 'download', label: '下载安装', desc: '下载 / 安装 / 拉取' },
  { key: 'generate', label: '生成', desc: '生图 / 重绘 / 文生皮肤' },
  { key: 'batch', label: '批量 / 调度', desc: '批量下载 / 定时任务' },
  { key: 'failed', label: '失败', desc: '出错 / 中断' },
]

const SOURCE_LABEL = {
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

const filtered = computed(() => {
  let out = tasks.value
  if (filter.value === 'running') {
    out = out.filter(t => ['running', 'downloading', 'collecting', 'loading', 'queued', 'idle'].includes(t.status))
  } else if (filter.value === 'download') {
    out = out.filter(t => ['download', 'install'].includes(t.kind))
  } else if (filter.value === 'generate') {
    out = out.filter(t => ['generate', 'repaint'].includes(t.kind))
  } else if (filter.value === 'batch') {
    out = out.filter(t => ['batch', 'schedule'].includes(t.kind))
  } else if (filter.value === 'failed') {
    out = out.filter(t => ['error', 'failed', 'interrupted'].includes(t.status))
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    out = out.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (SOURCE_LABEL[t.source] || t.source || '').toLowerCase().includes(q) ||
      (t.phase || '').toLowerCase().includes(q))
  }
  return out
})

function go(t) {
  if (t.deep_link) router.push(t.deep_link.replace(/^\/#/, ''))
}

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
        <p class="page-sub">汇总所有插件与系统级功能的下载、安装与生成任务</p>
      </div>
      <div class="header-actions">
        <button class="btn" @click="includeDone = !includeDone; load()">
          {{ includeDone ? '隐藏已完成' : '显示已完成' }}
        </button>
        <button class="btn" @click="purgeDone()">清理已完成</button>
        <button class="btn" @click="load()">刷新</button>
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
        @click="filter = f.key"
      >
        {{ f.label }}
      </div>
      <input v-model="search" class="input search-input" placeholder="搜索任务名 / 来源 / 阶段" />
    </div>

    <div v-if="error" class="alert-err">{{ error }}</div>
    <div v-else-if="loading && !tasks.length" class="hint">加载中...</div>
    <div v-else-if="!filtered.length" class="hint">暂无任务</div>

    <div v-else class="task-grid">
      <div
        v-for="(t, idx) in filtered"
        :key="t.source + '-' + t.id + '-' + idx"
        class="task-card"
        :class="{ clickable: t.deep_link }"
        @click="go(t)"
      >
        <div class="task-head">
          <div class="task-badge" :class="'kind-' + t.kind">{{ KIND_LABEL[t.kind] || '任务' }}</div>
          <div class="task-source">{{ SOURCE_LABEL[t.source] || t.source }}</div>
          <div class="task-status" :class="'badge-tag ' + statusClass(t.status)">
            {{ STATUS_LABEL[t.status] || t.status }}
          </div>
        </div>
        <div class="task-name">{{ t.name || '未命名任务' }}</div>
        <div v-if="t.phase" class="task-phase">{{ t.phase }}</div>
        <div v-if="t.error" class="task-error">{{ t.error }}</div>
        <div class="task-progress">
          <div class="progress"><div :style="{ width: Math.min(100, t.progress) + '%' }"></div></div>
          <div class="progress-num">{{ Math.min(100, Math.round(t.progress || 0)) }}%</div>
        </div>
        <div class="task-foot">
          <span class="task-time">{{ timeAgo(t.created) }}</span>
          <span v-if="t.deep_link" class="task-link">查看 →</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
.page-sub { color: var(--border-strong); font-size: 13px; margin-top: 4px; }
.header-actions { display: flex; gap: 8px; }

.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
.stat-num { font-size: 26px; font-weight: 700; }
.stat-num.accent { color: var(--accent); }
.stat-num.warn { color: #f0b429; }
.stat-num.muted { color: var(--border-strong); }
.stat-label { font-size: 12px; color: var(--border-strong); margin-top: 2px; }

.filter-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.filter-chip { padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px; cursor: pointer; font-size: 13px; color: var(--border-strong); }
.filter-chip:hover { border-color: var(--border-strong); }
.filter-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.search-input { max-width: 260px; margin-left: auto; }

.task-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.task-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
.task-card.clickable { cursor: pointer; }
.task-card.clickable:hover { border-color: var(--border-strong); }

.task-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.task-badge { font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); }
.task-badge.kind-download { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
.task-badge.kind-install { background: rgba(109, 92, 255, 0.15); color: var(--accent); }
.task-badge.kind-generate { background: rgba(240, 180, 41, 0.15); color: #f0b429; }
.task-badge.kind-repaint { background: rgba(163, 113, 247, 0.15); color: #a371f7; }
.task-badge.kind-batch, .task-badge.kind-schedule { background: rgba(88, 166, 255, 0.15); color: #58a6ff; }
.task-source { font-size: 12px; color: var(--border-strong); margin-right: auto; }

.task-status { font-size: 11px; }
.task-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; word-break: break-all; }
.task-phase { font-size: 12px; color: var(--border-strong); margin-bottom: 4px; }
.task-error { font-size: 12px; color: #f0b429; margin-bottom: 4px; word-break: break-all; }

.task-progress { display: flex; align-items: center; gap: 8px; margin: 8px 0 6px; }
.task-progress .progress { flex: 1; }
.progress-num { font-size: 12px; color: var(--border-strong); min-width: 36px; text-align: right; }

.task-foot { display: flex; justify-content: space-between; align-items: center; }
.task-time { font-size: 11px; color: var(--border-strong); }
.task-link { font-size: 12px; color: var(--accent); }
</style>
