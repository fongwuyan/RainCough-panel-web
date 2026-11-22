<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const items = ref([])
const err = ref('')
const ok = ref('')
const form = ref({ name: '每日备份', action: 'backup', interval_sec: 86400, keep_days: 30 })
const busy = ref(false)

async function load() {
  try { const d = await api.schedules(); items.value = (d && d.items) || [] }
  catch (e) { err.value = e.message || String(e) }
}
async function add() {
  busy.value = true; err.value = ''; ok.value = ''
  try {
    await api.scheduleSave({ ...form.value, interval_sec: Number(form.value.interval_sec) || 3600, keep_days: Number(form.value.keep_days) || 30, enabled: true })
    ok.value = '已添加定时任务'
    await load()
  } catch (e) { err.value = e.message || String(e) }
  finally { busy.value = false }
}
async function run(it) {
  try { await api.scheduleRun(it.id); ok.value = '已触发：' + it.name } catch (e) { err.value = e.message || String(e) }
}
async function del(it) {
  if (!confirm('删除定时任务「' + it.name + '」？')) return
  try { await api.scheduleDelete(it.id); await load() } catch (e) { err.value = e.message || String(e) }
}
function fmt(ts) { return ts ? new Date(ts * 1000).toLocaleString() : '—' }
onMounted(load)
</script>

<template>
  <div class="page sched-page">
    <div class="sched-head"><div><h1>定时任务</h1><p class="sub">面板级备份与回收站清理；不编排插件业务</p></div><button class="btn" @click="load">刷新</button></div>
    <div v-if="err" class="error">{{ err }}</div>
    <div v-if="ok" class="ok-msg">{{ ok }}</div>
    <section class="sched-form">
      <input v-model="form.name" class="input" placeholder="任务名" />
      <select v-model="form.action" class="input">
        <option value="backup">创建备份</option>
        <option value="trash_cleanup">清理回收站</option>
      </select>
      <label class="sched-label">间隔(s) <input v-model.number="form.interval_sec" class="input" type="number" min="30" /></label>
      <label v-if="form.action === 'trash_cleanup'" class="sched-label">保留天数 <input v-model.number="form.keep_days" class="input" type="number" min="1" /></label>
      <button class="btn btn-primary" :disabled="busy" @click="add">添加</button>
    </section>
    <div class="sched-table-wrap">
      <table class="sched-table">
        <thead><tr><th>名称</th><th>动作</th><th>间隔</th><th>上次</th><th>下次</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="it in items" :key="it.id">
            <td>{{ it.name }}</td>
            <td>{{ it.action === 'backup' ? '备份' : '清理回收站' }}</td>
            <td>{{ Math.round((it.interval_sec || 0) / 60) }} 分钟</td>
            <td class="mono">{{ fmt(it.last_run) }}</td>
            <td class="mono">{{ fmt(it.next_run) }}</td>
            <td :class="it.last_error ? 'bad' : 'ok'">{{ it.last_error ? '失败' : (it.enabled ? '启用' : '暂停') }}</td>
            <td><button class="btn btn-sm" @click="run(it)">立即执行</button> <button class="btn btn-sm btn-danger" @click="del(it)">删除</button></td>
          </tr>
          <tr v-if="!items.length"><td colspan="7" class="empty">没有定时任务</td></tr>
        </tbody>
      </table>
    </div>
    <div v-if="items.some(x => x.last_error)" class="error" style="margin-top:8px;">{{ items.filter(x => x.last_error)[0].last_error }}</div>
  </div>
</template>

<style scoped>
.sched-page { padding: 18px 22px 28px; }
.sched-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.sched-head h1 { margin: 0; font-size: 22px; }
.sched-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.ok-msg { color: #2f9e44; font-size: 12px; margin: 8px 0; }
.sched-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
.sched-form .input { width: 150px; }
.sched-label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); }
.sched-label .input { width: 100px; }
.sched-table-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: auto; background: var(--bg-card); }
.sched-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sched-table th, .sched-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
.sched-table th { color: var(--text-muted); }
.sched-table .empty { text-align: center; color: var(--text-muted); padding: 20px; }
.ok { color: #2f9e44; }
.bad { color: var(--danger); }
</style>
