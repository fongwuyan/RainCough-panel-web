<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { api } from '../../api'

const nodes = ref([])
const groups = ref([])
const query = ref('')
const activeGroup = ref('all')
const protoFilter = ref('')
const err = ref('')
const live = ref(null)
const connecting = ref('')
const latencyBusy = ref(new Set())
const speedBusy = ref('')
const actionNode = ref(null)
const bulkBusy = ref(false)
const mode = ref('local')
const modeInfo = ref({})
const modeBusy = ref(false)

const protos = computed(() => {
  const seen = []
  for (const n of nodes.value) if (!seen.includes(n.protocol)) seen.push(n.protocol)
  return seen
})
const filtered = computed(() => nodes.value.filter(n =>
  (!protoFilter.value || n.protocol === protoFilter.value)))
const activeNodeLabel = computed(() => {
  if (!live.value || !live.value.v2ray || !live.value.v2ray.running) return ''
  return live.value.v2ray.node || ''
})
const isLinkMode = computed(() => mode.value === 'link')
function fmtBps(b) {
  b = Number(b) || 0
  if (b >= 1048576) return (b / 1048576).toFixed(2) + ' MB/s'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB/s'
  return b + ' B/s'
}
function fmtBytes(b) {
  b = Number(b) || 0
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}
function hero() {
  if (!live.value || !live.value.v2ray || !live.value.v2ray.running) return null
  const v = live.value.v2ray
  return {
    node: v.node || '已连接',
    downRate: fmtBps(v.down_bps), upRate: fmtBps(v.up_bps),
    down: fmtBytes(v.total_down), up: fmtBytes(v.total_up),
    engine: v.engine || '',
  }
}
function isConnected(n) {
  return activeNodeLabel.value && activeNodeLabel.value === `${n.protocol}:${n.name}`
}
function isConnecting(n) { return connecting.value === n._id }
function engineUnavailable(n) { return n.engine === 'sing-box-missing' }
function isSingbox(n) { return n.engine === 'sing-box' }

async function loadMode() {
  const m = await api.v2ModeGet().catch(() => null)
  if (m && m.mode) { mode.value = m.mode; modeInfo.value = m }
}
async function setMode(m) {
  if (modeBusy.value || m === mode.value) return
  modeBusy.value = true; err.value = ''
  try {
    const r = await api.v2ModeSet(m)
    if (r && r.mode) { mode.value = r.mode; modeInfo.value = r }
  } catch (e) { err.value = e.message }
  modeBusy.value = false
  pollLive()
}

async function loadNodes() {
  nodes.value = await api.v2Nodes(query.value, activeGroup.value).catch(() => [])
}
async function loadGroups() {
  groups.value = await api.v2NodesGroups().catch(() => [])
}
function pollLive() {
  api.vpnLive().then(d => { live.value = d }).catch(() => {})
}
async function modelessConnect(n) {
  err.value = ''
  if (engineUnavailable(n)) {
    err.value = `该节点协议(${n.protocol})依赖 sing-box 内核, 但宿主未安装 sing-box`
    return
  }
  connecting.value = n._id
  try {
    const r = await api.v2NodesSelect(n._id, 'v2play', 1080)
    if (r && r.error) err.value = r.error
  } catch (e) { err.value = e.message }
  setTimeout(() => { connecting.value = ''; loadNodes() }, 400)
  pollLive()
}
async function latency(n) {
  err.value = ''
  latencyBusy.value.add(n._id)
  try {
    const r = await api.v2NodesTest([n._id])
    if (r && r.error) err.value = r.error
  } catch (e) { err.value = e.message }
  latencyBusy.value.delete(n._id)
  loadNodes()
}
async function speed(n) {
  err.value = ''
  speedBusy.value = n._id
  try {
    const r = await api.v2NodeSpeedTest(n._id)
    if (r && r.error) err.value = r.error
  } catch (e) { err.value = e.message }
  speedBusy.value = ''
  loadNodes()
}
async function bulkSpeed() {
  if (bulkBusy.value || !filtered.value.length) return
  bulkBusy.value = true
  err.value = ''
  for (const n of filtered.value) {
    if (engineUnavailable(n)) continue
    speedBusy.value = n._id
    await api.v2NodeSpeedTest(n._id).catch(() => {})
  }
  speedBusy.value = ''
  bulkBusy.value = false
  loadNodes()
}
async function remove(n) {
  await api.v2NodesDelete([n._id]).catch(e => err.value = e.message)
  actionNode.value = null
  loadNodes()
}
function doSearch() { loadNodes() }
function pickGroup(g) { activeGroup.value = g; loadNodes() }

