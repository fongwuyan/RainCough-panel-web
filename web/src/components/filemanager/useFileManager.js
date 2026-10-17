import { ref, computed, reactive } from 'vue'
import { api } from '../../api'

// 文件管理器的全部状态与动作。视图层只负责渲染, 不碰请求。
export function useFileManager() {
  const cwd = ref('/')
  const items = ref([])
  const loading = ref(false)
  const error = ref('')
  const selection = ref(new Set())

  const sortKey = ref('name')
  const sortDir = ref(1) // 1 升序, -1 降序
  const view = ref('list') // list | grid

  const history = ref(['/'])
  const histIdx = ref(0)

  const search = reactive({ on: false, q: '', results: [], hasMore: false, offset: 0, busy: false })

  const ops = ref([]) // 后台任务(复制/移动/删除/压缩)
  const uploads = ref([])
  const toast = ref('')
  let toastTimer = null

  const favorites = ref(loadFavs())

  const sorted = computed(() => {
    const arr = [...items.value]
    const k = sortKey.value
    const dir = sortDir.value
    arr.sort((a, b) => {
      // 目录恒在前
      if (!!a.is_dir !== !!b.is_dir) return a.is_dir ? -1 : 1
      let r = 0
      if (k === 'name') r = a.name.localeCompare(b.name, 'zh-CN')
      else if (k === 'size') r = (a.size || 0) - (b.size || 0)
      else if (k === 'mtime') r = (a.mtime || 0) - (b.mtime || 0)
      else if (k === 'kind') r = String(a.kind || '').localeCompare(String(b.kind || ''))
      return r * dir
    })
    return arr
  })

  const selectedItems = computed(() => sorted.value.filter((i) => selection.value.has(i.path)))
  const selectedBytes = computed(() => selectedItems.value.reduce((n, i) => n + (i.is_dir ? 0 : i.size || 0), 0))
  const activeOps = computed(() => ops.value.filter((t) => t.status === 'running' || t.status === 'queued'))

  function flash(msg) {
    toast.value = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = ''), 2400)
  }

  // ---- 导航 ----

  async function load(path = cwd.value) {
    loading.value = true
    error.value = ''
    try {
      const d = await api.fmList(path)
      cwd.value = d.path || path
      items.value = d.items || []
      selection.value = new Set()
      if (!search.on) pushHistory(cwd.value)
    } catch (e) {
      error.value = e.message || String(e)
      items.value = []
    } finally {
      loading.value = false
    }
  }

  function pushHistory(p) {
    if (history.value[histIdx.value] === p) return
    history.value = history.value.slice(0, histIdx.value + 1)
    history.value.push(p)
    if (history.value.length > 50) history.value.shift()
    histIdx.value = history.value.length - 1
  }

  function go(path) {
    if (!path) return
    search.on = false
    load(path)
  }

  function up() {
    if (cwd.value === '/') return
    const p = cwd.value.replace(/\/+$/, '')
    go(p.slice(0, p.lastIndexOf('/')) || '/')
  }

  function back() {
    if (histIdx.value <= 0) return
    histIdx.value--
    load(history.value[histIdx.value])
  }

  function forward() {
    if (histIdx.value >= history.value.length - 1) return
    histIdx.value++
    load(history.value[histIdx.value])
  }

  function open(item) {
    if (item.is_dir) go(item.path)
    else return item
  }

  // ---- 选择 ----

  function toggleSel(item, e) {
    const s = new Set(selection.value)
    if (e && e.shiftKey) {
      const list = sorted.value
      const last = list.findIndex((i) => selection.value.has(i.path))
      const cur = list.findIndex((i) => i.path === item.path)
      if (last >= 0) {
        const [a, b] = last < cur ? [last, cur] : [cur, last]
        for (let i = a; i <= b; i++) s.add(list[i].path)
        selection.value = s
        return
      }
    }
    if (s.has(item.path)) s.delete(item.path)
    else s.add(item.path)
    selection.value = s
  }

  function selectAll() {
    selection.value = new Set(sorted.value.map((i) => i.path))
  }

  function clearSel() {
    selection.value = new Set()
  }

  function setSort(k) {
    if (sortKey.value === k) sortDir.value = -sortDir.value
    else {
      sortKey.value = k
      sortDir.value = 1
    }
  }

  // ---- 操作 ----

  async function mkdir(name) {
    const p = joinPath(cwd.value, name)
    await api.fmMkdir(p)
    flash('已创建: ' + name)
    await load()
  }

  async function rename(item, newName) {
    if (newName === item.name) return
    await api.fmRename(item.path, newName)
    flash('已重命名')
    await load()
  }

  async function remove(paths) {
    const id = await api.fmOpsStart('delete', paths)
    watchOps(id)
    flash('已加入删除队列')
    selection.value = new Set()
  }

  async function moveCopy(op, paths, dest) {
    const id = await api.fmOpsStart(op, paths, { dest })
    watchOps(id)
    flash((op === 'copy' ? '复制' : '移动') + '已开始')
    selection.value = new Set()
  }

  async function archive(paths, dest, name, format) {
    const id = await api.fmOpsStart('archive', paths, { dest, name, format })
    watchOps(id)
    flash('压缩已开始')
  }

  async function hash(path, algo = 'md5') {
    return api.fmHash(path, algo)
  }

  async function unzip(archive, dest, password) {
    await api.fmUnzip(archive, dest, password)
    flash('解压完成')
    await load()
  }

  function download(path) {
    window.open(api.fmDownload(path), '_blank')
  }

  async function dirSizes(paths) {
    const d = await api.fmSize(paths)
    return d.sizes || {}
  }

  // ---- 上传 ----

  async function upload(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return
    uploads.value = files.map((f) => ({ name: f.name, size: f.size, pct: 0, state: 'wait' }))
    try {
      const res = await api.fmUpload(cwd.value, files, 'rename', (ev) => {
        const it = uploads.value[ev.file - 1]
        if (!it) return
        it.pct = Math.round((ev.loadedBytes / Math.max(1, ev.totalBytes)) * 100)
        it.state = ev.done ? (ev.error ? 'error' : 'done') : 'up'
      })
      if (res.errors && res.errors.length) flash('部分失败: ' + res.errors[0])
      else flash('上传完成 ' + res.saved.length + ' 个')
      setTimeout(() => (uploads.value = []), 1200)
      await load()
    } catch (e) {
      flash('上传失败: ' + (e.message || e))
      uploads.value = []
    }
  }

  // ---- 后台任务轮询 ----

  let pollTimer = null
  async function pollOps() {
    try {
      const d = await api.fmOpsList()
      ops.value = (d && d.tasks) || []
    } catch (e) {
      /* 静默 */
    }
    const active = activeOps.value.length > 0
    if (active && !pollTimer) pollTimer = setInterval(pollOps, 1000)
    if (!active && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function watchOps() {
    await pollOps()
    if (!pollTimer) pollTimer = setInterval(pollOps, 1000)
  }

  async function cancelOp(id) {
    try {
      await api.fmOpsCancel(id)
    } catch (e) {
      flash(e.message || String(e))
    }
    pollOps()
  }

  async function removeOp(id) {
    try {
      await api.fmOpsRemove(id)
    } catch (e) {
      flash(e.message || String(e))
    }
    pollOps()
  }

  // ---- 搜索 ----

  async function doSearch(q) {
    search.q = q
    search.offset = 0
    if (!q.trim()) {
      search.on = false
      search.results = []
      await load()
      return
    }
    search.on = true
    search.busy = true
    try {
      const d = await api.fmSearch({ path: cwd.value, q: q.trim(), offset: 0 })
      search.results = d.results || []
      search.hasMore = !!d.has_more
      search.offset = (d.offset || 0) + (d.results || []).length
    } catch (e) {
      flash('搜索失败: ' + (e.message || e))
    } finally {
      search.busy = false
    }
  }

  async function searchMore() {
    if (!search.hasMore || search.busy) return
    search.busy = true
    try {
      const d = await api.fmSearch({ path: cwd.value, q: search.q.trim(), offset: search.offset })
      search.results = search.results.concat(d.results || [])
      search.hasMore = !!d.has_more
      search.offset = (d.offset || 0) + (d.results || []).length
    } finally {
      search.busy = false
    }
  }

  function exitSearch() {
    search.on = false
    search.q = ''
    search.results = []
    load()
  }

  // ---- 收藏 ----

  function loadFavs() {
    try {
      return JSON.parse(localStorage.getItem('rc-fm-favs') || '[]')
    } catch (e) {
      return []
    }
  }

  function addFav() {
    if (favorites.value.includes(cwd.value)) return
    favorites.value.push(cwd.value)
    localStorage.setItem('rc-fm-favs', JSON.stringify(favorites.value))
    flash('已收藏')
  }

  function removeFav(p) {
    favorites.value = favorites.value.filter((x) => x !== p)
    localStorage.setItem('rc-fm-favs', JSON.stringify(favorites.value))
  }

  return {
    cwd, items, sorted, loading, error, selection, selectedItems, selectedBytes,
    sortKey, sortDir, view, search, ops, activeOps, uploads, toast, favorites,
    load, go, up, back, forward, open, toggleSel, selectAll, clearSel, setSort,
    mkdir, rename, remove, moveCopy, archive, hash, unzip, download, dirSizes, upload,
    pollOps, watchOps, cancelOp, removeOp, doSearch, searchMore, exitSearch,
    addFav, removeFav, flash,
  }
}

export function joinPath(dir, name) {
  if (dir.endsWith('/')) return dir + name
  return dir + '/' + name
}

export function fmtSize(n) {
  n = Number(n) || 0
  if (n < 1024) return n + ' B'
  const u = ['KB', 'MB', 'GB', 'TB', 'PB']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < u.length - 1)
  return n.toFixed(n < 10 ? 1 : 0) + ' ' + u[i]
}

export function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function kindLabel(it) {
  if (it.is_dir) return '目录'
  const k = it.kind || 'file'
  const map = { image: '图片', video: '视频', audio: '音频', archive: '压缩包', text: '文本', code: '代码' }
  return map[k] || (it.name.includes('.') ? it.name.split('.').pop().toUpperCase() : '文件')
}

export function iconOf(it) {
  if (it.is_dir) return '▣'
  const k = it.kind || ''
  if (k === 'image') return '▤'
  if (k === 'video') return '▶'
  if (k === 'audio') return '♪'
  if (k === 'archive') return '▦'
  if (k === 'text' || k === 'code') return '≡'
  return '·'
}
