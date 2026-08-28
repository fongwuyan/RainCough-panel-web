<script setup>
// 插件健康 — 系统顶级页面
// 自动检测插件加载情况: 子进程存活 / 健康端点 / 独立前端资产 / runtime 日志
// 子选项卡: ① 检测结果 ② 独立日志
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const tab = ref('status') // status | logs
const data = ref(null)
const loading = ref(false)
const err = ref('')
const logName = ref('')
const logText = ref('')
const logLoading = ref(false)

async function load() {
  loading.value = true
  err.value = ''
  try {
    const r = await fetch('/api/sys/plugins-health')
    const d = await r.json()
    if (d.error) { err.value = d.error } else { data.value = d }
  } catch (e) { err.value = e.message }
  loading.value = false
}

const summary = {
  get total() { return data.value ? data.value.total : 0 },
  get alive() { return data.value ? data.value.alive : 0 },
  get healthy() { return data.value ? data.value.healthy : 0 },
  get bad() { return (data.value ? data.value.total : 0) - (data.value ? data.value.healthy : 0) },
}

const probs = computed(() => (data.value ? (data.value.items || []).filter((i) => !i.alive || !i.health_http) : []))

function statusText(it) {
  if (!it.alive) return { label: '未存活', cls: 'bad' }
  if (!it.health_http) return { label: '健康端失败', cls: 'warn' }
  return { label: '正常', cls: 'ok' }
}

async function loadLog(name) {
  logName.value = name
  logLoading.value = true
  logText.value = ''
  try {
    const r = await fetch('/api/sys/plugins-health/log?name=' + encodeURIComponent(name) + '&lines=400')
    const d = await r.json()
    logText.value = (d && d.text) || '(无日志)'
  } catch (e) { logText.value = '读取失败: ' + e.message }
  logLoading.value = false
}

let timer = null
onMounted(() => { load(); timer = setInterval(load, 5000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div>
    <!-- 父级子选项卡 -->
    <div class="parent-tabs">
      <div class="parent-tab" :class="{ on: tab === 'status' }" @click="tab = 'status'">检测结果</div>
      <div class="parent-tab" :class="{ on: tab === 'logs' }" @click="tab = 'logs'">独立日志</div>
    </div>

    <!-- ============ 检测结果 ============ -->
    <div v-if="tab === 'status'">
      <div v-if="err" class="section error">{{ err }}</div>
      <div v-if="loading && !data" class="section loading"><div class="spinner"></div> 检测中...</div>

      <div v-if="data" class="stat-grid">
        <div class="stat-card"><div class="stat-num">{{ summary.total }}</div><div class="stat-label">插件总数</div></div>
        <div class="stat-card"><div class="stat-num accent">{{ summary.healthy }}</div><div class="stat-label">健康</div></div>
        <div class="stat-card"><div class="stat-num warn">{{ summary.bad }}</div><div class="stat-label">异常</div></div>
        <div class="stat-card"><div class="stat-num muted">{{ summary.alive }}</div><div class="stat-label">子进程存活</div></div>
      </div>

      <!-- 异常概览 -->
      <div v-if="probs.length" class="section">
        <div class="section-title" style="color:var(--danger,#f85149);">⚠ 异常插件</div>
        <div v-for="p in probs" :key="p.name" class="kv-row">
          <span class="kv-k">{{ p.label || p.name }}</span>
          <span class="kv-v mono" style="color:var(--danger,#f85149);">{{ p.error || '健康检查失败' }}</span>
        </div>
      </div>

      <!-- 全表 -->
      <div class="section">
        <div class="section-title">全部插件</div>
        <table class="table">
          <thead>
            <tr><th>插件</th><th>版本</th><th>子进程</th><th>健康端</th><th>前端资产</th><th>状态</th><th>日志尾</th></tr>
          </thead>
          <tbody>
            <tr v-for="it in (data ? data.items : [])" :key="it.name">
              <td class="mono">{{ it.label || it.name }}</td>
              <td class="mono faint" style="font-size:11px;">{{ it.version }}</td>
              <td>{{ it.alive ? '✔' : '✘' }}</td>
              <td>{{ it.health_http ? '✔' : '✘' }}</td>
              <td>{{ it.asset_ok ? '✔' : '—' }}</td>
              <td>
                <span :class="'tag-chip ' + statusText(it).cls">{{ statusText(it).label }}</span>
              </td>
              <td>
                <span v-if="it.log_tail" class="mono faint" style="font-size:10px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;" :title="it.log_tail">{{ it.log_tail.split('\n').slice(-1)[0] }}</span>
                <span v-else class="faint">-</span>
              </td>
            </tr>
          </tbody>
        </table>
        <button class="btn btn-sm" style="margin-top:8px;" @click="load">立即检测</button>
      </div>
    </div>

    <!-- ============ 独立日志 ============ -->
    <div v-else tabindex="-1">
      <div class="section">
        <div class="section-title">插件子进程日志(.runtime.log)</div>
        <div class="flex" style="gap:8px;margin-bottom:8px;">
          <select v-model="logName" class="input" style="flex:1" @change="logName && loadLog(logName)">
            <option value="">选择插件…</option>
            <option v-for="it in (data ? data.items : [])" :key="it.name" :value="it.name">{{ it.label || it.name }}</option>
          </select>
          <button class="btn btn-primary" @click="logName && loadLog(logName)" :disabled="!logName || logLoading">{{ logLoading ? '读取中…' : '读取日志' }}</button>
          <button class="btn btn-sm btn-ghost" v-if="logName" @click="loadLog(logName)">刷新</button>
        </div>
        <div v-if="logLoading" class="loading"><div class="spinner"></div> 加载日志...</div>
        <pre v-else-if="logText" class="mono-block" style="max-height:65vh;overflow:auto;white-space:pre-wrap;">{{ logText }}</pre>
        <p v-else class="hint">选择插件后点击读取日志</p>
      </div>
    </div>
  </div>
</template>