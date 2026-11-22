<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const items = ref([])
const loading = ref(false)
const busy = ref(false)
const err = ref('')
const ok = ref('')

async function load() {
  loading.value = true; err.value = ''
  try { const d = await api.backups(); items.value = (d && d.items) || [] }
  catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}
async function create() {
  busy.value = true; err.value = ''; ok.value = ''
  try { const d = await api.backupCreate(); ok.value = '已创建：' + d.name; await load() }
  catch (e) { err.value = e.message || String(e) }
  finally { busy.value = false }
}
async function restore(it) {
  if (!confirm('恢复「' + it.name + '」会覆盖当前面板配置和插件 config.json。继续？')) return
  busy.value = true; err.value = ''; ok.value = ''
  try {
    const d = await api.backupRestore(it.name, false)
    ok.value = '已恢复 ' + d.files + ' 个文件；安全备份：' + (d.safety_backup || '无') + '；请重启面板'
    await load()
  } catch (e) { err.value = e.message || String(e) }
  finally { busy.value = false }
}
function fmtSize(n) {
  n = Number(n) || 0
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB'
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}
function fmtTime(ts) { return ts ? new Date(ts * 1000).toLocaleString() : '—' }
onMounted(load)
</script>

<template>
  <div class="page backup-page">
    <div class="backup-head">
      <div><h1>备份</h1><p class="sub">备份面板版本、data 元数据和插件 config.json；不包含插件代码和媒体文件</p></div>
      <div class="flex" style="gap:8px;">
        <button class="btn" :disabled="loading" @click="load">刷新</button>
        <button class="btn btn-primary" :disabled="busy" @click="create">{{ busy ? '创建中…' : '创建备份' }}</button>
      </div>
    </div>
    <div v-if="err" class="error">{{ err }}</div>
    <div v-if="ok" class="ok-msg">{{ ok }}</div>
    <div class="backup-table-wrap">
      <table class="backup-table">
        <thead><tr><th>文件</th><th>大小</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="it in items" :key="it.name">
            <td class="mono">{{ it.name }}</td>
            <td>{{ fmtSize(it.size) }}</td>
            <td class="mono">{{ fmtTime(it.time) }}</td>
            <td><a class="btn btn-sm" :href="api.backupDownloadUrl(it.name)">下载</a> <button class="btn btn-sm" @click="restore(it)">恢复</button></td>
          </tr>
          <tr v-if="!items.length"><td colspan="4" class="empty">没有备份</td></tr>
        </tbody>
      </table>
    </div>
    <div class="faint" style="font-size:11px;margin-top:8px;">备份文件保存在面板 data/backups/；恢复会覆盖 data/ 与插件 config.json，并自动先创建安全备份。</div>
  </div>
</template>

<style scoped>
.backup-page { padding: 18px 22px 28px; }
.backup-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.backup-head h1 { margin: 0; font-size: 22px; }
.backup-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.ok-msg { color: #2f9e44; font-size: 12px; margin: 8px 0; }
.backup-table-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: auto; background: var(--bg-card); margin-top: 12px; }
.backup-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.backup-table th, .backup-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.backup-table th { color: var(--text-muted); }
.backup-table .empty { text-align: center; color: var(--text-muted); padding: 20px; }
</style>