let timer = null
onMounted(() => { loadGroups(); loadNodes(); loadMode(); pollLive(); timer = setInterval(pollLive, 2000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div>
    <div v-if="err" class="error" style="margin-bottom:10px;">{{ err }}</div>

    <!-- 连接状态 + 实时速率 + 模式切换 -->
    <div class="status-hero" :class="{ on: hero() }">
      <div class="sh-row">
        <span class="sh-dot" :class="hero() ? 'on' : ''"></span>
        <span class="sh-label">{{ hero() ? '已连接' : '未连接' }}</span>
        <span class="sh-engine" v-if="hero() && hero().engine">{{ hero().engine }}</span>
      </div>
      <div class="sh-node">{{ hero() ? hero().node : '点击下方节点开始连接' }}</div>
      <div class="sh-speed" v-if="hero()">
        <span class="sh-dir">↓ {{ hero().downRate }}</span>
        <span class="sh-dir">↑ {{ hero().upRate }}</span>
      </div>
      <div class="sh-total" v-if="hero()">累计 ↓ {{ hero().down }} · ↑ {{ hero().up }}</div>

      <div class="mode-switch">
        <button class="mode-opt" :class="{ on: !isLinkMode }" :disabled="modeBusy" @click="setMode('local')">
          本地模式<span class="mode-sub">127.0.0.1:1080</span>
        </button>
        <button class="mode-opt" :class="{ on: isLinkMode }" :disabled="modeBusy" @click="setMode('link')">
          链接模式<span class="mode-sub">内网共享</span>
        </button>
      </div>
      <div class="mode-hint" v-if="isLinkMode">
        局域网客户端可将 SOCKS 设为 <code>socks5://{{ modeInfo.lan_ip || '内网IP' }}:1080</code> 使用本机节点出口
      </div>
    </div>

    <div class="node-toolbar">
      <input v-model="query" class="input search" placeholder="搜索名称 / IP" @keyup.enter="doSearch" />
      <button class="btn btn-sm" @click="doSearch">搜索</button>
    </div>

    <div class="pills" v-if="groups.length || nodes.length">
      <button class="pill" :class="{ on: activeGroup === 'all' }" @click="pickGroup('all')">全部</button>
      <button v-for="g in groups" :key="g" class="pill" :class="{ on: activeGroup === g }" @click="pickGroup(g)">{{ g }}</button>
    </div>
    <div class="pills" v-if="protos.length">
      <button class="pill pill-sub" :class="{ on: protoFilter === '' }" @click="protoFilter = ''">全部协议</button>
      <button v-for="p in protos" :key="p" class="pill pill-sub" :class="{ on: protoFilter === p }" @click="protoFilter = p">{{ p }}</button>
    </div>

    <div class="node-actions">
      <button class="btn btn-sm btn-ghost" @click="bulkSpeed" :disabled="bulkBusy">{{ bulkBusy ? '批量测速中...' : '全部测速' }}</button>
      <button class="btn btn-sm btn-ghost" @click="loadNodes">刷新</button>
    </div>

    <div v-if="!filtered.length" class="hint" style="padding:30px 0;">暂无节点, 去「订阅」页添加并刷新订阅。</div>

    <div class="node-card" v-for="n in filtered" :key="n._id"
         :class="{ connected: isConnected(n), connecting: isConnecting(n), disabled: engineUnavailable(n) }"
         @click="modelessConnect(n)">
      <div class="nc-left">
        <div class="nc-name">
          <span class="nc-dot" :class="isConnected(n) ? 'on' : (isConnecting(n) ? 'busy' : '')"></span>
          <span class="nc-title">{{ n.name || n._id }}</span>
          <span v-if="engineUnavailable(n)" class="chip chip-warn">需 sing-box</span>
          <span v-else-if="isSingbox(n)" class="chip chip-sb">sing-box</span>
        </div>
        <div class="nc-meta">{{ n.protocol }} · {{ n.addr }}:{{ n.port }}</div>
      </div>
      <div class="nc-right">
        <div class="nc-badges">
          <span v-if="latencyBusy.has(n._id)" class="chip chip-busy">测延迟…</span>
          <span v-else-if="n.latency != null" class="chip" :class="n.latency_err ? 'chip-err' : 'chip-ok'">
            {{ n.latency_err ? '超时' : n.latency + 'ms' }}
          </span>
          <span v-if="speedBusy === n._id" class="chip chip-busy">测速 {{ n._id ? '' : '' }}…</span>
          <span v-else-if="n.speed_mbps != null" class="chip chip-ok">{{ n.speed_mbps.toFixed ? n.speed_mbps.toFixed(1) : n.speed_mbps }} MB/s</span>
        </div>
        <button class="btn btn-sm btn-ghost more-btn" @click.stop="actionNode = n._id">⋯</button>
      </div>
    </div>

    <div class="hint" style="padding:14px 0;text-align:center;" v-if="filtered.length">
      点击卡片直接连接切换
    </div>

    <!-- 动作单 -->
    <div v-if="actionNode" class="sheet-overlay" @click.self="actionNode = null">
      <div class="sheet">
        <div class="sheet-title">{{ (nodes.find(x => x._id === actionNode) || {}).name || '' }}</div>
        <button class="sheet-item" @click="latency(nodes.find(x => x._id === actionNode))">延迟测试</button>
        <button class="sheet-item" @click="speed(nodes.find(x => x._id === actionNode))">深度测速</button>
        <button class="sheet-item" @click="remove(nodes.find(x => x._id === actionNode))">删除节点</button>
        <button class="sheet-item sheet-cancel" @click="actionNode = null">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-hero {
  border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px;
  background: var(--surface); margin-bottom: 14px;
}
.status-hero.on { border-color: var(--success); background: var(--success-soft); }
.sh-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sh-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border-strong); }
.sh-dot.on { background: var(--success); box-shadow: 0 0 8px var(--success); }
.sh-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.sh-engine { font-size: 11px; font-family: var(--font-mono); color: var(--accent);
  border: 1px solid var(--accent); border-radius: 999px; padding: 1px 8px; }
.sh-node { font-size: 17px; font-weight: 800; color: var(--text); font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-speed { display: flex; gap: 18px; font-family: var(--font-mono); font-size: 13px; margin-top: 8px; }
.sh-dir { color: var(--accent); }
.sh-total { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); margin-top: 4px; }
.mode-switch { display: flex; gap: 6px; margin-top: 14px; }
.mode-opt {
  flex: 1; padding: 8px 6px; font-size: 12px; font-weight: 600; text-align: center;
  border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2);
  color: var(--text-muted); cursor: pointer; display: flex; flex-direction: column; gap: 3px;
  font-family: var(--font); transition: all var(--transition);
}
.mode-opt:hover { border-color: var(--border-strong); }
.mode-opt.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.mode-sub { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); font-weight: 500; }
.mode-opt.on .mode-sub { color: var(--accent); }
.mode-hint { margin-top: 10px; font-size: 11px; color: var(--text-muted); }
.mode-hint code { font-family: var(--font-mono); color: var(--success); }
.node-toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
.node-toolbar .search { flex: 1; }
.pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.pill {
  padding: 5px 12px; font-size: 12px; font-weight: 600; border-radius: 999px;
  background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);
  cursor: pointer; transition: all var(--transition);
}
.pill.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.pill-sub { font-family: var(--font-mono); font-size: 11px; }
.node-actions { display: flex; gap: 8px; margin-bottom: 12px; }
.node-card {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px; margin-bottom: 8px;
  cursor: pointer; transition: border-color var(--transition), background var(--transition);
}
.node-card:hover { border-color: var(--border-strong); }
.node-card.connected { border-color: var(--success); background: var(--success-soft); }
.node-card.connecting { border-color: var(--accent); }
.node-card.disabled { opacity: 0.55; cursor: not-allowed; }
.nc-left { flex: 1; min-width: 0; }
.nc-name { display: flex; align-items: center; gap: 6px; }
.nc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border-strong); flex-shrink: 0; }
.nc-dot.on { background: var(--success); }
.nc-dot.busy { background: var(--accent); animation: blink 800ms infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.nc-title { font-size: 13px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nc-meta { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); margin-top: 2px; }
.nc-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.nc-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.chip {
  display: inline-block; padding: 2px 8px; font-size: 11px; font-family: var(--font-mono);
  border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-muted);
}
.chip-ok { color: var(--success); border-color: var(--success); background: var(--success-soft); }
.chip-err { color: var(--danger); border-color: var(--danger); background: var(--danger-soft); }
.chip-warn { color: var(--warning); border-color: var(--warning); background: rgba(210, 153, 34, 0.14); }
.chip-sb { color: #7c8bff; border-color: #7c8bff; background: rgba(124, 139, 255, 0.14); }
.chip-busy { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.more-btn { border-radius: 999px; padding: 4px 10px; }
.sheet-overlay { position: fixed; inset: 0; z-index: 120; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; justify-content: center; }
.sheet {
  width: 100%; max-width: 460px; background: var(--surface); border-top: 1px solid var(--border-strong);
  padding: 10px 12px calc(18px + env(safe-area-inset-bottom)); border-radius: 14px 14px 0 0;
  animation: sheet-up 180ms ease;
}
@keyframes sheet-up { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
.sheet-title { font-size: 12px; color: var(--text-faint); padding: 8px 6px 12px; text-align: center; font-family: var(--font-mono); }
.sheet-item {
  display: block; width: 100%; text-align: left; padding: 13px 14px; font-size: 14px; font-weight: 600;
  background: none; border: none; color: var(--text); cursor: pointer; border-radius: 8px; font-family: var(--font);
}
.sheet-item:hover { background: var(--surface-2); }
.sheet-cancel { text-align: center; color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 6px; border-radius: 0; }
</style>
