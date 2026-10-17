import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'
import { verNewer, verOlderInRepo } from '../../version'

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

  // 面板内直接安装(上传本地插件包) — 与"从仓库安装"完全独立的通道
  const uploadOpen = ref(false)
  const uploadBusy = ref(false)
  const uploadPct = ref(0)
  const uploadErr = ref('')
  const uploadResult = ref(null)
  const uploadFile = ref('')

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

  // 后端语言支持判断 —— 以 GET /api/plugins/runtime 为唯一事实来源。
  //
  // ★ 2026-10-17 事故记录: 这段函数定义曾被一次"替换版本比较代码"的编辑误删,
  //   只剩 onMounted 里的调用和末尾的导出, 于是点「插件」页直接白屏报
  //   ReferenceError: loadRuntime is not defined。
  //   教训: 用字符串切片改代码必须重新 grep 一遍被删区间里的所有符号。
  //
  // 历史背景: 这里曾硬编码 `lang !== 'go' → 不兼容 v6`。v6 早期确实只支持 Go
  // 静态二进制, 后来 internal/pluginrt 支持了 py/php/java/node/bash, 前端那份
  // 判断没跟着改, 导致 JMComic(Python)明明能跑却一直标红。
  // 现在读后端探测结果; LANG_FALLBACK 仅用于接口暂不可用时降级显示。
  const runtimeInfo = ref(null)
  const LANG_FALLBACK = ['go', 'binary', 'python', 'python3', 'php', 'java', 'node', 'nodejs', 'bash', 'sh']

  async function loadRuntime() {
    try {
      runtimeInfo.value = await api.pluginsRuntime()
    } catch (e) {
      runtimeInfo.value = null // 退到兜底列表
    }
  }

  const supportedLangs = computed(() => {
    const d = runtimeInfo.value
    if (d && Array.isArray(d.languages) && d.languages.length) return d.languages
    return LANG_FALLBACK
  })

  // langUnavailable: 语言受支持但环境缺解释器(如声明 python 但没装)
  function langUnavailable(p) {
    const d = runtimeInfo.value
    if (!d || !p || !p.lang) return false
    const lang = String(p.lang).toLowerCase()
    const detail = (d.details || []).find((x) => String(x.lang).toLowerCase() === lang)
    return !!(detail && detail.supported && !detail.available)
  }

  // incompatible 语言根本不在支持列表里(未知语言)
  function incompatible(p) {
    if (!p || !p.lang) return false // 未声明语言: 按二进制处理, 不拦
    const langs = supportedLangs.value.map((s) => String(s).toLowerCase())
    return !langs.includes(String(p.lang).toLowerCase())
  }

  // 版本比较统一走 ../version.js —— 面板与插件共用一份实现, 不再各处手写。
  // 只有"市场版本严格高于已装版本"才算可更新(否则会引导用户降级)。
  function hasUpdate(p) {
    if (!p || !p.installed) return false
    return verNewer(p.version, p.installed_version)
  }

  // localNewer 本地已装版本比市场更高(本地开发版/预发布/市场清单未更新)。
  // 这种情况不该提示"可更新", 否则点了会降级。
  function localNewer(p) {
    if (!p || !p.installed) return false
    return verOlderInRepo(p.version, p.installed_version)
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

  // ---- 面板内直接安装(上传本地插件包) ----

  function openUpload() {
    uploadOpen.value = true
    uploadErr.value = ''
    uploadResult.value = null
    uploadPct.value = 0
    uploadFile.value = ''
  }

  function closeUpload() {
    if (uploadBusy.value) return   // 上传中不允许关闭(避免半截请求)
    uploadOpen.value = false
    uploadErr.value = ''
    uploadResult.value = null
    uploadPct.value = 0
    uploadFile.value = ''
  }

  const UPLOAD_EXT = ['.zip', '.tar.gz', '.tgz', '.tar']

  function pickExtOk(name) {
    const n = (name || '').toLowerCase()
    return UPLOAD_EXT.some((x) => n.endsWith(x))
  }

  // installFromFile 上传并安装。成功返回结果对象, 失败返回 null(错误写在 uploadErr)
  async function installFromFile(file) {
    if (!file) { uploadErr.value = '请选择插件包'; return null }
    if (!pickExtOk(file.name)) {
      uploadErr.value = '不支持的格式: 仅 .zip / .tar.gz / .tgz / .tar'
      return null
    }
    uploadBusy.value = true
    uploadErr.value = ''
    uploadResult.value = null
    uploadPct.value = 0
    uploadFile.value = file.name
    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const d = await api.storePluginUpload(fd, (loaded, total) => {
        uploadPct.value = total ? Math.min(99, Math.round((loaded / total) * 100)) : 0
      })
      uploadPct.value = 100
      uploadResult.value = d || { ok: true }
      flash((d && d.message) || '安装成功')
      // 已装列表要立刻刷新(新插件出现在「已安装」页签)
      await loadInstalled()
      await loadHealth()
      return uploadResult.value
    } catch (e) {
      uploadErr.value = (e && e.message) || '安装失败'
      return null
    } finally {
      uploadBusy.value = false
    }
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
    loadRuntime() // 先拉运行时能力, incompatible() 才有依据
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
    uploadOpen, uploadBusy, uploadPct, uploadErr, uploadResult, uploadFile,
    filteredInstalled, filteredMarket, onlineCount,
    runtimeInfo, langUnavailable,
    hasUpdate, localNewer, incompatible, flash,
    refresh, refreshAll, loadMarket, loadGate, unlock, lockGate,
    openUpload, closeUpload, installFromFile, pickExtOk,
    install, update, remove,
  }
}
