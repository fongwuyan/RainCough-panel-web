<script setup>
// Sidebar — 复刻旧面板侧栏式样: 系统分组 + 插件分组(注册表驱动)
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePlugins } from '../stores/plugins'

const route = useRoute()
const { plugins, load } = usePlugins()
onMounted(load)

// 系统功能(主系统, 对应后端核心 API)
const SYSTEM = [
  { key: 'workspace', label: '工作台', path: '/', icon: '⌂' },
  { key: 'filemanager', label: '文件管理', path: '/file', icon: '🗂' },
  { key: 'terminal', label: '终端', path: '/terminal', icon: '▯' },
  { key: 'syscenter', label: '系统中心', path: '/syscenter', icon: '⚙' },
]
const SYSTEM2 = [
  { key: 'tasks', label: '任务队列', path: '/tasks', icon: '☰' },
  { key: 'scheduler', label: '定时任务', path: '/scheduler', icon: '⏱' },
  { key: 'envpkg', label: '环境包', path: '/envpkg', icon: '▤' },
  { key: 'store', label: '插件市场', path: '/store', icon: '▦' },
]

function isActive(key) {
  if (key === 'workspace') return route.path === '/'
  if (key === 'filemanager') return route.path === '/file'
  if (key.startsWith('syscenter')) return route.path === '/syscenter'
  if (key === 'tasks') return route.path === '/tasks'
  if (key === 'scheduler') return route.path === '/scheduler'
  if (key === 'envpkg') return route.path === '/envpkg'
  if (key === 'store') return route.path === '/store'
  if (key === 'terminal') return route.path === '/terminal'
  return route.path === ('/' + key)
}

const pluginActive = computed(() =>
  route.name === 'plugin' ? String(route.params.name || '') : ''
)
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="brand-dot"></span>
      <h2>RainCough</h2>
    </div>

    <nav class="plugin-list">
      <template v-for="p in SYSTEM" :key="p.key">
        <router-link class="plugin-item" :class="{ active: isActive(p.key) }" :to="p.path">
          <span class="nav-icon">{{ p.icon }}</span>
          <div class="info"><div class="label">{{ p.label }}</div></div>
        </router-link>
      </template>

      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">系统</div>
      <template v-for="p in SYSTEM2" :key="p.key">
        <router-link class="plugin-item" :class="{ active: isActive(p.key) }" :to="p.path">
          <span class="nav-icon">{{ p.icon }}</span>
          <div class="info"><div class="label">{{ p.label }}</div></div>
        </router-link>
      </template>

      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">插件</div>
      <router-link v-for="p in plugins" :key="p.name" class="plugin-item"
        :class="{ active: pluginActive === p.name }" :to="'/plugin/' + p.name">
        <span class="nav-icon dot" :class="p.alive === false ? 'off' : 'on'"></span>
        <div class="info">
          <div class="label">{{ p.label }}</div>
          <div class="desc">{{ p.description || p.name }}</div>
        </div>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <span class="version">v1.0 · 仅局域网</span>
    </div>
  </aside>
</template>

<style scoped>
.nav-icon.dot { border-radius: 50%; font-size: 8px; line-height: 8px; padding: 0; }
.nav-icon.on { background: var(--success); }
.nav-icon.off { background: var(--danger); }
</style>