<script setup>
// 任务列表 — 面板与插件的统一任务队列(只读视图 + 清理)
//
// 数据来自 /api/tasks(安装浮窗、文件批量操作、上传都在写同一个 TaskStore),
// 所以这里不需要自己维护状态: 每 2s 拉一次, 页面不可见时暂停。
// 详情走 /api/tasks/<id>(TaskStore 的持久化快照, 含 meta 与环境报告)。
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已完成' },
  { key: 'failed', label: '失败' },
]

const tasks = ref([])
const counts = ref({ queued: 0, running: 0, done: 0, failed: 0 })
const filter = ref('all')
const q = ref('')
const loading = ref(false)
const err = ref('')
const syncedAt = ref(0)
const busy = ref(false)
const notice = ref('')

const detail = ref(null)
const detailBusy = ref(false)

let timer = null
let noticeTimer = null

const total = computed(() => (counts.value.queued || 0) + (counts.value.running || 0)
  + (counts.value.done || 0) + (counts.value.failed || 0))

const countFor = (key) => {
  const c = counts.value
  if (key === 'active') return (c.queued || 0) + (c.running || 0)
  if (key === 'done') return c.done || 0
  if (key === 'failed') return c.failed || 0
  return total.value
}

const visible = computed(() => {
  const key = filter.value
  const needle = q.value.trim().toLowerCase()
  return tasks.value.filter((t) => {
    if (key === 'active' && !(t.status === 'queued' || t.status === 'running')) return false
    if (key === 'done' && t.status !== 'done') return false
    if (key === 'failed' && t.status !== 'failed') return false
    if (!needle) return true
    return [t.name, t.source, t.kind, t.message, t.error, t.id]
      .filter(Boolean).join(' ').toLowerCase().includes(needle)
  })
})

const activeCount = computed(() => (counts.value.queued || 0) + (counts.value.running || 0))

function flash(msg) {
  notice.value = msg
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 3200)
}

function statusLabel(s) {
  return { queued: '排队中', running: '进行中', done: '已完成', failed: '失败' }[s] || s || '未知'
}

function pct(t) {
  if (t.status === 'done') return 100
  const n = Number(t.progress) || 0
  return Math.max(0, Math.min(100, n))
}

function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - ts))
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前'
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0')
    + ':' + String(d.getMinutes()).padStart(2, '0')
}

function fmtFull(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
}

async function load(silent) {
  if (!silent) loading.value = true
  try {
    const d = await api.taskQueue(true, 200)
    tasks.value = (d && d.tasks) || []
    counts.value = {
      queued: (d && d.queued) || 0,
      running: (d && d.running) || 0,
      done: (d && d.done) || 0,
      failed: (d && d.failed) || 0,
    }
    syncedAt.value = Math.floor(Date.now() / 1000)
    err.value = ''
  } catch (e) {
    err.value = (e && e.message) || '任务队列读取失败'
  } finally {
    if (!silent) loading.value = false
  }
}

function tick() {
  if (document.hidden) return // 后台标签页不拉, 省请求也省电
  load(true)
}

async function clearDone() {
  if (busy.value) return
  const n = (counts.value.done || 0) + (counts.value.failed || 0)
  if (!n) return
  if (!confirm('清理 ' + n + ' 条已完成/失败的任务？进行中的不受影响。')) return
  busy.value = true
  try {
    const d = await api.taskQueuePurge()
    await load(true)
    flash('已清理 ' + ((d && d.removed) || 0) + ' 条任务')
  } catch (e) {
    flash('清理失败: ' + ((e && e.message) || e))
  } finally {
    busy.value = false
  }
}

async function openDetail(t) {
  detailBusy.value = true
  detail.value = t // 先显示列表里的快照, 详情回来再覆盖
  try {
    const d = await api.taskDetail(t.id)
    if (d && d.id) detail.value = d
  } catch (e) {
    // 任务可能刚被清理掉: 保留列表快照, 不弹错误
  } finally {
    detailBusy.value = false
  }
}

const metaText = computed(() => {
  const m = detail.value && detail.value.meta
  if (!m || !Object.keys(m).length) return ''
  try { return JSON.stringify(m, null, 2) } catch (e) { return String(m) }
})

onMounted(() => {
  load()
  timer = setInterval(tick, 2000)
})

onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="page tk-page">
    <div class="page-head">
      <div class="tk-head">
        <div>
          <h1>任务列表</h1>
          <p class="subtitle">面板与插件的统一任务队列：插件安装、下载、上传、批量文件操作都在这里排队执行。</p>
        </div>
        <div class="tk-actions">
          <button class="btn btn-sm" :disabled="loading" @click="load(false)">{{ loading ? '刷新中…' : '刷新' }}</button>
          <button class="btn btn-sm" :disabled="busy || (!counts.done && !counts.failed)" @click="clearDone">清理已完成</button>
        </div>
      </div>

      <div class="tk-bar">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          class="tk-chip"
          :class="{ active: filter === f.key }"
          @click="filter = f.key"
        >
          {{ f.label }}<b>{{ countFor(f.key) }}</b>
        </button>
        <input v-model="q" class="input tk-search" placeholder="搜索任务名 / 来源 / ID…" />
        <span class="hint tk-sync">
          <span class="tk-live" :class="{ on: activeCount > 0 }"></span>
          {{ activeCount > 0 ? '有任务在执行' : '队列空闲' }} · 2s 自动刷新
        </span>
      </div>
    </div>

    <div class="page-body">
      <div v-if="notice" class="tk-notice">{{ notice }}</div>
      <div v-if="err" class="tk-error">{{ err }}</div>

      <div v-if="!visible.length && !err" class="tk-empty">
        <div class="tk-empty-icon">◌</div>
        <div class="tk-empty-title">{{ filter === 'all' && !q ? '还没有任务' : '没有匹配的任务' }}</div>
        <div class="hint">
          {{ filter === 'all' && !q ? '在插件市场安装插件、上传文件或批量处理文件时，任务会出现在这里。' : '换个筛选条件或清空搜索词试试。' }}
        </div>
      </div>

      <div
        v-for="t in visible"
        :key="t.id"
        class="tk-row"
        :class="'st-' + t.status"
        role="button"
        tabindex="0"
        @click="openDetail(t)"
        @keydown.enter="openDetail(t)"
      >
        <span class="tk-dot"></span>
        <div class="tk-main">
          <div class="tk-title">
            <b>{{ t.name || t.kind || '未命名任务' }}</b>
            <span v-if="t.source" class="tag-chip tag-chip-sm">{{ t.source }}</span>
            <span v-if="t.kind" class="tag-chip tag-chip-sm">{{ t.kind }}</span>
            <span class="tk-status">{{ statusLabel(t.status) }}</span>
          </div>
          <div class="tk-sub" :class="{ danger: t.status === 'failed' && t.error }">
            {{ t.error || t.message || t.phase || '等待执行…' }}
          </div>
          <div class="progress tk-progress"><div :style="{ width: pct(t) + '%' }"></div></div>
        </div>
        <div class="tk-side">
          <div class="tk-time">{{ fmtTime(t.created) }}</div>
          <div class="tk-id mono">{{ t.id }}</div>
        </div>
      </div>
    </div>

    <div v-if="detail" class="overlay" @click.self="detail = null">
      <div class="modal tk-modal">
        <div class="modal-header">
          <span>{{ detail.name || detail.kind || '任务详情' }}</span>
          <button class="btn btn-sm btn-ghost" @click="detail = null">关闭</button>
        </div>
        <div class="modal-body tk-detail">
          <div class="tk-kv"><span>状态</span><b :class="'tk-st-' + detail.status">{{ statusLabel(detail.status) }}</b></div>
          <div class="tk-kv"><span>进度</span><b>{{ pct(detail) }}%</b></div>
          <div class="tk-kv"><span>来源 / 类型</span><b>{{ detail.source || '—' }} / {{ detail.kind || '—' }}</b></div>
          <div v-if="detail.phase" class="tk-kv"><span>阶段</span><b class="mono">{{ detail.phase }}</b></div>
          <div class="tk-kv"><span>任务 ID</span><b class="mono tk-break">{{ detail.id }}</b></div>
          <div class="tk-kv"><span>创建</span><b>{{ fmtFull(detail.created) }}</b></div>
          <div class="tk-kv"><span>更新</span><b>{{ fmtFull(detail.updated_at) }}</b></div>
          <div v-if="detail.message" class="tk-kv"><span>消息</span><b class="tk-break">{{ detail.message }}</b></div>
          <div v-if="detail.error" class="tk-kv"><span>错误</span><b class="tk-break danger">{{ detail.error }}</b></div>
          <div v-if="metaText" class="tk-meta">
            <div class="tk-meta-title">附加数据 (meta)</div>
            <pre>{{ metaText }}</pre>
          </div>
          <div v-if="detailBusy" class="hint" style="margin-top:8px">读取最新详情…</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="detail = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tk-page { gap: 12px; }
