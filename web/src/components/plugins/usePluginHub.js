import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

// 插件中心数据层: 已装列表、市场清单、服务健康、安装任务。
export function usePluginHub() {
  const installed = ref([])
  const market = ref([])
  const marketSource = ref('')
  const health = ref(null)
  const tasks = ref([])
  const loading = ref(true)
  const marketLoading = ref(false)
  const err = ref('')
  const marketErr = ref('')
  const q = ref('')
  const busy = ref('')
  const toast = ref('')

  // 插件库口令闸门: 插件库是公开仓库, 拉清单/装插件需先输入口令
  const gateLocked = ref(false)
  const gateEnabled = ref(false)
  const gateBusy = ref(false)
  const gateErr = ref('')

  let tTask = null
  let tToast = null

  const filteredInstalled = computed(() => {
    const s = q.value.trim().toLowerCase()
    if (!s) return installed.value
    return installed.value.filter(
      (p) => (p.name + ' ' + (p.label || '') + ' ' + (p.description || '')).toLowerCase().includes(s)
    )
  })

  const filteredMarket = computed(() => {
    const s = q.value.trim().toLowerCase()
    if (!s) return market.value
    return market.value.filter(
      (p) => (p.name + ' ' + (p.label || '') + ' ' + (p.description || '')).toLowerCase().includes(s)
    )
  })

  const onlineCount = computed(() => installed.value.filter((p) => p.alive).length)

  // 市场里有新版: 已装且版本号不同
  function hasUpdate(p) {
    return !!(p.installed && p.installed_version && p.version && p.installed_version !== p.version)
  }

  // v6 只认 Go 插件; 旧 Python 插件标记为不兼容(装上也起不来)
  function incompatible(p) {
    return !!(p.lang && p.lang !== 'go')
  }

  const activeTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'running' || t.status === 'queued')
  )

  function flash(m) {
    toast.value = m
    clearTimeout(tToast)
    tToast = setTimeout(() => (toast.value = ''), 3000)
  }

  async function loadInstalled() {
    try {
      const d = await api.listPlugins()
      installed.value = Array.isArray(d) ? d : []
      err.value = ''
    } catch (e) {
      err.value = e.message || String(e)
    } finally {
      loading.value = false
    }
  }

  async function loadMarket() {
    marketLoading.value = true
    marketErr.value = ''
    try {
      const d = await api.storeRegistry()
      market.value = (d && d.plugins) || []
      marketSource.value = (d && d.source) || 'github'
      gateLocked.value = false
    } catch (e) {
      // 403 + need_password = 插件库上锁(不是故障, 不要显示成红色错误)
      if (e && e.status === 403 && e.data && e.data.need_password) {
        gateLocked.value = true
        gateEnabled.value = true
        marketErr.value = ''
      } else {
        marketErr.value = e.message || String(e)
      }
      market.value = []
    } finally {
      marketLoading.value = false
    }
  }

  // 拉闸门状态(进入页面时调用; 已解锁则不显示口令框)
  async function loadGate() {
    try {
      const d = await api.storeGateStatus()
      gateEnabled.value = !!(d && d.enabled)
      gateLocked.value = !!(d && d.locked)
    } catch (e) {
      gateEnabled.value = false
      gateLocked.value = false
    }
  }

  // 提交口令; 成功后自动拉清单
  async function unlock(password) {
    gateBusy.value = true
    gateErr.value = ''
    try {
      await api.storeGateUnlock(password)
      gateLocked.value = false
      await loadMarket()
      return true
    } catch (e) {
      gateErr.value = (e && e.message) || '口令错误'
      return false
    } finally {
      gateBusy.value = false
    }
  }

  // 主动上锁(下次要用再输口令)
  async function lockGate() {
    try {
      await api.storeGateLock()
    } catch (e) {
      /* 忽略: 即便失败, 前端也按已上锁显示 */
    }
    gateLocked.value = true
    market.value = []
    marketErr.value = ''
  }

  async function loadHealth() {
    try {
      health.value = await api.servicesHealth()
    } catch (e) {
      health.value = null
    }
  }

  async function loadTasks() {
    try {
      const d = await api.taskQueue(false, 20)
      tasks.value = ((d && d.tasks) || []).filter((t) => t.source === 'store')
    } catch (e) {
      /* 静默 */
    }
  }

  function startTaskPoll() {
    if (tTask) return
    tTask = setInterval(loadTasks, 1500)
  }

  function stopTaskPoll() {
    if (!tTask) return
    clearInterval(tTask)
    tTask = null
  }

  async function refresh() {
    await Promise.all([loadInstalled(), loadHealth(), loadTasks()])
  }

  async function refreshAll() {
    await refresh()
    await loadMarket()
  }

  async function install(name) {
    busy.value = name
    try {
      await api.storePluginInstall(name)
      flash('已提交安装: ' + name)
      startTaskPoll()
      await loadTasks()
    } catch (e) {
      flash('安装失败: ' + (e.message || e))
    } finally {
      busy.value = ''
    }
  }

  async function update(name) {
    busy.value = name
    try {
      await api.storePluginUpdate(name)
      flash('已提交更新: ' + name)
      startTaskPoll()
      await loadTasks()
    } catch (e) {
      flash('更新失败: ' + (e.message || e))
    } finally {
      busy.value = ''
    }
  }

  async function remove(name) {
    busy.value = name
    try {
      await api.storePluginRemove(name)
      flash('已移除: ' + name)
      await refreshAll()
    } catch (e) {
      flash('移除失败: ' + (e.message || e))
    } finally {
      busy.value = ''
    }
  }

  onMounted(() => {
    loadGate()
    refreshAll()
    loadTasks().then(() => {
      if (activeTasks.value.length) startTaskPoll()
    })
  })

  onUnmounted(() => {
    stopTaskPoll()
    clearTimeout(tToast)
  })

  return {
    installed, market, marketSource, health, tasks, activeTasks,
    loading, marketLoading, err, marketErr, q, busy, toast,
    gateLocked, gateEnabled, gateBusy, gateErr,
    filteredInstalled, filteredMarket, onlineCount,
    hasUpdate, incompatible, flash,
    refresh, refreshAll, loadMarket, loadGate, unlock, lockGate, install, update, remove,
  }
}
