<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'

const envs = ref({})
const catalog = ref(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')

const activeTab = ref('java')
const search = ref('')

// version select modal
const selType = ref('')
const selVer = ref('')
const selLabel = ref('')
const versionModal = ref(false)

// run console
const runName = ref('')
const runCmd = ref('')
const runOut = ref('')
const runErr = ref('')
const runLoading = ref(false)
const runShow = ref(false)

// installed filter
const onlyInstalled = ref(false)

let pollTimer = null

const TABS = [
  { key: 'java', label: 'Java', icon: 'J', desc: 'JDK / Temurin', color: '#e76f51' },
  { key: 'node', label: 'Node.js', icon: 'N', desc: 'JavaScript 运行时', color: '#3fb950' },
  { key: 'go', label: 'Go', icon: 'G', desc: '编译型静态语言', color: '#58a6ff' },
  { key: 'python', label: 'Python', icon: 'P', desc: '解释型脚本语言', color: '#f0b429' },
  { key: 'php', label: 'PHP', icon: 'Ph', desc: 'Web 脚本语言', color: '#a371f7' },
  { key: 'maven', label: 'Maven', icon: 'M', desc: 'Java 构建工具', color: '#e58ba9' },
  { key: 'cpp', label: 'C/C++', icon: 'C', desc: '系统编译工具链', color: '#8b949e' },
]

const typeMeta = computed(() => TABS.find(t => t.key === activeTab.value) || TABS[0])

const list = computed(() => {
  const rows = catalog.value && catalog.value[activeTab.value]
  if (!rows) return []
  let out = rows
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    out = out.filter(r => (r.label || '').toLowerCase().includes(q) || (r.version || '').toLowerCase().includes(q))
  }
  if (onlyInstalled.value) out = out.filter(r => r.installed)
  return out
})

const installedList = computed(() => Object.values(envs.value))

async function load() {
  loading.value = true; error.value = ''
  try {
    const [e, c] = await Promise.all([api.envList(), api.envCatalog()])
    envs.value = e.envs || {}
    catalog.value = c.catalog || {}
  } catch (err) { error.value = err.message }
  finally { loading.value = false }
}

onMounted(() => {
  load()
  pollTimer = setInterval(() => {
    api.envList().then(e => { envs.value = e.envs || {} }).catch(() => {})
    api.envCatalog().then(c => { if (c.catalog) catalog.value = c.catalog }).catch(() => {})
  }, 5000)
})
onBeforeUnmount(() => { clearInterval(pollTimer) })

function pollEnv() {
  api.envList().then(e => {
    envs.value = e.envs || {}
    const c = e.catalog
    if (c) Object.assign(catalog.value || {}, c)
    if (!catalog.value) load()
  }).catch(() => {})
}

function taskOfName(name) {
  return envs.value[name] || null
}

const runningNames = computed(() => {
  // installed envs already carry fpm_running/status via /envs
  return new Set(Object.keys(envs.value))
})

function selectVersion(r) {
  if (r.installed) return
  selType.value = r.type; selVer.value = r.version; selLabel.value = r.label || r.version
  versionModal.value = true
}

async function doInstall() {
  error.value = ''
  try {
    const res = await api.envInstallRT(selType.value, selVer.value)
    notice.value = `已开始安装 ${selLabel.value}...`
    setTimeout(() => { notice.value = '' }, 5000)
    versionModal.value = false
    load()
  } catch (err) { error.value = err.message }
}

async function uninstall(name) {
  if (!confirm(`确认卸载 ${name}？会删除其安装目录。`)) return
  error.value = ''
  try {
    const r = await api.envUninstall(name)
    notice.value = r.message; setTimeout(() => { notice.value = '' }, 4000)
    load()
  } catch (err) { error.value = err.message }
}

async function start(name) {
  error.value = ''
  try { await api.envStart(name); load() } catch (err) { error.value = err.message }
}
async function stop(name) {
  error.value = ''
  try { await api.envStop(name); load() } catch (err) { error.value = err.message }
}

