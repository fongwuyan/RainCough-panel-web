<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const items = ref([])
const err = ref('')
const ok = ref('')
const form = ref({ name: 'API Token', scope: 'read' })
const created = ref('')
const busy = ref(false)

async function load() {
  try { const d = await api.tokens(); items.value = (d && d.items) || [] }
  catch (e) { err.value = e.message || String(e) }
}
async function create() {
  busy.value = true; err.value = ''; ok.value = ''; created.value = ''
  try {
    const d = await api.tokenCreate(form.value.name, form.value.scope)
    created.value = d.token
    await load()
  } catch (e) { err.value = e.message || String(e) }
  finally { busy.value = false }
}
async function del(it) {
  if (!confirm('撤销 Token「' + it.name + '」？')) return
  try { await api.tokenDelete(it.id); await load() }
  catch (e) { err.value = e.message || String(e) }
}
function copy() {
  if (!created.value) return
  try { navigator.clipboard.writeText(created.value); ok.value = '已复制，关闭后将无法再次查看' } catch (e) { ok.value = '请手动复制' }
}
onMounted(load)
</script>

<template>
  <div class="page tokens-page">
    <div class="tokens-head"><div><h1>Token</h1><p class="sub">面板 API Token；read 仅允许 GET/HEAD，full 允许全部方法</p></div><button class="btn" @click="load">刷新</button></div>
    <div v-if="err" class="error">{{ err }}</div>
    <div v-if="ok" class="ok-msg">{{ ok }}</div>
    <section class="tokens-form">
      <input v-model="form.name" class="input" placeholder="Token 名称" />
      <select v-model="form.scope" class="input"><option value="read">只读 read</option><option value="full">完整 full</option></select>
      <button class="btn btn-primary" :disabled="busy" @click="create">生成 Token</button>
    </section>
    <div v-if="created" class="token-created">
      <div>只显示这一次：</div>
      <div class="mono token-value">{{ created }}</div>
      <button class="btn btn-sm" @click="copy">复制</button>
    </div>
    <div class="tokens-table-wrap">
      <table class="tokens-table">
        <thead><tr><th>名称</th><th>权限</th><th>掩码</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="it in items" :key="it.id">
            <td>{{ it.name }}</td><td>{{ it.scope }}</td><td class="mono">{{ it.hint }}</td>
            <td class="mono">{{ new Date(it.created * 1000).toLocaleString() }}</td>
            <td><button class="btn btn-sm btn-danger" @click="del(it)">撤销</button></td>
          </tr>
          <tr v-if="!items.length"><td colspan="5" class="empty">没有 Token</td></tr>
        </tbody>
      </table>
    </div>
    <div class="faint" style="font-size:11px;margin-top:8px;">使用方式：请求头 Authorization: Bearer &lt;token&gt;。Token 只保存 SHA-256 哈希。</div>
  </div>
</template>

<style scoped>
.tokens-page { padding: 18px 22px 28px; }
.tokens-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.tokens-head h1 { margin: 0; font-size: 22px; }
.tokens-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.ok-msg { color: #2f9e44; font-size: 12px; margin: 8px 0; }
.tokens-form { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.tokens-form .input { width: 200px; }
.token-created { border: 1px solid var(--accent); border-radius: 8px; padding: 10px; margin: 10px 0; background: var(--accent-soft); font-size: 12px; }
.token-value { word-break: break-all; margin: 6px 0; padding: 6px; background: var(--bg2); }
.tokens-table-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: auto; background: var(--bg-card); }
.tokens-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.tokens-table th, .tokens-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.tokens-table th { color: var(--text-muted); }
.tokens-table .empty { text-align: center; color: var(--text-muted); padding: 20px; }
</style>
