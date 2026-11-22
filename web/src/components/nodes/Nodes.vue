<template>
  <div class="nodes-page">
    <div class="np-toolbar">
      <div class="np-summary">
        <span class="np-count">{{ nodes.length }}</span><span class="np-muted">节点</span>
        <span class="np-divider"></span>
        <span class="np-online">{{ nodes.filter((n) => n.status === 'online').length }}</span><span class="np-muted">在线</span>
      </div>
      <div class="np-toolbar-actions">
        <button class="btn btn-sm" :disabled="busy" @click="load">刷新</button>
        <button class="btn btn-sm btn-primary" @click="showForm = !showForm">{{ showForm ? '收起' : '添加节点' }}</button>
      </div>
    </div>

    <div v-if="err" class="np-error">{{ err }}</div>

    <section v-if="showForm" class="node-form">
      <div class="node-form-head">
        <b>添加节点</b>
        <button class="btn btn-sm btn-ghost" @click="showForm = false">×</button>
      </div>
      <div class="node-form-grid">
        <label class="np-field"><span>名称</span><input v-model="form.name" placeholder="节点名称" /></label>
        <label class="np-field"><span>地址</span><input v-model="form.host" placeholder="192.168.2.143" /></label>
        <label class="np-field"><span>端口</span><input v-model.number="form.port" type="number" placeholder="8000" /></label>
        <label class="np-field"><span>分组</span><input v-model="form.group" placeholder="internal" /></label>
        <label class="np-field span2"><span>节点 Token</span><input v-model="form.token" type="password" placeholder="data/node_token" /></label>
        <label class="np-field"><span>SSH 用户</span><input v-model="form.ssh_user" placeholder="root" /></label>
        <label class="np-field"><span>SSH 密码</span><input v-model="form.ssh_password" type="password" placeholder="可留空" /></label>
        <label class="np-field span2"><span>MAC 地址（开机用）</span><input v-model="form.mac" placeholder="AA:BB:CC:DD:EE:FF" /></label>
      </div>
      <div class="node-form-foot">
        <label class="np-check"><input v-model="form.publish" type="checkbox" /> 参与发布</label>
        <label class="np-check"><input v-model="form.enabled" type="checkbox" /> 启用</label>
        <span class="np-hint">f 节点请保持不参与发布</span>
        <span class="np-grow"></span>
        <button class="btn btn-sm" :disabled="busy" @click="sshTest">测试 SSH</button>
        <button class="btn btn-sm btn-primary" :disabled="busy" @click="save">保存节点</button>
      </div>
      <pre v-if="sshOut" class="np-pre">{{ sshOut }}</pre>
    </section>

    <div class="node-grid">
      <article v-for="n in nodes" :key="n.id" class="node-card" :class="n.status">
        <div class="node-head">
          <span class="node-dot" :class="n.status"></span>
          <div class="node-ident">
            <b>{{ n.name }}</b>
            <span class="node-host">{{ n.host }}:{{ n.port }}</span>
          </div>
          <span class="node-badge" :class="n.status">{{ statusText(n.status) }}</span>
        </div>
        <div class="node-badges">
          <span v-if="!n.publish" class="node-badge warn">不参与发布</span>
          <span v-if="!n.enabled" class="node-badge">已停用</span>
          <span v-if="n.group" class="node-badge">{{ n.group }}</span>
        </div>
        <div class="node-facts">
          <div><span>版本</span><b>{{ n.version || '-' }}</b></div>
          <div><span>GPU</span><b>{{ n.gpu || '-' }}</b></div>
          <div><span>最近</span><b>{{ n.last_seen ? timeText(n.last_seen) : '-' }}</b></div>
        </div>
        <div v-if="n.message" class="node-msg">{{ n.message }}</div>
        <div class="node-actions">
          <button class="btn btn-sm" :disabled="busy" @click="test(n)">测试</button>
          <button class="btn btn-sm" :disabled="busy" @click="install(n)">部署/升级</button>
          <button class="btn btn-sm" :disabled="busy" @click="preflight(n)">预检</button>
          <button class="btn btn-sm" :disabled="busy" @click="power(n, 'reboot')">重启</button>
          <button class="btn btn-sm" :disabled="busy" @click="power(n, 'shutdown')">关机</button>
          <button class="btn btn-sm" :disabled="busy" @click="power(n, 'poweron')">开机</button>
          <button class="btn btn-sm" :disabled="busy" @click="detailNode(n)">详情</button>
          <button class="btn btn-sm btn-danger" :disabled="busy" @click="remove(n)">删除</button>
        </div>
      </article>
      <div v-if="!nodes.length" class="node-empty">还没有节点，点「添加节点」接入。</div>
    </div>

    <div v-if="detail" class="np-mask" @click.self="detail = null">
      <aside class="np-drawer">
        <div class="np-drawer-head">
          <b>{{ detailName }} · 状态</b>
          <button class="btn btn-sm btn-ghost" @click="detail = null">×</button>
        </div>
        <pre>{{ detail }}</pre>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { api } from '../../api'

