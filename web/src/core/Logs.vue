<script setup>
// 日志 — 样式复刻旧 Logs.vue, 逻辑对接新后端 /api/sysfunc
import { ref, onMounted, onUnmounted } from 'vue'
import { request } from '../api/client'

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
    const path = '/var/log/raincough.log'
    const d = await request.get('/api/fm/read?path=' + encodeURIComponent(path) + '&limit=' + lines.value * 120)
    error.value = ''
    const content = d.content || ''
    const arr = content.split('\n').filter((l) => {
      if (!l) return false
      if (grep.value && !l.includes(grep.value)) return false
      return true
    })
    text.value = arr.slice(-lines.value).join('\n')
  } catch (e) {
    error.value = e.message || '加载失败'
  }
  loading.value = false
}

function toggleAuto() {
  auto.value = !auto.value
  if (auto.value) start()
  else stop()
}
function start() {
  stop()
  timer = setInterval(load, 3000)
}
function stop() {
  if (timer) { clearInterval(timer); timer = null }
}
let debounce = null
function onSearchInput() {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(load, 400)
}
onMounted(() => { load(); if (auto.value) start() })
onUnmounted(stop)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>系统日志</h1>
      <div class="subtitle">/var/log/raincough.log</div>
      <div class="log-toolbar">
        <input v-model="grep" class="term-select" placeholder="过滤关键字…" @input="onSearchInput" />
        <select v-model="lines" class="term-select">
          <option :value="100">100 行</option>
          <option :value="200">200 行</option>
          <option :value="500">500 行</option>
          <option :value="1000">1000 行</option>
        </select>
        <button class="btn btn-sm" @click="load">刷新</button>
        <button class="btn btn-sm" :class="auto ? 'btn-primary' : ''" @click="toggleAuto">{{ auto ? '自动刷新: 开' : '自动刷新: 关' }}</button>
        <span class="log-status">{{ loading ? '加载中…' : error || (text ? 'ok' : '空') }}</span>
      </div>
    </div>
    <div class="page-body no-scroll">
      <pre class="log-view">{{ text }}</pre>
    </div>
  </div>
</template>

<style scoped>
.log-toolbar { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.term-select { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); padding: 5px 8px; font-size: 13px; }
.log-status { margin-left: auto; font-size: 12px; color: var(--text-faint); }
.log-view { background: var(--bg); border: 1px solid var(--border); padding: 12px; height: calc(100vh - 220px); overflow: auto; font-size: 12px; font-family: var(--font-mono); white-space: pre-wrap; word-break: break-all; }
</style>