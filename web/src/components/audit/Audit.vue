<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const items = ref([])
const loading = ref(false)
const err = ref('')
const plugin = ref('')
const iface = ref('')
const errorsOnly = ref(false)

async function load() {
  loading.value = true; err.value = ''
  try {
    const d = await api.audit({ plugin: plugin.value, iface: iface.value, errors: errorsOnly.value ? '1' : '', limit: 300 })
    items.value = (d && d.items) || []
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}
function fmt(ts) {
  if (!ts) return '—'
  return new Date(Number(ts) * 1000).toLocaleString()
}
onMounted(load)
</script>

<template>
  <div class="page audit-page">
    <div class="audit-head">
      <div><h1>审计</h1><p class="sub">接口调用记录，不记录请求参数和密钥</p></div>
      <button class="btn" :disabled="loading" @click="load">{{ loading ? '刷新中…' : '刷新' }}</button>
    </div>
    <div v-if="err" class="error">{{ err }}</div>
    <div class="audit-filters">
      <input v-model="plugin" class="input" placeholder="插件名" @keyup.enter="load" />
      <input v-model="iface" class="input" placeholder="接口 ID" @keyup.enter="load" />
      <label class="audit-check"><input v-model="errorsOnly" type="checkbox" @change="load" /> 只看错误</label>
      <button class="btn" @click="load">筛选</button>
    </div>
    <div class="audit-table-wrap">
      <table class="audit-table">
        <thead><tr><th>时间</th><th>调用方</th><th>插件</th><th>接口</th><th>耗时</th><th>结果</th></tr></thead>
        <tbody>
          <tr v-for="(it, i) in items" :key="i">
            <td class="mono">{{ fmt(it.time) }}</td>
            <td>{{ it.caller }}</td>
            <td>{{ it.plugin }}</td>
            <td class="mono">{{ it.interface }}</td>
            <td>{{ it.ms }}ms</td>
            <td :class="it.error ? 'bad' : 'ok'">{{ it.error ? '失败' : '成功' }}</td>
          </tr>
          <tr v-if="!items.length"><td colspan="6" class="empty">暂无调用记录</td></tr>
        </tbody>
      </table>
    </div>
    <div class="faint audit-note">审计记录保存在内存中，最多 500 条，面板重启后清空。</div>
  </div>
</template>

<style scoped>
.audit-page { padding: 18px 22px 28px; }
.audit-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.audit-head h1 { margin: 0; font-size: 22px; }
.audit-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.audit-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 14px 0; }
.audit-filters .input { width: 180px; }
.audit-check { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); }
.audit-table-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: auto; background: var(--bg-card); }
.audit-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.audit-table th, .audit-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
.audit-table th { color: var(--text-muted); }
.audit-table .empty { text-align: center; color: var(--text-muted); padding: 22px; }
.audit-table .ok { color: #2f9e44; }
.audit-table .bad { color: var(--danger); }
.audit-note { margin-top: 8px; font-size: 11px; }
</style>
