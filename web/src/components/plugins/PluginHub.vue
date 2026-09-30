<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import { usePlugins } from '../../stores/plugins'
import { useUi } from '../../stores/ui'
import StoreProject from '../store/StoreProject.vue'

// 「插件」中心: 已装插件管理 + 插件市场 两页签合一
// (原 /store 市场页与设置页里的插件设置在此合并, 设置页只保留外观)
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

function flash(msg, ok = true) {
  status.value = msg
  statusOk.value = ok
  setTimeout(() => { if (status.value === msg) status.value = '' }, 3500)
}

// ============ 市场清单(两页签共用: 已装页签拿它做"有更新"对比) ============
const regPlugins = ref([])
const regSource = ref('')      // github | local
const regHasToken = ref(null)
const regLoading = ref(false)
const regError = ref('')

async function loadRegistry() {
  regLoading.value = true
  regError.value = ''
  try {
    const d = await api.storeRegistry()
    regPlugins.value = d.plugins || []
    regSource.value = d.source || ''
    regHasToken.value = typeof d.has_token === 'boolean' ? d.has_token : null
  } catch (e) {
    regError.value = e.message
    regPlugins.value = []
    regSource.value = ''
    regHasToken.value = null
  } finally {
    regLoading.value = false
  }
}

// ============ 仓库配置(市场页签) ============
const cfg = ref(null)
const showSettings = ref(false)
const tokenInput = ref('')
const pingUser = ref('')

async function loadSettings() {
  try {
    const d = await api.storeSettings()
    cfg.value = d.config || {}
  } catch (e) { /* 配置读不到时下方显示加载提示, 不阻塞页面 */ }
}

async function saveSettings() {
  try {
    // 只提交后端真正接收的字段: machine_label/port/bind 是旧 store.py 遗留,
    // Go 侧既不解析也不回传(2026-09-28 审计定位后已从表单移除)。
    const body = { plugin_repo: cfg.value.plugin_repo, panel_repo: cfg.value.panel_repo }
    if (tokenInput.value) body.github_token = tokenInput.value
    const d = await api.storeSaveSettings(body)
    cfg.value = d.config
    tokenInput.value = ''
    pingUser.value = ''
    flash('配置已保存')
    await loadRegistry()
  } catch (e) {
    flash(`保存失败: ${e.message}`, false)
  }
}

async function ping() {
  // 后端契约 {net:bool, auth:bool}; 旧版读 d.ok/d.user/d.error 恒报"Token 无效"
  try {
    const d = await api.storePing()
    if (d.net === false) {
      pingUser.value = ''
      flash('网络不通: 无法访问 api.github.com', false)
      return
    }
    if (d.auth) {
      pingUser.value = '已授权'
      flash('Token 校验通过 (GitHub 返回 200)')
    } else {
      pingUser.value = ''
      flash('Token 无效或未配置 (GitHub 未授权)', false)
    }
  } catch (e) {
    pingUser.value = ''
    flash(`校验失败: ${e.message}`, false)
  }
}

// ============ 已装页签 ============
const installedQ = ref('')
const installedFilter = ref('all')   // all | online | offline | update
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

const installedCount = computed(() => installed.value.filter((p) => p.name !== 'filemanager').length)

function regVersionOf(name) {
  const r = regPlugins.value.find((x) => x.name === name)
  return r ? r.version || '' : ''
}

const updateCount = computed(() => installed.value.filter((p) => {
  if (p.name === 'filemanager') return false
  const latest = regVersionOf(p.name)
  return !!(latest && p.version && latest !== p.version)
}).length)

