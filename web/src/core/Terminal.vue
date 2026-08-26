<script setup>
// 终端 — 对接 /api/terminal(SSE 流)
import { ref, onMounted, onUnmounted } from 'vue'
import { request } from '../api/client'

const sid = ref('')
const output = ref('')
const inputLine = ref('')
const connected = ref(false)
let es = null

async function openTerm() {
  try {
    const d = await request.post('/api/terminal/open', { rows: 24, cols: 100 })
    sid.value = d.sid
    connected.value = true
    // SSE 流
    es = new EventSource('/api/terminal/stream?sid=' + d.sid)
    es.onmessage = (ev) => {
      try {
        const text = atob(ev.data)
        output.value += text
        if (output.value.length > 20000) output.value = output.value.slice(-20000)
        scrollBottom()
      } catch (e) { /* 忽略 */ }
    }
    es.onerror = () => { /* 断线重连由 EventSource 处理 */ }
  } catch (e) { alert('打开终端失败: ' + e.message) }
}

function send() {
  if (!sid.value || !inputLine.value) return
  const data = btoa(inputLine.value + '\n')
  request.post('/api/terminal/input', { sid: sid.value, data }).catch(() => {})
  inputLine.value = ''
}

async function closeTerm() {
  if (es) { es.close(); es = null }
  if (sid.value) await request.post('/api/terminal/close', { sid: sid.value }).catch(() => {})
  connected.value = false
  sid.value = ''
}

function scrollBottom() {
  setTimeout(() => {
    const el = document.getElementById('term-out')
    if (el) el.scrollTop = el.scrollHeight
  }, 50)
}

onUnmounted(() => { if (es) es.close() })
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>终端</h1>
        <p class="subtitle" :class="connected ? 'ok' : ''">{{ connected ? '已连接 ' + sid : '未连接' }}</p>
      </div>
      <div class="toolbar">
        <button v-if="!connected" class="btn btn-primary" @click="openTerm">连接</button>
        <button v-else class="btn btn-danger" @click="closeTerm">关闭</button>
      </div>
    </div>
    <div class="page-body">
      <pre id="term-out" class="term mono">{{ output || '（点击 连接 开始）' }}</pre>
      <div class="term-input">
        <input v-model="inputLine" class="input mono" placeholder="输入命令, 回车发送"
          @keydown.enter="send" :disabled="!connected" />
        <button class="btn btn-primary" :disabled="!connected" @click="send">发送</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.toolbar { display: flex; gap: 8px; }
.term { background: #0a0e14; color: #d8e0ea; padding: 14px; height: calc(100vh - 210px); overflow-y: auto;
  white-space: pre-wrap; word-break: break-all; font-size: 13px; border-radius: var(--radius-sm); }
.term-input { display: flex; gap: 8px; margin-top: 10px; }
.term-input .input { flex: 1; }
.ok { color: var(--success); }
</style>