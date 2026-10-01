<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api'
import { verNewer } from '../../version'
import { useExtensions } from '../../stores/extensions'

// 「系统扩展」: 面板内置 7 项之外的功能, 以扩展包存于**主面板库** extensions/ 目录,
// 面板主体安装时不含扩展 —— 这一页只做两件事:
//   ① 从主面板库拉取可用扩展并安装(后端 ExtStore.Install: 先本地源, 再走主面板库 contents API)
//   ② 已装扩展可打开/更新/卸载(卸载即删除扩展目录)
// 内置 7 项(工作台/文件管理/终端/系统扩展/插件/设置/开发文档)编译在面板主体里, 不可卸载,
// 因此不在这里列出(侧边栏就是它们的入口)。
const route = useRoute()
const router = useRouter()
const { extensions, load: loadInstalled } = useExtensions()

const registry = ref([])
const regSource = ref('')     // github | local | ''
const regLoading = ref(false)
const regError = ref('')
const backends = ref({})      // 扩展名 -> 后端状态(仅声明了 backend 的扩展有)
const notice = ref('')
const noticeOk = ref(true)
const busy = ref('')
const progress = ref('')
const refreshing = ref(false)

const progressPct = computed(() => {
  const m = /(\d+)%/.exec(progress.value || '')
  return m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : 0
})
const regMap = computed(() => {
  const m = {}
  for (const x of registry.value) m[x.name] = x
  return m
})
// 可安装 = 主面板库里还没装的(已装的在本页「已装扩展」区, 不重复列)
const installable = computed(() => registry.value.filter((x) => !x.installed))

function regVerOf(name) {
  const r = regMap.value[name]
  return r ? (r.version || '') : ''
}
function updOf(ext) {
  return verNewer(regVerOf(ext.name), ext.version)
}
function flash(msg, ok = true) {
  notice.value = msg
  noticeOk.value = ok
  if (ok) setTimeout(() => { if (notice.value === msg) notice.value = '' }, 4000)
}

async function loadRegistry() {
  regLoading.value = true
  regError.value = ''
  try {
    const d = await api.extRegistry()
    registry.value = d.extensions || []
    regSource.value = d.source || ''
    if (d.error) regError.value = d.error
  } catch (e) {
    regError.value = e.message
    registry.value = []
    regSource.value = ''
  } finally {
    regLoading.value = false
  }
}

async function refresh() {
  refreshing.value = true
  try {
    await Promise.all([loadInstalled(), loadRegistry(), loadBackends()])
  } finally {
    refreshing.value = false
  }
}

// 扩展自带后端: 状态只对声明了 backend 的扩展查(纯前端扩展不查)
async function loadBackends() {
  const any = extensions.value.some((x) => x.backend)
  if (!any) { backends.value = {}; return }
  try {
    const d = await api.extBackend()
    backends.value = d.backends || {}
  } catch (e) { backends.value = {} }
}
function bstate(name) { return backends.value[name] || {} }
function backendText(x) {
  const st = bstate(x.name)
  const run = st.active ? '运行中' : (st.unit_file ? '已停止' : '未启动')
  return ((x.backend && x.backend.exec) || []).join(' ') + ' · ' + run
}
async function restartBackend(x) {
  busy.value = x.name
  try {
    await api.extBackendRestart(x.name)
    flash(`已重启 ${x.label || x.name} 的后端`)
    await loadBackends()
  } catch (e) {
    flash('重启后端失败: ' + e.message, false)
  } finally { busy.value = '' }
}

async function storeTaskIds() {
  try {
    const d = await api.taskQueue(true, 40)
    const s = new Set()
    for (const t of (d.tasks || [])) if (t.source === 'ext') s.add(t.id)
    return s
  } catch (e) { return new Set() }
}

// 只跟踪新出现的 ext 任务: 队列里残留的旧记录会造成假完成(见任务队列审计)
async function watchTask(name, verb, before) {
  const t0 = Date.now()
  let last = ''
  let miss = 0
  while (Date.now() - t0 < 120000) {
    await new Promise((r) => setTimeout(r, 1500))
    let list = []
    try {
      const d = await api.taskQueue(true, 40)
      list = d.tasks || []
    } catch (e) { /* 下一轮再取 */ }
    const t = list.find((x) => x.source === 'ext' && !before.has(x.id) &&
      `${x.name || ''} ${x.message || ''}`.includes(name))
    if (!t) {
      if (++miss >= 8) { progress.value = ''; flash(`${verb}已提交, 到本页安装「任务队列」扩展后可查看进度`, false); return false }
      continue
    }
    miss = 0
    if (t.status === 'done') { progress.value = ''; flash(`${verb}完成: ${t.message || name}`); return true }
    if (t.status === 'failed') { progress.value = ''; flash(`${verb}失败: ${t.error || t.message || '未知错误'}`, false); return false }
    const line = `${verb}中 ${t.progress || 0}%${t.phase ? ' · ' + t.phase : ''}`
    if (line !== last) { last = line; progress.value = line }
  }
  progress.value = ''
  flash(`${verb}仍在后台进行, 到「任务队列」扩展查看进度(没装就在本页安装)`, false)
  return false
}

async function doInstall(ext, verb) {
  const name = ext.name
  const before = await storeTaskIds()
  busy.value = name
  try {
    if (verb === '更新') await api.extUpdate(name)
    else await api.extInstall(name)
    const ok = await watchTask(name, verb, before)
    if (ok) {
      await Promise.all([loadInstalled(), loadRegistry(), loadBackends()])
      if (verb !== '更新') flash(`已安装 ${ext.label || name}, 可在侧边栏或本页打开`)
    }
  } catch (e) {
    flash(e.message, false)
  } finally { busy.value = '' }
}

