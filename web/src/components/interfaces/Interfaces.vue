<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../api'

const route = useRoute()
const pluginFilter = computed(() => String(route.query.plugin || ''))

const loading = ref(false)
const err = ref('')
const summary = ref({})
const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 100
const q = ref('')
const status = ref('')
const visibility = ref('')
const source = ref('')
const detail = ref(null)
const detailLoading = ref(false)
const policyDisabled = ref(false)
const policyTimeout = ref(15000)
const policyBusy = ref(false)
const testBody = ref('{\n  "params": {}\n}')
const testBusy = ref(false)
const testResult = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

async function load() {
  loading.value = true; err.value = ''
  try {
    const [s, d] = await Promise.all([
      api.ifacesSummary(),
      api.interfaces({ plugin: pluginFilter.value, q: q.value, status: status.value, visibility: visibility.value, source: source.value, page: page.value, page_size: pageSize }),
    ])
    summary.value = s || {}
    items.value = (d && d.items) || []
    total.value = (d && d.total) || 0
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}

async function openDetail(row) {
  detail.value = row; detailLoading.value = true; testResult.value = ''
  try { detail.value = await api.interfaceDetail(row.id) }
  catch (e) { err.value = e.message || String(e) }
  finally { detailLoading.value = false }
  policyDisabled.value = !!(detail.value && detail.value.disabled)
  policyTimeout.value = (detail.value && detail.value.timeout_ms) || 15000
}

async function savePolicy() {
  if (!detail.value) return
  policyBusy.value = true
  try {
    const r = await api.interfacePolicy(detail.value.id, {
      disabled: !!policyDisabled.value,
      timeout_ms: Number(policyTimeout.value) || 15000,
    })
    detail.value.disabled = r.disabled
    detail.value.timeout_ms = r.timeout_ms
    await load()
  } catch (e) { err.value = e.message || String(e) }
  finally { policyBusy.value = false }
}

function pretty(v) {
  if (v === null || v === undefined || v === '') return '—'
  try { return JSON.stringify(v, null, 2) } catch (e) { return String(v) }
}

async function runTest() {
  if (!detail.value) return
  testBusy.value = true; testResult.value = ''
  let body
  try { body = JSON.parse(testBody.value || '{}') } catch (e) { testResult.value = 'JSON 无效: ' + e.message; testBusy.value = false; return }
  try {
    const r = await api.interfaceInvoke(detail.value.id, body.params !== undefined ? body.params : body, 30000)
    testResult.value = JSON.stringify(r, null, 2)
  } catch (e) {
    testResult.value = '调用失败: ' + (e.message || String(e)) + '\n' + pretty(e.data)
  } finally { testBusy.value = false }
}

function statusText(s) { return { online: '在线', offline: '离线', degraded: '异常', disabled: '已禁用' }[s] || s || '—' }
function statusClass(s) { return s === 'online' ? 'ok' : s === 'offline' ? 'off' : 'warn' }
function filter() { page.value = 1; load() }
function nextPage(n) { page.value = Math.max(1, Math.min(totalPages.value, n)); load() }

onMounted(load)
</script>

<template>
  <div class="page interfaces-page">
    <div class="if-head">
      <div>
        <h1>接口</h1>
        <p class="sub">{{ pluginFilter ? ('插件 ' + pluginFilter + ' 的接口') : '插件接口目录、状态、测试与调用统计' }}</p>
      </div>
      <button class="btn" :disabled="loading" @click="load">刷新</button>
    </div>

    <div class="if-kpis">
      <div class="if-kpi"><b>{{ summary.interfaces || 0 }}</b><span>接口总数</span></div>
      <div class="if-kpi ok"><b>{{ summary.online || 0 }}</b><span>在线</span></div>
      <div class="if-kpi off"><b>{{ summary.offline || 0 }}</b><span>离线</span></div>
      <div class="if-kpi"><b>{{ summary.plugin || 0 }}</b><span>插件接口</span></div>
      <div class="if-kpi"><b>{{ summary.system || 0 }}</b><span>系统接口</span></div>
    </div>

    <div v-if="err" class="if-error">{{ err }}</div>

    <div class="if-filters">
      <input v-model="q" class="input" placeholder="搜索接口 ID / 插件 / 描述" @keyup.enter="filter" />
      <select v-model="source" class="input" @change="filter">
        <option value="">全部来源</option>
        <option value="plugin">插件</option>
        <option value="system">系统</option>
      </select>
      <select v-model="status" class="input" @change="filter">
        <option value="">全部状态</option>
        <option value="online">在线</option>
        <option value="offline">离线</option>
      </select>
      <select v-model="visibility" class="input" @change="filter">
        <option value="">全部可见性</option>
        <option value="all">all</option>
        <option value="main">main</option>
      </select>
      <button class="btn" @click="filter">筛选</button>
    </div>

    <div class="if-table-wrap">
      <table class="if-table">
        <thead>
          <tr>
            <th>状态</th><th>插件</th><th>接口</th><th>可见性</th><th>调用</th><th>平均</th><th>P95</th><th>最近错误</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.id" @click="openDetail(it)">
            <td><span class="if-dot" :class="statusClass(it.status)"></span>{{ statusText(it.status) }}</td>
            <td>{{ it.plugin }}</td>
            <td><b class="mono">{{ it.id }}</b><div class="if-desc">{{ it.description }}</div></td>
            <td><span class="if-chip">{{ it.visibility }}</span></td>
            <td>{{ it.calls || 0 }}</td>
            <td>{{ it.avg_ms || 0 }}ms</td>
            <td>{{ it.p95_ms || 0 }}ms</td>
            <td class="if-err">{{ it.last_error || '—' }}</td>
          </tr>
          <tr v-if="!items.length && !loading"><td colspan="8" class="if-empty">没有接口</td></tr>
        </tbody>
      </table>
    </div>

    <div class="if-pager">
      <span>共 {{ total }} 条 · 第 {{ page }} / {{ totalPages }} 页</span>
      <button class="btn btn-sm" :disabled="page <= 1" @click="nextPage(page - 1)">上一页</button>
      <button class="btn btn-sm" :disabled="page >= totalPages" @click="nextPage(page + 1)">下一页</button>
    </div>

    <div v-if="detail" class="if-drawer-mask" @click.self="detail = null">
      <aside class="if-drawer">
        <div class="if-drawer-head">
          <div><b class="mono">{{ detail.id }}</b><div class="faint">{{ detail.plugin }} · {{ detail.version }}</div></div>
          <button class="btn btn-sm" @click="detail = null">关闭</button>
        </div>
        <div class="if-detail-meta">
          <span>状态：{{ statusText(detail.online ? 'online' : 'offline') }}</span>
          <span>可见性：{{ detail.visibility }}</span>
          <span>调用：{{ detail.calls || 0 }}</span>
          <span>平均：{{ detail.avg_ms || 0 }}ms</span>
          <span>P95：{{ detail.p95_ms || 0 }}ms</span>
        </div>
        <div class="if-detail-section">
          <h4>面板策略</h4>
          <div class="if-policy-row">
            <label><input v-model="policyDisabled" type="checkbox" /> 禁用接口</label>
            <label>超时 <input v-model.number="policyTimeout" class="input if-policy-input" type="number" min="100" max="300000" /> ms</label>
            <button class="btn btn-sm" :disabled="policyBusy" @click="savePolicy">{{ policyBusy ? '保存中…' : '保存策略' }}</button>
          </div>
        </div>
        <div class="if-detail-section"><h4>描述</h4><p>{{ detail.description || '—' }}</p></div>
        <div class="if-detail-section"><h4>输入 Schema</h4><pre>{{ pretty(detail.input) }}</pre></div>
        <div class="if-detail-section"><h4>输出 Schema</h4><pre>{{ pretty(detail.output) }}</pre></div>
        <div class="if-detail-section">
          <h4>测试调用</h4>
          <textarea v-model="testBody" class="input if-test-body"></textarea>
          <button class="btn btn-primary btn-sm" :disabled="testBusy" @click="runTest">{{ testBusy ? '调用中…' : '执行测试' }}</button>
          <pre v-if="testResult" class="if-test-result">{{ testResult }}</pre>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.interfaces-page { padding: 18px 22px 28px; }
.if-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.if-head h1 { margin: 0; font-size: 22px; }
.if-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.if-kpis { display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0; }
.if-kpi { min-width: 110px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); }
.if-kpi b { display: block; font-size: 22px; }
.if-kpi span { color: var(--text-muted); font-size: 11px; }
.if-kpi.ok b { color: var(--success, #2f9e44); }
.if-kpi.off b { color: var(--danger); }
.if-error { color: var(--danger); font-size: 12px; margin-bottom: 8px; }
.if-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.if-filters .input { width: auto; min-width: 130px; }
.if-table-wrap { overflow: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); }
.if-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.if-table th, .if-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
.if-table th { color: var(--text-muted); font-weight: 600; position: sticky; top: 0; background: var(--bg-card); }
.if-table tbody tr { cursor: pointer; }
.if-table tbody tr:hover { background: var(--accent-soft); }
.if-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; }
.if-dot.ok { background: #2f9e44; }
.if-dot.off { background: #888; }
.if-dot.warn { background: #d9480f; }
.if-desc { color: var(--text-muted); font-size: 11px; margin-top: 2px; max-width: 300px; }
.if-chip { border: 1px solid var(--border); border-radius: 10px; padding: 1px 6px; font-size: 10px; }
.if-err { color: var(--danger); max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.if-empty { text-align: center !important; color: var(--text-muted); padding: 24px !important; }
.if-pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 10px; font-size: 12px; color: var(--text-muted); }
.if-drawer-mask { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 80; display: flex; justify-content: flex-end; }
.if-drawer { width: min(680px, 94vw); height: 100%; overflow: auto; background: var(--bg); border-left: 1px solid var(--border); padding: 16px 18px 30px; }
.if-drawer-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.if-detail-meta { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; font-size: 12px; color: var(--text-muted); }
.if-detail-section { margin-top: 16px; }
.if-detail-section h4 { margin: 0 0 6px; font-size: 13px; }
.if-policy-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 12px; }
.if-policy-input { width: 90px; padding: 3px 6px; }
.if-detail-section pre { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-size: 11px; overflow: auto; max-height: 240px; }
.if-test-body { width: 100%; min-height: 100px; font-family: var(--mono); font-size: 12px; margin-bottom: 8px; }
.if-test-result { white-space: pre-wrap; }
</style>
