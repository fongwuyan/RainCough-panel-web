<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

// 仓库配置(自插件市场页迁回设置页): 插件仓/程序仓 owner-repo-branch + GitHub Token 校验
const cfg = ref(null)
const showSettings = ref(true)
const tokenInput = ref('')
const pingUser = ref('')
const status = ref('')
const statusOk = ref(true)
const loading = ref(true)

function flash(msg, ok = true) {
  status.value = msg
  statusOk.value = ok
  setTimeout(() => { if (status.value === msg) status.value = '' }, 4000)
}

async function loadSettings() {
  loading.value = true
  try {
    const d = await api.storeSettings()
    cfg.value = d.config || {}
  } catch (e) {
    flash(`读取配置失败: ${e.message}`, false)
  } finally { loading.value = false }
}

async function saveSettings() {
  try {
    // 只提交后端真正接收的字段: machine_label/port/bind 是旧 store.py 遗留,
    // Go 侧既不解析也不回传(2026-09-28 审计定位后已从表单移除)。
    const body = { plugin_repo: cfg.value.plugin_repo, panel_repo: cfg.value.panel_repo }
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
  // 后端契约 {net:bool, auth:bool}; 旧版读 d.ok/d.user/d.error 恒报"Token 无效"
  try {
    const d = await api.storePing()
    if (d.net === false) {
      pingUser.value = ''
      flash('网络不通: 无法访问 api.github.com', false)
      return
    }
    if (d.auth) {
      pingUser.value = '已授权'
      flash('Token 校验通过 (GitHub 返回 200)')
    } else {
      pingUser.value = ''
      flash('Token 无效或未配置 (GitHub 未授权)', false)
    }
  } catch (e) {
    pingUser.value = ''
    flash(`校验失败: ${e.message}`, false)
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="section">
    <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
      <span>仓库配置</span>
      <button class="btn btn-sm btn-ghost" @click="showSettings = !showSettings">
        {{ showSettings ? '收起' : '展开' }}
      </button>
    </div>

    <div v-if="loading && !cfg" class="hint" style="padding:12px;">加载配置中...</div>

    <template v-else-if="cfg">
      <div v-if="showSettings" style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;">
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
            <input v-model="tokenInput" class="input" type="password" placeholder="ghp_xxx 个人访问令牌" style="flex:1;" />
            <button class="btn btn-sm" @click="ping">校验</button>
          </div>
          <div v-if="pingUser" style="font-size:12px;color:var(--success);margin-top:4px;">{{ pingUser }}</div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:8px;">
          <button class="btn btn-primary" @click="saveSettings">保存配置</button>
        </div>
      </div>

      <div v-else style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);">
        <span>插件仓:
          <b style="color:var(--text);font-family:var(--font-mono);">
            {{ cfg.plugin_repo.owner }}/{{ cfg.plugin_repo.repo }}
          </b>
        </span>
        <span>Token:
          <b :style="{ color: cfg.has_token ? 'var(--success)' : 'var(--danger)' }">
            {{ cfg.has_token ? '已配置' : '未配置' }}
          </b>
        </span>
      </div>
    </template>

    <div v-if="status" class="status-line" :class="statusOk ? 'ok' : 'fail'" style="padding:8px 0 0;">
      {{ status }}
    </div>
  </div>
</template>
