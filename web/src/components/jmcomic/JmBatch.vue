<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useJmcomic } from '../../stores/jmcomic'

const jm = useJmcomic()

const MODES = [
  { key: 'keyword', label: '关键词' },
  { key: 'author', label: '作者' },
  { key: 'tag', label: '标签' },
]
const mode = ref('keyword')
const keyword = ref('')
const error = ref('')

const batch = jm.batch
const running = computed(() => batch.value && batch.value.running)
const statusText = computed(() => (batch.value || {}).status || 'idle')

const list = computed(() => {
  const b = batch.value
  if (!b || !b.results) return []
  return Object.entries(b.results).map(([aid, r]) => ({ aid, ...r }))
})

const doneCount = computed(() => (batch.value || {}).done || 0)
const failCount = computed(() => (batch.value || {}).fail || 0)
const skipCount = computed(() => (batch.value || {}).skip || 0)
const foundCount = computed(() => (batch.value || {}).found || 0)
const currentAid = computed(() => (batch.value || {}).current)

function currentName() {
  if (!currentAid.value) return ''
  const b = batch.value
  if (!b || !b.results) return ''
  const r = b.results[currentAid.value]
  return r ? r.name : ''
}

function statusLabel(st) {
  return {
    queued: '等待',
    downloading: '下载中',
    completed: '成功',
    failed: '失败',
    skipped: '已跳过',
  }[st] || st
}

function statusCls(st) {
  return {
    queued: 'status',
    downloading: 'status',
    completed: 'ok',
    failed: 'err',
    skipped: 'muted',
  }[st] || 'status'
}

async function start() {
  error.value = ''
  const kw = keyword.value.trim()
  if (!kw) { error.value = '请输入批量搜索内容'; return }
  try {
    await jm.startBatch(mode.value, kw)
  } catch (e) {
    error.value = e.message
  }
}

async function stop() {
  error.value = ''
  try {
    await jm.stopBatch()
  } catch (e) {
    error.value = e.message
  }
}

onMounted(async () => {
  await jm.getBatch()
  if (jm.batch && jm.batch.running) {
    jm.ensureBatchPolling()
  }
})

onUnmounted(() => {
  if (jm.batch && !jm.batch.running) {
    jm.stopBatchPolling && jm.stopBatchPolling()
  }
})
</script>

<template>
  <div>
    <div class="search-bar">
      <select v-model="mode" class="select">
        <option v-for="m in MODES" :key="m.key" :value="m.key">{{ m.label }}</option>
      </select>
      <input
        v-model="keyword"
        class="input"
        type="text"
        :placeholder="mode === 'author' ? '输入作者名...' : mode === 'tag' ? '输入标签...' : '输入关键词...'"
        @keydown.enter="start"
      />
      <button class="btn btn-primary" :disabled="running" @click="start">
        {{ running ? '批量下载中...' : '开始批量下载' }}
      </button>
      <button v-if="running" class="btn btn-danger" @click="stop">停止</button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="running || batch" class="section" style="margin-top:16px;">
      <div class="section-title">批量下载进度</div>
      <div style="font-size:13px;margin-bottom:10px;line-height:1.8;">
        <span v-if="statusText === 'collecting'" class="status-line">正在收集：已发现 {{ foundCount }} 本...</span>
        <span v-else-if="statusText === 'downloading'" class="status-line">
          下载中：已发现 {{ foundCount }} 本 · 已完成 {{ doneCount }} · 失败 {{ failCount }} · 跳过 {{ skipCount }}
        </span>
        <span v-else-if="statusText === 'done'" class="status-line">
          已完成：共 {{ foundCount }} 本 · 成功 {{ doneCount }} · 失败 {{ failCount }} · 跳过 {{ skipCount }}
        </span>
        <span v-else-if="statusText === 'stopped'" class="status-line">
          已停止：已下载 {{ doneCount }} / {{ foundCount }}
        </span>
      </div>
      <div v-if="statusText === 'downloading' && currentAid" class="status-line" style="margin-bottom:8px;">
        当前：<strong>#{{ currentAid }}</strong> {{ currentName() }}
      </div>
      <div v-if="foundCount || list.length" class="progress" style="margin-bottom:14px;">
        <div :style="{ width: Math.round(((doneCount + failCount + skipCount) / Math.max(foundCount, 1)) * 100) + '%' }"></div>
      </div>

      <template v-if="list.length">
        <div style="max-height:360px;overflow:auto;border:1px solid var(--border);border-radius:var(--radius-sm);">
          <div
            v-for="item in list"
            :key="item.aid"
            style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;"
          >
            <span class="card-meta" style="flex-shrink:0;">#{{ item.aid }}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" :title="item.name">
              {{ item.name || '未知书名' }}
            </span>
            <span class="badge-tag" :class="statusCls(item.status)" style="position:static;flex-shrink:0;">
              {{ statusLabel(item.status) }}
            </span>
          </div>
        </div>
        <div style="margin-top:10px;">
          <button class="btn btn-ghost btn-sm" @click="jm.refreshLibrary">刷新本子库</button>
        </div>
      </template>
    </div>

    <div v-else class="empty" style="margin-top:16px;">输入作者 / 关键词 / 标签，批量下载其全部作品</div>
  </div>
</template>
