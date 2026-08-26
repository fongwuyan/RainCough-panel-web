<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'
import InstanceManager from './InstanceManager.vue'

const error = ref('')
const notice = ref('')
const instances = ref([])
const activeInst = ref('')
const total = ref(0)
const runningCount = ref(0)

const view = ref('list')          // 'list' | 'manager'
const managingId = ref('')

// 新建 / 编辑
const showAdd = ref(false)
const newInst = ref({ id: '', label: '', dir: '', session: '', port: 25565, mem_min: '2G', mem_max: '4G', jvm_args: '', start_cmd: '' })
const showEdit = ref(false)
const editInst = ref({})

// 核心选择
const cores = ref([])
const coresLoading = ref(false)
const coreSel = ref('')
const coreVerInst = ref('')
const coreInstalling = ref(false)
const coreAsync = ref(false)
const coreErred = ref(false)
const coreState = ref('')
let installPollTimer = null

// 已装核心切换 (按实例通用)
const instJars = ref([])
const instJarCur = ref('')
const instJarSel = ref('')
const instJarBusy = ref(false)
const instJarErr = ref('')
const instJarsReady = ref(false)
async function loadInstJars() {
  if (!editInst.value || !editInst.value.id) return
  instJarsReady.value = false
  try {
    const d = await api.mcCoreJars(editInst.value.id)
    instJars.value = d.jars || []
    instJarCur.value = d.current || ''
    instJarSel.value = d.current || ''
    instJarErr.value = ''
    instJarsReady.value = true
  } catch (e) {
    instJarErr.value = e.message
    instJarsReady.value = false
  }
}
async function switchInstJar() {
  if (!instJarSel.value || instJarBusy.value) return
  instJarBusy.value = true; instJarErr.value = ''
  try {
    const r = await api.mcCoreSwitch(editInst.value.id, instJarSel.value)
    notice.value = r.message || '核心切换中'; flash()
    setTimeout(loadInstJars, 2000)
  } catch (e) { instJarErr.value = e.message } finally { instJarBusy.value = false }
}

// Java 环境包选择
const javas = ref([])
const loadedJava = ref(false)
async function loadJavas() {
  try {
    const d = await api.mcJavas()
    javas.value = d.javas || []
  } catch (e) { /* 忽略 */ }
  loadedJava.value = true
}

let timer = null

async function loadInstances() {
  try {
    const d = await api.mcInstances()
    instances.value = d.instances || []
    activeInst.value = d.active || ''
    total.value = d.total || instances.value.length
    runningCount.value = d.running_count || 0
  } catch (e) { error.value = e.message }
}

const stats = computed(() => ({
  total: total.value,
  running: runningCount.value,
  stopped: total.value - runningCount.value,
  ports: instances.value.filter(i => i.running).map(i => i.port),
}))

function flash() { setTimeout(() => notice.value = '', 4000) }

onMounted(() => {
  loadInstances(); loadCores()
  timer = setInterval(loadInstances, 5000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer); stopInstallPoll() })

// ---------- 新增 ----------
function payload(o) {
  const p = { id: o.id, label: o.label, dir: o.dir, session: o.session, port: o.port }
  if (o.mem_min !== undefined) p.mem_min = o.mem_min
  if (o.mem_max !== undefined) p.mem_max = o.mem_max
  if (o.jvm_args !== undefined) p.jvm_args = o.jvm_args
  if (o.start_cmd !== undefined) p.start_cmd = o.start_cmd
  if (o.java !== undefined) p.java = o.java
  return p
}
async function addInstSave() {
  if (!newInst.value.id) { error.value = '需要实例 ID'; return }
  error.value = ''
  try {
    await api.mcInstanceAdd(payload(newInst.value))
    showAdd.value = false
    newInst.value = { id: '', label: '', dir: '', session: '', port: 25565, mem_min: '2G', mem_max: '4G', jvm_args: '', start_cmd: '' }
    loadInstances()
  } catch (e) { error.value = e.message }
}

