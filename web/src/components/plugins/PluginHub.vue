<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import { usePlugins } from '../../stores/plugins'
import { useUi } from '../../stores/ui'

// 「插件」中心: 已装插件管理 + 插件市场 两页签合一
// (仓库配置与面板更新在「设置」页; 旧 /store 市场页重定向到这里)
const router = useRouter()
const { plugins: installed, load: loadInstalled } = usePlugins()
const { installOpen } = useUi()

const tab = ref('installed')
const status = ref('')
const statusOk = ref(false)
const busy = ref('')        // 正在操作的插件名(安装/更新/卸载/重启)
const progress = ref('')    // 安装/更新实时进度文案
// 进度文案形如 "安装中 45% · 解压", 抽出其中的百分比给进度条
const progressPct = computed(() => {
  const m = /(\d+)%/.exec(progress.value || '')
  return m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : 0
})
const refreshing = ref(false)

// 成功提示 3.5 秒自动消失; 失败提示保留到下一次操作或手动关闭(错误要来得及看)
function flash(msg, ok = true) {
  status.value = msg
  statusOk.value = ok
  if (ok) setTimeout(() => { if (status.value === msg) status.value = '' }, 3500)
}
function clearStatus() { status.value = ''; statusOk.value = true }

// ============ 市场清单(两页签共用: 已装页签拿它做"有更新"对比) ============
const regPlugins = ref([])
const regSource = ref('')      // github | local
const regLoading = ref(false)
const regError = ref('')

async function loadRegistry() {
  regLoading.value = true
  regError.value = ''
  try {
    const d = await api.storeRegistry()
    regPlugins.value = d.plugins || []
    regSource.value = d.source || ''
  } catch (e) {
    regError.value = e.message
    regPlugins.value = []
    regSource.value = ''
  } finally {
    regLoading.value = false
  }
}

// 仓库配置与面板更新在「设置」页; 本页只消费清单, 清单不可用时只提示"仓库不可用"。

// ============ 已装页签 ============
const installedQ = ref('')
const installedFilter = ref('all')   // all | online | offline | update
const installedLoading = ref(false)
const health = ref({})               // 插件名 -> /api/services/health 的 provider 项
const svcUnits = ref([])             // systemd 服务列表(找插件对应单元)

async function loadHealth() {
  try {
    const d = await api.servicesHealth()
    const map = {}
    for (const p of (d.providers || [])) map[p.name] = p
    health.value = map
  } catch (e) { health.value = {} }
}

async function loadUnits() {
  try {
    const d = await api.sysfServiceList()
    svcUnits.value = d.services || d.units || []
  } catch (e) { svcUnits.value = [] }
}

// 插件的 systemd 单元名没有统一约定, 按候选逐个匹配;
// 找不到时相关按钮给出明确提示而不是静默失败。
function unitFor(name) {
  const cands = [`plugin-${name}.service`, `${name}.service`, `plugin-${name}`]
  for (const u of svcUnits.value) {
    const n = u.unit || u.name || ''
    if (cands.includes(n)) return n
  }
  return ''
}

// 筛选下拉的计数(基于全量, 不受搜索词与当前筛选影响)
const installedStats = computed(() => {
  const r = { all: 0, online: 0, offline: 0, update: 0 }
  for (const p of installed.value) {
    r.all++
    const h = health.value[p.name] || {}
    const on = typeof h.online === 'boolean' ? h.online : !!p.alive
    if (on) r.online++; else r.offline++
    const latest = regVersionOf(p.name)
    if (latest && p.version && latest !== p.version) r.update++
  }
  return r
})
const installedCount = computed(() => installedStats.value.all)

function regVersionOf(name) {
  const r = regPlugins.value.find((x) => x.name === name)
  return r ? r.version || '' : ''
}

// 与筛选下拉的"可更新"计数保持同一个口径(全部已装插件, 含内置)
const updateCount = computed(() => installedStats.value.update)