const nodes = ref([])
const busy = ref(false)
const err = ref('')
const showForm = ref(false)
const detail = ref('')
const detailName = ref('')
const sshOut = ref('')
const trainNode = ref('')
const trainState = ref(null)
const trainDatasets = ref([])
const trainMsg = ref('')
const trainDataset = ref('')
const trainBase = ref('realistic')
const trainSteps = ref(800)
const trainRank = ref(16)
const trainAlpha = ref(16)
const trainLr = ref(0.0001)
const dsName = ref('')
const dsCaption = ref('')
const dsFiles = ref(null)
const dsMsg = ref('')
let trainTimer = null
const form = reactive({
  name: 'f', host: '192.168.2.143', port: 8000, group: 'internal',
  token: '', ssh_user: 'f', ssh_password: '', publish: false, enabled: true,
  mac: '',
})

async function load() {
  err.value = ''
  try {
    const d = await api.nodes()
    nodes.value = (d && d.nodes) || []
  } catch (e) { err.value = e.message || String(e) }
}

async function save() {
  if (!form.name || !form.host) { err.value = '名称和地址必填'; return }
  busy.value = true
  try {
    await api.nodeSave({ ...form })
    showForm.value = false
    form.token = ''
    form.ssh_password = ''
    await load()
  } catch (e) { err.value = e.message || String(e) } finally { busy.value = false }
}

async function test(n) {
  busy.value = true
  err.value = ''
  try {
    const d = await api.nodeTest(n.id)
    if (d && d.node) {
      const i = nodes.value.findIndex((x) => x.id === n.id)
      if (i >= 0) nodes.value[i] = d.node
      if (d.node.status !== 'online') err.value = (d.node.message || '节点离线')
    }
  } catch (e) { err.value = e.message || String(e) } finally { busy.value = false }
}

async function sshTest() {
  if (!form.host || !form.ssh_user || !form.ssh_password) { err.value = 'SSH 测试需要地址、用户、密码'; return }
  busy.value = true; err.value = ''; sshOut.value = '连接中…'
  try {
    const d = await api.nodeSSHTest({
      host: form.host, port: 22, user: form.ssh_user, password: form.ssh_password,
    })
    sshOut.value = d.ok ? d.output : ('失败：' + (d.error || '') + '\n' + (d.output || ''))
  } catch (e) { sshOut.value = '失败：' + (e.message || e) } finally { busy.value = false }
}

async function install(n) {
  if (!confirm(`通过 SSH 部署/升级节点「${n.name}」？节点服务会重启。`)) return
  busy.value = true; err.value = ''; sshOut.value = '部署中（上传节点包 → 解压 → 重启 → 健康检查）…'
  try {
    const d = await api.nodeInstall(n.id)
    sshOut.value = d.ok ? (d.output || '部署成功') : ('部署失败：' + (d.error || '') + '\n' + (d.output || ''))
    await load()
  } catch (e) { sshOut.value = '部署失败：' + (e.message || e) } finally { busy.value = false }
}

async function preflight(n) {
  busy.value = true; err.value = ''; sshOut.value = '预检中…'
  try {
    const d = await api.nodePreflight(n.id)
    sshOut.value = d.ok ? d.output : ('预检失败：' + (d.error || '') + '\n' + (d.output || ''))
  } catch (e) { sshOut.value = '预检失败：' + (e.message || e) } finally { busy.value = false }
}

async function detailNode(n) {  busy.value = true
  err.value = ''
  try {
    const d = await api.nodeStatus(n.id)
    detailName.value = n.name
    detail.value = JSON.stringify(d, null, 2)
  } catch (e) { err.value = e.message || String(e) } finally { busy.value = false }
}

