import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

// 工作台数据层: 系统快照(1.5s) + 常驻历史(5s) + GPU(手动/10s)。
// 视图只负责排版, 所有轮询与派生值都在这里。
export function useWorkspace() {
  const sys = ref(null)
  const gpus = ref([])
  const gpuErr = ref('')
  const gpuLoading = ref(false)
  const err = ref('')
  const hist = ref({ series: [], points: [] })
  const ifacesStats = ref(null)
  const health = ref(null)
  const plugins = ref([])
  const tasks = ref([])
  const updatedAt = ref(0)
  const now = ref(Date.now())

  let tSys = null
  let tHist = null
  let tBus = null
  let tClock = null

  const cpu = computed(() => num(sys.value && sys.value.cpu_percent))
  const cores = computed(() => (sys.value && sys.value.cpu_per_core) || [])
  const load = computed(() => (sys.value && sys.value.load_avg) || [0, 0, 0])

  const memTotal = computed(() => num(sys.value && sys.value.memory_total))
  const memUsed = computed(() => num(sys.value && sys.value.memory_used))
  const memPct = computed(() => num(sys.value && sys.value.memory_percent))
  const swapTotal = computed(() => num(sys.value && sys.value.swap_total))
  const swapUsed = computed(() => num(sys.value && sys.value.swap_used))
  const swapPct = computed(() => num(sys.value && sys.value.swap_percent))

  const upRate = computed(() => num(sys.value && sys.value.net_up_rate))
  const downRate = computed(() => num(sys.value && sys.value.net_down_rate))
  const ifaces = computed(() => (sys.value && sys.value.net_interfaces) || [])

  const disks = computed(() => (sys.value && sys.value.disks) || [])
  const diskPct = computed(() => num(sys.value && sys.value.disk_percent))

  const uptime = computed(() => num(sys.value && sys.value.uptime))
  const bootTime = computed(() => num(sys.value && sys.value.boot_time))

  const histPoints = computed(() => hist.value.points || [])

  // col 取历史里某个 series 的整列; 找不到返回空数组
  function col(name) {
    const i = (hist.value.series || []).indexOf(name)
    if (i < 0) return []
    return histPoints.value.map((p) => (p.v && p.v[i]) || 0)
  }

  const histCpu = computed(() => col('cpu'))
  const histMem = computed(() => col('mem'))
  const histSwap = computed(() => col('swap'))
  const histUp = computed(() => col('up'))
  const histDown = computed(() => col('down'))
  const histDisk = computed(() => col('disk'))
  const histL1 = computed(() => col('l1'))
  const histL5 = computed(() => col('l5'))
  const histL15 = computed(() => col('l15'))
  const histCore = computed(() => {
    const out = []
    for (let i = 0; i < cores.value.length; i++) out.push(col('pc' + i))
    return out
  })

  async function loadSys() {
    try {
      sys.value = await api.sysInfo()
      err.value = ''
      updatedAt.value = Date.now()
    } catch (e) {
      err.value = e.message || String(e)
    }
  }

  async function loadHist() {
    try {
      const d = await api.wsHistory(180)
      hist.value = { series: d.series || [], points: d.points || [] }
    } catch (e) {
      /* 历史失败不影响实时卡片 */
    }
  }

  // 接口库 / 服务 / 插件 / 任务: 运营侧状态, 5s 刷新一次
  async function loadBus() {
    try { ifacesStats.value = await api.ifacesSummary() } catch (e) { /* 忽略 */ }
    try { health.value = await api.servicesHealth() } catch (e) { /* 忽略 */ }
    try {
      const d = await api.listPlugins()
      plugins.value = Array.isArray(d) ? d : []
    } catch (e) { /* 忽略 */ }
    try {
      const d = await api.taskQueue(false, 8)
      tasks.value = (d && d.tasks) || []
    } catch (e) { /* 忽略 */ }
  }

  async function loadGpus() {
    gpuLoading.value = true
    try {
      const d = await api.sysGpus()
      gpus.value = (d && d.gpus) || []
      gpuErr.value = ''
    } catch (e) {
      gpuErr.value = e.message || String(e)
    } finally {
      gpuLoading.value = false
    }
  }

  onMounted(() => {
    loadSys()
    loadHist()
    loadBus()
    loadGpus()
    tSys = setInterval(loadSys, 1500)
    tHist = setInterval(loadHist, 5000)
    tBus = setInterval(loadBus, 5000)
    tClock = setInterval(() => (now.value = Date.now()), 1000)
  })

  onUnmounted(() => {
    clearInterval(tSys)
    clearInterval(tHist)
    clearInterval(tBus)
    clearInterval(tClock)
  })

  return {
    sys, err, updatedAt, now, gpus, gpuErr, gpuLoading,
    cpu, cores, load, memTotal, memUsed, memPct, swapTotal, swapUsed, swapPct,
    upRate, downRate, ifaces, disks, diskPct, uptime, bootTime,
    histPoints, histCpu, histMem, histSwap, histUp, histDown, histDisk, histCore,
    histL1, histL5, histL15, ifacesStats, health, plugins, tasks,
    loadSys, loadGpus,
  }
}

export function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function fmtBytes(n) {
  n = num(n)
  if (n <= 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return (n < 10 ? n.toFixed(1) : n.toFixed(0)) + ' ' + u[i]
}

export function fmtRate(n) {
  return fmtBytes(n) + '/s'
}

export function fmtDuration(sec) {
  sec = Math.floor(num(sec))
  if (sec <= 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m} 分`
}

export function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
