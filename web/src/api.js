async function req(method, url, body, isForm) {
  const opts = { method, headers: {} }
  if (body) {
    if (isForm) {
      opts.body = body
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // 把状态码与响应体挂到 Error 上: 调用方需要区分 401(未登录) / 403+need_password(插件库上锁)
    const err = new Error((data && data.error) || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

async function reqForm(url, fd) {
  return req('POST', url, fd, true)
}

// reqUpload 带上传进度的 form-data 请求(XHR; fetch 不支持上行进度)。
// onProgress(loaded, total) 可选; 返回解析后的 JSON, 非 2xx 抛错(同样挂 status/data)。
function reqUpload(url, fd, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.withCredentials = true
    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total)
      }
    }
    xhr.onload = () => {
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch (e) { /* 非 JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
        return
      }
      const err = new Error((data && data.error) || `HTTP ${xhr.status}`)
      err.status = xhr.status
      err.data = data
      reject(err)
    }
    xhr.onerror = () => reject(new Error('网络错误或连接被中断'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.send(fd)
  })
}

// authStatus 不抛 401: 该接口专用于「我登录了吗」, 401 = 未登录 = 正常状态
async function reqAuthNoThrow(url, opts = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...opts })
  let data = null
  try { data = await res.json() } catch (e) { /* 非 JSON(罕见) */ }
  return { ok: res.ok, status: res.status, data }
}

// 与后端路由一一对应。删掉的接口不再保留空壳(历史上"点了没反应"多源于此)。
function uploadFileId(path, file, idx) {
  const s = String(path || '/') + '|' + file.name + '|' + file.size + '|' + (file.lastModified || 0) + '|' + idx
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ('u' + (h >>> 0).toString(36)).slice(0, 64)
}

export const api = {

  // ---- 鉴权 ----
  // authStatus 永远不抛(401 = 未登录是合法状态, 给登录页/导航守卫用)
  authStatus: async () => {
    const r = await reqAuthNoThrow('/api/auth/status')
    return r.data || { logged_in: false }
  },
  authLogin: (password) => req('POST', '/api/auth/login', { password }),
  authLogout: () => req('POST', '/api/auth/logout', {}),
  // 登录策略: 是否允许用系统(SSH)密码登录(设置页开关)
  authLoginPolicy: () => req('GET', '/api/auth/login-policy'),
  authSetLoginPolicy: (allow) => req('POST', '/api/auth/login-policy', { allow_ssh_password: !!allow }),
  // 设置页改面板密码(至少 8 位; 其它设备的会话会被注销)
  authSetPassword: (pw) => req('POST', '/api/auth/password', { new_password: pw }),

  // ---- 插件 ----
  listPlugins: () => req('GET', '/api/plugins'),
  pluginInfo: (name) => req('GET', `/api/plugins/${encodeURIComponent(name)}`),
  removePlugin: (name) => req('DELETE', `/api/plugins/${name}`),

  // ---- 工作台 ----
  sysInfo: () => req('GET', '/api/system'),
  sysGpus: () => req('GET', '/api/system/gpus'),
  disks: () => req('GET', '/api/disks'),
  wsHistory: (points) => req('GET', '/api/workspace/history?points=' + (points || 600)),

  // ---- 接口库 / 服务健康 ----
  servicesHealth: () => req('GET', '/api/services/health'),
  audit: (params = {}) => {
    const qs = new URLSearchParams()
    for (const k of ['plugin', 'iface', 'caller', 'errors', 'limit']) if (params[k] !== undefined && params[k] !== '') qs.append(k, params[k])
    return req('GET', '/api/audit?' + qs.toString())
  },
  // 接口调用统计(工作台「接口库」卡片用, 5s 轮询)
  ifacesSummary: () => req('GET', '/api/interfaces/stats/summary'),
  interfaces: (params = {}) => {
    const qs = new URLSearchParams()
    for (const k of ['source', 'plugin', 'visibility', 'status', 'q', 'page', 'page_size']) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') qs.append(k, params[k])
    }
    return req('GET', '/api/interfaces?' + qs.toString())
  },
  interfaceDetail: (id) => req('GET', '/api/interfaces/' + encodeURIComponent(id)),
  interfaceInvoke: (id, params, timeoutMs) => req('POST', '/api/interfaces/' + encodeURIComponent(id) + '/invoke', { params, timeout_ms: timeoutMs || 15000 }),
  interfacePolicy: (id, policy) => req('POST', '/api/interfaces/' + encodeURIComponent(id) + '/policy', policy),
  serviceList: () => req('GET', '/api/services/list'),
  // ★ 旧签名是 (unit, action) 并下发 {unit, action} —— 那是 v3 的 systemd 单元模型
  //   (unit=plugin-XXX.service)。v4 由 supervisor 管进程, 后端只认 {name, action},
  //   按 unit 传会解析出空名 → 400。前端此前没有任何调用方, 所以一直没暴露。
  serviceAction: (name, action) => req('POST', '/api/services/action', { name, action }),
  // 开机自启开关。后端用指针接收 on, 缺字段会明确 400 而不是静默当 false
  serviceAutostart: (name, on) => req('POST', '/api/services/autostart', { name, on }),
  // 插件运行时日志(读 supervisor 的 .runtime.log, 进程死了也能看)
  serviceLog: (name, lines, grep) => {
    let u = '/api/services/log?name=' + encodeURIComponent(name) + '&lines=' + (lines || 200)
    if (grep) u += '&grep=' + encodeURIComponent(grep)
    return req('GET', u)
  },

  // ---- 文件管理 ----
  fmList: (path) => req('GET', `/api/fm/list?path=${encodeURIComponent(path || '/')}`),
  fmUpload: (path, files, conflict = 'rename', onProgress) => {
    const CHUNK = 8 * 1024 * 1024
    return (async () => {
      const saved = []
      const errors = []
      const list = [...files]
      for (let fi = 0; fi < list.length; fi++) {
        const file = list[fi]
        const total = Math.max(1, Math.ceil(file.size / CHUNK))
        const fileId = uploadFileId(path, file, fi)
        let received = new Set()
        try {
          const r = await fetch('/api/fm/upload/status?file_id=' + encodeURIComponent(fileId) + '&total_chunks=' + total)
          if (r.ok) {
            const st = await r.json()
            received = new Set((st && st.received) || [])
          }
        } catch (e) { /* 状态不可用时从头上传 */ }
        try {
          for (let i = 0; i < total; i++) {
            // 最后一块即使已收到也重发一次：后端靠最后一块触发拼装
            if (received.has(i) && i < total - 1) {
              if (onProgress) onProgress({ file: fi + 1, of: list.length, name: file.name, done: false, totalBytes: file.size, loadedBytes: (i + 1) * CHUNK })
              continue
            }
            const chunk = file.slice(i * CHUNK, Math.min((i + 1) * CHUNK, file.size))
            await new Promise((resolve, reject) => {
              const fd = new FormData()
              fd.append('path', path || '/')
              fd.append('filename', file.name)
              fd.append('file_id', fileId)
              fd.append('chunk_index', String(i))
              fd.append('total_chunks', String(total))
              fd.append('conflict', conflict)
              fd.append('chunk', chunk)
              const xhr = new XMLHttpRequest()
              xhr.open('POST', '/api/fm/upload/chunk')
              xhr.upload.onprogress = (ev) => {
                if (onProgress && ev.lengthComputable) {
                  onProgress({ file: fi + 1, of: list.length, name: file.name,
                    done: false, totalBytes: file.size, loadedBytes: i * CHUNK + ev.loaded })
                }
              }
              xhr.onload = () => {
                try {
                  const data = JSON.parse(xhr.responseText)
                  if (xhr.status >= 200 && xhr.status < 300 && data.ok) resolve(data)
                  else reject(new Error(data.error || ('HTTP ' + xhr.status)))
                } catch (e) { reject(new Error('响应解析失败')) }
              }
              xhr.onerror = () => reject(new Error('网络错误'))
              xhr.send(fd)
            })
          }
          saved.push(file.name)
          if (onProgress) onProgress({ file: fi + 1, of: list.length, name: file.name,
            done: true, totalBytes: file.size, loadedBytes: file.size })
        } catch (e) {
          errors.push(file.name + ': ' + (e.message || e))
          if (onProgress) onProgress({ file: fi + 1, of: list.length, name: file.name, done: true, error: true })
        }
      }
      return { saved, errors }
    })()
  },
  fmUploadStatus: (fileId, total) => req('GET', '/api/fm/upload/status?file_id=' + encodeURIComponent(fileId) + '&total_chunks=' + (total || 1)),
  fmDownload: (path, mode) => {
    const m = mode || 'direct'
    return `/api/fm/download?path=${encodeURIComponent(path)}&mode=${m}`
  },
  fmMkdir: (path) => req('POST', '/api/fm/mkdir', { path }),
  fmRename: (path, newName) => req('POST', '/api/fm/rename', { path, new_name: newName }),
  fmBatchRename: (paths, opts = {}) => req('POST', '/api/fm/batch-rename', { paths, ...opts }),
  fmTrash: (paths) => req('POST', '/api/fm/trash', { paths }),
  fmTrashList: () => req('GET', '/api/fm/trash'),
  fmTrashRestore: (id) => req('POST', '/api/fm/trash/restore/' + encodeURIComponent(id), {}),
  fmTrashPurge: (id) => req('POST', '/api/fm/trash/purge/' + encodeURIComponent(id), {}),
  fmTrashPurgeAll: () => req('POST', '/api/fm/trash/purge', { all: true }),
  fmHash: (path, algo) => req('GET', `/api/fm/hash?path=${encodeURIComponent(path)}&algo=${algo}`),
  fmUnzip: (archive, dest, password) => req('POST', '/api/fm/unzip', { archive, dest, password }),
  fmSave: (path, content, encoding) => req('POST', '/api/fm/save', { path, content, encoding: encoding || 'utf-8' }),
  fmSize: (paths) => req('POST', '/api/fm/size', { paths }),
  fmOpsStart: (op, paths, opts = {}) => req('POST', '/api/fm/ops', { op, paths, ...opts }),
  fmOpsList: () => req('GET', '/api/fm/ops'),
  fmOpsCancel: (id) => req('POST', `/api/fm/ops/${id}/cancel`),
  fmOpsRemove: (id) => req('DELETE', `/api/fm/ops/${id}`),
  fmPreview: (path) => req('GET', `/api/fm/preview?path=${encodeURIComponent(path)}`),
  fmSearch: (params) => {
    const qs = new URLSearchParams()
    for (const k of ['path', 'q', 'kind', 'min_size', 'max_size', 'mtime_days', 'offset']) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') qs.append(k, params[k])
    }
    return req('GET', `/api/fm/search?${qs.toString()}`)
  },

  // ---- 终端 ----
  tmOpen: (rows, cols) => req('POST', '/api/terminal/open', { rows: rows || 24, cols: cols || 100 }),
  tmInput: (sid, data) => req('POST', '/api/terminal/input', { sid, data }),
  tmResize: (sid, rows, cols) => req('POST', '/api/terminal/resize', { sid, rows, cols }),
  tmClose: (sid) => req('POST', '/api/terminal/close', { sid }),
  tmHostsList: () => req('GET', '/api/terminal/hosts'),
  tmHostCreate: (h) => req('POST', '/api/terminal/hosts', h),
  tmHostUpdate: (h) => req('PUT', '/api/terminal/hosts', h),
  tmHostDelete: (host) => req('DELETE', `/api/terminal/hosts?host=${encodeURIComponent(host)}`),
  // 后端 /hosts/set_sort 读 {hosts:[...]} 数组(原 sort_list 键名+形状双错 → 恒 400)
  tmCommandsList: () => req('GET', '/api/terminal/commands'),
  tmCommandCreate: (c) => req('POST', '/api/terminal/commands', c),
  tmCommandUpdate: (c) => req('PUT', '/api/terminal/commands', c),
  tmCommandDelete: (title) => req('DELETE', `/api/terminal/commands?title=${encodeURIComponent(title)}`),

  // ---- 多盘存储策略 ----
  storageInfo: () => req('GET', '/api/storage'),
  storageSave: (cfg) => req('POST', '/api/storage', cfg),
  storageTarget: (kind) => req('GET', `/api/storage/target?kind=${encodeURIComponent(kind || 'uploads')}`),

  // ---- 统一任务队列 ----
  taskQueue: (includeDone, limit) => req('GET', `/api/tasks?done=${includeDone ? '1' : '0'}&limit=${limit || 0}`),
  // 单条任务详情(含 meta): 任务列表页打开展开时用, 列表接口不返回大字段
  taskDetail: (id) => req('GET', `/api/tasks/${encodeURIComponent(id)}`),
  taskAction: (action, id) => req('POST', '/api/tasks', { action, id }),
  taskQueuePurge: () => req('POST', '/api/tasks/purge'),

  // ---- 节点管理 ----
  nodes: () => req('GET', '/api/nodes'),
  nodeSave: (node) => req('POST', '/api/nodes', node),
  nodeDelete: (id) => req('POST', '/api/nodes/delete', { id }),
  nodeTest: (id) => req('POST', '/api/nodes/test', { id }),
  nodeStatus: (id) => req('GET', `/api/nodes/status?id=${encodeURIComponent(id)}`),
  nodeSSHTest: (b) => req('POST', '/api/nodes/ssh-test', b),
  nodeInstall: (id) => req('POST', '/api/nodes/install', { id }),
  nodePreflight: (id) => req('POST', '/api/nodes/preflight', { id }),
  nodePower: (id, action) => req('POST', '/api/nodes/power', { id, action }),
  nodeTrainState: (id) => req('GET', `/api/node-train?node_id=${encodeURIComponent(id)}`),
  nodeTrainStart: (id, reqData) => req('POST', '/api/node-train/start', { node_id: id, req: reqData }),
  nodeTrainStop: (id) => req('POST', '/api/node-train/stop', { node_id: id }),
  nodeDatasets: (id) => req('GET', `/api/node-datasets?node_id=${encodeURIComponent(id)}`),
  nodeDatasetCreate: (id, name) => req('POST', '/api/node-datasets/create', { node_id: id, name }),
  nodeDatasetUpload: (id, name, filename, image_b64, caption) => req('POST', '/api/node-datasets/upload', { node_id: id, name, filename, image_b64, caption }),
  nodeDatasetDelete: (id, name) => req('POST', '/api/node-datasets/delete', { node_id: id, name }),

  // ---- 插件市场 ----
  storeSettings: () => req('GET', '/api/store/settings'),
  storeSaveSettings: (cfg) => req('POST', '/api/store/settings', cfg),
  storePing: () => req('POST', '/api/store/ping', {}),
  // ---- 插件市场 ----
  // 插件库上锁: 拉清单/装插件/更新都会 403 + need_password
  storeGateStatus: async () => {
    const r = await reqAuthNoThrow('/api/store/gate')
    return r.data || { locked: false, enabled: false }
  },
  storeGateUnlock: (password) => req('POST', '/api/store/gate/unlock', { password }),
  storeGateLock: () => req('POST', '/api/store/gate/lock', {}),
  storeRegistry: () => req('GET', '/api/store/registry'),
  // 运行时能力: 支持哪些插件语言、各解释器是否就绪(前端判断"不兼容"的依据)
  pluginsRuntime: () => req('GET', '/api/plugins/runtime'),
  // 插件环境检查(只读): 读 plugin.json 的 environment 块并逐项探测。
  // 可反复调用, 有耗时(会执行检查命令), 别放进列表接口或定时轮询里。
  pluginEnv: (name) => req('GET', `/api/plugins/${encodeURIComponent(name)}/environment`),  // steps 只传步骤 id, 不传命令 —— 命令由后端从插件清单里取,
  // 前端永远碰不到"让面板执行任意 shell"这条路。
  pluginEnvApply: (name, steps) => req('POST', `/api/plugins/${encodeURIComponent(name)}/environment/apply`,
                                       { steps: steps || [], confirm: true }),
  pluginConfigList: () => req('GET', '/api/plugin-config/list'),
  pluginConfigGet: (plugin) => req('GET', '/api/plugin-config?plugin=' + encodeURIComponent(plugin)),
  pluginConfigSave: (plugin, config) => req('POST', '/api/plugin-config', { plugin, config }),
  pluginBackups: (name) => req('GET', `/api/plugins/${encodeURIComponent(name)}/backups`),
  pluginDeps: () => req('GET', '/api/plugin-deps'),
  assets: (params = {}) => {
    const qs = new URLSearchParams()
    for (const k of ['plugin', 'kind', 'q', 'offset', 'limit']) if (params[k] !== undefined && params[k] !== '') qs.append(k, params[k])
    return req('GET', '/api/assets?' + qs.toString())
  },
  assetDelete: (plugin, path) => req('POST', '/api/assets/delete', { plugin, path }),
  assetRename: (plugin, path, newName) => req('POST', '/api/assets/rename', { plugin, path, new_name: newName }),
  assetArchive: (plugin, path) => req('GET', '/api/assets/archive?plugin=' + encodeURIComponent(plugin) + '&path=' + encodeURIComponent(path)),
  assetArchiveEntryUrl: (plugin, path, entry) => '/api/assets/archive/entry?plugin=' + encodeURIComponent(plugin) + '&path=' + encodeURIComponent(path) + '&entry=' + encodeURIComponent(entry),
  assetDocUrl: (plugin, path) => '/api/assets/doc?plugin=' + encodeURIComponent(plugin) + '&path=' + encodeURIComponent(path),
  tokens: () => req('GET', '/api/tokens'),
  tokenCreate: (name, scope) => req('POST', '/api/tokens', { name, scope }),
  tokenDelete: (id) => req('DELETE', '/api/tokens', { id }),
  notificationState: () => req('GET', '/api/notifications/state'),
  saveNotificationState: (keys) => req('POST', '/api/notifications/state', { keys }),
  pluginRollback: (name, backup) => req('POST', `/api/plugins/${encodeURIComponent(name)}/rollback`, { backup }),
  secrets: () => req('GET', '/api/secrets'),
  secretSave: (plugin, name, value, id) => req('POST', '/api/secrets', { plugin, name, value, id }),
  secretDelete: (id) => req('DELETE', '/api/secrets', { id }),
  backups: () => req('GET', '/api/backup'),
  backupCreate: () => req('POST', '/api/backup', {}),
  backupDownloadUrl: (name) => '/api/backup/download?name=' + encodeURIComponent(name),
  backupRestore: (name, dryRun) => req('POST', '/api/backup/restore', { name, dry_run: !!dryRun }),
  schedules: () => req('GET', '/api/schedules'),
  scheduleSave: (job) => req('POST', '/api/schedules', job),
  scheduleDelete: (id) => req('DELETE', '/api/schedules', { id }),
  scheduleRun: (id) => req('POST', '/api/schedules/run', { id }),
  // 面板内直接安装: 上传本地插件包(zip/tar.gz), 与"从仓库安装"是两套逻辑
  storePluginUpload: (fd, onProgress) => reqUpload('/api/store/plugin/upload', fd, onProgress),
  storePluginInstall: (name) => req('POST', '/api/store/plugin/install', { name }),
  storePluginUpdate: (name) => req('POST', '/api/store/plugin/update', { name }),
  storePluginRemove: (name) => req('POST', '/api/store/plugin/remove', { name }),
  panelVersion: () => req('GET', '/api/panel/version'),  panelInstallCommand: () => req('GET', '/api/panel/install-command'),
  panelUpdateCheck: () => req('GET', '/api/panel/update/check'),
  panelUpdateState: () => req('GET', '/api/panel/update/state'),
  panelUpdateApply: (version) => req('POST', '/api/panel/update/apply', { version: version || '' }),
  // 本地上传面板包(.tar.gz): 不依赖 GitHub Release, 自己构建的版本也能直接装。
  // 落盘/校验/备份/覆盖/回滚与在线更新共用同一实现。
  panelUpdateUpload: (fd, onProgress) => reqUpload('/api/panel/update/upload', fd, onProgress),
  // 回滚到备份版本(备份路径传空 = 用 updateState 里记录的最近一次备份)
  panelUpdateRollback: (backup) => req('POST', '/api/panel/update/rollback', { backup: backup || '' }),
  // 移动端 REST 访问密钥: /<插件名>/api/... 前缀通道的凭证, App 用它免登录访问插件数据
  restKey: () => req('GET', '/api/panel/restkey'),
  restKeyRotate: () => req('POST', '/api/panel/restkey', {}),
  panelUpdateRestart: () => req('POST', '/api/panel/update/restart', {}),
}
