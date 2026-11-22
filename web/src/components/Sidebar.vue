<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlugins } from '../stores/plugins'
import { useAuth } from '../stores/auth'
import { useUi } from '../stores/ui'
import PanelUpdate from './panel/PanelUpdate.vue'
import { api } from '../api'

const route = useRoute()
const router = useRouter()
const { plugins, load } = usePlugins()
const auth = useAuth()
const ui = useUi()
// 收起侧栏：隐藏后内容区右下角的球能把它叫回来
function hideSidebar() { ui.setSidebarHidden(true) }

// 版本号从 /api/panel/version 读，不再写死。
// 写死时升版本要改四处(VERSION / config.go / package.json / 这里)，漏一处就显示旧号。
const appVer = ref('')
const ifaces = ref([])
const taskItems = ref([])
const notices = ref([])
const noticeOpen = ref(false)
let noticeTimer = null

const unread = computed(() => notices.value.filter((n) => !n.read).length)

async function loadSearchIndex() {
  try {
    const d = await api.interfaces({ page: 1, page_size: 500 })
    ifaces.value = (d && d.items) || []
  } catch (e) { /* 搜索索引失败不影响导航 */ }
  try {
    const d = await api.taskQueue(false, 20)
    taskItems.value = (d && d.tasks) || []
  } catch (e) { /* 搜索索引失败不影响导航 */ }
}

async function loadNotices() {
  let seen = new Set()
  try { seen = new Set(JSON.parse(localStorage.getItem('rc-notice-read') || '[]')) } catch (e) {}
  const out = []
  try {
    const h = await api.servicesHealth()
    for (const p of (h && h.providers) || []) {
      if (p.online) continue
      out.push({ key: 'svc:' + p.name, kind: '插件离线', title: (p.label || p.name) + ' 离线', body: '版本 ' + (p.version || '—'), path: '/health', time: h.checked_at })
    }
  } catch (e) {}
  try {
    const d = await api.interfaces({ status: 'offline', page: 1, page_size: 100 })
    for (const it of (d && d.items) || []) {
      out.push({ key: 'iface:' + it.id, kind: '接口异常', title: it.id + ' 离线', body: '插件 ' + it.plugin, path: '/interfaces?plugin=' + encodeURIComponent(it.plugin), time: it.last_call_at })
    }
  } catch (e) {}
  try {
    const d = await api.taskQueue(false, 50)
    for (const t of (d && d.tasks) || []) {
      if (t.status !== 'failed' && t.status !== 'error') continue
      out.push({ key: 'task:' + t.id, kind: '任务失败', title: t.name || t.title || t.id, body: t.error || '任务执行失败', path: '/tasks', time: t.updated || t.created })
    }
  } catch (e) {}
  notices.value = out.map((n) => ({ ...n, read: seen.has(n.key) }))
}

function markRead(n) {
  n.read = true
  const seen = new Set(notices.value.filter((x) => x.read).map((x) => x.key))
  try { localStorage.setItem('rc-notice-read', JSON.stringify([...seen])) } catch (e) {}
}

function markAllRead() {
  notices.value.forEach((n) => { n.read = true })
  try { localStorage.setItem('rc-notice-read', JSON.stringify(notices.value.map((n) => n.key))) } catch (e) {}
}

function clearNotices() {
  notices.value = []
  noticeOpen.value = false
}

function openNotice(n) {
  markRead(n)
  noticeOpen.value = false
  if (n.path) router.push(n.path)
}

onMounted(() => {
  load()
  loadSearchIndex()
  loadNotices()
  noticeTimer = setInterval(loadNotices, 30000)
  api.panelVersion()
    .then((d) => { appVer.value = (d && d.version) || '' })
    .catch(() => { /* 取不到就显示占位，不阻塞侧栏 */ })
})
onUnmounted(() => { if (noticeTimer) clearInterval(noticeTimer) })

async function onLogout() {
  await auth.logout()
  router.replace('/login')
}

