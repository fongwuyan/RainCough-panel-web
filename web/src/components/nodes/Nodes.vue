<template>
  <div class="nodes">
    <div class="hd">
      <div>
        <h1>节点管理</h1>
        <p class="sub">生图 / 推理 / 训练节点，仅限内网。f 已标记为不参与发布。</p>
      </div>
      <div class="actions">
        <button class="btn" @click="load">刷新</button>
        <button class="btn primary" @click="showForm = !showForm">
          {{ showForm ? '收起' : '添加节点' }}
        </button>
      </div>
    </div>

    <div v-if="err" class="err">{{ err }}</div>

    <div v-if="showForm" class="form">
      <div class="form-row">
        <label>名称<input v-model="form.name" placeholder="f" /></label>
        <label>地址<input v-model="form.host" placeholder="192.168.2.143" /></label>
        <label>端口<input v-model.number="form.port" type="number" placeholder="8000" /></label>
        <label>分组<input v-model="form.group" placeholder="internal" /></label>
      </div>
      <div class="form-row">
        <label class="grow">节点 Token<input v-model="form.token" type="password" placeholder="data/node_token" /></label>
        <label>SSH 用户<input v-model="form.ssh_user" placeholder="f" /></label>
        <label>SSH 密码<input v-model="form.ssh_password" type="password" placeholder="可留空" /></label>
      </div>
      <div class="form-row">
        <label>MAC 地址<input v-model="form.mac" placeholder="AA:BB:CC:DD:EE:FF（开机用）" /></label>
      </div>
      <div class="form-row">
        <label class="check"><input type="checkbox" v-model="form.publish" /> 参与发布</label>
        <label class="check"><input type="checkbox" v-model="form.enabled" /> 启用</label>
        <span class="hint">f 请保持「不参与发布」</span>
        <button class="btn" :disabled="busy" @click="sshTest">测试 SSH</button>
        <button class="btn primary" style="margin-left:auto" :disabled="busy" @click="save">保存节点</button>
      </div>
      <pre v-if="sshOut" class="ssh">{{ sshOut }}</pre>
    </div>

    <div class="grid">
      <div v-for="n in nodes" :key="n.id" class="card">
        <div class="card-hd">
          <span class="dot" :class="n.status"></span>
          <b>{{ n.name }}</b>
          <span class="host">{{ n.host }}:{{ n.port }}</span>
          <span v-if="!n.publish" class="badge warn">不参与发布</span>
          <span v-if="!n.enabled" class="badge">已停用</span>
          <span class="badge" :class="n.status">{{ statusText(n.status) }}</span>
        </div>
        <div class="meta">
          <span>版本 {{ n.version || '-' }}</span>
          <span>GPU {{ n.gpu || '-' }}</span>
          <span>最近 {{ n.last_seen ? timeText(n.last_seen) : '-' }}</span>
        </div>
        <div v-if="n.message" class="msg">{{ n.message }}</div>
        <div class="card-actions">
          <button class="btn sm" :disabled="busy" @click="test(n)">测试连接</button>
          <button class="btn sm" :disabled="busy" @click="install(n)">部署/升级</button>
          <button class="btn sm" :disabled="busy" @click="preflight(n)">预检</button>
          <button class="btn sm" :disabled="busy" @click="power(n, 'reboot')">重启</button>
          <button class="btn sm danger" :disabled="busy" @click="power(n, 'shutdown')">关机</button>
          <button class="btn sm" :disabled="busy" @click="power(n, 'poweron')">开机</button>
          <button class="btn sm" :disabled="busy" @click="detailNode(n)">状态详情</button>
          <button class="btn sm danger" :disabled="busy" @click="remove(n)">删除</button>
        </div>
      </div>
      <div v-if="!nodes.length" class="empty">还没有节点，点「添加节点」接入 f。</div>
    </div>

    <div v-if="detail" class="detail">
      <div class="detail-hd">
        <b>{{ detailName }} · 状态</b>
        <button class="btn sm" @click="detail = null">关闭</button>
      </div>
      <pre>{{ detail }}</pre>
    </div>

    <div class="train">
      <h3>LoRA 训练</h3>
      <div class="form-row">
        <label>节点
          <select v-model="trainNode" @change="loadTrain">
            <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.name }}</option>
          </select>
        </label>
        <label>数据集
          <input v-model="trainDataset" list="aidraw-datasets" placeholder="数据集名" />
          <datalist id="aidraw-datasets">
            <option v-for="d in trainDatasets" :key="d.name || d" :value="d.name || d" />
          </datalist>
        </label>
        <label>底模
          <select v-model="trainBase">
            <option value="realistic">写实 · SD1.5</option>
            <option value="anime">动漫 · waifu-diffusion</option>
          </select>
        </label>
        <label>步数<input v-model.number="trainSteps" type="number" /></label>
        <label>rank<input v-model.number="trainRank" type="number" /></label>
        <label>alpha<input v-model.number="trainAlpha" type="number" /></label>
        <label>lr<input v-model.number="trainLr" type="number" step="0.00001" /></label>
      </div>
      <div class="form-row">
        <button class="btn primary" @click="startTrain">开始训练</button>
        <button class="btn" @click="stopTrain">停止</button>
        <button class="btn" @click="loadTrain">刷新状态</button>
        <span class="hint">
          {{ trainMsg }} · 状态 {{ trainStatusText(trainState) }}
          · step {{ (trainState && trainState.step) || 0 }}/{{ (trainState && trainState.total) || 0 }}
          · loss {{ (trainState && (trainState.avg_loss || trainState.loss)) || '-' }}
        </span>
      </div>
      <pre v-if="trainState && (trainState.log || []).length" class="ssh">{{ (trainState.log || []).slice(-16).join('\n') }}</pre>

      <div class="ds">
        <h4>数据集</h4>
        <div class="form-row">
          <label>新数据集<input v-model="dsName" placeholder="例如 my-style" /></label>
          <button class="btn" @click="createDataset">新建</button>
          <label>图片<input ref="dsFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="dsFiles = $event.target" /></label>
          <label class="grow">这批 caption<input v-model="dsCaption" placeholder="可空；训练时缺 caption 会补触发词" /></label>
          <button class="btn primary" @click="uploadDataset">上传</button>
          <button class="btn danger" @click="deleteDataset">删除当前数据集</button>
        </div>
        <div class="hint">
          {{ dsMsg }} · 现有：
          <span v-for="d in trainDatasets" :key="d.name" style="margin-right:10px">
            {{ d.name }}（{{ d.images }} 图 / {{ d.captions }} 标注）
          </span>
          <span v-if="!trainDatasets.length">无</span>
        </div>
      </div>
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
onMounted(loadTrain)
</script>