const installedView = computed(() => {
  const q = installedQ.value.trim().toLowerCase()
  return installed.value
    .filter((p) => p.name !== 'filemanager')
    .map((p) => {
      const h = health.value[p.name] || {}
      const online = typeof h.online === 'boolean' ? h.online : !!p.alive
      const latest = regVersionOf(p.name)
      const upd = !!(latest && p.version && latest !== p.version)
      return { ...p, online, latency: h.latency_ms, st: h.status || '', latest, upd }
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

async function restartSvc(p) {
  const u = unitFor(p.name)
  if (!u) { flash(`未找到 ${p.name} 的服务单元, 无法重启`, false); return }
  busy.value = p.name
  try {
    await api.sysfServiceAction(u, 'restart')
    flash(`${p.label || p.name}: 已下发重启 (${u})`)
    setTimeout(loadHealth, 1500)
  } catch (e) {
    flash(`重启失败: ${e.message}`, false)
  } finally { busy.value = '' }
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
})

const marketQ = ref('')
const marketFilter = ref('all')   // all | new | update

// 等待一次 store 任务收尾, 并把进度显示在页头进度行
async function watchTask(name, verb) {
  const t0 = Date.now()
  let last = ''
  while (Date.now() - t0 < 120000) {
    await new Promise((r) => setTimeout(r, 1500))
    let list = []
    try {
      const d = await api.taskQueue(true, 40)
      list = d.tasks || []
    } catch (e) { /* 网络抖动: 下一轮再取 */ }
    const t = list.find((x) => x.source === 'store' &&
      `${x.name || ''} ${x.message || ''}`.includes(name))
    if (!t) continue
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
  busy.value = name
  try {
    await api.storePluginInstall(name)
    const ok = await watchTask(name, '安装')
    if (ok) {
      await Promise.all([loadInstalled(), loadRegistry(), loadHealth()])
      tab.value = 'installed'
    }
  } catch (e) {
    flash(e.message, false)
  } finally { busy.value = '' }
}

async function doUpdate(name) {
  busy.value = name
  try {
    await api.storePluginUpdate(name)
    const ok = await watchTask(name, '更新')
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
    await Promise.all([loadInstalled(), loadRegistry(), loadHealth(), loadUnits(), loadSettings()])
    flash('已刷新')
  } finally { refreshing.value = false }
}

onMounted(() => {
  loadInstalled()
  loadRegistry()
  loadSettings()
  loadHealth()
  loadUnits()
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

      <div v-if="status" class="status-line" :class="statusOk ? 'ok' : 'fail'" style="padding:2px 0 10px;">
        {{ status }}
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
              <select v-model="installedFilter" class="select" style="width:108px;">
                <option value="all">全部</option>
                <option value="online">在线</option>
                <option value="offline">离线</option>
                <option value="update">可更新</option>
              </select>
            </div>
          </div>

          <div v-if="!installedView.length" class="hint" style="padding:16px 4px;">
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

              <span v-if="p.upd" class="tag-chip tag-chip-sm"
                    style="border-color:var(--accent);color:var(--accent);">有更新 → {{ p.latest }}</span>

              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-sm" @click="openPlugin(p)">打开</button>
                <button class="btn btn-sm" :disabled="!!busy" @click="restartSvc(p)">
                  {{ busy === p.name ? '处理中…' : '重启服务' }}
                </button>
                <button class="btn btn-sm btn-danger" :disabled="!!busy" @click="uninstall(p)">卸载</button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ============ 页签 2: 插件市场 ============ -->
      <template v-else>
        <div class="section">
          <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>仓库配置</span>
            <button class="btn btn-sm btn-ghost" @click="showSettings = !showSettings">
              {{ showSettings ? '收起' : '展开' }}
            </button>
          </div>
          <template v-if="cfg">
            <div v-if="showSettings" style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;">
              <div>
                <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">插件仓库 owner/repo/branch</div>
                <div style="display:flex;gap:8px;">
                  <input v-model="cfg.plugin_repo.owner" class="input" type="text" placeholder="owner" style="flex:1;" />
                  <input v-model="cfg.plugin_repo.repo" class="input" type="text" placeholder="repo" style="flex:1;" />
                  <input v-model="cfg.plugin_repo.branch" class="input" type="text" placeholder="branch" style="width:90px;" />
                </div>
              </div>
              <div>
                <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">程序仓库 owner/repo/branch</div>
                <div style="display:flex;gap:8px;">
                  <input v-model="cfg.panel_repo.owner" class="input" type="text" placeholder="owner" style="flex:1;" />
                  <input v-model="cfg.panel_repo.repo" class="input" type="text" placeholder="repo" style="flex:1;" />
                  <input v-model="cfg.panel_repo.branch" class="input" type="text" placeholder="branch" style="width:90px;" />
                </div>
              </div>
              <div>
                <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">
                  GitHub Token {{ cfg.has_token ? '(已配置, 留空则不修改)' : '(未配置)' }}
                </div>
                <div style="display:flex;gap:8px;">
                  <input v-model="tokenInput" class="input" type="password" placeholder="ghp_xxx 个人访问令牌" style="flex:1;" />
                  <button class="btn btn-sm" @click="ping">校验</button>
                </div>
                <div v-if="pingUser" style="font-size:12px;color:var(--success);margin-top:4px;">{{ pingUser }}</div>
              </div>
              <div style="display:flex;align-items:flex-end;gap:8px;">
                <button class="btn btn-primary" @click="saveSettings">保存配置</button>
              </div>
            </div>
            <div v-else style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
              <span>插件仓:
                <b style="color:var(--text);font-family:var(--font-mono);">
                  {{ cfg.plugin_repo.owner }}/{{ cfg.plugin_repo.repo }}
                </b>
              </span>
              <span>Token:
                <b :style="{ color: cfg.has_token ? 'var(--success)' : 'var(--danger)' }">
                  {{ cfg.has_token ? '已配置' : '未配置' }}
                </b>
              </span>
            </div>
          </template>
          <div v-else class="hint" style="padding:12px;">加载配置中...</div>
        </div>

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

          <div v-if="regSource === 'local' && !regError" class="error"
               style="padding:10px 12px;text-align:left;color:var(--danger);border:1px solid var(--danger);border-radius:6px;margin-bottom:10px;">
            远程仓库清单不可用，已回退为本机已安装插件列表 —— 此列表不会出现可安装的新插件。
            {{ regHasToken ? 'Token 已配置，可能是仓库名/分支不符或该 Token 无权访问。' : '未配置 GitHub Token，私有仓库的 registry.json 读不到：请在上方展开配置并校验 Token 后刷新。' }}
          </div>
          <div v-if="regError" class="error" style="padding:12px;">{{ regError }}</div>
          <div v-else-if="regLoading && !regPlugins.length" class="hint" style="padding:16px;">加载中...</div>
          <div v-else-if="!marketView.length" class="hint" style="padding:16px;">
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
                  <button class="btn btn-sm" :disabled="!!busy" @click="doUpdate(p.name)">
                    {{ busy === p.name ? '更新中…' : '更新' }}
                  </button>
                  <button class="btn btn-sm" @click="tab = 'installed'; installedQ = p.name">管理</button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 面板更新(自设置页迁入: 属"获取与更新"语义) -->
        <div class="section">
          <div class="section-title">面板更新</div>
          <StoreProject />
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