// 内置功能: 工作台 / 文件管理 / 终端 / 任务列表 / 节点 / 插件 / 接口 / 设置
const PAGES = [
  { key: 'workspace', label: '工作台', path: '/', desc: '概览与状态', icon: 'WD' },
  { key: 'fm', label: '文件管理', path: '/fm', desc: '文件系统', icon: 'FM' },
  { key: 'assets', label: '资产', path: '/assets', desc: '插件产物聚合', icon: 'AS' },
  { key: 'terminal', label: '终端', path: '/terminal', desc: 'Shell', icon: 'TM' },
  { key: 'tasks', label: '任务列表', path: '/tasks', desc: '队列与进度', icon: 'TK' },
  { key: 'nodes', label: '节点管理', path: '/nodes', desc: '生图/推理节点', icon: 'ND' },
  { key: 'plugins', label: '插件', path: '/plugins', desc: '管理与安装', icon: 'PL' },
  { key: 'interfaces', label: '接口', path: '/interfaces', desc: '注册与状态', icon: 'IF' },
  { key: 'health', label: '健康', path: '/health', desc: '服务与接口状态', icon: 'HT' },
  { key: 'audit', label: '审计', path: '/audit', desc: '接口调用记录', icon: 'AU' },
  { key: 'config', label: '配置', path: '/plugin-config', desc: '插件配置', icon: 'CF' },
  { key: 'secrets', label: '密钥', path: '/secrets', desc: '密钥索引', icon: 'KY' },
  { key: 'backup', label: '备份', path: '/backup', desc: '配置与数据备份', icon: 'BK' },
  { key: 'schedules', label: '定时', path: '/schedules', desc: '定时备份/清理', icon: 'SC' },
  { key: 'rollback', label: '回滚', path: '/plugin-rollback', desc: '插件历史版本', icon: 'RB' },
  { key: 'deps', label: '依赖', path: '/plugin-deps', desc: '插件依赖检查', icon: 'DP' },
  { key: 'tokens', label: 'Token', path: '/tokens', desc: 'API 访问令牌', icon: 'TK' },
  { key: 'settings', label: '设置', path: '/settings', desc: '偏好', icon: 'SG' },
]
const pageMap = Object.fromEntries(PAGES.map((p) => [p.key, p]))
const NAV_GROUPS = [
  { label: '', keys: ['workspace'] },
  { label: '运行', keys: ['tasks', 'nodes', 'terminal'] },
  { label: '内容', keys: ['fm', 'assets'] },
  { label: '扩展', keys: ['plugins', 'interfaces'] },
  { label: '系统', keys: ['settings'] },
]

const searchQ = ref('')
const favs = ref(loadFavs())
// 面板更新悬浮窗: 必须声明成 ref —— 曾漏声明, 模板里写 showUpdate 会落到未跟踪的 ctx 上,
// 点击后不触发重渲染, 表现为"点了没反应/过一会儿才弹出"(见 PanelUpdate.vue 注释)
const showUpdate = ref(false)
const updBtn = ref(null)

function loadFavs() { try { return JSON.parse(localStorage.getItem('rc-favs') || '[]') } catch (e) { return [] } }
function saveFavs() { localStorage.setItem('rc-favs', JSON.stringify(favs.value)) }

const searchResults = computed(() => {
  const q = searchQ.value.trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const p of PAGES) if ((p.label + p.desc).toLowerCase().includes(q)) out.push({ key: p.path, label: p.label, desc: p.desc, path: p.path })
  for (const p of plugins.value) if ((p.label + ' ' + (p.description || '')).toLowerCase().includes(q)) out.push({ key: 'plugin:' + p.name, label: p.label, desc: '插件 · ' + (p.description || ''), path: '/plugin/' + p.name })
  for (const it of ifaces.value) if ((it.id + ' ' + (it.description || '') + ' ' + it.plugin).toLowerCase().includes(q)) out.push({ key: 'iface:' + it.id, label: it.id, desc: '接口 · ' + it.plugin, path: '/interfaces?plugin=' + encodeURIComponent(it.plugin) })
  for (const t of taskItems.value) if (((t.name || '') + ' ' + (t.title || '') + ' ' + (t.kind || '')).toLowerCase().includes(q)) out.push({ key: 'task:' + t.id, label: t.name || t.title || t.id, desc: '任务 · ' + (t.status || ''), path: '/tasks' })
  return out.slice(0, 12)
})

function pick(entry) { go(entry.path); searchQ.value = '' }
function toggleFav(entry) {
  const i = favs.value.findIndex((f) => f.path === entry.path)
  if (i >= 0) favs.value.splice(i, 1); else favs.value.push({ label: entry.label, path: entry.path })
  saveFavs()
}
function inFav(path) { return favs.value.some((f) => f.path === path) }

function go(path) { router.push(path) }

function isActive(name) {
  if (name === 'workspace') return route.path === '/'
  if (name === 'fm') return route.name === 'fm'
  if (name === 'assets') return route.name === 'assets'
  if (name === 'terminal') return route.name === 'terminal'
  if (name === 'tasks') return route.name === 'tasks'
  if (name === 'nodes') return route.name === 'nodes'
  if (name === 'plugins') return route.name === 'plugins' || route.name === 'plugin'
  if (name === 'interfaces') return route.name === 'interfaces'
  if (name === 'health') return route.name === 'health'
  if (name === 'audit') return route.name === 'audit'
  if (name === 'config') return route.name === 'plugin-config'
  if (name === 'secrets') return route.name === 'secrets'
  if (name === 'backup') return route.name === 'backup'
  if (name === 'schedules') return route.name === 'schedules'
  if (name === 'rollback') return route.name === 'plugin-rollback'
  if (name === 'deps') return route.name === 'plugin-deps'
  if (name === 'tokens') return route.name === 'tokens'
  if (name === 'settings') return route.name === 'settings'
  return false
}
</script>