const installedView = computed(() => {
  const q = installedQ.value.trim().toLowerCase()
  return installed.value
    .map((p) => {
      const h = health.value[p.name] || {}
      const online = typeof h.online === 'boolean' ? h.online : !!p.alive
      const latest = regVersionOf(p.name)
      const upd = !!(latest && p.version && latest !== p.version)
      return { ...p, online, latency: h.latency_ms, st: h.status || '', latest, upd, builtIn: p.name === 'filemanager' }
    })
    .filter((p) => {
      if (installedFilter.value === 'online') return p.online
      if (installedFilter.value === 'offline') return !p.online
      if (installedFilter.value === 'update') return p.upd
      return true
    })
    .filter((p) => !q || `${p.label || ''} ${p.name} ${p.description || ''}`.toLowerCase().includes(q))
    .sort((a, b) => (b.upd ? 1 : 0) - (a.upd ? 1 : 0) || String(a.name).localeCompare(String(b.name)))
})

function openPlugin(p) { router.push('/plugin/' + p.name) }

// 离线给[启动服务], 在线给[重启服务]; 下发后轮询健康直到上线(最多 3 轮×1.5s),
// 不再只查一次就把没起来的服务报成"离线"。
async function restartSvc(p) {
  const u = unitFor(p.name)
  if (!u) { flash(`未找到 ${p.name} 的服务单元, 无法操作`, false); return }
  const act = p.online ? 'restart' : 'start'
  const verb = p.online ? '重启' : '启动'
  busy.value = p.name
  try {
    await api.sysfServiceAction(u, act)
    flash(`${p.label || p.name}: 已下发${verb} (${u})`)
  } catch (e) {
    busy.value = ''
    flash(`${verb}失败: ${e.message}`, false)
    return
  }
  busy.value = ''
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    await loadHealth()
    if (health.value[p.name] && health.value[p.name].online) {
      flash(`${p.label || p.name}: 已在线`)
      return
    }
  }
  flash(`${p.label || p.name}: 已下发${verb}, 服务仍未在线`, false)
}

// 卸载: 二次确认 -> 停服务(尽力) -> 删目录 -> 刷新两个页签的数据
async function uninstall(p) {
  if (p.name === 'filemanager') { flash('内置插件不可卸载', false); return }
  if (!confirm(`确定卸载插件 ${p.label || p.name} (${p.name})？插件目录将被删除。`)) return
  busy.value = p.name
  try {
    const u = unitFor(p.name)
    if (u) { try { await api.sysfServiceAction(u, 'stop') } catch (e) { /* 服务本就未运行 */ } }
    await api.storePluginRemove(p.name)
    flash(`已卸载 ${p.label || p.name}`)
    await Promise.all([loadInstalled(), loadRegistry(), loadHealth()])
  } catch (e) {
    flash(`卸载失败: ${e.message}`, false)
  } finally { busy.value = '' }
}

// ---- 插件配置说明 ----
// 没有通用的插件设置接口: api.js 与后端都不存在 pluginSettingsGet/Save,
// 原设置页的插件设置区实际从未加载过。各插件自己的设置在插件页内
// (如 AI 生图的设置页签、走 <name>.config.get/save 接口), 故本页只给[打开]。

// ============ 安装 / 更新(市场页签) ============
// 该插件是否有可用更新: 版本都拿得到且不同才亮徽标。
// 本机回退清单里 version 就来自本地 plugin.json, 与已装版本恒相等, 不会误报。
function canUpdate(p) {
  return !!(p.installed && p.installed_version && p.version &&
    p.installed_version !== p.version)
}

const marketView = computed(() => {
  const q = marketQ.value.trim().toLowerCase()
  return regPlugins.value
    .filter((p) => {
      if (marketFilter.value === 'new') return !p.installed
      if (marketFilter.value === 'update') return canUpdate(p)
      return true
    })
    .filter((p) => !q || `${p.label || ''} ${p.name} ${p.description || ''} ${p.author || ''}`.toLowerCase().includes(q))
    // 与已装页签一致的优先级: 可更新 → 未安装 → 已装, 同组按名称
    .sort((a, b) => (canUpdate(b) ? 1 : 0) - (canUpdate(a) ? 1 : 0)
      || (a.installed ? 1 : 0) - (b.installed ? 1 : 0)
      || String(a.name).localeCompare(String(b.name)))
})

