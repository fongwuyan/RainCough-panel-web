<script setup>
// 接口总览: 接口库 v4 目录(系统+插件), 支持筛选/详情/试调用
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'rc-api'

const route = useRoute()

const summary = ref({ interfaces: 0, online: 0, offline: 0, plugin: 0, system: 0, providers: 0 })
const items = ref([])
const total = ref(0)
const loading = ref(false)
const loadErr = ref('')          // 目录加载错误(页级展示, 不再被详情面板吞掉)
const page = ref(1)
const pageSize = 500             // 后端单页上限 500; 一次拉全避免"共N但只显示100"
const detail = ref(null)
const detailErr = ref('')
const testParams = ref('{}')
const testResult = ref('')
const testing = ref(false)

const filters = ref({ source: '', visibility: '', status: '', q: '' })
const visibilities = ['', 'all', 'main', 'private']

let timer = null

const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

async function load() {
  loading.value = true
  loadErr.value = ''
  try {
    const f = { ...filters.value, page: page.value, page_size: pageSize }
    if (!f.q) delete f.q
    const [cat, sum] = await Promise.all([api.ifaces(f), api.ifacesSummary()])
    items.value = cat.items || []
    total.value = cat.total || 0
    Object.assign(summary.value, sum)
    // 过滤后当前页可能越界
    if (page.value > pages.value) { page.value = pages.value; return load() }
  } catch (e) {
    loadErr.value = (e && e.message) || String(e)
  } finally {
    loading.value = false
  }
}

// 筛选条件变化 → 回到第 1 页再取
function resetLoad() { page.value = 1; load() }
function goPage(p) { if (p < 1 || p > pages.value || p === page.value) return; page.value = p; load() }

// 破坏性动词(全来源) + 系统主接口(visibility≠all) → 试调用前必须确认
const DANGER_RE = /(delete|remove|install|uninstall|send|save|create|update|start|stop|restart|close|purge|runnow|mkdir|rename|cancel|clear|format|reboot|shutdown|exec)/i
function isDangerous(it) {
  if (!it) return false
  if (DANGER_RE.test(it.id)) return true
  return it.source === 'system' && it.visibility !== 'all'
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
  if (isDangerous(detail.value)) {
    const ok = confirm(
      '即将在服务器上执行接口试调用：\n' + detail.value.id +
      '\n\n该接口可能改变系统/插件状态（删除、保存、启停、发送等），确认继续？'
    )
    if (!ok) return
  }
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
  if (route.query.q) filters.value.q = String(route.query.q)
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

    <div v-if="loadErr" class="err" style="margin-bottom:8px;padding:8px 10px;border:1px solid #f3c1c0;background:#fdf1f1;border-radius:6px;">
      目录加载失败: {{ loadErr }} · <button class="btn btn-sm" @click="load">重试</button>
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
      <input v-model="filters.q" placeholder="搜索接口 id / 插件 / 描述" class="input" @keyup.enter="resetLoad" />
      <select v-model="filters.source" class="input" @change="resetLoad">
        <option value="">来源:全部</option>
        <option value="plugin">插件</option>
        <option value="system">系统</option>
      </select>
      <select v-model="filters.visibility" class="input" @change="resetLoad">
        <option value="">可见性:全部</option>
        <option v-for="v in visibilities.filter(Boolean)" :key="v" :value="v">{{ v }}</option>
      </select>
      <select v-model="filters.status" class="input" @change="resetLoad">
        <option value="">状态:全部</option>
        <option value="online">在线</option>
        <option value="offline">离线</option>
      </select>
      <span class="faint">共 {{ total }} 个接口 · 本页 {{ items.length }} 条</span>
      <span v-if="pages > 1" class="iface-pager">
        <button class="btn btn-sm" :disabled="page <= 1 || loading" @click="goPage(page - 1)">上一页</button>
        <span class="faint">{{ page }}/{{ pages }}</span>
        <button class="btn btn-sm" :disabled="page >= pages || loading" @click="goPage(page + 1)">下一页</button>
      </span>
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
.iface-pager { display: inline-flex; gap: 6px; align-items: center; }
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