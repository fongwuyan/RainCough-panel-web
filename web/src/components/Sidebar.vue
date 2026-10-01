<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlugins } from '../stores/plugins'
import { useExtensions } from '../stores/extensions'
import PanelUpdate from './panel/PanelUpdate.vue'

const route = useRoute()
const router = useRouter()
const { plugins, load } = usePlugins()
const { extensions, load: loadExts } = useExtensions()

onMounted(() => { load(); loadExts() })

// 内置功能(随面板主体安装): 共 7 项, 其余功能一律是系统扩展(在「系统扩展」页安装)
const PAGES = [
  { key: 'workspace', label: '工作台', path: '/', desc: '概览与状态', icon: 'WD' },
  { key: 'fm', label: '文件管理', path: '/fm', desc: '文件系统', icon: 'FM' },
  { key: 'terminal', label: '终端', path: '/terminal', desc: 'Shell', icon: 'TM' },
  { key: 'ext', label: '系统扩展', path: '/ext', desc: '扩展安装与管理', icon: 'EX' },
  { key: 'plugins', label: '插件', path: '/plugins', desc: '管理与安装', icon: 'PL' },
  { key: 'settings', label: '设置', path: '/settings', desc: '偏好', icon: 'SG' },
  { key: 'docs', label: '开发文档', path: '/docs', desc: '插件指南', icon: 'DC' },
]
// 「系统中心」已迁为系统扩展(extensions/syscenter): 侧边栏不再拆分其子功能,
// 已装后在本列表的「已装扩展」分组里进入; 旧 /sysfunc/* 深链由 router 重定向到
// /ext/syscenter?sub=xxx(见 router.js)。
const searchQ = ref('')
const favs = ref(loadFavs())
function loadFavs() { try { return JSON.parse(localStorage.getItem('rc-favs') || '[]') } catch (e) { return [] } }
function saveFavs() { localStorage.setItem('rc-favs', JSON.stringify(favs.value)) }
function favKey(label, path) { return path }
const searchResults = computed(() => {
  const q = searchQ.value.trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const p of PAGES) if ((p.label + p.desc).toLowerCase().includes(q)) out.push({ label: p.label, desc: p.desc, path: p.path })
  for (const p of plugins.value) if ((p.label + ' ' + (p.description || '')).toLowerCase().includes(q)) out.push({ label: p.label, desc: p.description || '', path: '/plugin/' + p.name })
  for (const x of extensions.value) if (((x.label || '') + ' ' + (x.description || '')).toLowerCase().includes(q)) out.push({ label: x.label || x.name, desc: x.description || '系统扩展', path: x.route || ('/ext/' + x.name) })
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
  if (name === 'settings') return route.name === 'settings'
  if (name === 'docs') return route.name === 'docs'
  if (name === 'fm') return route.name === 'fm'
  if (name === 'filemanager') return route.name === 'plugin' && route.params.name === 'filemanager'
  if (name === 'terminal') return route.name === 'terminal'
  if (name === 'ext') return route.name === 'ext' || route.name === 'ext-view'
  if (name === 'plugins') return route.name === 'plugins'
  return route.name === 'plugin' && route.params.name === name
}

// 已装系统扩展的侧边栏项(挂在「系统扩展」页下)
function extActive(x) { return route.name === 'ext-view' && String(route.params.name) === x.name }
</script>

<template>
  <aside class="sidebar">
    <PanelUpdate v-if="showUpdate" @close="showUpdate = false" />
    <div class="sidebar-header">
      <span class="brand-dot"></span>
      <h2>RainCough</h2>
      <button class="upd-btn" title="面板更新" @click="showUpdate = !showUpdate">↓</button>
    </div>
    <div style="padding:10px">
      <input v-model="searchQ" class="input" style="width:100%" placeholder="搜索: 页面/插件/功能…" @keydown.enter="searchResults.length && pick(searchResults[0])" />
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
        v-for="p in PAGES.slice(0, 3)"
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

      <div
        v-for="p in PAGES.slice(3)"
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
      <div class="sidebar-section-label">已装扩展</div>
      <div v-if="!extensions.length" class="hint" style="padding:4px 12px 8px;font-size:11px;">
        未安装扩展, 到「系统扩展」页安装
      </div>
      <div
        v-for="x in extensions"
        :key="'ext-' + x.name"
        class="plugin-item"
        :class="{ active: extActive(x) }"
        @click="go(x.route || ('/ext/' + x.name))"
      >
        <div class="nav-icon">{{ x.icon || 'EX' }}</div>
        <div class="info">
          <div class="label">{{ x.label || x.name }}</div>
          <div class="desc">{{ x.description || ('v' + (x.version || '-')) }}</div>
        </div>
      </div>

      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">已装插件</div>
      <template v-if="plugins.length">
        <div
          v-for="p in plugins.filter((x) => x.name !== 'filemanager')"
          :key="p.name"
          class="plugin-item"
          :class="{ active: isActive(p.name) }"
          @click="go('/plugin/' + p.name)"
        >
          <div class="info">
            <div class="label">{{ p.label }}</div>
            <div class="desc">{{ p.description }}</div>
          </div>
        </div>
      </template>
      <div v-else class="hint" style="padding:16px 8px;">加载中...</div>
    </nav>
    <div class="sidebar-footer">
      <span class="version">v1.0.0 · 仅局域网</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-sub-label {
  padding: 6px 10px 3px 14px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.4px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  border-left: 2px solid var(--border);
  margin: 8px 0 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sys-toggle {
  cursor: pointer;
  user-select: none;
  border-left: 2px solid transparent;
  transition: color var(--transition), border-color var(--transition), background var(--transition);
}
.sys-toggle:hover { color: var(--text-muted); background: var(--surface-2); }
.sys-toggle.sys-active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: var(--accent-soft);
}
.sys-caret {
  display: inline-block;
  width: 14px;
  font-size: 10px;
  color: var(--text-faint);
}
.sys-toggle.sys-active .sys-caret { color: var(--accent); }
.sys-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-faint);
}
.sys-toggle.sys-active .sys-count {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.sys-sub { padding-left: 4px; }
.sys-sub .sys-ico {
  width: 22px;
  height: 22px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0;
}
.sys-sub .label { font-size: 13px; }
.sys-sub .desc { font-size: 10px; }
.sys-sub.active { border-left: 2px solid var(--accent); }
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
