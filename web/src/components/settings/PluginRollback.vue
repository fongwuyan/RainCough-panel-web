<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const plugins = ref([])
const cur = ref('')
const items = ref([])
const err = ref('')
const ok = ref('')
const busy = ref(false)

async function loadPlugins() {
  try {
    const d = await api.listPlugins()
    plugins.value = Array.isArray(d) ? d : []
    if (!cur.value && plugins.value.length) await select(plugins.value[0].name)
  } catch (e) { err.value = e.message || String(e) }
}
async function select(name) {
  cur.value = name; items.value = []; err.value = ''; ok.value = ''
  try { const d = await api.pluginBackups(name); items.value = (d && d.items) || [] }
  catch (e) { err.value = e.message || String(e) }
}
async function rollback(it) {
  if (!confirm('回滚 ' + cur.value + ' 到 ' + it.name + '？面板会保留当前版本到 .backup，重启插件后生效。')) return
  busy.value = true; err.value = ''; ok.value = ''
  try {
    await api.pluginRollback(cur.value, it.name)
    ok.value = '已回滚，请重启插件'
    await select(cur.value)
  } catch (e) { err.value = e.message || String(e) }
  finally { busy.value = false }
}
function fmt(ts) { return ts ? new Date(ts * 1000).toLocaleString() : '—' }
onMounted(loadPlugins)
</script>

<template>
  <div class="page rollback-page">
    <div class="rollback-head"><div><h1>插件回滚</h1><p class="sub">从 .backup 恢复历史版本；不修改插件业务</p></div><button class="btn" @click="loadPlugins">刷新</button></div>
    <div v-if="err" class="error">{{ err }}</div>
    <div v-if="ok" class="ok-msg">{{ ok }}</div>
    <div class="rollback-layout">
      <aside class="rollback-list">
        <div v-for="p in plugins" :key="p.name" class="rollback-item" :class="{ active: cur === p.name }" @click="select(p.name)">
          <b>{{ p.label || p.name }}</b><span class="faint">{{ p.version }}</span>
        </div>
      </aside>
      <section class="rollback-main">
        <div class="rollback-title">{{ cur || '未选择插件' }}</div>
        <div v-if="!items.length" class="hint" style="padding:14px;">没有历史备份。以后面板升级/安装插件时会自动保留最近 3 个旧版本。</div>
        <table v-else class="rollback-table">
          <thead><tr><th>备份目录</th><th>版本</th><th>时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="it in items" :key="it.name">
              <td class="mono">{{ it.name }}</td>
              <td>{{ it.version || '—' }}</td>
              <td class="mono">{{ fmt(it.time) }}</td>
              <td><button class="btn btn-sm" :disabled="busy" @click="rollback(it)">回滚</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<style scoped>
.rollback-page { padding: 18px 22px 28px; }
.rollback-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.rollback-head h1 { margin: 0; font-size: 22px; }
.rollback-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.ok-msg { color: #2f9e44; font-size: 12px; margin: 8px 0; }
.rollback-layout { display: grid; grid-template-columns: 220px 1fr; gap: 12px; margin-top: 12px; min-height: 360px; }
.rollback-list { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); overflow: auto; }
.rollback-item { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 12px; }
.rollback-item.active { background: var(--accent-soft); color: var(--accent); }
.rollback-main { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); overflow: auto; }
.rollback-title { padding: 10px 12px; border-bottom: 1px solid var(--border); font-weight: 600; }
.rollback-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.rollback-table th, .rollback-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.rollback-table th { color: var(--text-muted); }
@media (max-width: 800px) { .rollback-layout { grid-template-columns: 1fr; } .rollback-list { max-height: 160px; } }
</style>
