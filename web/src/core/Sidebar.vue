<script setup>
// Sidebar v2 — 注册表驱动: 系统功能 + 插件列表均来自后端 /api/plugins 与本地路由表(不再硬编码 12 组件 MAP)。
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePlugins } from '../stores/plugins'

const route = useRoute()
const { plugins, load } = usePlugins()
onMounted(load)

// 系统功能(M4 展开): 后端返回的 core 菜单会并入这里
const CORE = [
  { key: 'home', label: '工作台', path: '/', desc: '概览与状态' },
]

function isActive(p) {
  if (p === 'home') return route.path === '/'
  return route.name === 'plugin' && route.params.name === p
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <span class="brand-dot"></span>
      <h2>RainCough</h2>
    </div>
    <nav class="plugin-list">
      <template v-for="p in CORE" :key="p.key">
        <router-link class="plugin-item" :class="{ active: isActive(p.key) }" :to="p.path">
          <div class="label">{{ p.label }}</div>
          <div class="desc">{{ p.desc }}</div>
        </router-link>
      </template>

      <div class="sidebar-divider"></div>
      <div class="sidebar-section-label">插件</div>
      <router-link v-for="p in plugins" :key="p.name" class="plugin-item"
        :class="{ active: isActive(p.name) }" :to="'/plugin/' + p.name">
        <div class="label">
          <span class="dot" :class="p.alive === false ? 'off' : 'on'"></span>{{ p.label }}
        </div>
        <div class="desc">{{ p.description || p.name }}</div>
      </router-link>
      <div v-if="!plugins || (!plugins.length && plugins !== null)" class="hint">加载中...</div>
    </nav>
    <div class="sidebar-footer">
      <span class="version">v1.0 · 仅局域网</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar { width: 230px; flex-shrink: 0; display: flex; flex-direction: column; height: 100vh; background: var(--sidebar-bg, #12151d); border-right: 1px solid var(--border, #2a3140); }
.sidebar-header { display: flex; align-items: center; gap: 10px; padding: 18px 18px 12px; }
.sidebar-header h2 { margin: 0; font-size: 17px; }
.brand-dot { width: 12px; height: 12px; border-radius: 50%; background: linear-gradient(135deg, var(--accent, #6d5cff), var(--accent-press, #5546d6)); }
.plugin-list { flex: 1; overflow-y: auto; padding: 4px 10px; display: flex; flex-direction: column; gap: 2px; }
.plugin-item { display: block; padding: 8px 10px; border-radius: 8px; text-decoration: none; color: var(--text, #e6e8ee); }
.plugin-item:hover { background: var(--hover, rgba(255,255,255,0.05)); }
.plugin-item.active { background: var(--accent-dim, rgba(109,92,255,0.16)); color: var(--accent, #6d5cff); }
.label { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.desc { font-size: 11px; color: var(--text-muted, #9aa3b2); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-divider { border-top: 1px solid var(--border, #2a3140); margin: 8px 4px; }
.sidebar-section-label { font-size: 11px; color: var(--text-faint, #777); padding: 6px 10px 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.dot { width: 7px; height: 7px; border-radius: 50%; }
.dot.on { background: #3fb950; }
.dot.off { background: #f85149; }
.hint { padding: 12px 10px; font-size: 12px; color: var(--text-faint, #777); }
.sidebar-footer { padding: 12px 18px; border-top: 1px solid var(--border, #2a3140); }
.version { font-size: 11px; color: var(--text-faint, #777); }
</style>