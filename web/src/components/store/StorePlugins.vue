<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

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
    const d = await api.storeRegistry()
    plugins.value = d.plugins || []
  } catch (e) {
    error.value = e.message
    plugins.value = []
  } finally {
    loading.value = false
  }
}

async function loadSettings() {
  try {
    const d = await api.storeSettings()
    cfg.value = d.config || {}
  } catch (e) {}
}

function flash(msg, ok = true) {
  status.value = msg
  statusOk.value = ok
  setTimeout(() => { status.value = '' }, 2500)
}

async function saveSettings() {
  try {
    const body = {
      machine_label: cfg.value.machine_label,
      port: Number(cfg.value.port),
      bind: cfg.value.bind,
      plugin_repo: cfg.value.plugin_repo,
      panel_repo: cfg.value.panel_repo,
    }
    if (tokenInput.value) body.github_token = tokenInput.value
    const d = await api.storeSaveSettings(body)
    cfg.value = d.config
    tokenInput.value = ''
    pingUser.value = ''
    flash('配置已保存')
  } catch (e) {
    flash(`保存失败: ${e.message}`, false)
  }
}

async function ping() {
  try {
    const d = await api.storePing()
    if (d.ok) {
      pingUser.value = d.user || 'ok'
      flash(`Token 有效, 用户: ${d.user || '?'}`)
    } else {
      pingUser.value = ''
      flash(`Token 无效: ${d.error || ''}`, false)
    }
  } catch (e) {
    pingUser.value = ''
    flash(`校验失败: ${e.message}`, false)
  }
}

async function doInstall(name) {
  busy.value = name
  try {
    await api.storePluginInstall(name)
    flash('已开始安装, 可在任务队列查看进度')
  } catch (e) {
    flash(e.message, false)
  } finally {
    busy.value = ''
  }
}

async function doUpdate(name) {
  busy.value = name
  try {
    await api.storePluginUpdate(name)
    flash('已开始更新, 可在任务队列查看进度')
  } catch (e) {
    flash(e.message, false)
  } finally {
    busy.value = ''
  }
}

async function doRemove(name) {
  if (!confirm(`确定卸载插件 ${name}?`)) return
  busy.value = name
  try {
    await api.storePluginRemove(name)
    flash('已卸载')
    await loadRegistry()
  } catch (e) {
    flash(e.message, false)
  } finally {
    busy.value = ''
  }
}

onMounted(() => { loadSettings(); loadRegistry() })
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>插件市场</h1>
      <div class="subtitle">从 RainCough-Plugin 仓库拉取并安装插件</div>
    </div>
    <div class="page-body">
      <div class="section">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>仓库配置</span>
          <button class="btn btn-sm btn-ghost" @click="showSettings = !showSettings">{{ showSettings ? '收起' : '展开' }}</button>
        </div>
        <template v-if="cfg">
          <div v-if="showSettings" style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;">
            <div>
              <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">机器标识</div>
              <input v-model="cfg.machine_label" class="input" type="text" placeholder="备注本机用途" style="width:100%;" />
            </div>
            <div style="display:flex;gap:8px;">
              <div style="flex:1;">
                <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">端口</div>
                <input v-model.number="cfg.port" class="input" type="number" style="width:100%;" />
              </div>
              <div style="flex:1;">
                <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">绑定地址</div>
                <input v-model="cfg.bind" class="input" type="text" style="width:100%;" />
              </div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">插件仓库 owner/repo/branch</div>
              <div style="display:flex;gap:8px;">
                <input v-model="cfg.plugin_repo.owner" class="input" type="text" placeholder="owner" style="flex:1;" />
                <input v-model="cfg.plugin_repo.repo" class="input" type="text" placeholder="repo" style="flex:1;" />
                <input v-model="cfg.plugin_repo.branch" class="input" type="text" placeholder="branch" style="width:90px;" />
              </div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">程序仓库 owner/repo/branch</div>
              <div style="display:flex;gap:8px;">
                <input v-model="cfg.panel_repo.owner" class="input" type="text" placeholder="owner" style="flex:1;" />
                <input v-model="cfg.panel_repo.repo" class="input" type="text" placeholder="repo" style="flex:1;" />
                <input v-model="cfg.panel_repo.branch" class="input" type="text" placeholder="branch" style="width:90px;" />
              </div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text-faint);margin-bottom:4px;">
                GitHub Token {{ cfg.has_token ? '(已配置, 留空则不修改)' : '(未配置)' }}
              </div>
              <div style="display:flex;gap:8px;">
                <input v-model="tokenInput" class="input" type="password" placeholder="ghp_xxx / ghp 个人访问令牌" style="flex:1;" />
                <button class="btn btn-sm" @click="ping">校验</button>
              </div>
              <div v-if="pingUser" style="font-size:12px;color:var(--success);margin-top:4px;">✔ {{ pingUser }}</div>
            </div>
            <div style="display:flex;align-items:flex-end;gap:8px;">
              <button class="btn btn-primary" @click="saveSettings">保存配置</button>
            </div>
          </div>
          <div v-else style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
            <span>机器: <b style="color:var(--text);">{{ cfg.machine_label || '未设置' }}</b></span>
            <span>插件仓: <b style="color:var(--text);font-family:var(--font-mono);">{{ cfg.plugin_repo.owner }}/{{ cfg.plugin_repo.repo }}</b></span>
            <span>Token: <b :style="{ color: cfg.has_token ? 'var(--success)' : 'var(--danger)' }">{{ cfg.has_token ? '已配置' : '未配置' }}</b></span>
          </div>
        </template>
        <div v-else class="hint" style="padding:12px;">加载配置中...</div>
      </div>

      <div class="section">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>插件列表</span>
          <button class="btn btn-sm" :disabled="loading" @click="loadRegistry">刷新</button>
        </div>
        <div v-if="error" class="error" style="padding:12px;">{{ error }}</div>
        <div v-else-if="loading" class="hint" style="padding:16px;">加载中...</div>
        <div v-else-if="!plugins.length" class="hint" style="padding:16px;">仓库暂无插件或未配置 Token</div>
        <div v-else class="result-item" v-for="p in plugins" :key="p.name">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="flex:1;min-width:0;">
              <div class="name">{{ p.label || p.name }} <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-faint);">{{ p.name }}</span></div>
              <div class="meta">
                版本 {{ p.version || '-' }}
                <span v-if="p.author" style="margin-left:10px;">作者: {{ p.author }}</span>
              </div>
              <div v-if="p.description" class="note">{{ p.description }}</div>
            </div>
            <span v-if="p.installed" class="tag-chip">
              {{ p.installed_version ? `已装 ${p.installed_version}` : '已装' }}
            </span>
            <button
              v-if="!p.installed"
              class="btn btn-primary btn-sm"
              :disabled="!!busy"
              @click="doInstall(p.name)"
            >{{ busy === p.name ? '安装中…' : '安装' }}</button>
            <template v-else>
              <button class="btn btn-sm" :disabled="!!busy" @click="doUpdate(p.name)">{{ busy === p.name ? '更新中…' : '更新' }}</button>
              <button class="btn btn-sm btn-danger" :disabled="!!busy" @click="doRemove(p.name)">卸载</button>
            </template>
          </div>
        </div>
      </div>

      <div v-if="status" class="status-line" :class="statusOk ? 'ok' : 'fail'" style="padding:8px 0;">{{ status }}</div>
    </div>
  </div>
</template>
