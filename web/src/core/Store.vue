<script setup>
// 插件市场 — 干净重写, 对接 /api/store(样式复刻旧 StorePlugins 布局)
import { ref, onMounted } from 'vue'
import { request } from '../api/client'

const plugins = ref([])
const loading = ref(false)
const error = ref('')
const status = ref('')
const statusOk = ref(false)
const busy = ref('')

const cfg = ref(null)
const showSettings = ref(false)
const tokenInput = ref('')
const pingUser = ref('')

async function loadRegistry() {
  loading.value = true
  error.value = ''
  try {
    const d = await request.get('/api/store/registry')
    plugins.value = d.plugins || []
  } catch (e) {
    error.value = e.message
    plugins.value = []
  }
  loading.value = false
}
async function loadSettings() {
  try { cfg.value = await request.get('/api/store/settings') } catch (e) { /* 忽略 */ }
}
function flash(msg, ok = true) {
  status.value = msg
  statusOk.value = ok
  setTimeout(() => { status.value = '' }, 2500)
}
async function ping() {
  try {
    const d = await request.post('/api/store/ping', {})
    pingUser.value = d.auth ? '认证成功' : '网络可达, 未认证'
    flash('GitHub: ' + (d.auth ? 'Token 有效' : 'Token 无效'))
  } catch (e) { flash('校验失败: ' + e.message, false) }
}
async function saveSettings() {
  try {
    const body = { plugin_repo: cfg.value.plugin_repo, panel_repo: cfg.value.panel_repo }
    if (tokenInput.value) body.token = tokenInput.value
    cfg.value = await request.post('/api/store/settings', body)
    tokenInput.value = ''
    pingUser.value = ''
    flash('配置已保存')
  } catch (e) { flash('保存失败: ' + e.message, false) }
}
async function doInstall(name) {
  busy.value = name
  try {
    await request.post('/api/store/plugin/install', { name })
    flash('已开始安装, 可在任务队列查看进度')
  } catch (e) { flash(e.message, false) }
  busy.value = ''
}
async function doRemove(name) {
  if (!confirm('确定卸载插件 ' + name + '?')) return
  busy.value = name
  try {
    await request.post('/api/store/plugin/remove', { name })
    flash('已卸载')
    await loadRegistry()
  } catch (e) { flash(e.message, false) }
  busy.value = ''
}

onMounted(() => { loadSettings(); loadRegistry() })
</script>

<template>
  <div class="page">
    <div class="page-head hero">
      <div>
        <h1>插件市场</h1>
        <p class="subtitle">GitHub 仓库插件安装</p>
      </div>
      <div class="toolbar">
        <button class="btn" @click="showSettings = !showSettings">设置</button>
        <button class="btn btn-primary" @click="loadRegistry">刷新</button>
      </div>
    </div>

    <div class="page-body">
      <div v-if="showSettings" class="section">
        <div class="section-title">仓库配置</div>
        <template v-if="cfg">
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <div class="lbl">插件仓库 owner/repo/branch</div>
              <div style="display:flex;gap:8px;">
                <input v-model="cfg.plugin_repo.owner" class="input" style="flex:1" placeholder="owner" />
                <input v-model="cfg.plugin_repo.repo" class="input" style="flex:1" placeholder="repo" />
                <input v-model="cfg.plugin_repo.branch" class="input" style="width:90px" placeholder="branch" />
              </div>
            </div>
            <div>
              <div class="lbl">Token {{ cfg.has_token ? '(已配置)' : '(未配置)' }}</div>
              <div style="display:flex;gap:8px;">
                <input v-model="tokenInput" class="input" type="password" placeholder="ghp_xxx" style="flex:1" />
                <button class="btn btn-sm" @click="ping">校验</button>
              </div>
              <div v-if="pingUser" class="ok" style="font-size:12px;margin-top:4px">✔ {{ pingUser }}</div>
            </div>
            <div><button class="btn btn-primary" @click="saveSettings">保存配置</button></div>
          </div>
        </template>
      </div>

      <div class="section">
        <div class="section-title">插件列表</div>
        <div v-if="error" class="error" style="padding:12px">{{ error }}</div>
        <div v-else-if="loading" class="hint" style="padding:16px">加载中...</div>
        <div v-else-if="!plugins.length" class="hint" style="padding:16px">仓库暂无插件或未配置 Token</div>
        <div class="result-item" v-for="p in plugins" :key="p.name">
          <div style="display:flex;align-items:center;gap:12px;width:100%;">
            <div style="flex:1;min-width:0;">
              <div class="name">{{ p.label || p.name }} <span class="mono faint" style="font-size:11px">{{ p.name }}</span></div>
              <div class="meta">版本 {{ p.version || '-' }}</div>
              <div v-if="p.description" class="note">{{ p.description }}</div>
            </div>
            <span v-if="p.installed" class="tag-chip">{{ p.installed_version ? '已装 ' + p.installed_version : '已装' }}</span>
            <button v-if="!p.installed" class="btn btn-sm btn-primary" :disabled="!!busy"
              @click="doInstall(p.name)">{{ busy === p.name ? '安装中…' : '安装' }}</button>
            <button v-else class="btn btn-sm btn-danger" :disabled="!!busy"
              @click="doRemove(p.name)">{{ busy === p.name ? '卸载中…' : '卸载' }}</button>
          </div>
        </div>
      </div>

      <div v-if="status" class="status-line" :class="statusOk ? 'ok' : 'fail'" style="padding:8px 0;">{{ status }}</div>
    </div>
  </div>
</template>

<style scoped>
.hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
.toolbar { display: flex; gap: 8px; }
.lbl { font-size: 12px; color: var(--text-faint); margin-bottom: 4px; }
.ok { color: var(--success); }
.status-line.ok { color: var(--success); }
.status-line.fail { color: var(--danger); }
</style>