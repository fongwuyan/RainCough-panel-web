import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../../api'
import { useUi } from '../../stores/ui'

// 设置页数据层: 主题、仓库配置、面板信息、维护动作。
export function useSettings() {
  const { theme, setTheme } = useUi()

  const cfg = reactive({ plugin_repo: { owner: '', repo: '', branch: '' }, panel_repo: { owner: '', repo: '', branch: '' } })
  const loading = ref(true)
  const saving = ref(false)
  const pinging = ref(false)
  const pingState = ref('') // '' | ok | fail
  const pingMsg = ref('')

  // 插件库密钥(替换原「访问令牌」): 口令哈希写死在二进制里, 不需要保存, 只做解锁验证
  const gatePW = ref('')
  const gateLocked = ref(true)
  const gateEnabled = ref(false)
  const gateBusy = ref(false)

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
    } catch (e) {
      flash('读取仓库配置失败: ' + (e.message || e), false)
    } finally {
      loading.value = false
    }
    await loadGate()
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

  // loadGate 读插件库密钥的当前状态(已解锁/未解锁)
  async function loadGate() {
    try {
      const d = await api.storeGateStatus()
      gateEnabled.value = !!(d && d.enabled)
      gateLocked.value = !(d && d.locked === false)
    } catch (e) {
      gateEnabled.value = false
      gateLocked.value = true
    }
  }

  // unlockGate 提交密钥; 成功则清空输入并提示
  async function unlockGate() {
    if (gateBusy.value || !gatePW.value) return
    gateBusy.value = true
    try {
      await api.storeGateUnlock(gatePW.value)
      gatePW.value = ''
      gateLocked.value = false
      flash('密钥已生效')
    } catch (e) {
      flash((e && e.message) || '密钥错误', false)
    } finally {
      gateBusy.value = false
    }
  }

  // lockGate 让密钥失效(下次需重新输入)
  async function lockGate() {
    gateBusy.value = true
    try {
      await api.storeGateLock()
      gateLocked.value = true
      flash('已上锁')
    } catch (e) {
      flash((e && e.message) || '操作失败', false)
    } finally {
      gateBusy.value = false
    }
  }

  async function saveRepo() {
    saving.value = true
    try {
      const body = { plugin_repo: cfg.plugin_repo, panel_repo: cfg.panel_repo }
      const d = await api.storeSaveSettings(body)
      const c = (d && d.config) || {}
      cfg.plugin_repo = c.plugin_repo || cfg.plugin_repo
      cfg.panel_repo = c.panel_repo || cfg.panel_repo
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
      } else if (d && d.public) {
        // 公开仓库靠匿名就够: 即便面板里残留了失效的旧 token 也不影响使用
        pingState.value = 'ok'
        pingMsg.value = d.auth ? '连接正常' : '连接正常（公开仓库，无需密钥）'
      } else if (d && d.auth) {
        // 私有仓库 + 有效 token
        pingState.value = 'ok'
        pingMsg.value = '连接正常'
      } else {
        pingState.value = 'fail'
        pingMsg.value = '读不到插件库清单：仓库可能是私有的，且未配置有效密钥'
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
    cfg, loading, saving, pinging, pingState, pingMsg,
    gatePW, gateLocked, gateEnabled, gateBusy,
    panel, sys, status, statusOk, repoSummary,
    flash, load, loadGate, unlockGate, lockGate, saveRepo, ping, clearDoneTasks,
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
