<script setup>
// 系统中心 — 服务管理 + 进程 + 防火墙(对接 /api/sysfunc)
import { ref, onMounted } from 'vue'
import { request } from '../api/client'

const tab = ref('services')
const services = ref([])
const processes = ref([])
const fw = ref(null)
const loading = ref(false)

async function loadServices() {
  loading.value = true
  try {
    const d = await request.get('/api/sysfunc/service/list')
    services.value = d.services || []
  } catch (e) { alert(e.message) }
  loading.value = false
}
async function loadProcesses() {
  loading.value = true
  try {
    const d = await request.get('/api/sysfunc/process/list')
    processes.value = d.processes || []
  } catch (e) { alert(e.message) }
  loading.value = false
}
async function loadFw() {
  try {
    const d = await request.get('/api/sysfunc/fw/status')
    fw.value = d
  } catch (e) { /* 未启用跳过 */ }
}

async function svcAction(name, action) {
  if (action === 'stop' && !confirm('停止服务 ' + name + ' ?')) return
  try {
    await request.post('/api/sysfunc/service/action', { name, action })
    loadServices()
  } catch (e) { alert(e.message) }
}

async function killProc(pid) {
  if (!confirm('结束进程 ' + pid + ' ?')) return
  try {
    await request.post('/api/sysfunc/process/kill', { pid })
    loadProcesses()
  } catch (e) { alert(e.message) }
}

function switchTab(t) {
  tab.value = t
  if (t === 'services') loadServices()
  if (t === 'processes') loadProcesses()
  if (t === 'fw') loadFw()
}

onMounted(() => switchTab('services'))
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>系统中心</h1>
        <p class="subtitle">服务 · 进程 · 防火墙</p>
      </div>
      <div class="tabs">
        <button class="btn" :class="{ active: tab === 'services' }" @click="switchTab('services')">服务</button>
        <button class="btn" :class="{ active: tab === 'processes' }" @click="switchTab('processes')">进程</button>
        <button class="btn" :class="{ active: tab === 'fw' }" @click="switchTab('fw')">防火墙</button>
      </div>
    </div>

    <div class="page-body">
      <!-- 服务 -->
      <template v-if="tab === 'services'">
        <div class="summary">共 {{ services.length }} 个服务</div>
        <table class="table">
          <thead><tr><th>名称</th><th>状态</th><th>说明</th><th></th></tr></thead>
          <tbody>
            <tr v-for="s in services" :key="s.name">
              <td class="mono">{{ s.name }}</td>
              <td><span class="badge" :class="s.active === 'active' ? 'ok' : ''">{{ s.active }}</span></td>
              <td class="faint">{{ s.desc }}</td>
              <td class="actions">
                <template v-if="s.active !== 'active'">
                  <button class="btn btn-sm" @click="svcAction(s.name, 'start')">启动</button>
                </template>
                <template v-else>
                  <button class="btn btn-sm" @click="svcAction(s.name, 'restart')">重启</button>
                  <button class="btn btn-sm btn-danger" @click="svcAction(s.name, 'stop')">停止</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- 进程 -->
      <template v-if="tab === 'processes'">
        <div class="summary">共 {{ processes.length }} 个进程</div>
        <table class="table">
          <thead><tr><th>PID</th><th>用户</th><th>CPU%</th><th>内存%</th><th>命令</th><th></th></tr></thead>
          <tbody>
            <tr v-for="p in processes" :key="p.pid">
              <td class="mono">{{ p.pid }}</td>
              <td class="mono">{{ p.user }}</td>
              <td class="mono">{{ p.cpu }}</td>
              <td class="mono">{{ p.mem }}</td>
              <td class="mono faint cmd">{{ p.cmd }}</td>
              <td class="actions"><button class="btn btn-sm btn-danger" @click="killProc(p.pid)">结束</button></td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- 防火墙 -->
      <template v-if="tab === 'fw'">
        <div v-if="fw" class="section">
          <div class="section-title">ufw 状态</div>
          <p>启用: <b :class="fw.enabled ? 'ok' : ''">{{ fw.enabled ? '是' : '否' }}</b></p>
          <table v-if="fw.rules && fw.rules.length" class="table">
            <thead><tr><th>规则</th></tr></thead>
            <tbody><tr v-for="r in fw.rules" :key="r"><td class="mono">{{ r }}</td></tr></tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.tabs { display: flex; gap: 6px; }
.tabs .btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.summary { color: var(--text-faint); font-size: 12px; padding: 4px 2px 8px; }
.badge { padding: 2px 8px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 12px; }
.badge.ok { background: var(--success-soft); color: var(--success); }
.actions { white-space: nowrap; text-align: right; }
.cmd { max-width: 45vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>