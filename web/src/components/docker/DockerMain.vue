<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const tab = ref('containers')
const info = ref(null)
const containers = ref([])
const images = ref([])
const networks = ref([])
const volumes = ref([])
const compose = ref(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')

const pullName = ref('')
const showCreate = ref(false)
const createForm = ref({ image: '', name: '', ports: [], env: [], volumes: [], restart: 'no', network: 'bridge', cmd: '' })
const logShow = ref(false)
const logName = ref('')
const logText = ref('')
const composePath = ref('')
const composeOut = ref('')

const TABS = [
  { key: 'containers', label: '容器' },
  { key: 'images', label: '镜像' },
  { key: 'volumes', label: '卷' },
  { key: 'networks', label: '网络' },
  { key: 'compose', label: 'Compose' },
]
let timer = null

function toast(m) { notice.value = m; setTimeout(() => { notice.value = '' }, 3000) }

async function load() {
  loading.value = true; error.value = ''
  try {
    const [i, s, c] = await Promise.all([api.dkInfo(), api.dkStatus(), api.dkContainers()])
    info.value = i; containers.value = c || []
    const extra = s || {}
    info.value = { ...(info.value || {}), ...extra }
    if (tab.value === 'images') images.value = await api.dkImages()
    if (tab.value === 'networks') networks.value = await api.dkNetworks()
    if (tab.value === 'volumes') volumes.value = await api.dkVolumes()
  } catch (e) {
    error.value = e.message
    if (String(e.message).includes('503') || String(e.message).includes('daemon')) {
      info.value = { daemon_down: true }
    }
  } finally { loading.value = false }
}

function poll() { load().catch(() => {}) }

onMounted(() => { load(); timer = setInterval(poll, 8000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function switchTab(k) { tab.value = k; load() }

async function act(fn, args, msg) {
  error.value = ''
  try { const r = await fn(args); if (r && r.error && !r.ok) error.value = r.error; else if (msg) toast(msg); load() }
  catch (e) { error.value = e.message }
}

function stClass(s) {
  if (!s) return ''
  s = String(s)
  if (s.includes('Up')) return 'ok'
  if (s.startsWith('Exited')) return 'err'
  return 'muted'
}

function stateOf(c) { return (c.state || '').toLowerCase() }

async function showLog(c) {
  logName.value = c.name; logText.value = '加载中...'; logShow.value = true
  try { const r = await api.dkLogs(c.id, 300); logText.value = (r && r.log) || '(空)' }
  catch (e) { logText.value = '读取失败: ' + e.message }
}

async function removeContainer(c) {
  if (!confirm('确认删除容器 ' + c.name + '?')) return
  await act(api.dkRemove, { id: c.id, force: true }, '已删除 ' + c.name)
}

async function removeImage(img) {
  const label = (img.tags && img.tags[0]) || img.id
  if (!confirm('确认删除镜像 ' + label + '?')) return
  await act(api.dkRemoveImage, { id: img.id, force: true }, '已删除镜像')
}

async function pullImage() {
  if (!pullName.value.trim()) return
  await act(api.dkPull, pullName.value.trim(), '开始拉取 ' + pullName.value)
  pullName.value = ''
}

async function createContainer() {
  const f = createForm.value
  if (!f.image.trim()) { error.value = '请填镜像'; return }
  const cfg = {
    image: f.image.trim(),
    name: f.name.trim(),
    ports: f.ports.split(',').map((x) => x.trim()).filter(Boolean),
    env: f.env.split(',').map((x) => x.trim()).filter(Boolean),
    volumes: f.volumes.split(',').map((x) => x.trim()).filter(Boolean),
    restart: f.restart,
    network: f.network,
    cmd: f.cmd.trim() ? f.cmd.split(' ').filter(Boolean) : [],
  }
  await act(api.dkCreate, cfg, '容器已创建/启动')
  showCreate.value = false
  createForm.value = { image: '', name: '', ports: '', env: '', volumes: '', restart: 'no', network: 'bridge', cmd: '' }
}

async function delVolume(v) {
  if (!confirm('删除卷 ' + v.name + '?')) return
  await act(api.dkVolumeRemove, { name: v.name }, '已删除卷')
}

async function composeUp() {
  if (!composePath.value.trim()) return
  composeOut.value = '运行中...'
  try { const r = await api.dkComposeUp(composePath.value.trim()); composeOut.value = (r && (r.out || r.error)) || 'done' }
  catch (e) { composeOut.value = e.message }
}
async function composeDown() {
  if (!composePath.value.trim()) return
  composeOut.value = '运行中...'
  try { const r = await api.dkComposeDown(composePath.value.trim()); composeOut.value = (r && (r.out || r.error)) || 'done' }
  catch (e) { composeOut.value = e.message }
}
async function composePs() {
  if (!composePath.value.trim()) return
  try { const r = await api.dkComposePs(composePath.value.trim()); composeOut.value = (r && r.out) || 'done' }
  catch (e) { composeOut.value = e.message }
}
</script>

<template>
  <div>
    <h1>Docker 管理</h1>
    <div class="subtitle">容器 / 镜像 / 卷 / 网络 / Compose · 宿主 docker8</div>

    <div v-if="notice" class="notice">{{ notice }}</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="info && info.daemon_down" class="section">
      <div class="section-title">Docker 守护进程未就绪</div>
      <div class="hint">请先在宿主机启动 docker（systemctl start docker），然后刷新。</div>
      <button class="btn btn-sm" @click="load">刷新</button>
    </div>

    <template v-else>
      <div class="card-grid ov">
        <div class="stat"><span class="st-k">daemon</span><b class="ok mono">{{ info && info.version || '...' }}</b></div>
        <div class="stat"><span class="st-k">运行中容器</span><b :class="info && info.running ? 'ok' : 'faint'">{{ info && info.running || 0 }}</b></div>
        <div class="stat"><span class="st-k">已停止</span><b class="faint">{{ info && info.stopped || 0 }}</b></div>
        <div class="stat"><span class="st-k">镜像</span><b class="mono">{{ info && info.images || 0 }}</b></div>
      </div>

      <div class="tabs">
        <button v-for="t in TABS" :key="t.key" class="tab" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
        <span class="grow"></span>
        <button v-if="tab === 'containers'" class="btn btn-sm btn-primary" @click="showCreate = true">新建容器</button>
        <button v-if="tab === 'containers'" class="btn btn-sm btn-ghost" @click="act(api.dkPrune, { all: true, volumes: false }, '已清理')">清理</button>
        <button class="btn btn-sm" @click="load">刷新</button>
      </div>

      <div v-if="tab === 'containers'" class="section">
        <table class="table">
          <thead><tr><th>名称</th><th>镜像</th><th>状态</th><th>端口</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="c in containers" :key="c.id">
              <td class="mono">{{ c.name }}</td>
              <td class="mono faint">{{ c.image }}</td>
              <td><span :class="stClass(c.status)">{{ c.status }}</span></td>
              <td class="mono faint" style="font-size:11px">{{ c.ports.join(', ') || '-' }}</td>
              <td style="white-space:nowrap">
                <template v-if="stateOf(c) === 'exited'">
                  <button class="btn btn-sm" @click="act(api.dkStart, { id: c.id }, '已启动')">启动</button>
                </template>
                <template v-else>
                  <button class="btn btn-sm" @click="act(api.dkStop, { id: c.id }, '已停止')">停止</button>
                  <button class="btn btn-sm" @click="act(api.dkRestart, { id: c.id }, '已重启')">重启</button>
                </template>
                <button class="btn btn-sm" @click="showLog(c)">日志</button>
                <button class="btn btn-sm btn-danger" @click="removeContainer(c)">删</button>
              </td>
            </tr>
            <tr v-if="!containers.length"><td colspan="5" class="hint">暂无容器</td></tr>
          </tbody>
        </table>
      </div>

      <div v-if="tab === 'images'" class="section">
        <div class="flex" style="margin-bottom:12px">
          <input v-model="pullName" class="input grow" placeholder="镜像名, 如 busybox / nginx:alpine" @keydown.enter="pullImage" />
          <button class="btn btn-sm btn-primary" @click="pullImage">拉取</button>
        </div>
        <table class="table">
          <thead><tr><th>镜像</th><th>ID</th><th>大小</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="img in images" :key="img.id">
              <td class="mono">{{ img.tags.length ? img.tags.join(', ') : '(无名)' }}</td>
              <td class="mono faint">{{ img.id }}</td>
              <td class="mono">{{ img.size }}</td>
              <td><button class="btn btn-sm btn-danger" @click="removeImage(img)">删</button></td>
            </tr>
            <tr v-if="!images.length"><td colspan="4" class="hint">镜像库为空</td></tr>
          </tbody>
        </table>
      </div>

      <div v-if="tab === 'volumes'" class="section">
        <table class="table">
          <thead><tr><th>卷名</th><th>驱动</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="v in volumes" :key="v.name">
              <td class="mono">{{ v.name }}</td><td class="mono faint">{{ v.driver }}</td>
              <td><button class="btn btn-sm btn-danger" @click="delVolume(v)">删</button></td>
            </tr>
            <tr v-if="!volumes.length"><td colspan="3" class="hint">无卷</td></tr>
          </tbody>
        </table>
      </div>

      <div v-if="tab === 'networks'" class="section">
        <table class="table">
          <thead><tr><th>网络</th><th>驱动</th><th>作用域</th></tr></thead>
          <tbody>
            <tr v-for="n in networks" :key="n.id">
              <td class="mono">{{ n.name }}</td><td class="mono faint">{{ n.driver }}</td><td class="mono faint">{{ n.scope }}</td>
            </tr>
            <tr v-if="!networks.length"><td colspan="3" class="hint">无网络</td></tr>
          </tbody>
        </table>
      </div>

      <div v-if="tab === 'compose'" class="section">
        <div class="flex" style="margin-bottom:12px">
          <input v-model="composePath" class="input grow" placeholder="项目目录(含 docker-compose.yml)" />
          <button class="btn btn-sm btn-primary" @click="composeUp">up -d</button>
          <button class="btn btn-sm" @click="composePs">ps</button>
          <button class="btn btn-sm btn-danger" @click="composeDown">down</button>
        </div>
        <pre class="mono-block pre">{{ composeOut || '(操作输出)' }}</pre>
      </div>
    </template>

    <!-- 日志抽屉 -->
    <div v-if="logShow" class="overlay" @click.self="logShow = false">
      <div class="modal" style="max-width:720px">
        <div class="modal-header"><span>日志 · {{ logName }}</span><button class="btn btn-sm btn-ghost" @click="logShow = false">关闭</button></div>
        <div class="modal-body"><pre class="mono-block pre">{{ logText }}</pre></div>
      </div>
    </div>

    <!-- 新建容器 -->
    <div v-if="showCreate" class="overlay" @click.self="showCreate = false">
      <div class="modal" style="max-width:520px">
        <div class="modal-header"><span>新建容器</span><button class="btn btn-sm btn-ghost" @click="showCreate = false">关闭</button></div>
        <div class="modal-body flex-col">
          <input v-model="createForm.image" class="input" placeholder="镜像(必填)" />
          <input v-model="createForm.name" class="input" placeholder="容器名" />
          <input v-model="createForm.ports" class="input" placeholder="端口, 如 8080:80, 443:443" />
          <input v-model="createForm.env" class="input" placeholder="环境变量, 如 A=1,B=2" />
          <input v-model="createForm.volumes" class="input" placeholder="卷, 如 /data:/app/data" />
          <input v-model="createForm.cmd" class="input" placeholder="命令(可空)" />
          <div class="flex">
            <label>重启策略
              <select v-model="createForm.restart" class="select">
                <option>no</option><option>always</option><option>on-failure</option>
              </select>
            </label>
            <label>网络
              <select v-model="createForm.network" class="select">
                <option>bridge</option><option>host</option><option>none</option>
              </select>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="createContainer">创建并启动</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice { padding: 8px 12px; border-radius: 8px; background: var(--success-soft); color: var(--success); margin-bottom: 12px; font-size: 13px; }
.card-grid.ov { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.st-k { font-size: 11px; color: var(--text-faint); }
.stat b { font-size: 15px; }
.pre { max-height: 360px; overflow: auto; }
</style>
