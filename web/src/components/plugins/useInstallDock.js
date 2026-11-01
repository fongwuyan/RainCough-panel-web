import { ref, computed } from 'vue'
import { api } from '../../api'

// 插件安装浮窗 —— 全局单例。
//
// 为什么是浮窗而不是页面内弹层:
//   装插件时用户经常要跳去查东西(NapCat 怎么装、模型 key 在哪申请)。
//   居中模态把整个面板挡死, 逼他先关掉再查、查完再找回来;
//   浮窗让"装"和"查"能并行。只有"要执行命令"这种必须暂停判断的时刻才上遮罩。
//
// 挂在 App.vue 上 → 切路由不消失, 这是它相对页内弹层的核心价值。
//
// 状态模型:
//   jobs[]      每个插件一次安装 = 一个 job
//   activeId    当前展开的 job
//   confirmBox  命令确认遮罩(执行前的最后一道关)

// 时间轴阶段。
//
// 未到达的阶段要"置灰但显示", 而不是藏起来 —— 用户最烦的就是盯着百分比猜还有几步。
// 阶段枚举与后端 Task.phase 对齐(市场安装走任务队列时会用同一套)。
export const INSTALL_PHASES = [
  { key: 'validate', label: '校验' },
  { key: 'write', label: '写入' },
  { key: 'env', label: '环境' },
  { key: 'verify', label: '验证' },
]

const jobs = ref([])
const activeId = ref('')
const confirmBox = ref(null)
let seq = 0

// 环境修复完成后的通知(插件列表那份缓存要失效, 否则徽标还是旧的)。
// 用 Set 而不是数组: 组件反复挂载/卸载不会重复注册。
const fixedListeners = new Set()

function notifyEnvFixed(name) {
  for (const cb of fixedListeners) {
    try { cb(name) } catch (e) { /* 监听器自己的问题不该影响主流程 */ }
  }
}

function blankSteps() {
  const m = {}
  for (const p of INSTALL_PHASES) m[p.key] = { state: 'wait', detail: '' }
  return m
}

