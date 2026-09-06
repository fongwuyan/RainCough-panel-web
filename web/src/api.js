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
    throw new Error((data && data.error) || `HTTP ${res.status}`)
  }
  return data
}

async function reqForm(url, fd) {
  return req('POST', url, fd, true)
}

export const api = {

  listPlugins: () => req('GET', '/api/plugins'),
  removePlugin: (name) => req('DELETE', `/api/plugins/${name}`),
  sysInfo: () => req('GET', '/api/system'),
  sysStorage: () => req('GET', '/api/storage'),
  disks: () => req('GET', '/api/disks'),
  diskUnmount: (device) => req('POST', '/api/disks/unmount', { device }),

  // 接口库 v4(自注册/服务总线)
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
  pluginInvoke: (name, iface, params, timeoutMs) => req('POST', `/api/plugins/${name}/invoke`, { iface, params, timeout_ms: timeoutMs }),

  mtImage: (files, opts) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('format', opts.format || '')
    fd.append('resize', opts.resize || '')
    fd.append('quality', opts.quality || '')
    fd.append('rotate', opts.rotate || '')
    return reqForm('/api/media/tool/image', fd)
  },
  mtPdf: (files, action, extra) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('action', action)
    if (extra) for (const k in extra) fd.append(k, String(extra[k]))
    return reqForm('/api/media/tool/pdf', fd)
  },
  mtMedia: (files, action, extra) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('action', action)
    if (extra) for (const k in extra) fd.append(k, String(extra[k]))
    return reqForm('/api/media/tool/media', fd)
  },
  mtInfo: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/media/tool/info', fd)
  },
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
  fmMove: (paths, dest) => req('POST', '/api/fm/move', { paths, dest }),
  fmCopy: (paths, dest) => req('POST', '/api/fm/copy', { paths, dest }),
  fmDelete: (paths) => req('POST', '/api/fm/delete', { paths }),
  fmHash: (path, algo) => req('GET', `/api/fm/hash?path=${encodeURIComponent(path)}&algo=${algo}`),
  fmUnzip: (archive, dest, password) => req('POST', '/api/fm/unzip', { archive, dest, password }),
  fmRead: (path, limit, offset) => req('GET', `/api/fm/read?path=${encodeURIComponent(path)}&limit=${limit || 5242880}&offset=${offset || 0}`),
  fmSave: (path, content, encoding) => req('POST', '/api/fm/save', { path, content, encoding: encoding || 'utf-8' }),
  fmSize: (paths) => req('POST', '/api/fm/size', { paths }),
  fmOpsStart: (op, paths, opts = {}) => req('POST', '/api/fm/ops', { op, paths, ...opts }),
  fmOpsList: () => req('GET', '/api/fm/ops'),
  fmOpsGet: (id) => req('GET', `/api/fm/ops/${id}`),
  fmOpsCancel: (id) => req('POST', `/api/fm/ops/${id}/cancel`),
  fmOpsRemove: (id) => req('DELETE', `/api/fm/ops/${id}`),
  fmOpsDownload: (id) => `/api/fm/ops/${id}/download`,
  fmArchive: (paths, format, name) => {
    const qs = new URLSearchParams({ format: format || 'zip', name: name || 'archive' })
    for (const p of paths) qs.append('paths', p)
    return `/api/fm/archive?${qs.toString()}`
  },
  fmPreview: (path) => req('GET', `/api/fm/preview?path=${encodeURIComponent(path)}`),
  fmSearch: (params) => {
    const qs = new URLSearchParams()
    for (const k of ['path', 'q', 'kind', 'min_size', 'max_size', 'mtime_days', 'offset']) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') qs.append(k, params[k])
    }
    return req('GET', `/api/fm/search?${qs.toString()}`)
  },
  sysfServiceAction: (unit, action) => req('POST', '/api/sysfunc/service/action', { unit, action }),
  sysfFw: () => req('GET', '/api/sysfunc/fw/all'),
  sysfHardware: () => req('GET', '/api/sysfunc/hardware'),
  sysfUpdatesRefresh: () => req('POST', '/api/sysfunc/updates/refresh', {}),
  sysfUpdatesList: () => req('GET', '/api/sysfunc/updates/list'),
  sysfUpdatesRun: () => req('POST', '/api/sysfunc/updates/run', { confirm: 'yes' }),
  sysfCronGet: (user) => req('GET', `/api/sysfunc/cron/get?user=${user || ''}`),
  sysfCronSave: (user, content) => req('POST', '/api/sysfunc/cron/save', { user, content }),
  sysfDisks: () => req('GET', '/api/sysfunc/disks/fs'),
  sysfSnapCap: () => req('GET', '/api/sysfunc/snapshot/cap'),
  sysfSnapCreate: (name) => req('POST', '/api/sysfunc/snapshot/create', { name }),
  sysfSnapList: () => req('GET', '/api/sysfunc/snapshot/list'),
  sysfUsers: () => req('GET', '/api/sysfunc/users'),
  sysfSshKeys: (user) => req('GET', `/api/sysfunc/ssh/keys?user=${encodeURIComponent(user)}`),
  sysfSshKeysSave: (user, keys) => req('POST', '/api/sysfunc/ssh/keys/save', { user, keys }),

  // 系统 (日志 / 进程)
  sysLogs: (lines, grep) => req('GET', `/api/sys/logs?lines=${lines || 200}&grep=${encodeURIComponent(grep || '')}`),
  sysProcesses: (sort) => req('GET', `/api/sys/processes?sort=${sort || 'cpu'}`),

  sysKill: (pid, sig) => req('POST', '/api/sys/processes/kill', { pid, sig }),
  schedActions: () => req('GET', '/api/scheduler/actions'),

  schedJobs: () => req('GET', '/api/scheduler/jobs'),
  schedCreate: (data) => req('POST', '/api/scheduler/jobs', data),

  schedUpdate: (id, data) => req('PUT', `/api/scheduler/jobs/${id}`, data),
  schedDelete: (id) => req('DELETE', `/api/scheduler/jobs/${id}`),

  schedPause: (id) => req('POST', `/api/scheduler/jobs/${id}/pause`),
  schedResume: (id) => req('POST', `/api/scheduler/jobs/${id}/resume`),

  schedRun: (id) => req('POST', `/api/scheduler/jobs/${id}/run`),
  mediaRoots: () => req('GET', '/api/media/roots'),
  mediaSaveRoots: (roots) => req('POST', '/api/media/roots', { roots }),
  mediaStats: () => req('GET', '/api/media/stats'),
  mediaList: (root, kind, page, tag) => req('GET', `/api/media/list?root=${encodeURIComponent(root)}&kind=${kind || ''}&page=${page || 0}&tag=${encodeURIComponent(tag || '')}`),
  mediaThumb: (path) => `/api/media/thumb?path=${encodeURIComponent(path)}`,
  mediaFile: (path) => `/api/media/file?path=${encodeURIComponent(path)}`,
  mediaTag: (paths) => req('POST', '/api/media/tag', { paths }),
  mediaTags: (path) => req('GET', `/api/media/tags?path=${encodeURIComponent(path)}`),
  mediaDedup: (root) => req('POST', '/api/media/dedup', { root }),

  vmInfo: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/media/tool/vmerge?action=info', fd)
  },
  vmExtract: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/media/tool/vmerge?action=extract', fd)
  },
  tbMediaInfo: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/media/tool/media?action=info', fd)
  },
  tbMediaProcess: (files, action, extra) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('action', action)
    if (extra) for (const k in extra) fd.append(k, String(extra[k]))
    return reqForm('/api/media/tool/media?action=convert', fd)
  },
  tbMediaMerge: (files) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return reqForm('/api/media/tool/media?action=merge', fd)
  },
  tmWsToken: () => req('GET', '/api/terminal/ws_token'),
  tmWsUrl: async (rows, cols) => {
    const d = await req('GET', '/api/terminal/ws_token')
    const host = d.host || window.location.hostname
    const port = d.port || 23080
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${host}:${port}/?token=${encodeURIComponent(d.token)}&rows=${rows}&cols=${cols}`
  },
  tmHostsList: () => req('GET', '/api/terminal/hosts'),
  tmHostCreate: (h) => req('POST', '/api/terminal/hosts', h),
  tmHostUpdate: (h) => req('PUT', '/api/terminal/hosts', h),
  tmHostDelete: (host) => req('DELETE', `/api/terminal/hosts?host=${encodeURIComponent(host)}`),
  tmHostSort: (sortList) => req('POST', '/api/terminal/hosts/set_sort', { sort_list: sortList }),
  tmCommandsList: () => req('GET', '/api/terminal/commands'),
  tmCommandCreate: (c) => req('POST', '/api/terminal/commands', c),
  tmCommandUpdate: (c) => req('PUT', '/api/terminal/commands', c),
  tmCommandDelete: (title) => req('DELETE', `/api/terminal/commands?title=${encodeURIComponent(title)}`),

  // 环境包管理 (envpkg 系统模块)
  envRecipes: () => req('GET', '/api/envpkg/recipes'),
  envCatalog: () => req('GET', '/api/envpkg/catalog'),
  envList: () => req('GET', '/api/envpkg/envs'),
  envInstall: (name) => req('POST', '/api/envpkg/install', { name }),
  envInstallRT: (type, version) => req('POST', '/api/envpkg/install', { type, version }),
  envTask: (id) => req('GET', `/api/envpkg/tasks/${id}`),
  envUninstall: (name) => req('POST', '/api/envpkg/uninstall', { name }),
  envStart: (name) => req('POST', '/api/envpkg/start', { name }),
  envStop: (name) => req('POST', '/api/envpkg/stop', { name }),
  envRun: (name, command, timeout) => req('POST', '/api/envpkg/run', { name, command, timeout }),

  // 统一任务队列
  taskQueue: (includeDone, limit) => req('GET', `/api/tasks?done=${includeDone ? '1' : '0'}&limit=${limit || 0}`),
  taskQueuePurge: () => req('POST', '/api/tasks/purge'),

  // 插件市场 / 面板更新 (store)
  storeSettings: () => req('GET', '/api/store/settings'),
  storeSaveSettings: (cfg) => req('POST', '/api/store/settings', cfg),
  storePing: () => req('POST', '/api/store/ping', {}),
  storeRegistry: () => req('GET', '/api/store/registry'),
  storePluginInstall: (name) => req('POST', '/api/store/plugin/install', { name }),
  storePluginUpdate: (name) => req('POST', '/api/store/plugin/update', { name }),
  storePluginRemove: (name) => req('POST', '/api/store/plugin/remove', { name }),
  storeProjectStatus: () => req('GET', '/api/store/project/status'),
  storeProjectUpdateInfo: () => req('GET', '/api/store/project/update-info'),
  storeProjectCheck: (net) => req('POST', '/api/store/project/check', { net }),
  storeProjectInstall: (dryRun) => req('POST', '/api/store/project/install', { dry_run: !!dryRun }),
  tmOpen: (rows, cols) => req('POST', '/api/terminal/open', { rows: rows || 24, cols: cols || 100 }),
  tmInput: (sid, data) => req('POST', '/api/terminal/input', { sid, data }),
  tmResize: (sid, rows, cols) => req('POST', '/api/terminal/resize', { sid, rows, cols }),
  tmClose: (sid) => req('POST', '/api/terminal/close', { sid }),

  // 系统级功能·第二批
  sysfCleanScan: () => req('GET', '/api/sysfunc/clean/scan'),
  sysfCleanDo: (item) => req('POST', '/api/sysfunc/clean/do', { item }),
  sysfPerf: (hours) => req('GET', `/api/sysfunc/perf/history?hours=${hours || 24}`),
  sysfNet: () => req('GET', '/api/sysfunc/net/status'),
  sysfPwrPlan: (action, minutes) => req('POST', '/api/sysfunc/pwr/plan', { action, minutes }),
  sysfPwrCancel: () => req('POST', '/api/sysfunc/pwr/cancel', {}),
  sysfPwrState: () => req('GET', '/api/sysfunc/pwr/state'),
  sysfKernels: () => req('GET', '/api/sysfunc/kernels'),
  sysfKernelRemove: (pkg) => req('POST', '/api/sysfunc/kernels/remove', { pkg, confirm: 'yes' }),
  sysfTime: () => req('GET', '/api/sysfunc/time/status'),
  sysfTimeSync: () => req('POST', '/api/sysfunc/time/sync', {}),
  sysfHealth: () => req('GET', '/api/sysfunc/health/check'),
  sysfHealthRestart: () => req('POST', '/api/sysfunc/health/restart', { confirm: 'yes' }),
  sysfEvents: (limit) => req('GET', `/api/sysfunc/events/timeline?limit=${limit || 100}`),
  sysfLogrotateList: () => req('GET', '/api/sysfunc/logrotate/list'),
  sysfLogrotateSave: (name, content) => req('POST', '/api/sysfunc/logrotate/save', { name, content }),

  // 系统级功能·第四批
  sysfBootHistory: () => req('GET', '/api/sysfunc/boot/history'),
  sysfApiStats: () => req('GET', '/api/sysfunc/api-monitor/stats'),
  sysfApiCalls: (n) => req('GET', `/api/sysfunc/api-monitor/calls?limit=${n || 300}`),
}