const marketQ = ref('')
const marketFilter = ref('all')   // all | new | update

// 开工前先记下已存在的 store 任务 id, 之后只认新出现的任务:
// 否则队列里残留的上次同名记录(已 done/failed)会被立刻命中, 造成假完成或假失败。
async function storeTaskIds() {
  try {
    const d = await api.taskQueue(true, 40)
    const s = new Set()
    for (const x of (d.tasks || [])) if (x.source === 'store') s.add(x.id)
    return s
  } catch (e) { return new Set() }
}

// 等待一次新出现的 store 任务收尾, 并把进度显示在页头进度行
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
    } catch (e) { /* 网络抖动: 下一轮再取 */ }
    const t = list.find((x) => x.source === 'store' && !before.has(x.id) &&
      `${x.name || ''} ${x.message || ''}`.includes(name))
    if (!t) {
      // 后端提交后应立即建任务; 超过 12 秒仍没等到就不空转, 让用户去任务队列看
      if (++miss >= 8) { progress.value = ''; flash(`${verb}已提交, 进度见任务队列`, false); return false }
      continue
    }
    miss = 0
    if (t.status === 'done') {
      progress.value = ''
      flash(`${verb}完成: ${t.message || name}`)
      return true
    }
    if (t.status === 'failed') {
      progress.value = ''
      flash(`${verb}失败: ${t.error || t.message || '未知错误'}`, false)
      return false
    }
    const line = `${verb}中 ${t.progress || 0}%${t.phase ? ' · ' + t.phase : ''}`
    if (line !== last) { last = line; progress.value = line }
  }
  progress.value = ''
  flash(`${verb}仍在后台进行, 任务队列可查看进度`, false)
  return false
}

async function doInstall(name) {
  const before = await storeTaskIds()
  busy.value = name
  try {
    await api.storePluginInstall(name)
    const ok = await watchTask(name, '安装', before)
    if (ok) {
      await Promise.all([loadInstalled(), loadRegistry(), loadHealth()])
      // 留在市场页签, 方便连续安装; 行内按钮会就地变成[更新], 状态行给出入口
      flash(`已安装 ${name}, 到「已装插件」页签可打开或重启它`)
    }
  } catch (e) {
    flash(e.message, false)
  } finally { busy.value = '' }
}

async function doUpdate(name) {
  const before = await storeTaskIds()
  busy.value = name
  try {
    await api.storePluginUpdate(name)
    const ok = await watchTask(name, '更新', before)
    if (ok) await Promise.all([loadInstalled(), loadRegistry(), loadHealth()])
  } catch (e) {
    flash(e.message, false)
  } finally { busy.value = '' }
}

const repoLabel = computed(() => {
  if (regSource.value === 'github') return 'GitHub 清单'
  if (regSource.value === 'local') return '本机回退'
  return '…'
})

async function refreshAll() {
  refreshing.value = true
  try {
    await Promise.all([loadInstalled(), loadRegistry(), loadHealth(), loadUnits()])
    flash('已刷新')
  } finally { refreshing.value = false }
}

// 在线/离线要保持新鲜: 回到前台立即查一次, 页面停留期间每 60s 静默刷新一次(不弹"已刷新")
let healthTimer = 0
function onVisChange() {
  if (!document.hidden) loadHealth()
}

