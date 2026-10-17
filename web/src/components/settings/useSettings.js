import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../../api'
import { useUi } from '../../stores/ui'

// 设置页数据层: 主题、仓库配置、面板信息、维护动作。
export function useSettings() {
  const { theme, setTheme } = useUi()

  const cfg = reactive({ plugin_repo: { owner: '', repo: '', branch: '' }, panel_repo: { owner: '', repo: '', branch: '' }, has_token: false })
  const token = ref('')
  const loading = ref(true)
  const saving = ref(false)
  const pinging = ref(false)
  const pingState = ref('') // '' | ok | fail
  const pingMsg = ref('')

  const panel = ref(null)
  const sys = ref(null)

  const status = ref('')
  const statusOk = ref(true)
  let statusTimer = null

  function flash(msg, ok = true) {
    status.value = msg
    statusOk.value = ok
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      if (status.value === msg) status.value = ''
    }, 4000)
  }

  const repoSummary = computed(() => {
    const p = cfg.plugin_repo || {}
    if (!p.owner || !p.repo) return '未配置'
    return `${p.owner}/${p.repo}@${p.branch || 'main'}`
  })

  async function load() {
    loading.value = true
    try {
      const d = await api.storeSettings()
      const c = (d && d.config) || {}
      cfg.plugin_repo = c.plugin_repo || { owner: '', repo: '', branch: 'main' }
      cfg.panel_repo = c.panel_repo || { owner: '', repo: '', branch: 'main' }
      cfg.has_token = !!c.has_token
    } catch (e) {
      flash('读取仓库配置失败: ' + (e.message || e), false)
    } finally {
      loading.value = false
    }
    try {
      panel.value = await api.panelVersion()
    } catch (e) {
      panel.value = null
    }
    try {
      sys.value = await api.sysInfo()
    } catch (e) {
      sys.value = null
    }
  }

  async function saveRepo() {
    saving.value = true
    try {
      const body = { plugin_repo: cfg.plugin_repo, panel_repo: cfg.panel_repo }
      if (token.value) body.github_token = token.value
      const d = await api.storeSaveSettings(body)
      const c = (d && d.config) || {}
      cfg.plugin_repo = c.plugin_repo || cfg.plugin_repo
      cfg.panel_repo = c.panel_repo || cfg.panel_repo
      cfg.has_token = !!c.has_token
      token.value = ''
      flash('配置已保存')
    } catch (e) {
      flash('保存失败: ' + (e.message || e), false)
    } finally {
      saving.value = false
    }
  }

  async function ping() {
    pinging.value = true
    pingState.value = ''
    pingMsg.value = ''
    try {
      const d = await api.storePing()
      if (d && d.net === false) {
        pingState.value = 'fail'
        pingMsg.value = '网络不通：连不上 api.github.com'
      } else if (d && d.auth) {
        pingState.value = 'ok'
        pingMsg.value = 'Token 有效'
      } else {
        pingState.value = 'fail'
        pingMsg.value = cfg.has_token ? 'Token 无效或已过期' : '未配置 Token'
      }
    } catch (e) {
      pingState.value = 'fail'
      pingMsg.value = e.message || String(e)
    } finally {
      pinging.value = false
    }
  }

  async function clearDoneTasks() {
    if (!confirm('清理所有已完成/失败的任务记录？')) return
    try {
      const d = await api.taskQueuePurge()
      flash('已清理 ' + ((d && d.removed) || 0) + ' 条任务记录')
    } catch (e) {
      flash('清理失败: ' + (e.message || e), false)
    }
  }

  onMounted(load)

  return {
    theme, setTheme,
    cfg, token, loading, saving, pinging, pingState, pingMsg,
    panel, sys, status, statusOk, repoSummary,
    flash, load, saveRepo, ping, clearDoneTasks,
  }
}

export function fmtUptime(sec) {
  sec = Math.floor(Number(sec) || 0)
  if (sec <= 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d) return `${d} 天 ${h} 小时`
  if (h) return `${h} 小时 ${m} 分`
  return `${m} 分`
}
