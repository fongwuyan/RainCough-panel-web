<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlugins } from '../stores/plugins'
import PanelUpdate from './panel/PanelUpdate.vue'

const route = useRoute()
const router = useRouter()
const { plugins, load } = usePlugins()

onMounted(() => { load() })

// 内置功能: 工作台 / 文件管理 / 终端 / 插件 / 设置(共 5 项)
const PAGES = [
  { key: 'workspace', label: '工作台', path: '/', desc: '概览与状态', icon: 'WD' },
  { key: 'fm', label: '文件管理', path: '/fm', desc: '文件系统', icon: 'FM' },
  { key: 'terminal', label: '终端', path: '/terminal', desc: 'Shell', icon: 'TM' },
  { key: 'plugins', label: '插件', path: '/plugins', desc: '管理与安装', icon: 'PL' },
  { key: 'settings', label: '设置', path: '/settings', desc: '偏好', icon: 'SG' },
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
  for (const p of PAGES) if ((p.label + p.desc).toLowerCase().includes(q)) out.push({ label: p.label, desc: p.desc, path: p.path })
  for (const p of plugins.value) if ((p.label + ' ' + (p.description || '')).toLowerCase().includes(q)) out.push({ label: p.label, desc: p.description || '', path: '/plugin/' + p.name })
  return out.slice(0, 10)
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
  if (name === 'terminal') return route.name === 'terminal'
  if (name === 'plugins') return route.name === 'plugins' || route.name === 'plugin'
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
    </div>
    <div style="padding:10px">
      <input v-model="searchQ" class="input" style="width:100%" placeholder="搜索: 页面/插件…" @keydown.enter="searchResults.length && pick(searchResults[0])" />
      <div v-if="searchQ && searchResults.length" class="search-pop">
        <div v-for="r in searchResults" :key="r.path" class="search-item">
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
      <div
        v-for="p in PAGES"
        :key="p.key"
        class="plugin-item"
        :class="{ active: isActive(p.key) }"
        @click="go(p.path)"
      >
        <div class="nav-icon">{{ p.icon }}</div>
        <div class="info">
          <div class="label">{{ p.label }}</div>
          <div class="desc">{{ p.desc }}</div>
        </div>
      </div>

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
      <span class="version">v1.0.0 · 仅局域网</span>
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
</style>
