<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const items = ref([])
const issues = ref(0)
const err = ref('')
const loading = ref(false)

async function load() {
  loading.value = true; err.value = ''
  try {
    const d = await api.pluginDeps()
    items.value = (d && d.plugins) || []
    issues.value = (d && d.issues) || 0
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}
function statusText(s) {
  return { ok: '正常', missing: '缺失', version_mismatch: '版本不匹配', optional_missing: '可选缺失' }[s] || s
}
onMounted(load)
</script>

<template>
  <div class="page deps-page">
    <div class="deps-head">
      <div><h1>插件依赖</h1><p class="sub">只检查插件声明的依赖和版本，不自动安装或调用插件业务</p></div>
      <button class="btn" :disabled="loading" @click="load">{{ loading ? '检查中…' : '重新检查' }}</button>
    </div>
    <div v-if="err" class="error">{{ err }}</div>
    <div class="deps-kpi" :class="{ bad: issues > 0 }">
      <b>{{ issues }}</b><span>个依赖问题</span>
    </div>
    <div v-if="!items.length" class="hint">没有插件依赖声明。可在 plugin.json 增加 dependencies 字段。</div>
    <div v-for="p in items" :key="p.name" class="deps-card">
      <div class="deps-title"><b>{{ p.name }}</b><span class="faint">{{ p.version }}</span></div>
      <div v-if="!p.dependencies.length" class="faint" style="font-size:11px;">无依赖</div>
      <div v-for="d in p.dependencies" :key="d.name" class="deps-row">
        <span>{{ d.name }}</span>
        <span class="mono">{{ d.version || '任意版本' }}</span>
        <span class="mono">{{ d.installed || '未安装' }}</span>
        <span :class="d.status === 'ok' ? 'ok' : (d.status === 'optional_missing' ? 'warn' : 'bad')">{{ statusText(d.status) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.deps-page { padding: 18px 22px 28px; }
.deps-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.deps-head h1 { margin: 0; font-size: 22px; }
.deps-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.deps-kpi { display: inline-flex; align-items: baseline; gap: 6px; margin: 14px 0; padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; }
.deps-kpi b { font-size: 22px; color: #2f9e44; }
.deps-kpi.bad b { color: var(--danger); }
.deps-kpi span { color: var(--text-muted); font-size: 11px; }
.deps-card { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); padding: 10px 12px; margin-bottom: 8px; }
.deps-title { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
.deps-row { display: grid; grid-template-columns: 1fr 120px 120px 90px; gap: 8px; padding: 5px 0; border-top: 1px solid var(--border); font-size: 12px; }
.ok { color: #2f9e44; }
.warn { color: #d9480f; }
.bad { color: var(--danger); }
</style>
