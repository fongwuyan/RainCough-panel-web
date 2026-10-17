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

// authStatus 不抛 401: 该接口专用于「我登录了吗」, 401 = 未登录 = 正常状态
async function reqAuthNoThrow(url, opts = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...opts })
  let data = null
  try { data = await res.json() } catch (e) { /* 非 JSON(罕见) */ }
  return { ok: res.ok, status: res.status, data }
}

// 与后端路由一一对应。删掉的接口不再保留空壳(历史上"点了没反应"多源于此)。
export const api = {

  // ---- 鉴权 ----
  // authStatus 永远不抛(401 = 未登录是合法状态, 给登录页/导航守卫用)
  authStatus: async () => {
    const r = await reqAuthNoThrow('/api/auth/status')
    return r.data || { logged_in: false }
  },
  authLogin: (password) => req('POST', '/api/auth/login', { password }),
  authLogout: () => req('POST', '/api/auth/logout', {}),

  // ---- 插件 ----
  listPlugins: () => req('GET', '/api/plugins'),
  pluginInfo: (name) => req('GET', `/api/plugins/${encodeURIComponent(name)}`),
  removePlugin: (name) => req('DELETE', `/api/plugins/${name}`),

  // ---- 工作台 ----
  sysInfo: () => req('GET', '/api/system'),
  sysGpus: () => req('GET', '/api/system/gpus'),
  disks: () => req('GET', '/api/disks'),
  diskUnmount: (device) => req('POST', '/api/disks/unmount', { device }),
  netStatus: () => req('GET', '/api/net/status'),
  wsHistory: (points) => req('GET', '/api/workspace/history?points=' + (points || 600)),

  // ---- 接口库 / 服务健康 ----
  ifaces: (params) => {
    const q = new URLSearchParams()
    for (const k in params || {}) if (params[k]) q.set(k, params[k])
    return req('GET', '/api/interfaces?' + q.toString())
  },
  ifaceDetail: (id) => req('GET', '/api/interfaces/' + encodeURIComponent(id)),
  ifaceInvoke: (id, params, timeoutMs) => req('POST', `/api/interfaces/${encodeURIComponent(id)}/invoke`, { params, timeout_ms: timeoutMs }),
  ifacesSummary: () => req('GET', '/api/interfaces/stats/summary'),
  servicesHealth: () => req('GET', '/api/services/health'),
  servicesHealthLog: (name, lines, grep) => {
    let u = '/api/services/health/log?name=' + encodeURIComponent(name) + '&lines=' + (lines || 200)
    if (grep) u += '&grep=' + encodeURIComponent(grep)
    return req('GET', u)
  },
  // 插件服务列表/操作(运行时由 Go 自管, 不再经 systemd)
  serviceList: () => req('GET', '/api/services/list'),
  serviceAction: (unit, action) => req('POST', '/api/services/action', { unit, action }),

  // ---- 文件管理 ----
  fmList: (path) => req('GET', `/api/fm/list?path=${encodeURIComponent(path || '/')}`),
  fmUpload: (path, files, conflict = 'rename', onProgress) => {
    const CHUNK = 8 * 1024 * 1024
    const fileBase = Math.random().toString(36).slice(2) + Date.now().toString(36)
    return (async () => {
      const saved = []
      const errors = []
      const list = [...files]
      for (let fi = 0; fi < list.length; fi++) {
        const file = list[fi]
        const total = Math.max(1, Math.ceil(file.size / CHUNK))
        try {
          for (let i = 0; i < total; i++) {
            const chunk = file.slice(i * CHUNK, Math.min((i + 1) * CHUNK, file.size))
            await new Promise((resolve, reject) => {
              const fd = new FormData()
              fd.append('path', path || '/')
              fd.append('filename', file.name)
              fd.append('file_id', fileBase + '_' + fi)
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
  fmDownload: (path, mode) => {
    const m = mode || 'direct'
    return `/api/fm/download?path=${encodeURIComponent(path)}&mode=${m}`
  },
  fmMkdir: (path) => req('POST', '/api/fm/mkdir', { path }),
  fmRename: (path, newName) => req('POST', '/api/fm/rename', { path, new_name: newName }),
  fmDelete: (paths) => req('POST', '/api/fm/delete', { paths }),
  fmHash: (path, algo) => req('GET', `/api/fm/hash?path=${encodeURIComponent(path)}&algo=${algo}`),
  fmUnzip: (archive, dest, password) => req('POST', '/api/fm/unzip', { archive, dest, password }),
  fmRead: (path, limit, offset) => req('GET', `/api/fm/read?path=${encodeURIComponent(path)}&limit=${limit || 5242880}&offset=${offset || 0}`),
  fmSave: (path, content, encoding) => req('POST', '/api/fm/save', { path, content, encoding: encoding || 'utf-8' }),
  fmSize: (paths) => req('POST', '/api/fm/size', { paths }),
  fmOpsStart: (op, paths, opts = {}) => req('POST', '/api/fm/ops', { op, paths, ...opts }),
  fmOpsList: () => req('GET', '/api/fm/ops'),
  fmOpsCancel: (id) => req('POST', `/api/fm/ops/${id}/cancel`),
  fmOpsRemove: (id) => req('DELETE', `/api/fm/ops/${id}`),
  fmOpsDownload: (id) => `/api/fm/ops/${id}/download`,
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
  tmHostSort: (hosts) => req('POST', '/api/terminal/hosts/set_sort', { hosts }),
  tmCommandsList: () => req('GET', '/api/terminal/commands'),
  tmCommandCreate: (c) => req('POST', '/api/terminal/commands', c),
  tmCommandUpdate: (c) => req('PUT', '/api/terminal/commands', c),
  tmCommandDelete: (title) => req('DELETE', `/api/terminal/commands?title=${encodeURIComponent(title)}`),

  // ---- 统一任务队列 ----
  taskQueue: (includeDone, limit) => req('GET', `/api/tasks?done=${includeDone ? '1' : '0'}&limit=${limit || 0}`),
  taskQueuePurge: () => req('POST', '/api/tasks/purge'),

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
  storePluginInstall: (name) => req('POST', '/api/store/plugin/install', { name }),
  storePluginUpdate: (name) => req('POST', '/api/store/plugin/update', { name }),
  storePluginRemove: (name) => req('POST', '/api/store/plugin/remove', { name }),
  storeChangelog: () => req('GET', '/api/store/changelog'),

  // ---- 面板更新(常驻浮窗) ----
  // ⚠ 这 8 个方法曾整体缺失, PanelUpdate.vue 里 api.panelVersion 等一直是 undefined,
  // 一调用就抛 TypeError, 悬浮窗永远停在空壳。改名时请同步 PanelUpdate.vue。
  panelVersion: () => req('GET', '/api/panel/version'),
  panelInstallCommand: () => req('GET', '/api/panel/install-command'),
  panelUpdateCheck: () => req('GET', '/api/panel/update/check'),
  panelUpdateState: () => req('GET', '/api/panel/update/state'),
  panelUpdateApply: (version) => req('POST', '/api/panel/update/apply', { version: version || '' }),
  panelUpdateRestart: () => req('POST', '/api/panel/update/restart', {}),
  panelUpdateLog: () => req('GET', '/api/panel/update/log'),
  panelUpdateRollback: (backup) => req('POST', '/api/panel/update/rollback', { backup: backup || '' }),
}