// ---------- 编辑 ----------
function openEdit(inst) {
  editInst.value = { id: inst.id, label: inst.label, dir: inst.dir, port: inst.port,
    mem_min: inst.mem_min || '2G', mem_max: inst.mem_max || '4G', jvm_args: inst.jvm_args || '',
    start_cmd: inst.start_cmd || '', java: inst.java || '' }
  coreAsync.value = ''; coreErred.value = false; coreState.value = ''; coreVerInst.value = ''
  showEdit.value = true
  if (!loadedJava.value) loadJavas()
  loadInstJars()
  api.mcInstanceSet(inst.id).then(() => refreshEditAfterInstall()).catch(() => {})
}
function closeEdit() { stopInstallPoll(); showEdit.value = false }
async function editSave() {
  error.value = ''
  try { await api.mcInstanceUpdate(payload(editInst.value)); showEdit.value = false; loadInstances() }
  catch (e) { error.value = e.message }
}
async function removeInst(id) {
  if (!confirm(`删除实例 ${id}？`)) return
  error.value = ''
  try { await api.mcInstanceRemove(id); loadInstances() } catch (e) { error.value = e.message }
}

// 进入管理/返回
async function enter(id) {
  managingId.value = id
  view.value = 'manager'
  try { await api.mcInstanceSet(id); activeInst.value = id } catch (e) { /* 忽略 */ }
}
function backToList() { view.value = 'list'; loadInstances() }

// ---------- 核心 ----------
async function loadCores() {
  coresLoading.value = true
  try {
    const d = await api.mcCores()
    cores.value = d.cores || []
    if (coreSel.value && !cores.value.some(c => c.id === coreSel.value)) coreSel.value = ''
  } catch (e) { /* 忽略 */ }
  coresLoading.value = false
}
function syncCoreVers() {
  const c = cores.value.find(x => x.id === coreSel.value)
  if (c && c.latest && !c.versions.includes(coreVerInst.value)) coreVerInst.value = c.latest
}
function onCoreChange() { coreVerInst.value = ''; coreState.value = ''; coreAsync.value = false; syncCoreVers() }
const curCore = computed(() => cores.value.find(c => c.id === coreSel.value))

async function installCore() {
  if (!coreSel.value || !coreVerInst.value || coreInstalling.value) return
  coreInstalling.value = true; coreErred.value = false; error.value = ''
  try {
    const r = await api.mcCoreInstall({ core: coreSel.value, version: coreVerInst.value, inst: editInst.value.id })
    notice.value = r.message; flash()
    coreAsync.value = true; coreState.value = ''
    pollInstall()
  } catch (e) { error.value = e.message; coreInstalling.value = false }
}
async function pollInstall() {
  try {
    const s = await api.mcCoreInstallStatus()
    coreState.value = s.state || ''
    coreErred.value = !!s.error
    if (s.done) {
      coreInstalling.value = false; coreAsync.value = false
      if (installPollTimer) { clearInterval(installPollTimer); installPollTimer = null }
      if (!s.error) { notice.value = s.state || '核心安装完成'; flash(); loadInstances(); refreshEditAfterInstall() }
      else error.value = s.state || '安装失败'
      return
    }
    if (!installPollTimer) installPollTimer = setInterval(pollInstall, 2000)
  } catch (e) { if (installPollTimer) { clearInterval(installPollTimer); installPollTimer = null }; coreInstalling.value = false }
}
async function refreshEditAfterInstall() {
  try {
    const d = await api.mcInstanceDetail()
    if (!d || d.id !== editInst.value.id) return
    editInst.value.start_cmd = d.start_cmd || ''
    editInst.value.jvm_args = d.jvm_args || ''
    editInst.value.mem_min = d.mem_min || editInst.value.mem_min
    editInst.value.mem_max = d.mem_max || editInst.value.mem_max
    editInst.value.java = d.java || editInst.value.java
  } catch (e) { /* 忽略 */ }
}
function stopInstallPoll() {
  if (installPollTimer) { clearInterval(installPollTimer); installPollTimer = null }
  coreInstalling.value = false
}
</script>

