<script setup>
// 服务健康中心(插件健康重做): 注册表驱动, 统一展示 v4 插件 + 存量 v3 插件
// 数据: /api/services/health(v4 接口库) + /api/sys/plugins-health(v3 兼容)
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'

const router = useRouter()
const loading = ref(false)
const summary = ref({ total: 0, online: 0, offline: 0, interfaces: 0 })
const rows = ref([])
const filter = ref({ type: '', status: '' })
const expanded = ref(null)   // 展开行的 name
const log = ref({ open: false, name: '', text: '', lines: 200, loading: false })

let timer = null

async function load() {
  loading.value = true
  try {
    const srv = await api.servicesHealth()
    rows.value = (srv.providers || []).map((p) => ({
      name: p.name, label: p.label, version: p.version, kind: p.kind || 'plugin',
      source: 'v4', status: p.status, online: p.online, latency: p.latency_ms,
      fail: p.fail_count, lastSeen: p.last_seen, ifaces: p.ifaces || [],
    }))
    Object.assign(summary.value, { total: out.length, interfaces: srv.interfaces || 0 })
    summary.value.online = out.filter((r) => r.online).length
    summary.value.offline = out.length - summary.value.online
  } catch (e) {
    console.error('health load failed', e)
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => rows.value.filter((r) => {
  if (filter.value.type && filter.value.type !== 'all') {
    if (filter.value.type === 'system' && r.kind !== 'system') return false
    if (filter.value.type === 'plugin' && r.kind !== 'plugin') return false
  }
  if (filter.value.status && filter.value.status !== 'all') {
    if (filter.value.status === 'online' && !r.online) return false
    if (filter.value.status === 'offline' && r.online) return false
  }
  return true
}))

const expandedRow = computed(() => rows.value.find((r) => r.name === expanded.value) || null)

function toggleRow(name) { expanded.value = expanded.value === name ? null : name }
function goIfaces(q) { router.push({ path: '/ifaces', query: q ? { q } : {} }) }

async function openLog(name) {
  log.value = { open: true, name, text: '', lines: 200, loading: true }
  try {
    const d = await api.servicesHealthLog(name, 200)
    log.value.text = d.text || '(空日志)'
  } catch (e) {
    log.value.text = '日志拉取失败: ' + (e.message || e)
  } finally {
    log.value.loading = false
  }
}
async function reloadLog() {
  if (!log.value.open) return
  log.value.loading = true
  try {
    const d = await api.servicesHealthLog(log.value.name, log.value.lines)
    log.value.text = d.text || '(空日志)'
  } catch (e) {
    log.value.text = '日志拉取失败: ' + (e.message || e)
  } finally {
    log.value.loading = false
  }
}

onMounted(() => { load(); timer = setInterval(load, 10000) })
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="section">
    <div class="section-title">
      <h2>服务健康中心</h2>
      <span class="faint">注册表驱动 · v4 接口库 + 存量插件</span>
      <button class="btn" :disabled="loading" @click="load">刷新</button>
    </div>

    <div class="sum">
      <div class="stat-card"><b>{{ summary.total }}</b><span>提供方</span></div>
      <div class="stat-card"><b style="color:#2e9e5b">{{ summary.online }}</b><span>在线</span></div>
      <div class="stat-card"><b style="color:#d9524e">{{ summary.offline }}</b><span>离线</span></div>
      <div class="stat-card"><b>{{ summary.interfaces }}</b><span>已注册接口</span></div>
    </div>

    <div class="bar">
      <select v-model="filter.type" class="input">
        <option value="all">类型:全部</option>
        <option value="plugin">插件</option>
        <option value="system">系统</option>
      </select>
      <select v-model="filter.status" class="input">
        <option value="all">状态:全部</option>
        <option value="online">在线</option>
        <option value="offline">离线</option>
      </select>
      <span class="faint">共 {{ filtered.length }} 个</span>
    </div>

    <table class="table">
      <thead>
        <tr><th>提供方</th><th>类型</th><th>版本</th><th>状态</th><th>接口</th><th>延迟</th><th>失败</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="r in filtered" :key="r.name" @click="toggleRow(r.name)">
          <td>
            <span class="dot" :class="r.online ? 'on' : 'off'"></span>
            <b>{{ r.label }}</b>
          </td>
          <td>{{ r.kind === 'system' ? '系统' : '插件' }}</td>
          <td>{{ r.version }}</td>
          <td>{{ r.status }}<span v-if="r.err" class="err"> · {{ r.err }}</span></td>
          <td>{{ r.ifaces.length }}</td>
          <td>{{ r.latency != null ? r.latency + 'ms' : '-' }}</td>
          <td>{{ r.fail }}</td>
          <td @click.stop>
            <button class="btn small" v-if="r.ifaces.length" @click="goIfaces(r.name)">接口</button>
            <button class="btn small" @click="openLog(r.name)">日志</button>
          </td>
        </tr>
        <tr v-if="!filtered.length"><td colspan="8" class="empty">暂无服务</td></tr>
        <tr v-if="expanded">
          <td colspan="8" class="expand">
            <template v-if="expandedRow && expandedRow.ifaces.length">
              <span class="faint">注册接口:</span>
              <span v-for="id in expandedRow.ifaces" :key="id" class="chip" @click.stop="goIfaces(id)">{{ id }}</span>
            </template>
            <span v-else class="faint">该服务未注册接口</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="log.open" class="log-panel">
      <div class="log-head">
        <b>诊断日志 · {{ log.name }}</b>
        <button class="btn small" :disabled="log.loading" @click="reloadLog">刷新</button>
        <button class="btn small" @click="log.open = false">关闭</button>
      </div>
      <pre>{{ log.text }}</pre>
    </div>
  </div>
</template>

<style scoped>
.sum { display: flex; gap: 10px; margin-bottom: 10px; }
.stat-card { background: var(--bg2,#fff); border: 1px solid var(--border,#e5e5e5); border-radius: 8px; padding: 10px 16px; display: flex; flex-direction: column; min-width: 90px; }
.stat-card b { font-size: 20px; } .stat-card span { font-size: 12px; color:#888; }
.bar { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
.on { background:#2e9e5b; } .off { background:#d9524e; }
.err { color:#d33; font-size:12px; }
.btn.small { padding: 2px 10px; font-size: 12px; margin-right: 4px; }
.expand { background: rgba(53,121,168,.06); }
.chip { display:inline-block; background:#eef4fa; border:1px solid #cfe0ee; border-radius: 10px; padding:2px 10px; margin:3px 4px 3px 0; font-size:12px; cursor:pointer; }
.log-panel { margin-top:12px; border:1px solid var(--border,#e5e5e5); border-radius:8px; }
.log-head { display:flex; gap:8px; align-items:center; padding:8px 12px; border-bottom:1px solid var(--border,#e5e5e5); }
.log-panel pre { margin:0; padding:12px; max-height:380px; overflow:auto; font-size:12px; background:#0d1117; color:#c9d1d9; white-space:pre-wrap; }
.empty { color:#999; text-align:center; padding:12px; }
</style>