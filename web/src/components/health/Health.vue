<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const loading = ref(false)
const err = ref('')
const health = ref(null)
const ifaces = ref(null)
const plugins = ref([])
const offlineIfaces = ref([])
const version = ref('')

async function load() {
  loading.value = true; err.value = ''
  try {
    const [h, i, p, o, v] = await Promise.all([
      api.servicesHealth(),
      api.ifacesSummary(),
      api.listPlugins(),
      api.interfaces({ status: 'offline', page: 1, page_size: 100 }),
      api.panelVersion(),
    ])
    health.value = h || null
    ifaces.value = i || null
    plugins.value = Array.isArray(p) ? p : []
    offlineIfaces.value = (o && o.items) || []
    version.value = (v && v.version) || ''
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}

function label(s) {
  return { online: '在线', offline: '离线', registered: '已注册', expired: '过期' }[s] || s || '—'
}
function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(Number(ts) * 1000)
  return d.toLocaleString()
}

onMounted(load)
</script>

<template>
  <div class="page health-page">
    <div class="health-head">
      <div><h1>健康中心</h1><p class="sub">面板、插件、接口与节点运行状态</p></div>
      <button class="btn" :disabled="loading" @click="load">{{ loading ? '刷新中…' : '刷新' }}</button>
    </div>

    <div v-if="err" class="health-error">{{ err }}</div>

    <div class="health-kpis">
      <div class="health-kpi"><b>v{{ version || '—' }}</b><span>面板版本</span></div>
      <div class="health-kpi ok"><b>{{ (health && health.online) || 0 }}<i>/{{ (health && health.total) || 0 }}</i></b><span>服务在线</span></div>
      <div class="health-kpi" :class="{ bad: health && health.offline }"><b>{{ (health && health.offline) || 0 }}</b><span>服务离线</span></div>
      <div class="health-kpi ok"><b>{{ (ifaces && ifaces.online) || 0 }}</b><span>接口在线</span></div>
      <div class="health-kpi" :class="{ bad: ifaces && ifaces.offline }"><b>{{ (ifaces && ifaces.offline) || 0 }}</b><span>接口离线</span></div>
      <div class="health-kpi"><b>{{ plugins.length }}</b><span>已装插件</span></div>
    </div>

    <div class="health-grid">
      <section class="health-card">
        <div class="health-card-head">
          <span>服务提供方</span>
          <router-link to="/plugins">插件管理 →</router-link>
        </div>
        <div v-if="!health || !health.providers" class="hint">暂无数据</div>
        <div v-else class="health-list">
          <div v-for="p in health.providers" :key="p.name" class="health-row">
            <div class="health-name"><b>{{ p.label || p.name }}</b><span class="faint">{{ p.name }} · {{ p.version }}</span></div>
            <div class="health-meta">{{ p.ifaces ? p.ifaces.length : 0 }} 接口</div>
            <div class="health-meta">{{ p.latency_ms || 0 }}ms</div>
            <div class="health-meta">失败 {{ p.fail_count || 0 }}</div>
            <div :class="p.online ? 'ok' : 'bad'">{{ label(p.status) }}</div>
          </div>
        </div>
      </section>

      <section class="health-card">
        <div class="health-card-head">
          <span>异常接口</span>
          <router-link to="/interfaces?status=offline">接口中心 →</router-link>
        </div>
        <div v-if="!offlineIfaces.length" class="hint">没有离线接口</div>
        <div v-else class="health-list">
          <div v-for="it in offlineIfaces" :key="it.id" class="health-row">
            <div class="health-name"><b class="mono">{{ it.id }}</b><span class="faint">{{ it.plugin }}</span></div>
            <div class="health-meta">{{ it.visibility }}</div>
            <div class="bad">离线</div>
          </div>
        </div>
      </section>

      <section class="health-card span2">
        <div class="health-card-head"><span>最近检查</span><span class="faint">{{ fmtTime(health && health.checked_at) }}</span></div>
        <div class="health-note">只读检查，不会重启插件或修改配置。接口/插件异常时，面板不替插件执行业务。</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.health-page { padding: 18px 22px 28px; }
.health-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.health-head h1 { margin: 0; font-size: 22px; }
.health-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.health-error { color: var(--danger); font-size: 12px; margin: 10px 0; }
.health-kpis { display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0; }
.health-kpi { min-width: 120px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); }
.health-kpi b { display: block; font-size: 22px; }
.health-kpi b i { font-size: 12px; color: var(--text-muted); font-style: normal; }
.health-kpi span { color: var(--text-muted); font-size: 11px; }
.health-kpi.ok b { color: #2f9e44; }
.health-kpi.bad b { color: var(--danger); }
.health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.health-card { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); padding: 12px 14px; min-height: 120px; }
.health-card.span2 { grid-column: span 2; min-height: auto; }
.health-card-head { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.health-card-head a { font-size: 11px; color: var(--text-muted); text-decoration: none; }
.health-list { display: flex; flex-direction: column; gap: 2px; max-height: 360px; overflow: auto; }
.health-row { display: grid; grid-template-columns: 1fr auto auto auto auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.health-name { display: flex; flex-direction: column; min-width: 0; }
.health-name b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.health-meta { color: var(--text-muted); font-size: 11px; white-space: nowrap; }
.health-note { font-size: 12px; color: var(--text-muted); line-height: 1.7; }
.ok { color: #2f9e44; }
.bad { color: var(--danger); }
@media (max-width: 900px) { .health-grid { grid-template-columns: 1fr; } .health-card.span2 { grid-column: span 1; } }
</style>
