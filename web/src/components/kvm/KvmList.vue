<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const emit = defineEmits(['open'])

const domains = ref([])
const loading = ref(false)
const error = ref('')
const notice = ref('')
let pollTimer = null

async function load() {
  loading.value = true; error.value = ''
  try {
    domains.value = (await api.kvDomains()) || []
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}
function poll() { load().catch(() => {}) }

onMounted(() => {
  load()
  pollTimer = setInterval(poll, 10000)
})
onBeforeUnmount(() => clearInterval(pollTimer))

function stateClass(d) {
  const s = (d.state || '').toLowerCase()
  if (s === 'running') return 'ok'
  if (s === 'paused') return 'warn'
  return 'fail'
}
function stateLabel(d) { return d.state_cn || d.state || '' }
function isRunning(d) { return (d.state || '').toLowerCase() === 'running' }
function isOff(d) { return (d.state || '').toLowerCase() === 'shut off' }
function isPaused(d) { return (d.state || '').toLowerCase() === 'paused' }

async function act(action, d, msg) {
  error.value = ''
  try {
    await api.kvAction(d.name, action)
    if (msg) { notice.value = msg; setTimeout(() => { notice.value = '' }, 3000) }
    load()
  } catch (err) { error.value = err.message }
}

async function removeVm(d) {
  if (!confirm(`确认删除虚拟机 ${d.name}？\n（将连同磁盘一并删除，不可恢复）`)) return
  error.value = ''
  try {
    await api.kvAction(d.name, 'undefine')
    notice.value = `已删除 ${d.name}`
    setTimeout(() => { notice.value = '' }, 3000)
    load()
  } catch (err) { error.value = err.message }
}
</script>

<template>
  <div class="section" style="margin-top:16px;">
    <div class="section-title">虚拟机列表 ({{ domains.length }})</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>
    <div v-if="loading" class="loading" style="margin-top:16px;"><div class="spinner"></div></div>

    <div v-if="!loading && !domains.length" class="hint" style="margin-top:8px;">暂无虚拟机</div>
    <div v-else>
      <div v-for="d in domains" :key="d.id || d.name" class="result-item" style="cursor:default;margin-bottom:10px;" @click.stop>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="min-width:0;cursor:pointer;" @click="emit('open', d)">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="name" style="font-size:14px;">{{ d.name }}</span>
              <span class="tag-chip" :class="stateClass(d)">{{ stateLabel(d) }}</span>
            </div>
            <div class="meta" style="font-size:12px;margin-top:4px;">{{ d.id === '-' ? '未运行' : 'ID ' + d.id }}</div>
            <div v-if="d.note" class="meta" style="font-size:12px;margin-top:4px;color:var(--text-dim);">
              <span>备注: </span>{{ d.note }}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;">
            <button v-if="isOff(d)" class="btn btn-sm" @click="act('start', d, '已启动 ' + d.name)">启动</button>
            <button v-else-if="isRunning(d)" class="btn btn-sm" @click="act('shutdown', d, '已发送关机')">关机</button>
            <button v-if="isRunning(d)" class="btn btn-sm" @click="act('reboot', d, '已重启')">重启</button>
            <button v-if="isRunning(d)" class="btn btn-sm" @click="act('suspend', d, '已暂停')">暂停</button>
            <button v-else-if="isPaused(d)" class="btn btn-sm" @click="act('resume', d, '已恢复')">恢复</button>
            <button v-if="isRunning(d)" class="btn btn-sm" @click="act('destroy', d, '已强制关闭')">强制</button>
            <button class="btn btn-sm" @click="emit('open', d)">详情</button>
            <button class="btn btn-sm btn-danger" @click="removeVm(d)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
