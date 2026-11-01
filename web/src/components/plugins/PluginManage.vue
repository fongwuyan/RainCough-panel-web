<template>
  <!-- 插件运行时管理: 启停 / 开机自启 / 运行日志。
       ★ 这些接口(v4 supervisor)一直存在但前端从无入口 —— 插件崩了只能重启整个面板,
         新装插件默认不开自启, 面板重启后它就静默停着(2026-11-01 QQBot 实测踩到)。 -->
  <div class="pman">
    <div class="pman-head">
      <span class="pman-title">运行时</span>
      <span class="pman-state" :class="stateClass">{{ stateText }}</span>
      <span v-if="sup && sup.pid" class="pman-meta mono">pid {{ sup.pid }}</span>
      <span v-if="sup && sup.up_sec" class="pman-meta mono">已运行 {{ fmtUp(sup.up_sec) }}</span>
      <span v-if="sup && sup.crash_count" class="pman-meta pman-warn">崩溃 {{ sup.crash_count }} 次</span>
      <button class="btn btn-sm pman-refresh" :disabled="busy" @click="reload">刷新</button>
    </div>

    <div class="pman-actions">
      <button class="btn btn-sm" :disabled="busy" @click="act('start')">启动</button>
      <button class="btn btn-sm" :disabled="busy" @click="act('stop')">停止</button>
      <button class="btn btn-sm" :disabled="busy" @click="act('restart')">重启</button>
      <label class="pman-auto">
        <input type="checkbox" :checked="!!(sup && sup.autostart)" :disabled="busy" @change="toggleAuto($event)" />
        开机自启
      </label>
    </div>

    <div v-if="err" class="pman-err">{{ err }}</div>

    <div class="pman-loghead">
      <span>运行日志</span>
      <span class="pman-meta mono">最近 {{ logLines }} 行</span>
      <button class="btn btn-sm pman-refresh" :disabled="logBusy" @click="loadLog">
        {{ logBusy ? '读取中…' : '刷新日志' }}
      </button>
    </div>
    <pre class="pman-log mono">{{ log || (logBusy ? '读取中…' : '（暂无日志）') }}</pre>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api'

const props = defineProps({
  name: { type: String, required: true },
})

const busy = ref(false)
const err = ref('')
const sup = ref(null)
const state = ref('')
const log = ref('')
const logBusy = ref(false)
const logLines = 200

const stateText = computed(() => {
  if (state.value === 'unmanaged') return '未托管'
  return state.value || '未知'
})
const stateClass = computed(() => {
  if (state.value === 'running') return 'is-ok'
  if (state.value === 'starting') return 'is-warn'
  if (['crashed', 'backoff', 'failed'].includes(state.value)) return 'is-bad'
  return 'is-idle'
})

function fmtUp(sec) {
  const s = Number(sec) || 0
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + 'm'
  if (s < 86400) return Math.floor(s / 3600) + 'h'
  return Math.floor(s / 86400) + 'd'
}

async function reload() {
  busy.value = true
  err.value = ''
  try {
    const d = await api.serviceList()
    const row = ((d && d.services) || []).find((x) => x.name === props.name)
    state.value = row ? row.state : ''
    sup.value = (row && row.supervisor) || null
  } catch (e) {
    err.value = (e && e.message) || '读取状态失败'
  } finally {
    busy.value = false
  }
}

async function act(action) {
  busy.value = true
  err.value = ''
  try {
    await api.serviceAction(props.name, action)
    // 启停是异步的: 给 supervisor 一点时间再读状态, 否则会看到旧的 starting
    await new Promise((r) => setTimeout(r, 600))
    await reload()
  } catch (e) {
    err.value = (e && e.message) || ('操作失败: ' + action)
  } finally {
    busy.value = false
  }
}

async function toggleAuto(e) {
  const on = !!(e && e.target && e.target.checked)
  busy.value = true
  err.value = ''
  try {
    await api.serviceAutostart(props.name, on)
    await reload()
  } catch (ex) {
    err.value = (ex && ex.message) || '设置自启失败'
    if (e && e.target) e.target.checked = !on // 失败回滚勾选状态
  } finally {
    busy.value = false
  }
}

async function loadLog() {
  logBusy.value = true
  try {
    const d = await api.serviceLog(props.name, logLines)
    // 后端可能回 {text} 或纯文本
    log.value = typeof d === 'string' ? d : ((d && (d.text || d.log)) || '')
  } catch (e) {
    log.value = '读取日志失败: ' + ((e && e.message) || '')
  } finally {
    logBusy.value = false
  }
}

onMounted(() => {
  reload()
  loadLog()
})
</script>

<style scoped>
/* 类名统一 pman- 前缀: main.css 的 .error/.hint 带 24px padding 与居中,
   直接复用会把每一行撑成大块(接手文档"踩过的坑"第 7 条)。 */
.pman {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-raised);
  padding: 10px 12px;
  margin: 8px 0;
  font-size: 12px;
}
.pman-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.pman-title { font-weight: 600; color: var(--text); }
.pman-state {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
}
.pman-state.is-ok { color: var(--success); border-color: var(--success); }
.pman-state.is-warn { color: var(--warning); border-color: var(--warning); }
.pman-state.is-bad { color: var(--danger); border-color: var(--danger); }
.pman-meta { font-size: 11px; color: var(--text-faint); }
.pman-warn { color: var(--warning); }
.pman-refresh { margin-left: auto; }

.pman-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.pman-auto {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  color: var(--text-muted);
  cursor: pointer;
}
.pman-err { color: var(--danger); padding: 6px 0; }

.pman-loghead {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: var(--text-muted);
}
.pman-log {
  margin: 6px 0 0;
  padding: 8px 10px;
  max-height: 220px;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