.tk-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.tk-actions { display: flex; gap: 8px; flex-shrink: 0; }
.tk-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0 14px; }
.tk-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; font-size: 12px; font-weight: 600;
  font-family: var(--font); color: var(--text-muted);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-pill); cursor: pointer;
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}
.tk-chip b { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.tk-chip:hover { color: var(--text); border-color: var(--border-strong); }
.tk-chip.active { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.tk-chip.active b { color: var(--accent); }
.tk-search { height: 30px; min-width: 220px; flex: 1; max-width: 320px; font-size: 12px; }
.tk-sync { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.tk-live { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); }
.tk-live.on { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); animation: tk-pulse 1.6s ease-in-out infinite; }
@keyframes tk-pulse { 50% { opacity: 0.35; } }

.tk-notice {
  margin-bottom: 10px; padding: 8px 12px; font-size: 12px;
  color: var(--accent); background: var(--accent-soft);
  border: 1px solid var(--accent); border-radius: var(--radius-sm);
}
.tk-error {
  margin-bottom: 10px; padding: 8px 12px; font-size: 12px;
  color: var(--danger); background: var(--danger-soft);
  border: 1px solid var(--danger); border-radius: var(--radius-sm);
}

.tk-empty { padding: 56px 20px; text-align: center; }
.tk-empty-icon { font-size: 30px; color: var(--text-faint); line-height: 1; margin-bottom: 10px; }
.tk-empty-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }

.tk-row {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 14px; margin-bottom: 10px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); cursor: pointer;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
}
.tk-row:hover { border-color: var(--border-strong); background: var(--surface-2); }
.tk-row:focus-visible { outline: none; box-shadow: var(--ring); }
.tk-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; flex-shrink: 0; background: var(--text-faint); }
.tk-row.st-running .tk-dot { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); animation: tk-pulse 1.6s ease-in-out infinite; }
.tk-row.st-queued .tk-dot { background: var(--warning); }
.tk-row.st-done .tk-dot { background: var(--success); }
.tk-row.st-failed .tk-dot { background: var(--danger); }

.tk-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.tk-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.tk-title b { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 420px; }
.tk-status { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }
.tk-row.st-running .tk-status { color: var(--accent); }
.tk-row.st-failed .tk-status { color: var(--danger); }
.tk-row.st-done .tk-status { color: var(--success); }
.tk-sub { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-sub.danger { color: var(--danger); }
.tk-progress { height: 3px; margin-top: 2px; }
.tk-row.st-failed .tk-progress > div { background: var(--danger); }
.tk-row.st-done .tk-progress > div { background: var(--success); }
.tk-side { flex-shrink: 0; text-align: right; display: flex; flex-direction: column; gap: 3px; }
.tk-time { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.tk-id { font-size: 10px; color: var(--text-faint); max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tk-modal { max-width: 620px; }
.tk-detail { display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto; }
.tk-kv { display: flex; gap: 14px; font-size: 12px; line-height: 1.6; }
.tk-kv > span { width: 82px; flex-shrink: 0; color: var(--text-faint); }
.tk-kv > b { font-weight: 600; color: var(--text); }
.tk-kv > b.danger { color: var(--danger); }
.tk-st-running { color: var(--accent); }
.tk-st-done { color: var(--success); }
.tk-st-failed { color: var(--danger); }
.tk-break { word-break: break-all; font-weight: 500 !important; }
.tk-meta { margin-top: 6px; }
.tk-meta-title { font-size: 11px; color: var(--text-faint); margin-bottom: 4px; }
.tk-meta pre {
  max-height: 220px; overflow: auto; margin: 0;
  padding: 10px 12px; font-family: var(--font-mono); font-size: 11px;
  color: var(--text-muted); background: var(--bg-raised);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
}
@media (max-width: 720px) {
  .tk-id { display: none; }
  .tk-search { max-width: 100%; }
}
</style>
