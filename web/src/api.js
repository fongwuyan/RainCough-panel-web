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
  // 系统
  listPlugins: () => req('GET', '/api/plugins'),
  pluginInfo: (name) => req('GET', `/api/plugins/${name}/info`),
  removePlugin: (name) => req('DELETE', `/api/plugins/${name}`),
  installPlugin: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return req('POST', '/api/plugins/install', fd, true)
  },
  sysInfo: () => req('GET', '/api/system'),
  sysStorage: () => req('GET', '/api/storage'),
  disks: () => req('GET', '/api/disks'),
  diskUnmount: (device) => req('POST', '/api/disks/unmount', { device }),
  saveStorage: (plugin, cfg) => req('POST', `/api/plugins/${plugin}/config`, cfg),

  // 来张涩图
  lsFetch: (tags) => req('POST', '/api/plugins/laizhangsetu/fetch', { tags }),
  lsHistory: () => req('GET', '/api/plugins/laizhangsetu/history'),
  lsClearHistory: () => req('DELETE', '/api/plugins/laizhangsetu/history'),
  lsConfig: () => req('GET', '/api/plugins/laizhangsetu/config'),
  lsSaveConfig: (cfg) => req('POST', '/api/plugins/laizhangsetu/config', cfg),

  // TouchGal
  tgSearch: (keyword, limit, nsfw) => req('POST', '/api/plugins/touchgal/search', { keyword, limit, nsfw }),
  tgResource: (patchId) => req('GET', `/api/plugins/touchgal/resource?patchId=${encodeURIComponent(patchId)}`),
  tgRecognize: (imageUrl) => req('POST', '/api/plugins/touchgal/recognize-dual', { imageUrl }),

  // JMComic
  jmSearch: (keyword, page, mode) =>
    req('GET', `/api/plugins/jmcomic/search?keyword=${encodeURIComponent(keyword)}&page=${page}&mode=${mode}`),
  jmMeta: (aid) => req('GET', `/api/plugins/jmcomic/meta/${aid}`),
  jmAlbum: (aid) => req('GET', `/api/plugins/jmcomic/album/${aid}`),
  jmChapter: (aid, cid) => req('GET', `/api/plugins/jmcomic/chapter/${aid}/${cid}`),
  jmDownload: (aid) => req('GET', `/api/plugins/jmcomic/download/${aid}`),
  jmStartDownload: (aid) => req('POST', `/api/plugins/jmcomic/download/${aid}`),
  jmLibrary: (page = 1, pageSize = 45) =>
    req('GET', `/api/plugins/jmcomic/library?page=${page}&page_size=${pageSize}`),
  jmDeleteLibrary: (aid) => req('DELETE', `/api/plugins/jmcomic/library/${aid}`),
  jmCover: (aid) => `/api/plugins/jmcomic/cover/${aid}`,
  jmImage: (aid, cid, file) => `/api/plugins/jmcomic/image/${aid}/${cid}/${file}`,
  jmZip: (aid) => `/api/plugins/jmcomic/download_zip/${aid}`,
  jmBatchStart: (mode, keyword) => req('POST', '/api/plugins/jmcomic/download/batch', { mode, keyword }),
  jmBatchStatus: () => req('GET', '/api/plugins/jmcomic/download/batch'),
  jmBatchStop: () => req('POST', '/api/plugins/jmcomic/download/batch/stop'),

  // 解压压缩 (decompress)
  dcList: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/yulotool/decompress/list', fd)
  },
  dcExtract: (file, password, organize) => {
    const fd = new FormData(); fd.append('file', file)
    fd.append('password', password || ''); fd.append('organize', organize || 'none')
    return reqForm('/api/plugins/yulotool/decompress/extract', fd)
  },
  dcCompress: (files, fmt, level, password, name) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('format', fmt); fd.append('level', String(level))
    fd.append('password', password || ''); fd.append('name', name || 'archive')
    return reqForm('/api/plugins/yulotool/decompress/compress', fd)
  },
  dcConvert: (file, fmt) => {
    const fd = new FormData(); fd.append('file', file); fd.append('format', fmt)
    return reqForm('/api/plugins/yulotool/decompress/convert', fd)
  },
  dcCompare: (a, b) => {
    const fd = new FormData(); fd.append('files', a); fd.append('files', b)
    return reqForm('/api/plugins/yulotool/decompress/compare', fd)
  },

  // 目录分析 (diranalyze)
  daStats: (files) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return reqForm('/api/plugins/yulotool/diranalyze/stats', fd)
  },
  daDuplicate: (files) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return reqForm('/api/plugins/yulotool/diranalyze/duplicate', fd)
  },

  // 文件哈希 (hash)
  hashCalc: (files) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return reqForm('/api/plugins/yulotool/hash/hash', fd)
  },
  hashGenerate: (files, algo) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('algo', algo)
    return reqForm('/api/plugins/yulotool/hash/generate', fd)
  },
  hashVerify: (files) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return reqForm('/api/plugins/yulotool/hash/verify', fd)
  },

  // 媒体工具 (mediatools)
  mtImage: (files, opts) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('format', opts.format || '')
    fd.append('resize', opts.resize || '')
    fd.append('quality', opts.quality || '')
    fd.append('rotate', opts.rotate || '')
    return reqForm('/api/plugins/yulotool/mediatools/image', fd)
  },
  mtPdf: (files, action, extra) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('action', action)
    if (extra) for (const k in extra) fd.append(k, String(extra[k]))
    return reqForm('/api/plugins/yulotool/mediatools/pdf', fd)
  },
  mtMedia: (files, action, extra) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('action', action)
    if (extra) for (const k in extra) fd.append(k, String(extra[k]))
    return reqForm('/api/plugins/yulotool/mediatools/media', fd)
  },
  mtInfo: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/yulotool/mediatools/info', fd)
  },

  // 文档转换 (docconvert)
  docCheck: () => req('GET', '/api/plugins/yulotool/docconvert/check'),
  docConvert: (files, to) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('to', to)
    return reqForm('/api/plugins/yulotool/docconvert/convert', fd)
  },

  // 网络工具 (networktools)
  ntDownload: (urls, pack) => req('POST', '/api/plugins/yulotool/networktools/download', { urls, pack }),
  ntSplit: (file, chunkMB) => {
    const fd = new FormData(); fd.append('file', file); fd.append('chunkSize', String(chunkMB))
    return reqForm('/api/plugins/yulotool/networktools/split', fd)
  },
  ntJoin: (files, name) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('name', name || 'joined')
    return reqForm('/api/plugins/yulotool/networktools/join', fd)
  },
  ntRename: (files, mode, value, value2, index) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('mode', mode); fd.append('value', value || '')
    fd.append('value2', value2 || ''); fd.append('index', String(index || 1))
    return reqForm('/api/plugins/yulotool/networktools/rename', fd)
  },
  ntDelete: (files, passes) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('passes', String(passes || 3))
    return reqForm('/api/plugins/yulotool/networktools/delete', fd)
  },

  // 文件管理 (系统级模块)
  fmList: (path) => req('GET', `/api/fm/list?path=${encodeURIComponent(path || '/')}`),
  fmUpload: (path, files) => {
    const fd = new FormData()
    fd.append('path', path || '/')
    for (const f of files) fd.append('files', f)
    return reqForm('/api/fm/upload', fd)
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
  fmArchive: (paths, format, name) => {
    const qs = new URLSearchParams({ format: format || 'zip', name: name || 'archive' })
    for (const p of paths) qs.append('paths', p)
    return `/api/fm/archive?${qs.toString()}`
  },
  fmPreview: (path) => req('GET', `/api/fm/preview?path=${encodeURIComponent(path)}`),
  fmSearch: (params) => {
    const qs = new URLSearchParams()
    for (const k of ['path', 'q', 'kind', 'min_size', 'max_size', 'mtime_days']) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') qs.append(k, params[k])
    }
    return req('GET', `/api/fm/search?${qs.toString()}`)
  },

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
  // 媒体中心 (系统级模块)
  mediaRoots: () => req('GET', '/api/media/roots'),
  mediaSaveRoots: (roots) => req('POST', '/api/media/roots', { roots }),
  mediaStats: () => req('GET', '/api/media/stats'),
  mediaList: (root, kind, page, tag) => req('GET', `/api/media/list?root=${encodeURIComponent(root)}&kind=${kind || ''}&page=${page || 0}&tag=${encodeURIComponent(tag || '')}`),
  mediaThumb: (path) => `/api/media/thumb?path=${encodeURIComponent(path)}`,
  mediaFile: (path) => `/api/media/file?path=${encodeURIComponent(path)}`,
  mediaTag: (paths) => req('POST', '/api/media/tag', { paths }),
  mediaTags: (path) => req('GET', `/api/media/tags?path=${encodeURIComponent(path)}`),
  mediaDedup: (root) => req('POST', '/api/media/dedup', { root }),

  // AI 生图 (aigen)
  agPing: () => req('GET', '/api/plugins/aigen/ping'),
  agModels: () => req('GET', '/api/plugins/aigen/models'),
  agGenerate: (params) => req('POST', '/api/plugins/aigen/generate', params),
  agImg2img: (params) => req('POST', '/api/plugins/aigen/img2img', params),
  agStatus: (jobId) => req('GET', `/api/plugins/aigen/status/${jobId}`),
  agCancel: (jobId) => req('POST', `/api/plugins/aigen/cancel/${jobId}`),
  agGallery: (params) => req('GET', `/api/plugins/aigen/gallery?limit=${params.limit || 120}&offset=${params.offset || 0}`),
  agGalleryDelete: (name) => req('DELETE', `/api/plugins/aigen/gallery/${encodeURIComponent(name)}`),
  agConfig: () => req('GET', '/api/plugins/aigen/config'),
  agSaveConfig: (cfg) => req('POST', '/api/plugins/aigen/config', cfg),

  // 视频融合 (videomerge)
  vmMerge: (video, archive, name) => {
    const fd = new FormData(); fd.append('files', video); fd.append('files', archive)
    fd.append('name', name || '')
    return reqForm('/api/plugins/yulotool/videomerge/merge', fd)
  },
  vmInfo: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/yulotool/videomerge/info', fd)
  },
  vmExtract: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/yulotool/videomerge/extract', fd)
  },

  // 全能工具箱 (toolbox)
  tbOcr: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/toolbox/ocr', fd)
  },
  tbOcrCheck: () => req('GET', '/api/plugins/toolbox/ocr/check'),
  tbQrGen: (text, size) => req('GET', `/api/plugins/toolbox/qr/gen?text=${encodeURIComponent(text)}&size=${size || 300}`),
  tbQrDecode: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/toolbox/qr/decode', fd)
  },
  tbImgSimilar: (a, b) => {
    const fd = new FormData(); fd.append('files', a); fd.append('files', b)
    return reqForm('/api/plugins/toolbox/image/similar', fd)
  },
  tbImgProcess: (files, opts) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('format', opts.format || '')
    fd.append('resize', opts.resize || '')
    fd.append('quality', opts.quality || '')
    fd.append('rotate', opts.rotate || '')
    return reqForm('/api/plugins/toolbox/image/process', fd)
  },
  tbMediaInfo: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/toolbox/media/info', fd)
  },
  tbMediaProcess: (files, action, extra) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('action', action)
    if (extra) for (const k in extra) fd.append(k, String(extra[k]))
    return reqForm('/api/plugins/toolbox/media/process', fd)
  },
  tbMediaMerge: (files) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    return reqForm('/api/plugins/toolbox/media/merge', fd)
  },
  tbSearch: (q, limit) => req('GET', `/api/plugins/toolbox/search?q=${encodeURIComponent(q)}&limit=${limit || 10}`),
  tbUrlCheck: (urls) => req('POST', '/api/plugins/toolbox/urlcheck', { urls }),
  tbRssList: () => req('GET', '/api/plugins/toolbox/rss/feeds'),
  tbRssAdd: (url, name) => req('POST', '/api/plugins/toolbox/rss/feeds', { url, name }),
  tbRssDelete: (idx) => req('POST', '/api/plugins/toolbox/rss/feeds/delete', { idx }),
  tbRssFetch: (url) => req('POST', '/api/plugins/toolbox/rss/fetch', { url }),
  tbReadability: (url) => req('POST', '/api/plugins/toolbox/readability', { url }),
  tbRegex: (pattern, text, flags) => req('POST', '/api/plugins/toolbox/text/regex', { pattern, text, flags }),
  tbTextReplace: (files, find, replace, regex) => {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    fd.append('find', find); fd.append('replace', replace); fd.append('regex', regex ? '1' : '0')
    return reqForm('/api/plugins/toolbox/text/replace', fd)
  },
  tbConvert: (action, content) => req('POST', '/api/plugins/toolbox/text/convert', { action, content }),
  tbTextStats: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return reqForm('/api/plugins/toolbox/text/stats', fd)
  },

  // 终端 (WebSocket, PHP 后端 :23080)
  tmWsToken: () => req('GET', '/api/terminal/ws_token'),
  tmWsUrl: async (rows, cols) => {
    const d = await req('GET', '/api/terminal/ws_token')
    const host = d.host || window.location.hostname
    const port = d.port || 23080
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${host}:${port}/?token=${encodeURIComponent(d.token)}&rows=${rows}&cols=${cols}`
  },

  // 终端：保存服务器 / 常用命令
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

  // 可插拔设置 (插件向设置页注入)
  pluginSettingsGet: (name) => req('GET', `/api/plugins/${name}/settings`),
  pluginSettingsSave: (name, data) => req('POST', `/api/plugins/${name}/settings`, data),

  // Uptime 监控
  upTargets: () => req('GET', '/api/plugins/uptime/targets'),
  upStatus: () => req('GET', '/api/plugins/uptime/status'),
  upCreate: (data) => req('POST', '/api/plugins/uptime/targets/create', data),
  upUpdate: (data) => req('POST', '/api/plugins/uptime/targets/update', data),
  upDelete: (name) => req('POST', '/api/plugins/uptime/targets/delete', { name }),
  upTest: (name) => req('POST', '/api/plugins/uptime/targets/test', { name }),
  upHistory: (name) => req('GET', `/api/plugins/uptime/targets/history?name=${encodeURIComponent(name)}`),
  upStatus24: (name) => req('GET', `/api/plugins/uptime/targets/status24?name=${encodeURIComponent(name)}`),

  // Docker 管理
  dkInfo: () => req('GET', '/api/plugins/docker/info'),
  dkContainers: () => req('GET', '/api/plugins/docker/containers'),
  dkStart: (id) => req('POST', '/api/plugins/docker/containers/start', { id }),
  dkStop: (id) => req('POST', '/api/plugins/docker/containers/stop', { id }),
  dkRestart: (id) => req('POST', '/api/plugins/docker/containers/restart', { id }),
  dkRemove: (id, force) => req('POST', '/api/plugins/docker/containers/remove', { id, force }),
  dkLogs: (id, tail) => req('GET', `/api/plugins/docker/containers/logs?id=${encodeURIComponent(id)}&tail=${tail || 200}`),
  dkStats: (id) => req('GET', `/api/plugins/docker/containers/stats?id=${encodeURIComponent(id)}`),
  dkImages: () => req('GET', '/api/plugins/docker/images'),
  dkPull: (name) => req('POST', '/api/plugins/docker/images/pull', { name }),
  dkRemoveImage: (id, force) => req('POST', '/api/plugins/docker/images/remove', { id, force }),
  dkNetworks: () => req('GET', '/api/plugins/docker/networks'),
  dkVolumes: () => req('GET', '/api/plugins/docker/volumes'),

  // KVM 虚拟机
  kvConfig: () => req('GET', '/api/plugins/kvm/config'),
  kvSaveConfig: (cfg) => req('POST', '/api/plugins/kvm/config', cfg),
  kvInfo: () => req('GET', '/api/plugins/kvm/info'),
  kvDomains: () => req('GET', '/api/plugins/kvm/domains'),
  kvDomain: (name) => req('GET', `/api/plugins/kvm/domain?name=${encodeURIComponent(name)}`),
  kvAction: (name, action) => req('POST', '/api/plugins/kvm/domain/action', { name, action }),
  kvAutostart: (name, on) => req('POST', '/api/plugins/kvm/domain/autostart', { name, on }),
  kvVncEnable: (name) => req('POST', '/api/plugins/kvm/domain/vnc', { name }),
  kvVncGet: (name) => req('GET', `/api/plugins/kvm/domain/vnc?name=${encodeURIComponent(name)}`),
  kvImages: () => req('GET', '/api/plugins/kvm/images'),
  kvStorage: () => req('GET', '/api/plugins/kvm/storage'),
  kvCreate: (cfg) => req('POST', '/api/plugins/kvm/domains', cfg),
  kvDomainStats: (name) => req('GET', `/api/plugins/kvm/domain/stats?name=${encodeURIComponent(name)}`),
  kvDomainNote: (name) => req('GET', `/api/plugins/kvm/domain/note?name=${encodeURIComponent(name)}`),
  kvSaveNote: (name, note) => req('POST', '/api/plugins/kvm/domain/note', { name, note }),

  // MC 服务器
  mcStatus: () => req('GET', '/api/plugins/mcserver/status'),
  mcStart: () => req('POST', '/api/plugins/mcserver/start', {}),
  mcStop: (force) => req('POST', '/api/plugins/mcserver/stop', { force }),
  mcRestart: () => req('POST', '/api/plugins/mcserver/restart', {}),
  mcConsole: () => req('GET', '/api/plugins/mcserver/console?lines=200'),
  mcCommand: (command) => req('POST', '/api/plugins/mcserver/console', { command }),
  mcConfig: () => req('GET', '/api/plugins/mcserver/config'),
  mcSaveConfig: (data) => req('POST', '/api/plugins/mcserver/config', data),
  mcWhitelist: () => req('GET', '/api/plugins/mcserver/whitelist'),
  mcWhitelistAction: (action, name) => req('POST', '/api/plugins/mcserver/whitelist', { action, name }),
  mcOps: () => req('GET', '/api/plugins/mcserver/ops'),
  mcOpsAction: (action, name) => req('POST', '/api/plugins/mcserver/ops', { action, name }),
  mcBackup: () => req('POST', '/api/plugins/mcserver/world/backup', {}),
  mcImport: (formData) => reqForm('/api/plugins/mcserver/world/import', formData),
  mcLogs: () => req('GET', '/api/plugins/mcserver/logs?lines=300'),

  // MC 服务器升级版
  mcInstances: () => req('GET', '/api/plugins/mcserver/instances'),
  mcInstanceAdd: (cfg) => req('POST', '/api/plugins/mcserver/instance/add', cfg),
  mcInstanceRemove: (id) => req('POST', '/api/plugins/mcserver/instance/remove', { id }),
  mcInstanceSet: (id) => req('POST', '/api/plugins/mcserver/instance/set', { id }),
  mcJavas: () => req('GET', '/api/plugins/mcserver/instance/javas'),
  mcInstanceDetail: () => req('GET', '/api/plugins/mcserver/instance/detail'),
  mcInstanceUpdate: (cfg) => req('POST', '/api/plugins/mcserver/instance/update', cfg),
  mcInstanceClearActive: () => req('POST', '/api/plugins/mcserver/instance/clear-active', {}),
  mcMetrics: () => req('GET', '/api/plugins/mcserver/metrics'),
  mcStream: () => `/api/plugins/mcserver/stream`,
  mcPlayers: () => req('GET', '/api/plugins/mcserver/players'),
  mcKick: (name, reason) => req('POST', '/api/plugins/mcserver/kick', { name, reason }),
  mcBans: () => req('GET', '/api/plugins/mcserver/bans'),
  mcBan: (name) => req('POST', '/api/plugins/mcserver/ban', { name }),
  mcUnban: (name) => req('POST', '/api/plugins/mcserver/unban', { name }),
  mcBanIp: (ip) => req('POST', '/api/plugins/mcserver/ban-ip', { ip }),
  mcPardonIp: (ip) => req('POST', '/api/plugins/mcserver/pardon-ip', { ip }),
  mcWorldInfo: () => req('GET', '/api/plugins/mcserver/world/info'),
  mcWorldBackups: () => req('GET', '/api/plugins/mcserver/world/backups'),
  mcWorldBackupDelete: (name) => req('POST', '/api/plugins/mcserver/world/backup/delete', { name }),
  mcWorldRestore: (name) => req('POST', '/api/plugins/mcserver/world/restore', { name }),
  mcWorldDownload: (name) => `/api/plugins/mcserver/world/download?name=${encodeURIComponent(name)}`,
  mcMods: () => req('GET', '/api/plugins/mcserver/mods'),
  mcModsUpload: (formData) => reqForm('/api/plugins/mcserver/mods/upload', formData),
  mcModsDelete: (name) => req('POST', '/api/plugins/mcserver/mods/delete', { name }),
  mcSchedule: () => req('GET', '/api/plugins/mcserver/schedule'),
  mcScheduleSave: (cfg) => req('POST', '/api/plugins/mcserver/schedule', cfg),
  mcCores: () => req('GET', '/api/plugins/mcserver/cores'),
  mcCoreInstall: (cfg) => req('POST', '/api/plugins/mcserver/core/install', cfg),
  mcCoreInstallStatus: () => req('GET', '/api/plugins/mcserver/core/install/status'),
  mcCoreJars: (inst) => req('GET', `/api/plugins/mcserver/core/jars?inst=${encodeURIComponent(inst)}`),
  mcCoreSwitch: (inst, jar) => req('POST', `/api/plugins/mcserver/core/switch?inst=${encodeURIComponent(inst)}`, { jar }),
  mcskinConvert: (formData) => reqForm('/api/plugins/mcskin/convert', formData),
  mcskinDetect: (formData) => reqForm('/api/plugins/mcskin/detect', formData),
  mcskinPaintModels: () => req('GET', '/api/plugins/mcskin/paint/models'),
  mcskinPaint: (formData) => reqForm('/api/plugins/mcskin/paint', formData),
  mcskinPaintStatus: (jid) => req('GET', '/api/plugins/mcskin/paint/status/' + jid),
  mcskinPaintCancel: (jid) => req('POST', '/api/plugins/mcskin/paint/cancel/' + jid, {}),
  mcskinTextModels: () => req('GET', '/api/plugins/mcskin/text2skin/models'),
  mcskinTextStyles: () => req('GET', '/api/plugins/mcskin/text2skin/styles'),
  mcskinText2Skin: (data) => req('POST', '/api/plugins/mcskin/text2skin', data),
  mcskinTextStatus: (jid) => req('GET', '/api/plugins/mcskin/text2skin/status/' + jid),
  mcskinTextRegenerate: (jid) => req('POST', '/api/plugins/mcskin/text2skin/regenerate/' + jid, {}),
  mcskinTextHistory: () => req('GET', '/api/plugins/mcskin/text2skin/history'),
  mcskinTextFeedback: (jid, like) => req('POST', '/api/plugins/mcskin/text2skin/feedback/' + jid, { like }),

  // RainCough VPN (vpn 插件)
  vpnSettings: () => req('GET', '/api/plugins/vpn/settings'),
  vpnSaveSettings: (data) => req('POST', '/api/plugins/vpn/settings', data),
  vpnOverview: () => req('GET', '/api/plugins/vpn/overview'),
  vpnLive: () => req('GET', '/api/plugins/vpn/overview/live'),
  vpnEnv: () => req('GET', '/api/plugins/vpn/env'),
  vpnInstall: (packages) => req('POST', '/api/plugins/vpn/install', { packages }),
  vpnStopAll: () => req('POST', '/api/plugins/vpn/stop-all'),
  vpnLogs: (tech) => req('GET', `/api/plugins/vpn/logs?tech=${tech}`),

  // WireGuard
  wgEnv: () => req('GET', '/api/plugins/vpn/wg/env'),
  wgStatus: () => req('GET', '/api/plugins/vpn/wg/status'),
  wgImport: (name, content) => req('POST', '/api/plugins/vpn/wg/import', { name, content }),
  wgAction: (name, action) => req('POST', '/api/plugins/vpn/wg/action', { name, action }),
  wgConfig: (name) => req('GET', `/api/plugins/vpn/wg/config?name=${encodeURIComponent(name)}`),
  wgServer: () => req('GET', '/api/plugins/vpn/wg/server'),
  wgServerSave: (data) => req('POST', '/api/plugins/vpn/wg/server/save', data),
  wgServerUp: () => req('POST', '/api/plugins/vpn/wg/server/up'),
  wgServerDown: () => req('POST', '/api/plugins/vpn/wg/server/down'),
  wgPeerAdd: (name) => req('POST', '/api/plugins/vpn/wg/peers/add', { name }),
  wgPeerDelete: (name) => req('POST', '/api/plugins/vpn/wg/peers/delete', { name }),
  wgExport: (name) => req('POST', '/api/plugins/vpn/wg/export', { name }),

  // OpenVPN
  ovpnEnv: () => req('GET', '/api/plugins/vpn/ovpn/env'),
  ovpnImport: (name, content) => req('POST', '/api/plugins/vpn/ovpn/import', { name, content }),
  ovpnAction: (name, action) => req('POST', '/api/plugins/vpn/ovpn/action', { name, action }),
  ovpnConfig: (name) => req('GET', `/api/plugins/vpn/ovpn/config?name=${encodeURIComponent(name)}`),
  ovpnLog: () => req('GET', '/api/plugins/vpn/ovpn/log'),
  ovpnServer: () => req('GET', '/api/plugins/vpn/ovpn/server'),
  ovpnServerSave: (data) => req('POST', '/api/plugins/vpn/ovpn/server/save', data),
  ovpnInitPki: () => req('POST', '/api/plugins/vpn/ovpn/server/init-pki'),
  ovpnBuild: () => req('POST', '/api/plugins/vpn/ovpn/server/build'),
  ovpnServerUp: () => req('POST', '/api/plugins/vpn/ovpn/server/up'),
  ovpnServerDown: () => req('POST', '/api/plugins/vpn/ovpn/server/down'),
  ovpnServerLog: () => req('GET', '/api/plugins/vpn/ovpn/server/log'),

  // v2ray
  v2Env: () => req('GET', '/api/plugins/vpn/v2/env'),
  v2Load: (name) => req('GET', `/api/plugins/vpn/v2/load?name=${encodeURIComponent(name)}`),
  v2Save: (name, config, port) => req('POST', '/api/plugins/vpn/v2/save', { name, config, port }),
  v2Action: (name, action) => req('POST', '/api/plugins/vpn/v2/action', { name, action }),
  v2Test: (name) => req('POST', '/api/plugins/vpn/v2/test', { name }),
  v2Log: () => req('GET', '/api/plugins/vpn/v2/log'),
  v2Wizard: (data) => req('POST', '/api/plugins/vpn/v2/wizard', data),
  v2Subs: () => req('GET', '/api/plugins/vpn/v2/subs'),
  v2SubAdd: (url, name) => req('POST', '/api/plugins/vpn/v2/subs', { url, name }),
  v2SubDel: (url) => req('DELETE', '/api/plugins/vpn/v2/subs', { url }),
  v2SubRefresh: (url) => req('POST', '/api/plugins/vpn/v2/subs/refresh', { url }),
  v2Nodes: (q, group) => {
    const p = []
    if (q) p.push(`q=${encodeURIComponent(q)}`)
    if (group && group !== 'all') p.push(`group=${encodeURIComponent(group)}`)
    return req('GET', `/api/plugins/vpn/v2/nodes${p.length ? `?${p.join('&')}` : ''}`)
  },
  v2NodesGroups: () => req('GET', '/api/plugins/vpn/v2/nodes/groups'),
  v2NodesDelete: (ids) => req('POST', '/api/plugins/vpn/v2/nodes/delete', { ids }),
  v2NodesTest: (ids) => req('POST', '/api/plugins/vpn/v2/nodes/test', { ids }),
  v2NodeSpeedTest: (id) => req('POST', '/api/plugins/vpn/v2/nodes/speedtest', { id }),
  v2NodesSelect: (id, name, port) => req('POST', '/api/plugins/vpn/v2/nodes/select', { id, name, port }),
  v2ModeGet: () => req('GET', '/api/plugins/vpn/v2/mode'),
  v2ModeSet: (mode) => req('POST', '/api/plugins/vpn/v2/mode', { mode }),

  // AI 编程助手 (raincode / 精简 opencode)
  rcEnv: () => req('GET', '/api/plugins/raincode/env'),
  rcConfig: () => req('GET', '/api/plugins/raincode/config'),
  rcSaveConfig: (data) => req('POST', '/api/plugins/raincode/config', data),
  rcModels: () => req('GET', '/api/plugins/raincode/models'),
  rcStart: () => req('POST', '/api/plugins/raincode/start', {}),
  rcStop: () => req('POST', '/api/plugins/raincode/stop', {}),
  rcSessions: () => req('GET', '/api/plugins/raincode/sessions'),
  rcSessionGet: (id) => req('GET', `/api/plugins/raincode/sessions/${id}`),
  rcSessionDelete: (id) => req('DELETE', `/api/plugins/raincode/sessions/${id}`),
  rcSkills: () => req('GET', '/api/plugins/raincode/skills'),
  rcSkillSave: (s) => req('POST', '/api/plugins/raincode/skills', s),
  rcSkillToggle: (name, enabled) => req('POST', '/api/plugins/raincode/skills/toggle', { name, enabled }),
  rcSkillDelete: (name) => req('DELETE', `/api/plugins/raincode/skills/${name}`),
  rcChat: (body) => fetch('/api/plugins/raincode/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  rcApprove: (body) => fetch('/api/plugins/raincode/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  rcCancel: (sessionId) => req('POST', '/api/plugins/raincode/cancel', { session_id: sessionId }),
}