onMounted(() => {
  installedLoading.value = true
  Promise.all([loadInstalled(), loadRegistry(), loadHealth(), loadUnits()])
    .finally(() => { installedLoading.value = false })
  healthTimer = window.setInterval(() => { if (!document.hidden) loadHealth() }, 60000)
  document.addEventListener('visibilitychange', onVisChange)
})
onBeforeUnmount(() => {
  if (healthTimer) window.clearInterval(healthTimer)
  document.removeEventListener('visibilitychange', onVisChange)
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>插件</h1>
      <div class="subtitle">
        已装 {{ installedCount }} · 可更新 {{ updateCount }} · 仓库 {{ repoLabel }}
      </div>
    </div>

    <div class="page-body">
      <div class="hub-bar">
        <div class="hub-tabs">
          <button class="hub-tab" :class="{ active: tab === 'installed' }" @click="tab = 'installed'">
            已装插件
          </button>
          <button class="hub-tab" :class="{ active: tab === 'market' }" @click="tab = 'market'">
            插件市场
          </button>
        </div>
        <div class="hub-actions">
          <button class="btn btn-sm" :disabled="refreshing" @click="refreshAll">
            {{ refreshing ? '刷新中…' : '刷新' }}
          </button>
          <button class="btn btn-sm btn-primary" @click="installOpen = true">安装本地包</button>
        </div>
      </div>

      <div v-if="status" class="status-line" :class="statusOk ? 'ok' : 'fail'"
           style="padding:2px 0 10px;display:flex;align-items:center;gap:10px;">
        <span>{{ status }}</span>
        <button v-if="!statusOk" class="btn btn-sm" style="margin-left:auto;" @click="clearStatus">关闭</button>
      </div>
      <div v-if="progress" class="progress" style="margin-bottom:10px;">
        <div :style="{ width: progressPct + '%' }"></div>
      </div>
      <div v-if="progress" class="hint" style="margin:-6px 0 10px;">{{ progress }}</div>

      <!-- ============ 页签 1: 已装插件 ============ -->
      <template v-if="tab === 'installed'">
        <div class="section">
          <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <span>已装插件 ({{ installedView.length }})</span>
            <div style="display:flex;gap:8px;align-items:center;">
              <input v-model="installedQ" class="input" placeholder="搜索名称 / 描述…" style="width:190px;" />
              <select v-model="installedFilter" class="select" style="width:132px;">
                <option value="all">全部 ({{ installedStats.all }})</option>
                <option value="online">在线 ({{ installedStats.online }})</option>
                <option value="offline">离线 ({{ installedStats.offline }})</option>
                <option value="update">可更新 ({{ installedStats.update }})</option>
              </select>
            </div>
          </div>

          <div v-if="installedLoading" class="hint" style="padding:16px 4px;">加载中...</div>
          <div v-else-if="!installedView.length" class="hint" style="padding:16px 4px;">
            {{ installedFilter === 'update' ? '没有可更新的插件' : (installedQ ? '没有匹配的插件' : '还没有安装插件, 到「插件市场」页签安装') }}
          </div>

          <div v-for="p in installedView" :key="p.name" class="result-item hub-item">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:220px;">
                <div class="name">
                  {{ p.label || p.name }}
                  <span class="hub-mono">{{ p.name }}</span>
                </div>
                <div class="meta">
                  版本 {{ p.version || '-' }}
                  <span style="margin-left:10px;">后端 {{ p.lang || '-' }}</span>
                  <span style="margin-left:10px;">
                    状态
                    <b :style="{ color: p.online ? 'var(--success)' : 'var(--danger)' }">{{ p.online ? '在线' : '离线' }}</b>
                  </span>
                  <span v-if="p.online && p.latency != null" style="margin-left:10px;">{{ p.latency }}ms</span>
                </div>
                <div v-if="p.description" class="note">{{ p.description }}</div>
              </div>

              <span v-if="p.builtIn" class="tag-chip" style="opacity:.75;">内置</span>
              <span v-if="p.upd" class="tag-chip tag-chip-sm"
                    style="border-color:var(--accent);color:var(--accent);">有更新 → {{ p.latest }}</span>

              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-sm" @click="openPlugin(p)">打开</button>
                <button class="btn btn-sm" :disabled="!!busy" @click="restartSvc(p)">
                  {{ busy === p.name ? '处理中…' : (p.online ? '重启服务' : '启动服务') }}
                </button>
                <button class="btn btn-sm btn-danger" :disabled="!!busy || p.builtIn"
                        :title="p.builtIn ? '内置插件不可卸载' : ''"
                        @click="uninstall(p)">卸载</button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ============ 页签 2: 插件市场 ============ -->
      <template v-else>
        <div class="section">
          <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <span>插件清单 ({{ marketView.length }})</span>
            <div style="display:flex;gap:8px;align-items:center;">
              <input v-model="marketQ" class="input" placeholder="搜索名称 / 作者…" style="width:190px;" />
              <select v-model="marketFilter" class="select" style="width:108px;">
                <option value="all">全部</option>
                <option value="new">未安装</option>
                <option value="update">可更新</option>
              </select>
              <button class="btn btn-sm" :disabled="regLoading" @click="loadRegistry">
                {{ regLoading ? '刷新中…' : '刷新' }}
              </button>
            </div>
          </div>

          <!-- 仓库不可用: 未配置 / 远程清单读不到 / 请求出错, 一律只给这一句 -->
          <div v-if="regSource === 'local' || regError" class="error"
               style="padding:10px 12px;text-align:center;color:var(--danger);border:1px solid var(--danger);border-radius:6px;margin-bottom:10px;">
            仓库不可用
          </div>
          <div v-if="regLoading && !regPlugins.length" class="hint" style="padding:16px;">加载中...</div>
          <div v-else-if="!marketView.length && !regError" class="hint" style="padding:16px;">
            {{ regSource === 'local' ? '本机暂无可安装的新插件' : '没有匹配的插件' }}
          </div>
          <div v-else v-for="p in marketView" :key="p.name" class="result-item hub-item">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:220px;">
                <div class="name">
                  {{ p.label || p.name }}
                  <span class="hub-mono">{{ p.name }}</span>
                </div>
                <div class="meta">
                  版本 {{ p.version || '-' }}
                  <span v-if="p.author" style="margin-left:10px;">作者: {{ p.author }}</span>
                </div>
                <div v-if="p.description" class="note">{{ p.description }}</div>
              </div>
              <span v-if="p.installed" class="tag-chip">
                {{ p.installed_version ? `已装 ${p.installed_version}` : '已装' }}
              </span>
              <span v-if="canUpdate(p)" class="tag-chip tag-chip-sm"
                    style="border-color:var(--accent);color:var(--accent);">有更新 → {{ p.version }}</span>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <template v-if="!p.installed">
                  <button class="btn btn-primary btn-sm" :disabled="!!busy" @click="doInstall(p.name)">
                    {{ busy === p.name ? '安装中…' : '安装' }}
                  </button>
                </template>
                <template v-else>
                  <!-- 版本相同时不冒充升级: 只有真有新版才给可点的[更新] -->
                  <button v-if="canUpdate(p)" class="btn btn-sm" :disabled="!!busy" @click="doUpdate(p.name)">
                    {{ busy === p.name ? '更新中…' : '更新' }}
                  </button>
                  <button v-else class="btn btn-sm" disabled style="opacity:.6;cursor:default;"
                          title="版本已是最新, 如需修复可先卸载再安装">已是最新</button>
                  <button class="btn btn-sm" @click="tab = 'installed'; installedQ = p.name">管理</button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hub-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.hub-tabs { display: flex; gap: 4px; }
.hub-tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  padding: 7px 16px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: color var(--transition), background var(--transition), border-color var(--transition);
}
.hub-tab:hover { color: var(--text); background: var(--surface-2); }
.hub-tab.active {
  color: var(--accent-hover);
  background: var(--accent-soft);
  border-color: var(--accent);
}
.hub-actions { display: flex; gap: 8px; }
.hub-item { margin-bottom: 10px; }
.hub-mono {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
  margin-left: 6px;
}
.hub-cfg {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
@media (max-width: 960px) {
  .hub-bar { flex-direction: column; align-items: stretch; }
  .hub-actions { justify-content: flex-end; }
}
</style>
