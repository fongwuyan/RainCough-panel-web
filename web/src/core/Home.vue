<script setup>
// Home — 新前端工作台起点(M4 展开系统监控等)。
import { ref, onMounted } from 'vue'
import { systemApi } from '../api/system'
import { usePlugins } from '../stores/plugins'

const sys = ref(null)
const { plugins, load } = usePlugins()

onMounted(async () => {
  load()
  try { sys.value = await systemApi.info() } catch (e) { /* 后端未就绪时静默 */ }
})

function fmtSize(b) {
  if (!b && b !== 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = b
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(1) + ' ' + units[i]
}
</script>

<template>
  <div>
    <div class="hero">
      <div>
        <h1>RainCough 面板</h1>
        <p class="sub">主系统与插件分层 · Go 核心</p>
      </div>
      <span v-if="sys" class="chip">v{{ sys.go_version }}</span>
    </div>

    <div class="grid">
      <div class="card" v-if="sys">
        <div class="card-title">系统概览</div>
        <div class="kv">
          <div class="kv-row"><span class="kv-k">主机</span><span class="kv-v">{{ sys.hostname }}</span></div>
          <div class="kv-row"><span class="kv-k">平台</span><span class="kv-v">{{ sys.platform }} / {{ sys.arch }}</span></div>
          <div class="kv-row"><span class="kv-k">CPU</span><span class="kv-v">{{ sys.cpu_count }} 核</span></div>
          <div class="kv-row"><span class="kv-k">内存</span><span class="kv-v">{{ fmtSize(sys.memory_total) }} · 已用 {{ sys.memory_percent.toFixed(1) }}%</span></div>
          <div class="kv-row"><span class="kv-k">进程</span><span class="kv-v">{{ sys.process_count }}</span></div>
          <div class="kv-row"><span class="kv-k">运行</span><span class="kv-v">{{ (sys.uptime / 3600).toFixed(1) }} 小时</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">插件 ({{ plugins.length }})</div>
        <div v-if="plugins.length" class="plist">
          <router-link v-for="p in plugins" :key="p.name" class="plist-item" :to="'/plugin/' + p.name">
            <span class="dot" :class="p.alive === false ? 'off' : 'on'"></span>
            <b>{{ p.label }}</b>
            <span class="faint">{{ p.lang || 'python' }}</span>
          </router-link>
        </div>
        <div v-else class="faint" style="padding:12px 0">
          {{ plugins === null ? '加载中...' : '暂无插件' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; margin-bottom: 16px; background: var(--surface, #161b24); border: 1px solid var(--border, #2a3140); border-radius: 14px; }
.hero h1 { margin: 0; font-size: 22px; }
.sub { margin: 4px 0 0; font-size: 12px; color: var(--text-muted, #9aa3b2); }
.chip { background: var(--border, #2a3140); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
.card { background: var(--surface, #161b24); border: 1px solid var(--border, #2a3140); border-radius: 12px; padding: 16px 18px; }
.card-title { font-size: 13px; color: var(--text-muted, #9aa3b2); margin-bottom: 10px; }
.kv-row { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border, #2a3140); font-size: 13px; }
.kv-row:last-child { border-bottom: none; }
.kv-k { width: 56px; color: var(--text-faint, #777); flex-shrink: 0; }
.plist { display: flex; flex-direction: column; gap: 6px; }
.plist-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border, #2a3140); border-radius: 8px; text-decoration: none; color: var(--text, #e6e8ee); font-size: 13px; }
.plist-item:hover { border-color: var(--accent, #6d5cff); }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.on { background: #3fb950; }
.dot.off { background: #f85149; }
.faint { color: var(--text-faint, #777); }
</style>