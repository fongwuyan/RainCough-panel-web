<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const items = ref([])
const loading = ref(false)
const err = ref('')
const ok = ref('')
const form = ref({ plugin: '', name: '', value: '' })
const saving = ref(false)

async function load() {
  loading.value = true; err.value = ''
  try {
    const d = await api.secrets()
    items.value = (d && d.items) || []
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}

async function save() {
  if (!form.value.plugin || !form.value.name || !form.value.value) { err.value = '插件、名称、值都必填'; return }
  saving.value = true; err.value = ''; ok.value = ''
  try {
    await api.secretSave(form.value.plugin.trim(), form.value.name.trim(), form.value.value)
    form.value = { plugin: '', name: '', value: '' }
    ok.value = '已保存（面板只显示掩码，不返回明文）'
    await load()
  } catch (e) { err.value = e.message || String(e) }
  finally { saving.value = false }
}

async function del(it) {
  if (!confirm('删除密钥「' + it.name + '」？')) return
  try { await api.secretDelete(it.id); await load() }
  catch (e) { err.value = e.message || String(e) }
}

onMounted(load)
</script>

<template>
  <div class="page secrets-page">
    <div class="secrets-head">
      <div><h1>密钥</h1><p class="sub">面板保存密钥索引；列表永远不返回明文</p></div>
      <button class="btn" :disabled="loading" @click="load">刷新</button>
    </div>
    <div v-if="err" class="error">{{ err }}</div>
    <div v-if="ok" class="ok-msg">{{ ok }}</div>

    <section class="secrets-form">
      <input v-model="form.plugin" class="input" placeholder="插件名，例如 GithubDownloader" />
      <input v-model="form.name" class="input" placeholder="名称，例如 token" />
      <input v-model="form.value" class="input" type="password" placeholder="密钥值" />
      <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存密钥' }}</button>
    </section>

    <div class="secrets-table-wrap">
      <table class="secrets-table">
        <thead><tr><th>插件</th><th>名称</th><th>掩码</th><th>更新时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="it in items" :key="it.id">
            <td>{{ it.plugin }}</td>
            <td>{{ it.name }}</td>
            <td class="mono">{{ it.hint }}</td>
            <td class="mono">{{ new Date(it.updated * 1000).toLocaleString() }}</td>
            <td><button class="btn btn-sm btn-danger" @click="del(it)">删除</button></td>
          </tr>
          <tr v-if="!items.length"><td colspan="5" class="empty">没有密钥</td></tr>
        </tbody>
      </table>
    </div>
    <div class="faint" style="font-size:11px;margin-top:8px;">文件保存在面板 data/secrets.json，权限 0600。插件读取密钥的 SDK 接口后续接入。</div>
  </div>
</template>

<style scoped>
.secrets-page { padding: 18px 22px 28px; }
.secrets-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.secrets-head h1 { margin: 0; font-size: 22px; }
.secrets-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.ok-msg { color: #2f9e44; font-size: 12px; margin: 8px 0; }
.secrets-form { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.secrets-form .input { width: 200px; }
.secrets-table-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: auto; background: var(--bg-card); }
.secrets-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.secrets-table th, .secrets-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.secrets-table th { color: var(--text-muted); }
.secrets-table .empty { text-align: center; color: var(--text-muted); padding: 20px; }
</style>
