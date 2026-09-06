<script setup>
// 接口总览: 接口库 v4 目录(系统+插件), 支持筛选/详情/试调用
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../api.js'

const summary = ref({ interfaces: 0, online: 0, offline: 0, plugin: 0, system: 0, providers: 0 })
const items = ref([])
const total = ref(0)
const loading = ref(false)
const detail = ref(null)
const detailErr = ref('')
const testParams = ref('{}')
const testResult = ref('')
const testing = ref(false)

const filters = ref({ source: '', visibility: '', status: '', q: '' })
const sources = ['', 'plugin', 'system']
const visibilities = ['', 'all', 'main', 'private']
const statuses = ['', 'online', 'offline']

let timer = null

async function load() {
  loading.value = true
  try {
    const f = { ...filters.value }
    if (!f.q) delete f.q
    const [cat, sum] = await Promise.all([api.ifaces(f), api.ifacesSummary()])
    items.value = cat.items || []
    total.value = cat.total || 0
    Object.assign(summary.value, sum)
  } catch (e) {
    detailErr.value = '加载失败: ' + (e.message || e)
  } finally {
    loading.value = false
  }
}

function groups() {
  const by = new Map()
  for (const it of items.value) {
    if (!by.has(it.plugin)) by.set(it.plugin, [])
    by.get(it.plugin).push(it)
  }
  return [...by.entries()].map(([plugin, list]) => ({ plugin, list }))
}

async function openDetail(it) {
  detail.value = it
  detailErr.value = ''
  testResult.value = ''
  testParams.value = JSON.stringify(previewParams(it.input), null, 1)
  try {
    const d = await api.ifaceDetail(it.id)
    detail.value = { ...it, ...d }
  } catch (e) {
    detailErr.value = '详情加载失败: ' + (e.message || e)
  }
}

function previewParams(schema) {
  if (!schema || schema.type !== 'object' || !schema.props) return {}
  const out = {}
  for (const [k, v] of Object.entries(schema.props)) {
    if (v.type === 'integer' || v.type === 'number') out[k] = 0
    else if (v.type === 'boolean') out[k] = false
    else out[k] = ''
  }
  return out
}

async function runTest() {
  if (!detail.value) return
  testing.value = true
  testResult.value = ''
  let params = {}
  try {
    params = JSON.parse(testParams.value || '{}')
  } catch (e) {
    testResult.value = '参数 JSON 解析失败: ' + e.message
    testing.value = false
    return
  }
  try {
    const r = await api.ifaceInvoke(detail.value.id, params, 15000)
    testResult.value = JSON.stringify(r, null, 2)
  } catch (e) {
    testResult.value = 'ERR: ' + (e.message || e)
  } finally {
    testing.value = false
    load()
  }
}

function dotCls(it) {
  if (it.source === 'system') return 'dot-system'
  return it.online ? 'dot-on' : 'dot-off'
}