<template>
  <aside class="sidebar">
    <!-- 常驻挂载: 它除了悬浮窗还要负责"检测到新版本自动弹确认窗" -->
    <PanelUpdate :open="showUpdate" :anchor="updBtn" @close="showUpdate = false" />
    <div class="sidebar-header">
      <span class="brand-dot"></span>
      <h2>RainCough</h2>
      <button ref="updBtn" class="upd-btn" title="面板更新" @click="showUpdate = !showUpdate">↓</button>
      <button class="upd-btn notice-btn" title="通知" @click.stop="noticeOpen = !noticeOpen">N<span v-if="unread" class="notice-badge">{{ unread > 9 ? '9+' : unread }}</span></button>
      <button class="upd-btn" title="收起侧栏（内容区右下角的球可以叫回来）" @click="hideSidebar">≡</button>
    </div>
    <div v-if="noticeOpen" class="notice-pop" @click.stop>
      <div class="notice-head"><b>通知</b><span class="faint">{{ unread }} 条未读</span><button class="btn btn-sm btn-ghost" @click="markAllRead">全部已读</button><button class="btn btn-sm btn-ghost" @click="clearNotices">清空</button></div>
      <div v-if="!notices.length" class="hint" style="padding:16px 8px;">暂无通知</div>
      <div v-for="n in notices.slice(0, 30)" :key="n.key" class="notice-item" :class="{ unread: !n.read }" @click="openNotice(n)">
        <div class="notice-title">{{ n.kind }} · {{ n.title }}</div>
        <div class="notice-body">{{ n.body }}</div>
      </div>
    </div>
    <div style="padding:10px">
      <input v-model="searchQ" class="input" style="width:100%" placeholder="搜索: 页面/插件/接口/任务…" @keydown.enter="searchResults.length && pick(searchResults[0])" />
      <div v-if="searchQ && searchResults.length" class="search-pop">
        <div v-for="r in searchResults" :key="r.key || r.path" class="search-item">
          <span style="flex:1;cursor:pointer" @click="pick(r)"><b>{{ r.label }}</b> <span class="faint" style="font-size:11px">{{ r.desc }}</span></span>
          <button class="btn btn-sm" @click="toggleFav(r)">{{ inFav(r.path) ? '★' : '☆' }}</button>
        </div>
      </div>
    </div>
    <div v-if="favs.length" style="padding:0 10px 6px">
      <div class="sidebar-section-label">收藏</div>
      <div v-for="f in favs" :key="f.path" class="plugin-item" @click="go(f.path)">
        <div class="info"><div class="label">{{ f.label }}</div></div>
        <button class="btn btn-sm btn-ghost" @click.stop="toggleFav(f)">★</button>
      </div>
    </div>
    <nav class="plugin-list">
      <template v-for="g in NAV_GROUPS" :key="g.label || 'main'">
        <div v-if="g.label" class="sidebar-section-label">{{ g.label }}</div>
        <div
          v-for="key in g.keys"
          :key="key"
          class="plugin-item"
          :class="{ active: isActive(key) }"
          @click="go(pageMap[key].path)"
        >
          <div class="nav-icon">{{ pageMap[key].icon }}</div>
          <div class="info">
            <div class="label">{{ pageMap[key].label }}</div>
            <div class="desc">{{ pageMap[key].desc }}</div>
          </div>
        </div>
      </template>

      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">已装插件</div>
      <template v-if="plugins.length">
        <div
          v-for="p in plugins"
          :key="p.name"
          class="plugin-item"
          :class="{ active: route.name === 'plugin' && route.params.name === p.name }"
          @click="go('/plugin/' + p.name)"
        >
          <div class="info">
            <div class="label">{{ p.label }}</div>
            <div class="desc">{{ p.description }}</div>
          </div>
        </div>
      </template>
      <div v-else class="hint" style="padding:16px 8px;">暂无插件</div>
    </nav>
    <div class="sidebar-footer">
      <span class="version">v{{ appVer || '—' }} · 仅局域网</span>
      <button v-if="auth.loggedIn()" class="logout-btn" title="注销当前 session" @click="onLogout">登出</button>
    </div>
  </aside>
</template>

<style scoped>
.upd-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
.upd-btn:hover { color: var(--accent); border-color: var(--accent); }
.notice-btn { position: relative; margin-left: 2px; }
.notice-badge { position: absolute; top: -5px; right: -5px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 8px; background: var(--danger); color: #fff; font-size: 9px; line-height: 14px; text-align: center; }
.notice-pop { position: absolute; top: 44px; left: 10px; right: 10px; z-index: 60; max-height: 60vh; overflow: auto; background: #1b1f27; border: 1px solid var(--border-strong); border-radius: 8px; box-shadow: 0 10px 28px rgba(0,0,0,.45); }
:root[data-scheme="light"] .notice-pop { background: #ffffff; }
:root[data-theme="yuluo"] .notice-pop { background: rgba(18,20,24,.96); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
.notice-head { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 12px; }
.notice-head .faint { margin-right: auto; font-size: 10px; }
.notice-item { padding: 7px 10px; border-bottom: 1px solid var(--border); cursor: pointer; }
.notice-item:hover { background: var(--accent-soft); }
.notice-item.unread { border-left: 2px solid var(--accent); }
.notice-title { font-size: 11px; font-weight: 600; }
.notice-body { font-size: 10px; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.logout-btn {
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.logout-btn:hover { color: var(--accent); border-color: var(--accent); }
</style>