export function useInstallDock() {
  const activeJob = computed(() => jobs.value.find((j) => j.id === activeId.value) || null)
  const openCount = computed(() => jobs.value.length)

  // openInstall 开一个安装浮窗。
  //
  // info: { name, label, version, message, env, error }
  // 上传安装是同步的 —— 拿到响应时"校验"和"写入"早已完成,
  // 所以这两格直接是完成态, 不装样子演一遍进度条。
  function openInstall(info) {
    const id = 'rcjob' + ++seq
    const failed = !!(info && info.error)
    const env = (info && info.env) || null
    const ready = !!(env && env.ready)

    const steps = blankSteps()
    steps.validate = { state: failed ? 'fail' : 'ok', detail: (info && info.error) || '' }
    steps.write = { state: failed ? 'skip' : 'ok', detail: '' }
    steps.env = { state: failed ? 'skip' : (ready ? 'ok' : 'run'), detail: '' }
    steps.verify = { state: failed ? 'skip' : (ready ? 'ok' : 'wait'), detail: '' }

    const job = {
      id,
      name: (info && info.name) || '',
      label: (info && info.label) || (info && info.name) || '',
      version: (info && info.version) || '',
      message: (info && info.message) || '',
      env,
      error: (info && info.error) || '',
      steps,
      busy: false,
      createdAt: Date.now(),
    }
    jobs.value = [job, ...jobs.value]
    activeId.value = id
    return id
  }

  // ensureJob 拿到(或建出)某个插件对应的 job。
  //
  // 为什么需要它: "一键修复"有两个发起入口 —— 安装浮窗和插件列表行内展开。
  // 两边都要走同一套确认流程, 所以按插件名找 job, 找不到就建一个。
  function ensureJob(info) {
    const name = (info && info.name) || ''
    let job = jobs.value.find((j) => j.name && j.name === name)
    if (!job) {
      const id = openInstall(info || {})
      job = jobs.value.find((j) => j.id === id)
    } else {
      // 已有 job: 用最新的报告覆盖(插件列表那份可能比浮窗里的新)
      if (info && info.env) job.env = info.env
      if (info && info.version) job.version = info.version
      if (info && info.label) job.label = info.label
    }
    return job
  }

  function closeJob(id) {
    jobs.value = jobs.value.filter((j) => j.id !== id)
    if (activeId.value === id) {
      activeId.value = jobs.value.length ? jobs.value[0].id : ''
    }
  }

  function setActive(id) {
    activeId.value = id
  }

  // pendingSteps 从报告里挑出待执行的步骤 id。
  //
  // 只挑"有对应 apply 步骤"且"当前未就绪"的项 ——
  // 已经 ok 的项点修复没有意义(后端也会跳过, 但前端就别去打扰它)。
  function pendingSteps(env) {
    if (!env || !env.items) return []
    const ids = []
    for (const it of env.items) {
      if (it.status === 'ok') continue
      if (!it.apply_steps || !it.apply_steps.length) continue
      for (const s of it.apply_steps) if (ids.indexOf(s) < 0) ids.push(s)
    }
    return ids
  }

  // requestApply 打开命令确认遮罩。
  //
  // ★ 这是整套安全模型里唯一真正起作用的一环: 用户能看见将要执行的命令原文。
  //   所以确认页里命令不折叠、不省略、不搞"展开查看详情"。
  function requestApply(info, stepIds) {
    const job = ensureJob(info)
    if (!job) return
    const env = job.env || {}
    const wanted = stepIds && stepIds.length ? stepIds : pendingSteps(env)
    if (!wanted.length) return
    const steps = (env.apply || []).filter((a) => wanted.indexOf(a.id) >= 0)
    if (!steps.length) return
    confirmBox.value = {
      jobId: job.id,
      title: job.label || job.name,
      steps,
      root: !!env.root,
      checked: false,
      running: false,
      error: '',
    }
  }

  function cancelConfirm() {
    if (confirmBox.value && confirmBox.value.running) return
    confirmBox.value = null
  }

  // runConfirm 真正执行。
  async function runConfirm() {
    const box = confirmBox.value
    if (!box || !box.checked || box.running) return
    box.running = true
    box.error = ''
    const job = jobs.value.find((j) => j.id === box.jobId)
    try {
      const ids = box.steps.map((s) => s.id)
      const res = await api.pluginEnvApply(job.name, ids)
      box.running = false
      confirmBox.value = null
      if (job) {
        if (res && res.env) job.env = res.env
        job.steps.env = { state: job.env && job.env.ready ? 'ok' : 'run', detail: '' }
        job.steps.verify = { state: job.env && job.env.ready ? 'ok' : 'wait', detail: '' }
        // 步骤级结果贴到时间轴的"环境"格里
        if (res && res.steps && res.steps.length) {
          const bad = res.steps.find((s) => s.status === 'failed')
          const denied = res.steps.filter((s) => s.status === 'denied')
          if (bad) {
            job.steps.env = { state: 'fail', detail: bad.detail || '步骤失败' }
          } else if (denied.length) {
            job.steps.env = { state: 'run', detail: denied[0].detail || '部分步骤因权限被跳过' }
          }
        }
        job.message = res && res.ok ? '环境已就绪' : (job.message || '环境处理完成')
      }
      notifyEnvFixed(job ? job.name : '')
      return res
    } catch (e) {
      box.running = false
      box.error = (e && e.message) || '执行失败'
      return null
    }
  }

  // refreshEnv 重新拉一次报告(装完手工改了环境时用)。
  async function refreshEnv(jobId) {
    const job = jobs.value.find((j) => j.id === jobId)
    if (!job || !job.name) return null
    job.busy = true
    try {
      const rep = await api.pluginEnv(job.name)
      job.env = rep
      job.steps.env = { state: rep.ready ? 'ok' : 'run', detail: '' }
      job.steps.verify = { state: rep.ready ? 'ok' : 'wait', detail: '' }
      return rep
    } catch (e) {
      job.error = (e && e.message) || '环境检查失败'
      return null
    } finally {
      job.busy = false
    }
  }

  // onEnvFixed 订阅"环境已修好"的回调, 返回取消订阅函数。
  function onEnvFixed(cb) {
    if (typeof cb !== 'function') return () => {}
    fixedListeners.add(cb)
    return () => fixedListeners.delete(cb)
  }

  return {
    jobs,
    activeId,
    activeJob,
    openCount,
    confirmBox,
    openInstall,
    ensureJob,
    closeJob,
    setActive,
    pendingSteps,
    requestApply,
    cancelConfirm,
    runConfirm,
    refreshEnv,
    onEnvFixed,
  }
}