async function doRemove(ext) {
  const name = ext.name
  if (!confirm(`确定卸载扩展 ${ext.label || name}？扩展目录将被删除。`)) return
  busy.value = name
  try {
    await api.extRemove(name)
    flash(`已卸载 ${ext.label || name}`)
    await Promise.all([loadInstalled(), loadRegistry(), loadBackends()])
    // 正在看这个扩展的页面时, 卸载后退回本页
    if (route.name === 'ext-view' && String(route.params.name) === name) router.push('/ext')
  } catch (e) {
    flash(`卸载失败: ${e.message}`, false)
  } finally { busy.value = '' }
}

function open(ext) {
  router.push(ext.route || ('/ext/' + ext.name))
}

onMounted(refresh)
</script>

<template>
  <div class="page">
    <div class="page-body">
      <div class="ext-bar">
        <button class="btn btn-sm" :disabled="refreshing" @click="refresh">
          {{ refreshing ? '刷新中…' : '刷新' }}
        </button>
      </div>

      <div v-if="notice" class="ext-line" :class="noticeOk ? 'ok' : 'fail'">{{ notice }}</div>
      <div v-if="progress" class="progress" style="margin-bottom:6px;">
        <div :style="{ width: progressPct + '%' }"></div>
      </div>
      <div v-if="progress" class="hint" style="margin:-2px 0 10px;">{{ progress }}</div>

      <!-- 已装扩展: 打开 / 更新 / 卸载 -->
      <div class="section">
        <div class="section-title">已装扩展 ({{ extensions.length }})</div>
        <div v-if="!extensions.length" class="hint ext-empty">还没有安装扩展</div>
        <div v-for="x in extensions" :key="x.name" class="ext-row">
          <div class="ext-row-main">
            <div class="ext-name">
              {{ x.label || x.name }}
              <span class="ext-mono">{{ x.name }}</span>
            </div>
            <div class="ext-desc">
              版本 {{ x.version || '-' }}
              <span v-if="x.author" class="ext-author">作者: {{ x.author }}</span>
              <span v-if="!x.has_assets" class="ext-bad">产物缺失</span>
            </div>
            <div v-if="x.description" class="ext-desc">{{ x.description }}</div>
            <div v-if="x.backend" class="ext-desc">后端: {{ backendText(x) }}</div>
            <div v-if="x.interfaces && x.interfaces.length" class="ext-desc">
              提供的接口: {{ x.interfaces.map((i) => i.id).join(' / ') }}
            </div>
          </div>
          <span v-if="updOf(x)" class="tag-chip tag-chip-sm"
                style="border-color:var(--accent);color:var(--accent);">有更新 → {{ regVerOf(x.name) }}</span>
          <div class="ext-acts">
            <button class="btn btn-sm" @click="open(x)">打开</button>
            <button v-if="updOf(x)" class="btn btn-sm" :disabled="!!busy" @click="doInstall(x, '更新')">
              {{ busy === x.name ? '更新中…' : '更新' }}
            </button>
            <button v-if="x.backend" class="btn btn-sm" :disabled="!!busy" @click="restartBackend(x)">重启后端</button>
            <button class="btn btn-sm btn-danger" :disabled="!!busy" @click="doRemove(x)">卸载</button>
          </div>
        </div>
      </div>

      <!-- 可安装的扩展: 来自主面板库 extensions/ -->
      <div class="section">
        <div class="section-title">可安装的扩展 ({{ installable.length }})</div>
        <div v-if="regError || regSource === 'local'" class="ext-err">仓库不可用</div>
        <div v-else-if="regLoading && !registry.length" class="hint ext-empty">加载中...</div>
        <div v-else-if="!installable.length" class="hint ext-empty">没有可安装的扩展</div>
        <div v-for="x in installable" :key="x.name" class="ext-row">
          <div class="ext-row-main">
            <div class="ext-name">
              {{ x.label || x.name }}
              <span class="ext-mono">{{ x.name }}</span>
            </div>
            <div class="ext-desc">
              版本 {{ x.version || '-' }}
              <span v-if="x.author" class="ext-author">作者: {{ x.author }}</span>
            </div>
            <div v-if="x.description" class="ext-desc">{{ x.description }}</div>
          </div>
          <div class="ext-acts">
            <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="doInstall(x, '安装')">
              {{ busy === x.name ? '安装中…' : '安装' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ext-bar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.ext-line { font-size: 13px; padding: 6px 0 10px; }
.ext-line.ok { color: var(--success); }
.ext-line.fail { color: var(--danger); }
.ext-err {
  padding: 10px 12px; text-align: center; color: var(--danger);
  border: 1px solid var(--danger); border-radius: var(--radius-sm); margin-bottom: 10px;
}
.ext-empty { padding: 14px 2px; }
.ext-row {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 12px 14px; margin-bottom: 10px; background: var(--surface);
}
.ext-row-main { flex: 1; min-width: 220px; }
.ext-name { font-size: 15px; font-weight: 600; }
.ext-mono { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); margin-left: 6px; }
.ext-desc { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.ext-author { margin-left: 10px; }
.ext-bad { margin-left: 10px; color: var(--danger); }
.ext-acts { display: flex; gap: 6px; flex-wrap: wrap; }
</style>