<template>
  <div class="dash">
    <div class="dash-head">
      <div>
        <h1 class="dash-title">MC 服务器</h1>
        <div class="subtitle">多实例 Minecraft 服务器管理 · 统一监控与核心安装</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-primary btn-lg" @click="showAdd = !showAdd">
          {{ showAdd ? '收起' : '＋ 新建实例' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error" style="margin:14px 0;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin:14px 0;">{{ notice }}</div>

    <!-- ===== 单实例管理 ===== -->
    <div v-if="view === 'manager'">
      <InstanceManager :inst-id="managingId" @back="backToList" />
    </div>

    <!-- ===== 仪表盘 ===== -->
    <template v-else>
      <!-- 统计卡 -->
      <div class="stats">
        <div class="stat-card">
          <div class="stat-num">{{ stats.total }}</div>
          <div class="stat-label">实例总数</div>
        </div>
        <div class="stat-card green">
          <div class="stat-num">{{ stats.running }}</div>
          <div class="stat-label">运行中</div>
        </div>
        <div class="stat-card red">
          <div class="stat-num">{{ stats.stopped }}</div>
          <div class="stat-label">已停止</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-num">{{ runningCount ? stats.ports.join(' / ') : '—' }}</div>
          <div class="stat-label">在线端口</div>
        </div>
      </div>

      <!-- 空状态引导 -->
      <div v-if="!instances.length && !showAdd" class="empty">
        <div class="empty-icon">▦</div>
        <div class="empty-title">还没有任何服务器实例</div>
        <div class="empty-desc">创建第一个实例，即可开始管理你的 Minecraft 服务器。</div>
        <div class="empty-actions">
          <button class="btn btn-primary btn-lg" @click="showAdd = true">＋ 创建实例</button>
        </div>
      </div>

      <!-- 新建表单 -->
      <div v-if="showAdd" class="panel">
        <div class="panel-title">新建实例</div>
        <div class="grid-2">
          <div class="form-row"><span class="form-label">实例 ID</span><input v-model="newInst.id" class="input" placeholder="如 craft1，无空格与 /" /></div>
          <div class="form-row"><span class="form-label">名称</span><input v-model="newInst.label" class="input" placeholder="显示名称" /></div>
          <div class="form-row"><span class="form-label">服务器目录</span><input v-model="newInst.dir" class="input" placeholder="/opt/mcserver" /></div>
          <div class="form-row"><span class="form-label">端口</span><input v-model.number="newInst.port" type="number" class="input" /></div>
        </div>
        <div class="grid-2">
          <div class="form-row"><span class="form-label">最小内存</span><input v-model="newInst.mem_min" class="input" placeholder="2G" /></div>
          <div class="form-row"><span class="form-label">最大内存</span><input v-model="newInst.mem_max" class="input" placeholder="4G" /></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn btn-primary" @click="addInstSave">创建实例</button>
          <button class="btn btn-ghost" @click="showAdd = false">取消</button>
        </div>
      </div>

      <!-- 实例卡片网格 -->
      <div v-if="instances.length" class="cards">
        <div v-for="i in instances" :key="i.id" class="card" :class="{ run: i.running }">
          <div class="card-top">
            <div class="card-dot" :class="i.running ? 'online' : 'offline'"></div>
            <div class="card-title">{{ i.label || i.id }}</div>
            <span v-if="i.running" class="tag-chip ok">运行中</span>
            <span v-else class="tag-chip fail">已停止</span>
          </div>
          <div class="card-sub"><code>{{ i.id }}</code> · 端口 <b>{{ i.port }}</b></div>
          <div class="card-meta">
            <div><span>目录</span><code>{{ i.dir }}</code></div>
            <div><span>核心</span><code>{{ i.jar || '未安装' }}</code></div>
            <div><span>内存</span><code>{{ i.mem_max }}</code></div>
            <div><span>版本</span><code>{{ i.version || '—' }}</code></div>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-primary" @click="enter(i.id)">管理</button>
            <button class="btn btn-sm" @click="openEdit(i)">开服参数</button>
            <button class="btn btn-sm btn-danger-ghost" @click="removeInst(i.id)">删除</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 编辑开服参数 + 核心安装 弹窗 -->
    <div v-if="showEdit" class="modal-mask">
      <div class="modal">
        <div class="modal-head">开服参数 — {{ editInst.label || editInst.id }}</div>
        <div class="grid-2">
          <div class="form-row"><span class="form-label">名称</span><input v-model="editInst.label" class="input" /></div>
          <div class="form-row"><span class="form-label">目录</span><input v-model="editInst.dir" class="input" /></div>
          <div class="form-row"><span class="form-label">端口</span><input v-model.number="editInst.port" type="number" class="input" /></div>
          <div class="form-row"><span class="form-label">内存</span><input v-model="editInst.mem_max" class="input" placeholder="如 4G" /></div>
        </div>
        <div class="form-row"><span class="form-label">Java 环境</span>
          <select v-model="editInst.java" class="select">
            <option value="" disabled>选择已安装的 JDK…</option>
            <option v-for="j in javas" :key="j.bin" :value="j.bin">{{ j.name }}（v{{ j.version }}）</option>
          </select>
          <a v-if="javas.length" class="hint" style="align-self:center;" @click.prevent="loadJavas">刷新</a>
          <span v-else class="hint" style="align-self:center;">无已安装 JDK，可到「环境包管理」安装</span>
        </div>
        <div class="form-row"><span class="form-label">额外 JVM 参数</span><input v-model="editInst.jvm_args" class="input" placeholder="如 -XX:+UseG1GC" /></div>
        <div class="form-row form-row-col"><span class="form-label">自定义启动命令</span><textarea v-model="editInst.start_cmd" class="input textarea" placeholder="完整启动命令（优先于上面参数）"></textarea></div>

        <div class="modal-sep">
          <div class="sep-title">内置服务核心 — 选择并安装</div>
          <div class="hint" style="font-size:11px;">从官方源拉取最新版，下载 jar 到实例目录并自动配置启动命令（先停止服务器）</div>
        </div>
        <div class="form-row"><span class="form-label">核心</span>
          <select v-model="coreSel" class="select" @change="onCoreChange" :disabled="coresLoading">
            <option value="" disabled>选择核心…</option>
            <option v-for="c in cores" :key="c.id" :value="c.id">{{ c.name }}（最新 {{ c.latest || '—' }}）</option>
          </select>
          <span v-if="coresLoading" class="hint">加载中…</span>
        </div>
        <div class="form-row" v-if="coreSel">
          <span class="form-label">版本</span>
          <select v-model="coreVerInst" class="select" style="flex:0 0 220px;" :disabled="coreInstalling">
            <option value="" disabled>{{ curCore ? '选择版本…' : '' }}</option>
            <option v-for="v in (curCore?.versions || [])" :key="v" :value="v">{{ v }}</option>
          </select>
          <button class="btn btn-primary btn-sm" :disabled="coreInstalling || !coreVerInst" @click="installCore">{{ coreInstalling ? '安装中…' : '下载并安装' }}</button>
        </div>
        <div v-if="coreAsync" class="inst-status" :class="coreErred ? 'err' : ''">
          <template v-if="coreState">{{ coreState }}</template>
          <template v-else>正在安装…</template>
          <span v-if="!coreErred" class="spin"></span>
        </div>

        <template v-if="instJarsReady">
          <div class="modal-sep">
            <div class="sep-title">已装核心 — 切换</div>
            <div class="hint" style="font-size:11px;">选择实例目录中已安装的核心，切换会重启该服务器，重启生效</div>
          </div>
          <div class="form-row">
            <span class="form-label">当前核心</span>
            <span class="hint" style="align-self:center;font-family:var(--font-mono);">{{ instJarCur || '—' }}</span>
          </div>
          <div class="form-row">
            <span class="form-label">切换至</span>
            <select v-model="instJarSel" class="select" style="flex:0 0 260px;" :disabled="instJarBusy">
              <option v-for="j in instJars" :key="j.name" :value="j.name">{{ j.name }}（{{ j.version }}，{{ (j.size/1048576).toFixed(1) }}MB）</option>
            </select>
            <button class="btn btn-primary btn-sm" :disabled="instJarBusy || !instJarSel || instJarSel === instJarCur" @click="switchInstJar">{{ instJarBusy ? '切换中…' : '切换并重启' }}</button>
          </div>
          <div v-if="instJarErr" class="inst-status err">{{ instJarErr }}</div>
        </template>

        <div class="modal-actions">
          <button class="btn btn-primary" :disabled="coreInstalling" @click="editSave">保存</button>
          <button class="btn btn-ghost" :disabled="coreInstalling" @click="closeEdit">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.dash-title { margin: 0; font-size: 26px; }
.head-actions { display: flex; gap: 10px; }
.btn-lg { padding: 10px 20px; font-size: 15px; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 20px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0; padding: 18px 20px; transition: transform .15s, border-color .15s; }
.stat-card:hover { transform: translateY(-2px); border-color: var(--border-strong); }
.stat-num { font-size: 30px; font-weight: 700; font-family: var(--font-mono); color: var(--text); }
.stat-label { font-size: 13px; color: var(--text-faint); margin-top: 4px; }
.stat-card.green .stat-num { color: #3fb950; }
.stat-card.red .stat-num { color: #f85149; }
.stat-card.accent .stat-num { color: var(--accent); font-size: 22px; }

.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 0; padding: 20px; margin-top: 20px; }
.panel-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 18px; }
@media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }

.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 70px 20px; margin-top: 20px; border: 1px dashed var(--border-strong); border-radius: 0; }
.empty-icon { font-size: 54px; color: var(--border-strong); margin-bottom: 12px; }
.empty-title { font-size: 20px; font-weight: 600; }
.empty-desc { color: var(--text-faint); margin-top: 8px; font-size: 14px; }
.empty-actions { margin-top: 18px; }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 20px; }
.card { border: 1px solid var(--border); border-radius: 0; padding: 16px 18px; background: var(--surface); transition: transform .15s, box-shadow .15s, border-color .15s; }
.card:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(0,0,0,.22); border-color: var(--border-strong); }
.card.run { border-color: rgba(63,185,80,.4); }
.card-top { display: flex; align-items: center; gap: 8px; }
.card-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
.card-dot.online { background: #3fb950; box-shadow: 0 0 0 3px rgba(63,185,80,.2); }
.card-dot.offline { background: var(--border-strong); }
.card-title { font-size: 18px; font-weight: 600; flex: 1; }
.card-sub { color: var(--text-faint); font-size: 12px; margin-top: 4px; }
.card-sub code { font-family: var(--font-mono); }
.card-meta { margin-top: 12px; font-size: 12px; display: flex; flex-direction: column; gap: 5px; border-top: 1px solid var(--border); padding-top: 12px; }
.card-meta > div { display: flex; }
.card-meta span { color: var(--text-faint); width: 56px; flex: 0 0 auto; }
.card-meta code { font-family: var(--font-mono); font-size: 11px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }

.btn-danger-ghost { color: #f85149; background: transparent; border-color: rgba(248,81,73,.4); }
.btn-danger-ghost:hover:not(:disabled) { background: rgba(248,81,73,.12); border-color: #f85149; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal { background: var(--bg); border: 1px solid var(--border); border-radius: 0; width: min(600px, 94vw); padding: 22px; max-height: 88vh; overflow: auto; }
.modal-head { font-size: 17px; font-weight: 600; margin-bottom: 14px; }
.modal-actions { display: flex; gap: 8px; margin-top: 16px; }
.modal-sep { border-top: 1px solid var(--border); margin-top: 16px; padding-top: 14px; }
.sep-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }

.form-row-col { flex-direction: column; align-items: stretch !important; gap: 4px !important; }
.textarea { min-height: 70px; resize: vertical; font-family: var(--font-mono); font-size: 12px !important; }
.inst-status { margin-top: 12px; padding: 8px 12px; border-radius: 0; background: var(--surface); border: 1px solid var(--border); font-size: 12px; display: flex; align-items: center; gap: 8px; }
.inst-status.err { border-color: #f85149; color: #f85149; }
.spin { width: 12px; height: 12px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: dash-spin .8s linear infinite; }
@keyframes dash-spin { to { transform: rotate(360deg); } }
</style>