<style scoped>
.nodes { padding: 20px 24px; color: var(--text); }
.hd { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
h1 { font-size: 18px; margin: 0 0 4px; }
.sub { color: var(--text-muted); font-size: 12px; margin: 0; }
.actions { display: flex; gap: 8px; }
.err { background: rgba(245, 83, 79, .12); border: 1px solid rgba(245, 83, 79, .35); color: #f5534f; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; }
.form { border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 16px; background: var(--surface); }
.form-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.form-row label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.form-row label.grow { flex: 1; min-width: 260px; }
.form-row input:not([type=checkbox]) { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 6px 8px; border-radius: 5px; min-width: 140px; }
.form-row label.check { flex-direction: row; align-items: center; gap: 6px; }
.hint { font-size: 12px; color: var(--text-faint); align-self: center; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--surface); }
.card-hd { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.host { color: var(--text-muted); font-size: 12px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-faint); }
.dot.online { background: #0ca678; }
.dot.offline { background: #f5534f; }
.badge { font-size: 11px; border: 1px solid var(--border); padding: 1px 6px; border-radius: 999px; color: var(--text-muted); }
.badge.warn { color: #e6b85c; border-color: rgba(230,184,92,.4); }
.badge.online { color: #0ca678; border-color: rgba(12,166,120,.4); }
.badge.offline { color: #f5534f; border-color: rgba(245,83,79,.4); }
.meta { display: flex; gap: 14px; flex-wrap: wrap; color: var(--text-muted); font-size: 12px; margin: 10px 0; }
.msg { color: #f5534f; font-size: 12px; margin-bottom: 8px; }
.card-actions { display: flex; gap: 6px; }
.btn { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.sm { padding: 3px 8px; }
.btn.danger { color: #f5534f; }
.btn:disabled { opacity: .5; cursor: default; }
.empty { color: var(--text-muted); padding: 30px; border: 1px dashed var(--border); border-radius: 8px; text-align: center; }
.detail { margin-top: 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.detail-hd { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.detail pre { margin: 0; padding: 12px; max-height: 420px; overflow: auto; font-size: 11px; line-height: 1.5; }
.ssh { margin: 10px 0 0; padding: 10px; max-height: 240px; overflow: auto; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; font-size: 11px; line-height: 1.5; white-space: pre-wrap; }
.train { margin-top: 22px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); padding: 14px; }
.train h3 { margin: 0 0 10px; font-size: 14px; }
.ds { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
.ds h4 { margin: 0 0 8px; font-size: 13px; }
</style>