onMounted(() => {
  load()
  timer = setInterval(load, 15000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="section">
    <div class="section-title">
      <h2>接口总览</h2>
      <span class="faint">接口库 v4 · 自注册服务总线（插件接口可被其他插件调用）</span>
      <button class="btn" :disabled="loading" @click="load">刷新</button>
    </div>

    <div class="iface-summary">
      <div class="stat-card"><b>{{ summary.interfaces }}</b><span>接口总数</span></div>
      <div class="stat-card"><b style="color:#2e9e5b">{{ summary.online }}</b><span>在线</span></div>
      <div class="stat-card"><b style="color:#d9524e">{{ summary.offline }}</b><span>离线</span></div>
      <div class="stat-card"><b>{{ summary.plugin }}</b><span>插件接口</span></div>
      <div class="stat-card"><b>{{ summary.system }}</b><span>系统接口</span></div>
      <div class="stat-card"><b>{{ summary.providers }}</b><span>提供方</span></div>
    </div>

    <div class="iface-filter">
      <input v-model="filters.q" placeholder="搜索接口 id / 插件 / 描述" class="input" @keyup.enter="load" />
      <select v-model="filters.source" class="input" @change="load">
        <option value="">来源:全部</option>
        <option value="plugin">插件</option>
        <option value="system">系统</option>
      </select>
      <select v-model="filters.visibility" class="input" @change="load">
        <option value="">可见性:全部</option>
        <option v-for="v in visibilities" :key="v" :value="v">{{ v }}</option>
      </select>
      <select v-model="filters.status" class="input" @change="load">
        <option value="">状态:全部</option>
        <option value="online">在线</option>
        <option value="offline">离线</option>
      </select>
      <span class="faint">共 {{ total }} 个接口</span>
    </div>

    <div class="iface-body">
      <div class="iface-list">
        <div v-if="!items.length" class="empty">暂无接口（插件启动后自动注册）</div>
        <div v-for="g in groups()" :key="g.plugin" class="iface-group">
          <div class="group-head">{{ g.plugin }}</div>
          <table class="table">
            <thead>
              <tr><th>接口</th><th>来源</th><th>可见性</th><th>状态</th><th>调用</th><th>平均</th></tr>
            </thead>
            <tbody>
              <tr v-for="it in g.list" :key="it.id" :class="{ active: detail && detail.id === it.id }" @click="openDetail(it)">
                <td><span class="dot" :class="dotCls(it)"></span>{{ it.id }}</td>
                <td>{{ it.source }}</td>
                <td>{{ it.visibility }}</td>
                <td>{{ it.status }}</td>
                <td>{{ it.calls }}</td>
                <td>{{ it.avg_ms }}ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="iface-detail" v-if="detail">
        <div class="detail-head">
          <b>{{ detail.id }}</b>
          <span class="faint">v{{ detail.version }} · {{ detail.plugin }}</span>
        </div>
        <div v-if="detailErr" class="err">{{ detailErr }}</div>
        <div class="kv" v-if="detail.description"><span>描述</span><code>{{ detail.description }}</code></div>
        <div class="kv"><span>可见性</span><code>{{ detail.visibility }}</code></div>
        <div class="kv"><span>统计</span><code>{{ detail.calls }} 次 · {{ detail.avg_ms }}ms 平均 · p95 {{ detail.p95_ms }}ms</code></div>
        <div class="kv" v-if="detail.last_error"><span>最近错误</span><code class="err">{{ detail.last_error }}</code></div>

        <div class="kv"><span>input schema</span><pre>{{ JSON.stringify(detail.input || {}, null, 1) }}</pre></div>

        <div class="test-box">
          <div class="label">试调用（params JSON）</div>
          <textarea v-model="testParams" rows="4" class="input code"></textarea>
          <button class="btn" :disabled="testing" @click="runTest">{{ testing ? '调用中…' : '试调用' }}</button>
          <pre v-if="testResult" class="result">{{ testResult }}</pre>
        </div>
      </div>
      <div class="iface-detail empty" v-else>点选左侧接口查看详情 / 试调用</div>
    </div>
  </div>
</template>

<style scoped>
.iface-summary { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.stat-card { background: var(--bg2, #fff); border: 1px solid var(--border, #e5e5e5); border-radius: 8px; padding: 10px 16px; min-width: 96px; display: flex; flex-direction: column; }
.stat-card b { font-size: 20px; }
.stat-card span { font-size: 12px; color: #888; }
.iface-filter { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
.iface-filter .input { min-width: 140px; }
.iface-body { display: grid; grid-template-columns: 1fr 380px; gap: 12px; align-items: start; }
@media (max-width: 1100px) { .iface-body { grid-template-columns: 1fr; } }
.iface-group { margin-bottom: 12px; }
.group-head { font-weight: bold; margin-bottom: 4px; color: #3579a8; }
.table { width: 100%; }
.table tr { cursor: pointer; }
.table tr.active { background: rgba(53, 121, 168, 0.12); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.dot-on { background: #2e9e5b; }
.dot-off { background: #d9524e; }
.dot-system { background: #3579a8; }
.iface-detail { border: 1px solid var(--border, #e5e5e5); border-radius: 8px; padding: 12px; background: var(--bg2, #fff); }
.detail-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.kv { margin-bottom: 6px; font-size: 13px; }
.kv span { color: #888; margin-right: 6px; }
.kv code, .kv pre { background: #f5f5f5; border-radius: 4px; padding: 2px 6px; font-size: 12px; }
.kv pre { display: block; margin-top: 4px; white-space: pre-wrap; }
.err { color: #d33; }
.test-box { margin-top: 10px; }
.test-box textarea { width: 100%; font-family: monospace; }
.test-box .result { background: #f5f5f5; border-radius: 6px; padding: 8px; font-size: 12px; white-space: pre-wrap; max-height: 220px; overflow: auto; }
.empty { color: #999; padding: 12px; }
label { font-size: 13px; }
</style>