async function power(n, action) {
  const label = action === 'shutdown' ? '关机' : action === 'reboot' ? '重启' : 'Wake-on-LAN 开机'
  if (!confirm(`对节点「${n.name}」执行${label}？`)) return
  busy.value = true; err.value = ''
  try {
    const d = await api.nodePower(n.id, action)
    if (d && d.ok === false) {
      err.value = `${label}失败：${d.error || ''}\n${d.output || ''}`
    } else {
      sshOut.value = `${label}：${(d && d.message) || '指令已发送'}`
      await load()
    }
  } catch (e) {
    err.value = `${label}失败：` + (e.message || e)
  } finally { busy.value = false }
}

async function remove(n) {
  if (!confirm(`删除节点「${n.name}」？`)) return
  busy.value = true
  try {
    await api.nodeDelete(n.id)
    await load()
  } catch (e) { err.value = e.message || String(e) } finally { busy.value = false }
}

function statusText(s) {
  return s === 'online' ? '在线' : s === 'offline' ? '离线' : '未检测'
}
function timeText(ts) {
  const d = new Date(ts * 1000)
  return d.toLocaleString()
}

async function loadTrain() {
  const nid = trainNode.value || (nodes.value[0] && nodes.value[0].id)
  if (!nid) return
  trainNode.value = nid
  try {
    const d = await api.nodeTrainState(nid)
    trainState.value = d.state || null
    trainDatasets.value = d.datasets || []
    if (!trainDataset.value && trainDatasets.value.length) trainDataset.value = trainDatasets.value[0].name || ''
    trainMsg.value = '已连接训练服务'
    await loadDatasets()
  } catch (e) { trainMsg.value = '训练服务不可用：' + (e.message || e) }
}
async function loadDatasets() {
  if (!trainNode.value) return
  try {
    const d = await api.nodeDatasets(trainNode.value)
    trainDatasets.value = d.datasets || []
    if (!trainDataset.value && trainDatasets.value.length) trainDataset.value = trainDatasets.value[0].name || ''
  } catch (e) { dsMsg.value = '数据集读取失败：' + (e.message || e) }
}
async function createDataset() {
  if (!dsName.value.trim()) { dsMsg.value = '数据集名不能为空'; return }
  try {
    await api.nodeDatasetCreate(trainNode.value, dsName.value.trim())
    trainDataset.value = dsName.value.trim()
    dsMsg.value = '已创建 ' + trainDataset.value
    dsName.value = ''
    await loadDatasets()
  } catch (e) { dsMsg.value = '创建失败：' + (e.message || e) }
}
function fileB64(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })
}
async function uploadDataset() {
  const files = dsFiles.value && dsFiles.value.files
  if (!trainDataset.value) { dsMsg.value = '先选择/新建数据集'; return }
  if (!files || !files.length) { dsMsg.value = '先选择图片'; return }
  dsMsg.value = '上传中…'
  let ok = 0
  for (const f of files) {
    try {
      const b64 = await fileB64(f)
      await api.nodeDatasetUpload(trainNode.value, trainDataset.value, f.name, b64, dsCaption.value)
      ok++
    } catch (e) { dsMsg.value = '上传失败 ' + f.name + '：' + (e.message || e) }
  }
  dsMsg.value = '已上传 ' + ok + ' 张到 ' + trainDataset.value
  if (dsFiles.value) dsFiles.value.value = ''
  await loadDatasets()
}
async function deleteDataset() {
  if (!trainDataset.value) return
  if (!confirm(`删除数据集「${trainDataset.value}」？`)) return
  try {
    await api.nodeDatasetDelete(trainNode.value, trainDataset.value)
    dsMsg.value = '已删除 ' + trainDataset.value
    trainDataset.value = ''
    await loadDatasets()
  } catch (e) { dsMsg.value = '删除失败：' + (e.message || e) }
}
async function startTrain() {
  if (!trainNode.value) { trainMsg.value = '先选节点'; return }
  if (!trainDataset.value) { trainMsg.value = '数据集不能为空'; return }
  trainMsg.value = '提交训练…'
  try {
    await api.nodeTrainStart(trainNode.value, {
      dataset: trainDataset.value, base_style: trainBase.value,
      steps: Number(trainSteps.value) || 800, rank: Number(trainRank.value) || 16,
      alpha: Number(trainAlpha.value) || 16, lr: Number(trainLr.value) || 1e-4,
    })
    trainMsg.value = '训练已启动'
    pollTrain()
  } catch (e) { trainMsg.value = '启动失败：' + (e.message || e) }
}
async function stopTrain() {
  try { await api.nodeTrainStop(trainNode.value); trainMsg.value = '已请求停止' } catch (e) { trainMsg.value = '停止失败：' + (e.message || e) }
}
function pollTrain() {
  if (trainTimer) clearInterval(trainTimer)
  trainTimer = setInterval(async () => {
    try {
      const d = await api.nodeTrainState(trainNode.value)
      trainState.value = d.state || null
      if (d.datasets && d.datasets.length) trainDatasets.value = d.datasets
      if (!trainState.value || !trainState.value.running) { clearInterval(trainTimer); trainTimer = null }
    } catch (e) { /* ignore */ }
  }, 2500)
}
function trainStatusText(s) {
  if (!s) return '未知'
  const m = { idle: '空闲', running: '训练中', stopping: '正在停止', done: '完成', error: '失败' }
  return m[s.status] || s.status
}

