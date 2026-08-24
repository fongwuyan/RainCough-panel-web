<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { api } from '../../api'

const text = ref('')
const grep = ref('')
const lines = ref(200)
const error = ref('')
const loading = ref(false)
const auto = ref(true)
let timer = null

async function load() {
  loading.value = true
  try {
    const d = await api.sysLogs(lines.value, grep.value)
    error.value = ''
    text.value = d.text || ''
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function toggleAuto() {
  auto.value = !auto.value
  if (auto.value) start()
  else stop()
}

function start() {
  stop()
  timer = setInterval(load, 2000)
}

function stop() {
  if (timer) { clearInterval(timer); timer = null }
}

let debounce = null
function onSearchInput() {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(load, 400)
}

watch(lines, () => { if (auto.value) load() })

onMounted(() => {
  load()
  if (auto.value) start()
})

onUnmounted(stop)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>系统日志</h1>
      <div class="subtitle">/var/log/touchgal.log</div>
      <div class="log-toolbar">
        <input v-model="grep" class="term-select" placeholder="过滤关键字…" @input="onSearchInput" />
        <select v-model="lines" class="term-select">
          <option :value="100">100 行</option>
          <option :value="200">200 行</option>
          <option :value="500">500 行</option>
          <option :value="1000">1000 行</option>
        </select>
        <button class="btn btn-sm" @click="load">刷新</button>
        <button class="btn btn-sm" :class="auto ? 'btn-primary' : ''" @click="toggleAuto">
          {{ auto ? '自动刷新: 开' : '自动刷新: 关' }}
        </button>
        <span class="log-status">{{ loading ? '加载中…' : error || (text ? 'ok' : '空') }}</span>
      </div>
    </div>
    <div class="page-body no-scroll">
      <pre class="log-view">{{ text }}</pre>
    </div>
  </div>
</template>

<style scoped>
.log-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.term-select {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 5px 8px;
  font-size: 13px;
}
.log-status {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-faint);
}
.page-body {
  display: flex;
  flex-direction: column;
}
.log-view {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 10px 12px;
  background: #0b0e11;
  border: 1px solid var(--border);
  border-radius: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: #b8c4d0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>