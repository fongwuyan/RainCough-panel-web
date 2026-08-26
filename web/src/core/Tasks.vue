<script setup>
// 任务队列 — 对接 /api/tasks
import { ref, onMounted, onUnmounted } from 'vue'
import { request } from '../api/client'

const tasks = ref([])
const counts = ref({})
let timer = null

async function load() {
  try {
    const d = await request.get('/api/tasks?include_done=1')
    tasks.value = d.tasks || []
    counts.value = d.count || {}
  } catch (e) { /* 忽略 */ }
}

function statusClass(s) {
  return { queued: '', running: 'run', done: 'ok', failed: 'err' }[s] || ''
}
const statusLabel = { queued: '排队', running: '执行中', done: '完成', failed: '失败' }

onMounted(() => { load(); timer = setInterval(load, 3000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>任务队列</h1>
        <p class="subtitle">
          排队 {{ counts.queued || 0 }} · 执行中 {{ counts.running || 0 }} ·
          完成 {{ counts.done || 0 }} · 失败 {{ counts.failed || 0 }}
        </p>
      </div>
      <button class="btn" @click="load">刷新</button>
    </div>
    <div class="page-body">
      <table class="table">
        <thead><tr><th>任务</th><th>来源</th><th>状态</th><th>进度</th><th>消息</th></tr></thead>
        <tbody>
          <tr v-for="t in tasks" :key="t.id">
            <td>{{ t.name }}</td>
            <td class="mono faint">{{ t.source }}</td>
            <td><span class="status" :class="statusClass(t.status)">{{ statusLabel[t.status] }}</span></td>
            <td style="width:140px">
              <div class="bar"><div class="bar-fill" :style="{ width: t.progress + '%', background: t.status === 'failed' ? 'var(--danger)' : 'var(--accent)' }"></div></div>
            </td>
            <td class="faint">{{ t.message || t.error || '' }}</td>
          </tr>
          <tr v-if="!tasks.length"><td colspan="5" class="faint">暂无任务</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.status { padding: 2px 8px; border-radius: var(--radius-sm); font-size: 12px; background: var(--surface-2); }
.status.run { background: var(--warning-soft); color: var(--warning); }
.status.ok { background: var(--success-soft); color: var(--success); }
.status.err { background: var(--danger-soft); color: var(--danger); }
.bar { background: var(--surface-2); height: 6px; border-radius: 2px; overflow: hidden; }
.bar-fill { height: 100%; }
</style>