function openRun(name) {
  runName.value = name; runCmd.value = ''; runOut.value = ''; runErr.value = ''
  runShow.value = true
}
async function doRun() {
  if (!runCmd.value.trim()) { runErr.value = '请输入命令'; return }
  runLoading.value = true; runOut.value = ''; runErr.value = ''
  try {
    const r = await api.envRun(runName.value, runCmd.value, 120)
    runOut.value = r.stdout || ''
    runErr.value = r.stderr || ''
    if (!r.ok && !r.stderr) runErr.value = `退出码 ${r.rc}`
  } catch (err) { runErr.value = err.message }
  finally { runLoading.value = false }
}

function fmtSize(n) {
  if (!n) return '-'
  if (n > 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(1) + ' GB'
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return Math.round(n / 1024) + ' KB'
}

function installedPkg(name) {
  return envs.value[name] && envs.value[name].status === 'installed'
}
</script>

<template>
  <div>
    <div class="head">
      <div>
        <h1>环境包管理</h1>
        <div class="subtitle">自包含运行时：JDK / Node / Go / Python / PHP / Maven / C++ 工具链，供站点、终端、调度任务调用</div>
      </div>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="notice" class="ok" style="margin-top:12px;">{{ notice }}</div>

    <!-- Tabs -->
    <div class="tabs" style="margin-top:20px;">
      <button v-for="t in TABS" :key="t.key" class="tab" :class="{ 'tab--active': activeTab === t.key }"
        @click="activeTab = t.key" :style="activeTab === t.key ? { borderColor: t.color, color: t.color } : {}">
        <span class="tab-icon" :style="{ background: t.color }">{{ t.icon }}</span>
        {{ t.label }}
        <span v-if="catalog && catalog[t.key]" class="tab-count">{{ catalog[t.key].length }}</span>
      </button>
    </div>

    <!-- search + filter -->
    <div class="toolbar" style="margin-top:16px;">
      <input v-model="search" class="input" style="flex:1;" placeholder="搜索版本…" />
      <label class="checkbox"><input type="checkbox" v-model="onlyInstalled" /> 只看已装</label>
      <button class="btn btn-ghost" @click="load" :disabled="loading">{{ loading ? '加载中…' : '刷新' }}</button>
    </div>

    <!-- version grid -->
    <div class="grid" style="margin-top:16px;">
      <div v-for="r in list" :key="r.version" class="card" :class="{ 'card--installed': r.installed }">
        <div class="card-top">
          <span class="tag-chip" :style="{ background: typeMeta.color }">{{ r.version }}</span>
          <span v-if="r.compile" class="tag-chip warn">源码编译</span>
          <span v-if="r.installed" class="tag-chip ok">已安装</span>
        </div>
        <div class="card-title">{{ r.label }}</div>
        <div class="card-meta">{{ r.size_hint }}</div>
        <div class="card-actions">
          <button v-if="r.installed" class="btn btn-sm btn-ghost" disabled>已安装</button>
          <button v-else class="btn btn-sm btn-primary" @click="selectVersion(r)">下载安装</button>
        </div>
      </div>
      <div v-if="!list.length" class="empty-card">暂无{{ typeMeta.label }}版本</div>
    </div>

    <!-- installed section -->
    <div class="section" style="margin-top:24px;">
      <div class="section-title">已安装环境 ({{ installedList.length }})</div>
      <div v-if="!installedList.length" class="hint" style="margin-top:8px;">尚未安装任何环境包</div>
      <div v-else class="grid">
        <div v-for="e in installedList" :key="e.name" class="card card--installed">
          <div class="card-top">
            <span class="tag-chip" :style="{ background: (TABS.find(t => t.key === e.type) || {}).color || '#8b949e' }">{{ e.type }}</span>
            <span class="tag-chip">{{ e.version }}</span>
            <span class="tag-chip" :class="e.exists ? 'ok' : 'fail'">{{ e.exists ? '存在' : '缺失' }}</span>
            <span v-if="e.type === 'php'" class="tag-chip" :class="e.fpm_running ? 'ok' : 'fail'">{{ e.fpm_running ? 'FPM运行' : 'FPM停' }}</span>
          </div>
          <div class="card-title">{{ e.name }}</div>
          <div class="card-meta">{{ e.root }} · {{ fmtSize(e.size) }}</div>
          <div class="card-meta">安装于 {{ new Date(e.installed * 1000).toLocaleString() }}</div>
          <div class="card-actions">
            <button class="btn btn-sm" @click="openRun(e.name)">运行</button>
            <button v-if="e.type === 'php' && !e.fpm_running" class="btn btn-sm" @click="start(e.name)">启动FPM</button>
            <button v-else-if="e.type === 'php'" class="btn btn-sm" @click="stop(e.name)">停止FPM</button>
            <button class="btn btn-sm btn-danger" @click="uninstall(e.name)">卸载</button>
          </div>
        </div>
      </div>
    </div>

    <!-- version confirm modal -->
    <div v-if="versionModal" class="modal-mask">
      <div class="modal">
        <div class="modal-head">下载并安装</div>
        <div style="margin-top:16px;">
          <div class="form-row"><span class="form-label">运行</span><span class="hint">{{ selType }}</span></div>
          <div class="form-row"><span class="form-label">版本</span><span class="name">{{ selLabel }}</span></div>
          <div class="hint" style="margin-top:8px;">将从官方/镜像源下载并安装到系统，安装过程中可离开此页。</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" @click="doInstall">确认安装</button>
          <button class="btn btn-ghost" @click="versionModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- run console -->
    <div v-if="runShow" class="modal-mask">
      <div class="modal">
        <div class="modal-head">环境运行 · {{ runName }}</div>
        <div class="search-bar" style="align-items:stretch;margin-top:14px;">
          <input v-model="runCmd" class="input" style="flex:1;font-family:var(--font-mono);" placeholder="如 java -version / node -v / go version"
            @keyup.enter="doRun" />
          <button class="btn btn-primary" :disabled="runLoading" @click="doRun">{{ runLoading ? '运行中...' : '运行' }}</button>
        </div>
        <div style="margin-top:10px;">
          <textarea class="input" style="width:100%;min-height:160px;font-family:var(--font-mono);font-size:12px;" readonly
            :value="(runOut ? runOut + '\n' : '') + (runErr ? '[err] ' + runErr : '')"></textarea>
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-sm btn-ghost" @click="runShow = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.tab { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--border);
  border-radius: 10px; background: var(--surface); color: var(--text-faint); cursor: pointer; font-size: 13px; transition: all .15s; }
.tab:hover { border-color: var(--border-strong); }
.tab--active { background: var(--surface); font-weight: 600; }
.tab-icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
  border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; }
.tab-count { font-size: 11px; color: var(--text-faint); }

.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.checkbox { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-faint); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px;
  transition: transform .15s, border-color .15s; }
.card:hover { transform: translateY(-2px); border-color: var(--border-strong); }
.card--installed { border-color: #3fb950; }
.card-top { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.card-title { font-size: 15px; font-weight: 600; margin-top: 10px; word-break: break-all; }
.card-meta { font-size: 12px; color: var(--text-faint); margin-top: 4px; }
.card-actions { margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap; }
.empty-card { display: flex; align-items: center; justify-content: center; min-height: 90px;
  border: 1px dashed var(--border-strong); border-radius: 12px; color: var(--text-faint); }

.section { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
.tag-chip.warn { color: #f0b429; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal { background: var(--bg); border: 1px solid var(--border); border-radius: 14px; width: min(420px, 92vw); padding: 22px; max-height: 88vh; overflow: auto; }
.modal-head { font-size: 17px; font-weight: 600; margin-bottom: 14px; }
.modal-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
</style>