onMounted(load)
</script>

<style scoped>
.nodes-page { padding: 14px 18px 24px; color: var(--text); }
.np-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.np-summary { display: flex; align-items: baseline; gap: 5px; font-size: 12px; color: var(--text-muted); }
.np-count, .np-online { font-size: 16px; font-weight: 700; color: var(--text); }
.np-online { color: var(--success, #2f9e44); }
.np-divider { width: 1px; height: 12px; background: var(--border); margin: 0 6px; }
.np-muted { color: var(--text-muted); font-size: 11px; }
.np-toolbar-actions { display: flex; align-items: center; gap: 6px; }
.np-error { color: var(--danger); border: 1px solid var(--danger); background: var(--danger-soft, rgba(245,83,79,.12)); padding: 7px 10px; border-radius: 6px; font-size: 12px; margin-bottom: 10px; }
.node-form { border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); padding: 12px; margin-bottom: 12px; }
.node-form-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
.node-form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 10px; }
.np-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-muted); }
.np-field.span2 { grid-column: span 2; }
.np-field input, .np-field select { height: 30px; background: var(--surface); border: 1px solid var(--border); border-radius: 5px; color: var(--text); padding: 5px 8px; font-size: 12px; min-width: 0; }
.np-field input:focus, .np-field select:focus { outline: none; border-color: var(--accent); }
.node-form-foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; font-size: 11px; }
.np-check { display: flex; align-items: center; gap: 5px; color: var(--text-muted); }
.np-hint { color: var(--text-muted); }
.np-grow { flex: 1; }
.np-pre { margin: 10px 0 0; max-height: 200px; overflow: auto; white-space: pre-wrap; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-size: 11px; }
.node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px; }
.node-card { border: 1px solid var(--border); border-radius: 8px; background: var(--surface-2); padding: 12px; min-width: 0; }
.node-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.node-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: var(--text-faint); }
.node-dot.online { background: var(--success, #2f9e44); box-shadow: 0 0 0 3px rgba(47,158,68,.15); }
.node-dot.offline { background: var(--danger); }
.node-ident { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.node-ident b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-host { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-badges { display: flex; gap: 4px; flex-wrap: wrap; margin: 7px 0; }
.node-badge { font-size: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 1px 6px; color: var(--text-muted); }
.node-badge.online { color: var(--success, #2f9e44); border-color: var(--success, #2f9e44); }
.node-badge.offline { color: var(--danger); border-color: var(--danger); }
.node-badge.warn { color: var(--warning, #d9480f); border-color: var(--warning, #d9480f); }
.node-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 7px 0; margin: 4px 0 8px; }
.node-facts div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.node-facts span { font-size: 10px; color: var(--text-muted); }
.node-facts b { font-size: 11px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-msg { color: var(--danger); font-size: 11px; margin-bottom: 7px; line-height: 1.5; }
.node-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.node-empty { grid-column: 1 / -1; text-align: center; color: var(--text-muted); border: 1px dashed var(--border); border-radius: 8px; padding: 28px; font-size: 12px; }
.np-mask { position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,.35); display: flex; justify-content: flex-end; }
.np-drawer { width: min(640px, 94vw); height: 100%; background: var(--bg, #11151c); border-left: 1px solid var(--border); display: flex; flex-direction: column; }
.np-drawer-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 13px; }
.np-drawer pre { flex: 1; margin: 0; padding: 12px; overflow: auto; font-size: 11px; line-height: 1.55; }
@media (max-width: 900px) { .node-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .nodes-page { padding: 10px 12px 20px; } .node-form-grid { grid-template-columns: 1fr; } .np-field.span2 { grid-column: span 1; } .node-grid { grid-template-columns: 1fr; } }
</style>
