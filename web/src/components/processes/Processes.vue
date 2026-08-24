<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const procs = ref([])
const sortKey = ref('cpu')
const error = ref('')
const loading = ref(false)
const auto = ref(true)
const confirmPid = ref(null)
let timer = null

function fmtBytes(n) {
  n = n || 0
  for (const u of ['B', 'KB', 'MB', 'GB']) {
    if (n < 1024 || u === 'GB') return `${n.toFixed(1)} ${u}`
    n /= 1024
  }
}

function fmtTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  return d.toLocaleString()
}

async function load() {
  loading.value = true
  try {
    const d = await api.sysProcesses(sortKey.value)
    error.value = ''
    procs.value = d.processes || []
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function setSort(k) {
  if (sortKey.value === k) return
  sortKey.value = k
  load()
}

async function doKill(pid, sig) {
  try {
    await api.sysKill(pid, sig)
    confirmPid.value = null
    load()
  } catch (e) {
    error.value = e.message || '操作失败'
  }
}

function toggleAuto() {
  auto.value = !auto.value
  if (auto.value) { timer = setInterval(load, 5000) } else if (timer) { clearInterval(timer); timer = null }
}

onMounted(() => {
  load()
  if (auto.value) timer = setInterval(load, 5000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>进程管理</h1>
      <div class="subtitle">服务器进程（仅可操作本用户 f 的进程）</div>
      <div class="proc-toolbar">
        <button class="btn btn-sm" @click="load">刷新</button>
        <button class="btn btn-sm" :class="auto ? 'btn-primary' : ''" @click="toggleAuto">
          {{ auto ? '自动刷新: 开' : '自动刷新: 关' }}
        </button>
        <span class="proc-status">{{ loading ? '加载中…' : error || `${procs.length} 个进程` }}</span>
      </div>
    </div>
    <div class="page-body">
      <div class="proc-table-wrap">
        <table class="proc-table">
          <thead>
            <tr>
              <th @click="setSort('pid')">PID {{ sortKey === 'pid' ? '↓' : '' }}</th>
              <th>名称</th>
              <th @click="setSort('cpu')">CPU% {{ sortKey === 'cpu' ? '↓' : '' }}</th>
              <th @click="setSort('mem')">内存 {{ sortKey === 'mem' ? '↓' : '' }}</th>
              <th>用户</th>
              <th>命令</th>
              <th>启动时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in procs.slice(0, 200)" :key="p.pid">
              <td class="mono">{{ p.pid }}</td>
              <td>{{ p.name }}</td>
              <td class="mono">{{ p.cpu.toFixed(1) }}</td>
              <td class="mono">{{ fmtBytes(p.mem) }}</td>
              <td class="mono">{{ p.username }}</td>
              <td class="cmd" :title="p.cmdline">{{ p.cmdline }}</td>
              <td class="mono muted">{{ fmtTime(p.create_time) }}</td>
              <td>
                <template v-if="confirmPid === p.pid">
                  <button class="btn btn-sm btn-danger" @click="doKill(p.pid, 'SIGKILL')">确认结束</button>
                  <button class="btn btn-sm" @click="confirmPid = null">取消</button>
                </template>
                <template v-else>
                  <button class="btn btn-sm" @click="confirmPid = p.pid">结束</button>
                </template>
              </td>
            </tr>
            <tr v-if="!procs.length">
              <td colspan="8" class="muted" style="text-align:center;padding:24px;">无进程数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.proc-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.proc-status {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-faint);
}
.proc-table-wrap {
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: auto;
}
.proc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.proc-table th {
  position: sticky;
  top: 0;
  background: var(--surface-2);
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  white-space: nowrap;
  color: var(--text-muted);
}
.proc-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.proc-table tr:last-child td { border-bottom: none; }
.mono { font-family: var(--font-mono); }
.muted { color: var(--text-faint); }
.cmd {
  max-width: 480px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>