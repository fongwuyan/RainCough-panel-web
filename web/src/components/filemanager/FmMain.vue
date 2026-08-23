<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'
import { usePreview } from '../../stores/preview'

const preview = usePreview()

const cwd = ref('')
const items = ref([])
const loading = ref(false)
const error = ref('')
const selected = ref(new Set())
const sortKey = ref('name')
const sortDir = ref(1)
const action = ref('')

const newName = ref('')
const targetDir = ref('')
const archiveName = ref('archive')
const archiveFmt = ref('zip')
const dlMode = ref('direct')
const unzipPwd = ref('')
const hashAlgo = ref('sha256')
const hashResult = ref(null)
const textPreview = ref(null)

const fileInput = ref(null)
const sidebarOpen = ref(true)
const PAGE_SIZE = 200
const page = ref(0)
const disks = ref([])
const searching = ref(false)
const searchQ = ref('')
const searchKind = ref('')
const searchMinMB = ref('')
const searchMaxMB = ref('')
const searchDays = ref('')
const searchOffset = ref(0)
const searchHasMore = ref(false)

const FAV_KEY = 'fm_favs'
const favs = ref([])
const showPicker = ref(false)
const pickerCwd = ref('/')
const pickerItems = ref([])
const pickerLoading = ref(false)
const toastMsg = ref('')
const toastKind = ref('ok')
const sentinel = ref(null)

/* ---- 上传进度 ---- */
const conflict = ref('rename')
const uploadState = ref({ active: false, items: [] })

/* ---- 在线编辑 ---- */
const editorOpen = ref(false)
const editorItem = ref(null)
const editorText = ref('')
const editorEncoding = ref('utf-8')
const editorSize = ref(0)
const editorDirty = ref(false)
const editorSaving = ref(false)
const editorMsg = ref('')
const editorEl = ref(null)
const gutterEl = ref(null)
const EDIT_LIMIT = 5 * 1024 * 1024

/* ---- 模态框(替代原生 prompt/confirm) ---- */
const renameState = ref({ show: false, target: null, value: '' })
const confirmState = ref({ show: false, title: '', msg: '', okText: '确定', danger: false, onOk: null })

/* ---- 右键菜单 / 地址栏 ---- */
const ctx = ref({ show: false, x: 0, y: 0, item: null })
const showAddr = ref(false)
const addrVal = ref('')

/* ---- 异步任务面板 ---- */
const tasksOpen = ref(false)
const opsTasks = ref([])
let pollTimer = null

/* ---- 目录大小 ---- */
const showDirs = ref(false)
const dirSizeMap = ref({})

/* ---- 拖拽上传 ---- */
const dragOver = ref(false)
const showNewRow = ref(false)

const displayPath = computed(() => cwd.value || '/')
const selectedList = computed(() => items.value.filter((i) => selected.value.has(i.path)))
const selectedSize = computed(() => selectedList.value.reduce((s, i) => s + (i.is_dir ? 0 : (i.size || 0)), 0))
const isRoot = computed(() => !cwd.value || cwd.value === '/')
const runningOps = computed(() => opsTasks.value.filter((t) => t.status === 'running').length)

let toastTimer = null
let observer = null

const OP_LABEL = { copy: '复制', move: '移动', delete: '删除', archive: '打包' }
const OP_STATE = { running: '进行中', done: '完成', error: '失败', cancelled: '已取消' }

function kindName(k) {
  return { dir: '目录', image: '图片', video: '视频', audio: '音频', archive: '压缩包', text: '文本', file: '文件' }[k] || k
}
function kindIcon(k) {
  return { dir: '📁', image: '🖼️', video: '🎬', audio: '🎵', archive: '🗜️', text: '📄', file: '📄' }[k] || '📄'
}

function fmtSize(item) {
  if (item.is_dir) return (showDirs.value && dirSizeMap.value[item.path] !== undefined) ? fmtBytes(dirSizeMap.value[item.path]) : (showDirs.value ? '…' : '-')
  return fmtBytes(item.size)
}
function fmtBytes(b) {
  if (b === undefined || b === null) return '-'
  if (b < 1024) return `${b} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let i = -1
  let v = b
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}

function fmtTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const crumbs = computed(() => {
  const parts = displayPath.value.split('/').filter(Boolean)
  const arr = [{ label: '/', path: '/' }]
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    arr.push({ label: p, path: acc })
  }
  return arr
})

const pickerCrumbs = computed(() => {
  const parts = (pickerCwd.value || '/').split('/').filter(Boolean)
  const arr = [{ label: '/', path: '/' }]
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    arr.push({ label: p, path: acc })
  }
  return arr
})

function showToast(msg, kind = 'ok') {
  toastMsg.value = msg
  toastKind.value = kind
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3200)
}

/* ---------- 选择 / 排序 / 分页 ---------- */
function toggleSel(item) {
  const s = new Set(selected.value)
  if (s.has(item.path)) s.delete(item.path)
  else s.add(item.path)
  selected.value = s
}

function allChecked() {
  return items.value.length > 0 && items.value.every((i) => selected.value.has(i.path))
}

function toggleAll(e) {
  const s = new Set(selected.value)
  if (e.target.checked) {
    for (const i of items.value) s.add(i.path)
  } else {
    for (const i of items.value) s.delete(i.path)
  }
  selected.value = s
}

const sortedAll = computed(() => {
  const k = sortKey.value
  const dir = sortDir.value
  const arr = [...items.value]
  arr.sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    let r = 0
    if (k === 'size') r = (a.size || 0) - (b.size || 0)
    else if (k === 'mtime') r = (a.mtime || 0) - (b.mtime || 0)
    else r = String(a.name).localeCompare(String(b.name), 'zh-CN')
    return r * dir
  })
  return arr
})

const paged = computed(() => {
  if (sortedAll.value.length <= PAGE_SIZE) return sortedAll.value
  return sortedAll.value.slice(0, (page.value + 1) * PAGE_SIZE)
})

const hasMore = computed(() => sortedAll.value.length > paged.value.length)

function showMore() {
  page.value += 1
}

function setSort(k) {
  if (sortKey.value === k) sortDir.value *= -1
  else { sortKey.value = k; sortDir.value = 1 }
}
function sortMark(k) {
  return sortKey.value === k ? (sortDir.value === 1 ? '▲' : '▼') : ''
}

function resetSelection() {
  selected.value = new Set()
  hashResult.value = null
  page.value = 0
}

async function load(dir) {
  const target = dir !== undefined ? dir : cwd.value
  loading.value = true
  error.value = ''
  resetSelection()
  try {
    const data = await api.fmList(target)
    cwd.value = data.path
    items.value = data.items
    if (showDirs.value) computeDirSizes()
  } catch (e) {
    error.value = e.message
    items.value = []
  } finally {
    loading.value = false
  }
}

function go(dir) {
  if (searching.value) searching.value = false
  if (dir !== cwd.value) load(dir)
}

function openItem(item) {
  if (item.is_dir) {
    if (searching.value) { searching.value = false; load(item.path); return }
    load(item.path)
    return
  }
  if (item.kind === 'image') {
    const imgs = items.value.filter((i) => i.kind === 'image')
    const idx = imgs.findIndex((i) => i.path === item.path)
    preview.open(imgs.map((i) => api.fmDownload(i.path, 'direct')), idx < 0 ? 0 : idx)
  }
}

/* ---------- 搜索 ---------- */
async function doSearch(reset = true) {
  if (!searchQ.value && !searchKind.value && !searchMinMB.value && !searchMaxMB.value && !searchDays.value) return
  searching.value = true
  loading.value = true
  error.value = ''
  if (reset) { searchOffset.value = 0; resetSelection() }
  try {
    const d = await api.fmSearch({
      path: cwd.value || '/',
      q: searchQ.value,
      kind: searchKind.value,
      min_size: searchMinMB.value ? String(parseFloat(searchMinMB.value) * 1024 * 1024) : '',
      max_size: searchMaxMB.value ? String(parseFloat(searchMaxMB.value) * 1024 * 1024) : '',
      mtime_days: searchDays.value,
      offset: searchOffset.value ? String(searchOffset.value) : '',
    })
    if (reset) items.value = d.results || []
    else items.value = [...items.value, ...(d.results || [])]
    searchHasMore.value = !!d.has_more
    searchOffset.value = (d.offset || 0) + (d.results || []).length
  } catch (e) {
    error.value = e.message
    items.value = []
  } finally {
    loading.value = false
  }
}

function searchMore() {
  if (searchHasMore.value && !loading.value) doSearch(false)
}

function exitSearch() {
  searching.value = false
  searchHasMore.value = false
  searchOffset.value = 0
  load(cwd.value)
}

/* ---------- 查看 / 编辑 ---------- */
async function showPreview(item) {
  try {
    const data = await api.fmPreview(item.path)
    textPreview.value = data
  } catch (e) {
    error.value = e.message
  }
}

async function openEditor(item) {
  try {
    const d = await api.fmRead(item.path, EDIT_LIMIT, 0)
    editorItem.value = item
    editorText.value = d.text
    editorEncoding.value = d.encoding || 'utf-8'
    editorSize.value = d.size
    editorDirty.value = false
    editorMsg.value = d.truncated ? '文件较大, 仅载入前 ' + (EDIT_LIMIT / 1024 / 1024) + 'MB' : ''
    editorOpen.value = true
    await nextTick()
    if (editorEl.value) editorEl.value.focus()
  } catch (e) {
    error.value = e.message
  }
}

async function saveEditor() {
  if (!editorItem.value) return
  editorSaving.value = true
  editorMsg.value = ''
  try {
    await api.fmSave(editorItem.value.path, editorText.value, editorEncoding.value)
    editorDirty.value = false
    showToast('已保存')
    load(cwd.value)
  } catch (e) {
    editorMsg.value = e.message
  } finally {
    editorSaving.value = false
  }
}

function closeEditor() {
  if (editorDirty.value) {
    askConfirm('未保存的修改', '编辑内容尚未保存, 确定放弃吗?', '放弃', true, () => {
      editorOpen.value = false
    })
    return
  }
  editorOpen.value = false
}

const editorLineCount = computed(() => (editorText.value ? editorText.value.split('\n').length : 1))

function syncEditorScroll() {
  if (gutterEl.value && editorEl.value) gutterEl.value.scrollTop = editorEl.value.scrollTop
}

/* ---------- 通用确认弹窗 ---------- */
function askConfirm(title, msg, okText = '确定', danger = false, onOk) {
  confirmState.value = { show: true, title, msg, okText, danger, onOk: onOk || null }
}
function confirmOk() {
  const fn = confirmState.value.onOk
  confirmState.value = { show: false, title: '', msg: '', okText: '确定', danger: false, onOk: null }
  if (fn) fn()
}

/* ---------- 新建 / 重命名 ---------- */
async function doMkdir() {
  if (!newName.value) return
  action.value = 'mkdir'
  try {
    const p = cwd.value.replace(/\/$/, '') + '/' + newName.value
    await api.fmMkdir(p)
    showToast('已创建 ' + newName.value)
    newName.value = ''
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

function openRename(item) {
  renameState.value = { show: true, target: item, value: item.name }
}
function closeRename() {
  renameState.value = { show: false, target: null, value: '' }
}
async function submitRename() {
  const item = renameState.value.target
  const name = renameState.value.value
  if (!item || !name) return
  action.value = 'rename'
  try {
    await api.fmRename(item.path, name)
    showToast('已重命名')
    closeRename()
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

/* ---------- 异步操作(复制/移动/删除/打包) ---------- */
async function startMoveCopy(op) {
  if (!selectedList.value.length) { error.value = '请先选择文件'; return }
  if (!targetDir.value) { error.value = '请输入目标目录'; return }
  action.value = op
  try {
    await api.fmOpsStart(op, selectedList.value.map((i) => i.path), { dest: targetDir.value })
    showToast(op === 'move' ? '已提交移动任务' : '已提交复制任务')
    targetDir.value = ''
    tasksOpen.value = true
    pollOps()
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

function askDelete(names, paths) {
  askConfirm('删除 ' + names.length + ' 项', '确定删除以下 ' + names.length + ' 项?\n\n' + names.slice(0, 10).join('\n') + (names.length > 10 ? '\n...' : ''), '删除', true, async () => {
    action.value = 'delete'
    try {
      await api.fmOpsStart('delete', paths)
      showToast('已提交删除任务 ' + names.length + ' 项')
      tasksOpen.value = true
      pollOps()
    } catch (e) { error.value = e.message }
    finally { action.value = '' }
  })
}

function askDeleteOne(item) {
  askDelete([item.name], [item.path])
}

async function startArchive() {
  if (!selectedList.value.length) { error.value = '请先选择文件'; return }
  action.value = 'archive'
  try {
    await api.fmOpsStart('archive', selectedList.value.map((i) => i.path), {
      format: archiveFmt.value,
      name: archiveName.value || 'archive',
    })
    showToast('已提交打包任务')
    tasksOpen.value = true
    pollOps()
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

/* ---------- 哈希 / 解压 ---------- */
async function doHash() {
  if (selectedList.value.length !== 1) { error.value = '请选择一个文件'; return }
  hashItem(selectedList.value[0])
}
async function hashItem(item) {
  action.value = 'hash'
  try {
    hashResult.value = await api.fmHash(item.path, hashAlgo.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function doUnzip() {
  if (selectedList.value.length !== 1) { error.value = '请选择一个压缩包'; return }
  unzipItem(selectedList.value[0])
}
async function unzipItem(item) {
  action.value = 'unzip'
  try {
    await api.fmUnzip(item.path, cwd.value, unzipPwd.value)
    showToast('解压完成')
    unzipPwd.value = ''
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

/* ---------- 下载 ---------- */
function downloadItem(item, mode) {
  window.open(api.fmDownload(item.path, mode), '_blank')
}
function downloadArchived(t) {
  window.open(api.fmOpsDownload(t.id), '_blank')
}

/* ---------- 异步任务轮询 ---------- */
async function pollOps() {
  try {
    const d = await api.fmOpsList()
    opsTasks.value = (d && d.tasks) || []
  } catch (e) { /* 静默 */ }
}
async function cancelTask(t) {
  try { await api.fmOpsCancel(t.id); pollOps() } catch (e) { error.value = e.message }
}
async function removeTask(t) {
  try { await api.fmOpsRemove(t.id); pollOps() } catch (e) { error.value = e.message }
}

/* ---------- 目录大小 ---------- */
async function computeDirSizes() {
  const dirs = items.value.filter((i) => i.is_dir && dirSizeMap.value[i.path] === undefined).map((i) => i.path).slice(0, 60)
  if (!dirs.length) return
  try {
    const r = await api.fmSize(dirs)
    dirSizeMap.value = { ...dirSizeMap.value, ...(r.sizes || {}) }
  } catch (e) { /* 静默 */ }
}
function toggleDirs() {
  showDirs.value = !showDirs.value
  if (showDirs.value) computeDirSizes()
}

/* ---------- 上传 ---------- */
function onPickFiles() {
  const input = fileInput.value
  if (!input || !input.files.length) return
  upload(input.files)
  input.value = ''
}
function onDrop(e) {
  dragOver.value = false
  const files = e.dataTransfer ? e.dataTransfer.files : null
  if (files && files.length) upload(files)
}
async function upload(files) {
  const list = [...files]
  uploadState.value = { active: true, items: list.map((f) => ({ name: f.name, pct: 0, status: 'wait' })) }
  error.value = ''
  try {
    const res = await api.fmUpload(cwd.value, list, conflict.value, (ev) => {
      const it = uploadState.value.items[ev.file - 1]
      if (!it) return
      if (ev.error) { it.status = 'error'; return }
      if (ev.done === true) { it.pct = 100; it.status = 'done'; return }
      it.status = 'uploading'
      it.pct = ev.totalBytes ? Math.min(100, Math.round((ev.loadedBytes / ev.totalBytes) * 100)) : 0
    })
    if (res.errors && res.errors.length) error.value = res.errors.join('; ')
    showToast('已上传 ' + res.saved.length + '/' + list.length)
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally {
    uploadState.value = { ...uploadState.value, active: false }
    setTimeout(() => { if (!uploadState.value.active) uploadState.value = { active: false, items: [] } }, 6000)
  }
}

/* ---------- 磁盘 / 收藏 ---------- */
function mountedDisks() {
  const out = []
  for (const d of disks.value) {
    for (const p of d.partitions || []) {
      if (p.mounted && p.mountpoint) out.push({ path: p.mountpoint, label: p.mountpoint, disk: d.path })
    }
  }
  return out
}

async function loadDisks() {
  try {
    const data = await api.disks()
    disks.value = data.disks || []
  } catch (e) {}
}

function saveFavs() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs.value)) } catch (e) {}
}
function addFav() {
  const p = cwd.value || '/'
  if (!favs.value.includes(p)) {
    favs.value.push(p)
    saveFavs()
    showToast('已收藏 ' + p)
  }
}
function removeFav(p) {
  favs.value = favs.value.filter((x) => x !== p)
  saveFavs()
}

/* ---------- 目录选择器 ---------- */
function openPicker() {
  showPicker.value = true
  pickerCwd.value = cwd.value || '/'
  loadPicker()
}
async function loadPicker() {
  pickerLoading.value = true
  try {
    const d = await api.fmList(pickerCwd.value)
    pickerItems.value = (d.items || []).filter((i) => i.is_dir)
  } catch (e) {
    pickerItems.value = []
  } finally {
    pickerLoading.value = false
  }
}
function pickerGo(dir) {
  pickerCwd.value = dir
  loadPicker()
}
function pickerEnter(item) {
  pickerGo(item.path)
}
function usePickerDir() {
  targetDir.value = pickerCwd.value || '/'
  showPicker.value = false
}

/* ---------- 右键菜单 ---------- */
function onCtx(e, item) {
  e.preventDefault()
  e.stopPropagation()
  ctx.value = { show: true, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 250), item }
}
function ctxClose() {
  ctx.value = { show: false, x: 0, y: 0, item: null }
}
async function ctxCopyPath() {
  try { await navigator.clipboard.writeText(ctx.value.item.path); showToast('路径已复制') } catch (e) { showToast('复制失败', 'err') }
  ctxClose()
}
function ctxAction(fn) {
  const item = ctx.value.item
  ctxClose()
  if (item) fn(item)
}

/* ---------- 地址栏 ---------- */
function toggleAddr() {
  showAddr.value = !showAddr.value
  if (showAddr.value) { addrVal.value = cwd.value || '/'; nextTick(() => { const el = document.querySelector('.fm-addr-input'); if (el) el.focus() }) }
}
function goAddr() {
  const p = (addrVal.value || '/').trim()
  if (!p) return
  showAddr.value = false
  go(p)
}

/* ---------- 键盘 ---------- */
function isTypingTarget(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}
function onKeydown(e) {
  if (editorOpen.value && e.key === 'Escape') {
    if (e.target === editorEl.value) { closeEditor(); e.preventDefault(); return }
  }
  if (e.key.startsWith('Arrow') || e.key === 'Escape') {
    if (preview.show.value) {
      if (e.key === 'ArrowRight') { preview.next(); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { preview.prev(); e.preventDefault() }
      else if (e.key === 'Escape') { preview.close() }
    }
    return
  }
  if (isTypingTarget(e.target)) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    toggleAddr()
    return
  }
  if (e.key === 'Delete') {
    e.preventDefault()
    if (selectedList.value.length) askDelete(selectedList.value.map((i) => i.name), selectedList.value.map((i) => i.path))
  } else if (e.key === 'F2') {
    e.preventDefault()
    if (selectedList.value.length === 1) openRename(selectedList.value[0])
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    const allSel = new Set(selected.value)
    for (const i of items.value) allSel.add(i.path)
    selected.value = allSel
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    error.value = ''
    const box = document.querySelector('.fm-search-input')
    if (box) box.focus()
  }
}

function setupObserver() {
  if (observer) observer.disconnect()
  if (!sentinel.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore.value && !loading.value) showMore()
  }, { rootMargin: '200px' })
  observer.observe(sentinel.value)
}

function onGlobalClick() {
  ctxClose()
}

onMounted(() => {
  load('/')
  loadDisks()
  pollOps()
  pollTimer = setInterval(pollOps, 2000)
  try {
    const saved = JSON.parse(localStorage.getItem(FAV_KEY) || 'null')
    favs.value = Array.isArray(saved) && saved.length ? saved : ['/', '/home', '/opt', '/tmp', '/var/log']
  } catch (e) { favs.value = ['/', '/home', '/opt', '/tmp', '/var/log'] }
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('click', onGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('click', onGlobalClick)
  if (observer) observer.disconnect()
  if (pollTimer) clearInterval(pollTimer)
})

watch([loading, hasMore], async () => {
  await nextTick()
  setupObserver()
})
watch(paged, () => setupObserver())
</script>
<template>
  <div class="fm-page">
    <h1>文件管理</h1>
    <div class="subtitle">浏览服务器文件系统 · 上传下载、在线编辑、压缩解压与异步任务</div>

    <div class="fm-shell" :class="{ drop: dragOver }"
         @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="onDrop">
      <!-- 侧栏 -->
      <aside v-if="sidebarOpen" class="fm-side">
        <div class="fm-side-head">
          <span>快捷导航</span>
          <button class="btn btn-sm btn-ghost fm-mini-btn" @click="sidebarOpen = false">收起</button>
        </div>
        <div class="fm-side-section">
          <div class="fm-side-label">
            <span>收藏目录</span>
            <button class="btn btn-sm btn-ghost fm-mini-btn" @click="addFav">＋当前</button>
          </div>
          <button v-for="p in favs" :key="'f' + p" class="fm-nav-btn"
                  :class="{ active: cwd === p }" @click="go(p)">
            <span class="fm-nav-text fm-mono">{{ p }}</span>
            <span class="fm-nav-x" title="移除收藏" @click.stop="removeFav(p)">×</span>
          </button>
        </div>
        <div v-if="mountedDisks().length" class="fm-side-section">
          <div class="fm-side-label">磁盘挂载</div>
          <button v-for="m in mountedDisks()" :key="'m' + m.path" class="fm-nav-btn"
                  :class="{ active: cwd === m.path }" @click="go(m.path)">
            <span class="fm-nav-text fm-mono">{{ m.path }}</span>
          </button>
        </div>
      </aside>

      <div class="fm-body">
        <!-- 顶栏 -->
        <header class="fm-topbar">
          <div class="fm-topbar-left">
            <button v-if="!sidebarOpen" class="fm-top-btn" title="显示侧栏" @click="sidebarOpen = true">☰</button>
            <div v-if="showAddr" class="fm-addr-wrap">
              <input v-model="addrVal" class="input fm-addr-input" placeholder="输入绝对路径，回车跳转"
                     @keydown.enter="goAddr" @keydown.esc="showAddr = false" />
            </div>
            <nav v-else class="fm-crumbs" title="双击编辑路径 (Ctrl+L)" @dblclick="toggleAddr">
              <button class="fm-crumb fm-mono" @click="go('/')">/</button>
              <template v-for="(c, i) in crumbs" :key="c.path">
                <span v-if="i > 0" class="fm-crumb-sep">›</span>
                <button class="fm-crumb fm-mono" @click="go(c.path)">{{ c.label }}</button>
              </template>
            </nav>
          </div>
          <div class="fm-topbar-right">
            <button class="fm-top-btn" :class="{ on: showDirs }" title="显示/隐藏目录大小" @click="toggleDirs">Σ</button>
            <button class="fm-top-btn" :class="{ on: tasksOpen }" title="任务面板" @click="tasksOpen = !tasksOpen">
              ≡<b v-if="runningOps" class="fm-badge">{{ runningOps }}</b>
            </button>
            <button class="fm-top-btn" title="刷新" @click="load(cwd)">↻</button>
            <button class="btn btn-sm btn-primary" title="上传文件到当前目录" @click="fileInput && fileInput.click()">⬆ 上传</button>
            <input ref="fileInput" type="file" multiple class="fm-hidden-file" @change="onPickFiles" />
            <button class="fm-top-btn" :class="{ on: showNewRow }" title="新建文件夹" @click="showNewRow = !showNewRow">＋</button>
          </div>
        </header>

        <!-- 新建行 -->
        <div v-if="showNewRow" class="fm-strip">
          <input v-model="newName" class="input fm-grow" placeholder="新建文件夹名"
                 @keydown.enter="doMkdir" @keydown.esc="showNewRow = false" />
          <button class="btn btn-sm btn-primary" :disabled="!!action" @click="doMkdir">创建</button>
          <button class="btn btn-sm" @click="showNewRow = false">取消</button>
        </div>

        <!-- 搜索行 -->
        <div class="fm-strip fm-search">
          <input v-model="searchQ" class="input fm-search-input fm-grow"
                 placeholder="搜索当前目录及子目录（文件名）…" @keydown.enter="doSearch()" />
          <button class="btn btn-sm btn-primary" @click="doSearch(true)">搜索</button>
          <button v-if="searching" class="btn btn-sm" @click="exitSearch">退出搜索</button>
          <div v-if="searching" class="fm-search-opts">
            <label class="fm-lbl">类型
              <select v-model="searchKind" class="input">
                <option value="">全部</option>
                <option value="image">图片</option>
                <option value="video">视频</option>
                <option value="audio">音频</option>
                <option value="archive">压缩包</option>
                <option value="text">文本</option>
                <option value="dir">目录</option>
                <option value="file">其他</option>
              </select>
            </label>
            <label class="fm-lbl">≥ <input v-model="searchMinMB" class="input fm-num" placeholder="MB" /></label>
            <label class="fm-lbl">≤ <input v-model="searchMaxMB" class="input fm-num" placeholder="MB" /></label>
            <label class="fm-lbl">N天内 <input v-model="searchDays" class="input fm-num" placeholder="天" /></label>
            <span class="fm-search-count">{{ items.length }} 条结果<span v-if="searchHasMore"> · 可加载更多</span></span>
            <button v-if="searchHasMore" class="btn btn-sm" :disabled="loading" @click="searchMore">加载更多</button>
          </div>
        </div>

        <!-- 选择操作条 -->
        <div v-if="selectedList.length" class="fm-selbar">
          <span class="fm-sel-info">{{ selectedList.length }} 项已选 · {{ fmtBytes(selectedSize) }}</span>
          <span class="fm-sel-sep"></span>
          <button class="btn btn-sm" :disabled="!!action"
                  @click="selectedList.length === 1 ? openRename(selectedList[0]) : null">重命名</button>
          <button class="btn btn-sm" :disabled="!!action" @click="startMoveCopy('move')">移动</button>
          <button class="btn btn-sm" :disabled="!!action" @click="startMoveCopy('copy')">复制</button>
          <button class="btn btn-sm btn-danger" :disabled="!!action"
                  @click="askDelete(selectedList.map(i => i.name), selectedList.map(i => i.path))">删除</button>
          <button class="btn btn-sm" :disabled="selectedList.length !== 1 || !!action" @click="doHash">哈希</button>
          <button class="btn btn-sm" :disabled="selectedList.length !== 1 || !!action" @click="doUnzip">解压</button>
          <button class="btn btn-sm" :disabled="!!action" @click="startArchive">打包</button>
          <span class="fm-grow"></span>
          <button class="btn btn-sm btn-ghost" @click="selected = new Set()">清除选择</button>
        </div>

        <!-- 操作参数 -->
        <details class="fm-params" open>
          <summary>操作参数 ⚙</summary>
          <div class="fm-params-row">
            <label class="fm-lbl fm-grow">移动/复制目标
              <input v-model="targetDir" class="input fm-target" placeholder="绝对路径" @keydown.enter="openPicker" />
            </label>
            <button class="btn btn-sm" @click="openPicker">浏览…</button>
            <label class="fm-lbl">解压密码
              <input v-model="unzipPwd" class="input fm-inp-sm" type="password" placeholder="可选" />
            </label>
            <label class="fm-lbl">哈希
              <select v-model="hashAlgo" class="input">
                <option value="md5">MD5</option>
                <option value="sha1">SHA1</option>
                <option value="sha256">SHA256</option>
                <option value="sha512">SHA512</option>
              </select>
            </label>
            <label class="fm-lbl">打包
              <select v-model="archiveFmt" class="input">
                <option value="zip">ZIP</option>
                <option value="7z">7z</option>
              </select>
              <input v-model="archiveName" class="input fm-inp-sm" placeholder="包名" />
            </label>
            <label class="fm-lbl">目录下载
              <select v-model="dlMode" class="input">
                <option value="direct">直传 zip</option>
                <option value="compress">7z 极限压缩</option>
              </select>
            </label>
            <label class="fm-lbl">重名
              <select v-model="conflict" class="input">
                <option value="rename">自动改名</option>
                <option value="overwrite">覆盖</option>
              </select>
            </label>
          </div>
        </details>

        <div v-if="error" class="fm-alert">⚠ {{ error }}</div>
        <div v-if="action" class="fm-processing"><span class="spinner"></span> {{ action === 'hash' ? '计算中...' : '处理中...' }}</div>
        <div v-if="hashResult" class="mono-block fm-hash">
          <b>{{ hashResult.algo.toUpperCase() }}</b> {{ hashResult.hash }}
        </div>

        <!-- 文本查看 -->
        <div v-if="textPreview" class="section fm-preview">
          <div class="section-title">文本预览
            <button class="btn btn-sm btn-ghost" style="float:right;" @click="textPreview = null">关闭</button>
          </div>
          <pre class="mono-block fm-preview-body">{{ textPreview.text }}</pre>
          <div v-if="textPreview.truncated" class="status-line" style="margin-top:6px;">已截断（仅显示前 512KB），如需完整内容请使用「编辑」</div>
        </div>

        <!-- 文件列表 -->
        <div class="fm-table-card">
          <div v-if="loading && !items.length" class="fm-empty">
            <div class="spinner"></div> 加载中...
          </div>
          <div v-else-if="!items.length" class="fm-empty">{{ searching ? '无搜索结果' : '空目录' }}</div>
          <table v-else class="fm-table">
            <thead>
              <tr>
                <th class="fm-col-check"><input type="checkbox" :checked="allChecked()" @change="toggleAll" /></th>
                <th class="fm-th-sort" @click="setSort('name')">名称 {{ sortMark('name') }}</th>
                <th class="fm-col-size fm-th-sort" @click="setSort('size')">大小 {{ sortMark('size') }}</th>
                <th class="fm-col-type">类型</th>
                <th class="fm-col-time fm-th-sort" @click="setSort('mtime')">修改时间 {{ sortMark('mtime') }}</th>
                <th class="fm-col-ops">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paged" :key="item.path" class="fm-row"
                  :class="{ sel: selected.has(item.path) }"
                  @contextmenu.prevent="onCtx($event, item)">
                <td class="fm-col-check" @click.stop>
                  <input type="checkbox" :checked="selected.has(item.path)" @change="toggleSel(item)" />
                </td>
                <td class="fm-col-name" @click="openItem(item)"
                    @dblclick="item.kind === 'text' && showPreview(item)"
                    :title="item.link_target ? ('链接 → ' + item.link_target) : item.path">
                  <span class="fm-ico">{{ kindIcon(item.kind) }}</span>
                  <span :class="{ 'text-faint': item.hidden }">{{ item.name }}</span>
                  <span v-if="item.is_link" class="fm-link">→</span>
                </td>
                <td class="fm-col-size fm-mono">{{ fmtSize(item) }}</td>
                <td class="fm-col-type">{{ kindName(item.kind) }}</td>
                <td class="fm-col-time fm-mono">{{ fmtTime(item.mtime) }}</td>
                <td class="fm-col-ops">
                  <button class="btn btn-sm btn-ghost fm-op" @click.stop="downloadItem(item, dlMode)">下载</button>
                  <button v-if="item.kind === 'text'" class="btn btn-sm btn-ghost fm-op" @click.stop="showPreview(item)">查看</button>
                  <button v-if="item.kind === 'text'" class="btn btn-sm btn-ghost fm-op" @click.stop="openEditor(item)">编辑</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="hasMore" ref="sentinel" class="fm-more">
            <button class="btn btn-sm" @click="showMore">加载更多（{{ paged.length }} / {{ sortedAll.length }}）</button>
          </div>
          <div v-if="searching && searchHasMore" class="fm-more">
            <button class="btn btn-sm" :disabled="loading" @click="searchMore">加载更多搜索结果</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 目录选择器 -->
    <div v-if="showPicker" class="fm-mask" @click.self="showPicker = false">
      <div class="fm-dialog fm-dialog-picker">
        <div class="fm-dialog-head"><span>选择目标目录</span><button class="btn btn-sm btn-ghost" @click="showPicker = false">取消</button></div>
        <div class="fm-dialog-crumb fm-mono">
          <template v-for="(c, i) in pickerCrumbs" :key="c.path">
            <span v-if="i > 0">›</span>
            <button class="btn btn-ghost btn-sm" style="padding:0 4px;" @click="pickerGo(c.path)">{{ c.label }}</button>
          </template>
        </div>
        <div class="fm-dialog-list">
          <div v-if="pickerLoading" class="fm-empty"><div class="spinner"></div> 加载中...</div>
          <div v-else-if="!pickerItems.length" class="fm-empty">无子目录</div>
          <button v-for="d in pickerItems" :key="d.path" class="fm-dir-item" @click="pickerEnter(d)">📁 {{ d.name }}</button>
        </div>
        <div class="fm-dialog-foot">
          <span class="status-line fm-mono">{{ pickerCwd }}</span>
          <span class="fm-grow"></span>
          <button class="btn btn-sm" @click="showPicker = false">取消</button>
          <button class="btn btn-sm btn-primary" @click="usePickerDir">使用此目录</button>
        </div>
      </div>
    </div>

    <!-- 重命名 -->
    <div v-if="renameState.show" class="fm-mask" @click.self="closeRename">
      <div class="fm-dialog">
        <div class="fm-dialog-head"><span>重命名</span><button class="btn btn-sm btn-ghost" @click="closeRename">取消</button></div>
        <div class="fm-dialog-body">
          <input v-model="renameState.value" class="input fm-mono" style="width:100%;"
                 @keydown.enter="submitRename" @keydown.esc="closeRename" />
        </div>
        <div class="fm-dialog-foot">
          <span class="status-line fm-mono">{{ renameState.target && renameState.target.path }}</span>
          <span class="fm-grow"></span>
          <button class="btn btn-sm" @click="closeRename">取消</button>
          <button class="btn btn-sm btn-primary" :disabled="!!action" @click="submitRename">确定</button>
        </div>
      </div>
    </div>

    <!-- 通用确认 -->
    <div v-if="confirmState.show" class="fm-mask"
         @click.self="confirmState = { show:false,title:'',msg:'',okText:'确定',danger:false,onOk:null }">
      <div class="fm-dialog">
        <div class="fm-dialog-head">{{ confirmState.title }}</div>
        <div class="fm-dialog-body fm-confirm-msg">{{ confirmState.msg }}</div>
        <div class="fm-dialog-foot">
          <span class="fm-grow"></span>
          <button class="btn btn-sm"
                  @click="confirmState = { show:false,title:'',msg:'',okText:'确定',danger:false,onOk:null }">取消</button>
          <button class="btn btn-sm" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" @click="confirmOk">{{ confirmState.okText }}</button>
        </div>
      </div>
    </div>

    <!-- 编辑器 -->
    <div v-if="editorOpen" class="fm-mask fm-edit-mask" @click.self="closeEditor">
      <div class="fm-dialog fm-edit-dialog">
        <div class="fm-dialog-head">
          <span class="fm-edit-title fm-mono">{{ editorItem && editorItem.path }}</span>
          <span class="status-line">{{ editorSize }} B · {{ editorEncoding }}</span>
          <button class="btn btn-sm btn-ghost" @click="closeEditor">关闭</button>
        </div>
        <div class="fm-edit-toolbar">
          <select v-model="editorEncoding" class="input">
            <option value="utf-8">UTF-8</option>
            <option value="gb18030">GB18030</option>
            <option value="gbk">GBK</option>
            <option value="ascii">ASCII</option>
            <option value="latin-1">latin-1</option>
          </select>
          <span class="status-line">Ctrl+S 保存</span>
          <span v-if="editorMsg" class="status-line fm-warn-text">{{ editorMsg }}</span>
          <span class="fm-grow"></span>
          <span v-if="editorDirty" class="status-line fm-warn-text">未保存</span>
          <button class="btn btn-sm btn-primary" :disabled="editorSaving" @click="saveEditor">{{ editorSaving ? '保存中…' : '保存' }}</button>
        </div>
        <div class="fm-edit-wrap">
          <div class="fm-edit-gutter fm-mono" ref="gutterEl">
            <div v-for="n in editorLineCount" :key="n" class="fm-edit-ln">{{ n }}</div>
          </div>
          <textarea ref="editorEl" v-model="editorText" class="fm-edit-area" spellcheck="false"
                    @scroll="syncEditorScroll" @input="editorDirty = true"
                    @keydown.ctrl.s.prevent="saveEditor" @keydown.meta.s.prevent="saveEditor"></textarea>
        </div>
      </div>
    </div>

    <!-- 上传进度 -->
    <div v-if="uploadState.items.length" class="fm-upcard">
      <div class="fm-upcard-head">
        <span>上传进度</span>
        <button class="btn btn-sm btn-ghost fm-mini-btn" @click="uploadState = { active: false, items: [] }">×</button>
      </div>
      <div v-for="(u, i) in uploadState.items" :key="i" class="fm-upitem">
        <span class="fm-upname fm-mono" :title="u.name">{{ u.name }}</span>
        <div class="fm-upbar"><div class="fm-upfill" :class="u.status" :style="{ width: (u.pct || 0) + '%' }"></div></div>
        <span class="fm-uppct fm-mono">{{ u.status === 'error' ? '失败' : (u.status === 'done' ? '完成' : (u.pct || 0) + '%') }}</span>
      </div>
    </div>

    <!-- 任务面板 -->
    <div v-if="tasksOpen" class="fm-tasks">
      <div class="fm-tasks-head"><span>任务（{{ opsTasks.length }}）</span><button class="btn btn-sm btn-ghost fm-mini-btn" @click="tasksOpen = false">收起</button></div>
      <div class="fm-tasks-body">
        <div v-if="!opsTasks.length" class="fm-empty">暂无任务</div>
        <div v-for="t in opsTasks" :key="t.id" class="fm-task">
          <div class="fm-task-line">
            <span class="fm-task-op">{{ OP_LABEL[t.op] || t.op }}</span>
            <span class="status-line fm-mono">#{{ t.id }}</span>
            <span class="fm-grow"></span>
            <span :class="'fm-task-state ' + t.status">{{ OP_STATE[t.status] || t.status }}</span>
          </div>
          <div class="fm-taskbar"><div class="fm-taskfill" :style="{ width: (t.total ? Math.round((t.done / t.total) * 100) : 0) + '%' }"></div></div>
          <div class="fm-taskfoot">
            <span class="status-line">{{ t.done }}/{{ t.total }}<template v-if="t.failed && t.failed.length"> · {{ t.failed.length }} 项失败</template></span>
            <span class="fm-grow"></span>
            <button v-if="t.status === 'running'" class="btn btn-sm btn-ghost" @click="cancelTask(t)">取消</button>
            <button v-else-if="t.op === 'archive' && t.status === 'done'" class="btn btn-sm" @click="downloadArchived(t)">下载包</button>
            <button v-if="t.status !== 'running'" class="btn btn-sm btn-ghost" @click="removeTask(t)">删除</button>
          </div>
          <div v-if="t.error" class="fm-task-err">{{ t.error }}</div>
          <div v-if="t.failed && t.failed.length" class="fm-task-err">{{ t.failed.join('; ') }}</div>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="ctx.show" class="fm-ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
      <div class="fm-ctx-title fm-mono">{{ ctx.item && ctx.item.name }}</div>
      <div class="fm-ctx-sep"></div>
      <button class="fm-ctx-item" @click="downloadItem(ctx.item, dlMode)">下载</button>
      <button v-if="ctx.item && ctx.item.kind === 'text'" class="fm-ctx-item" @click="ctxAction((i) => showPreview(i))">查看</button>
      <button v-if="ctx.item && ctx.item.kind === 'text'" class="fm-ctx-item" @click="ctxAction((i) => openEditor(i))">编辑</button>
      <button class="fm-ctx-item" @click="ctxAction((i) => openRename(i))">重命名 (F2)</button>
      <button class="fm-ctx-item" @click="ctxAction((i) => hashItem(i))">哈希</button>
      <button v-if="ctx.item && ctx.item.kind === 'archive'" class="fm-ctx-item" @click="ctxAction((i) => unzipItem(i))">解压</button>
      <button class="fm-ctx-item" @click="ctxCopyPath">复制路径</button>
      <div class="fm-ctx-sep"></div>
      <button class="fm-ctx-item danger" @click="ctxAction((i) => askDeleteOne(i))">删除</button>
    </div>

    <!-- toast -->
    <transition name="toast">
      <div v-if="toastMsg" class="fm-toast" :class="toastKind">{{ toastMsg }}</div>
    </transition>
  </div>
</template>

<style scoped>
.fm-page {}
.fm-shell { display: flex; gap: 14px; align-items: flex-start; min-height: 200px; }
.fm-shell.drop { outline: 2px dashed var(--accent); outline-offset: 4px; border-radius: 10px; }

/* 侧栏 */
.fm-side { width: 216px; flex-shrink: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface-2); }
.fm-side-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; font-size: 12px; color: var(--text-faint); font-weight: 700; border-bottom: 1px solid var(--border); }
.fm-mini-btn { padding: 0 6px; font-size: 11px; }
.fm-side-section { padding: 6px 0; }
.fm-side-section + .fm-side-section { border-top: 1px solid var(--border); }
.fm-side-label { display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; font-size: 11px; color: var(--text-faint); }
.fm-nav-btn { display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; padding: 6px 12px; border-radius: 0; background: transparent; border: none; color: var(--text); cursor: pointer; font-size: 12.5px; }
.fm-nav-btn:hover { background: var(--surface-3); }
.fm-nav-btn.active { background: var(--accent-soft); color: var(--accent-hover); }
.fm-nav-x { color: var(--text-faint); padding: 0 2px; line-height: 1; }
.fm-nav-x:hover { color: var(--danger); }
.fm-nav-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 主区 */
.fm-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.fm-grow { flex: 1; min-width: 0; }
.fm-mono { font-family: var(--font-mono); }
.fm-hidden-file { display: none; }

/* 顶栏 */
.fm-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
.fm-topbar-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.fm-topbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
.fm-top-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 30px; height: 28px; padding: 0 8px; border-radius: 7px; border: 1px solid transparent; background: transparent; color: var(--text-muted); font-size: 13px; cursor: pointer; transition: var(--transition); }
.fm-top-btn:hover { background: var(--surface-3); color: var(--text); }
.fm-top-btn.on { background: var(--accent-soft); color: var(--accent-hover); border-color: var(--accent); }
.fm-badge { margin-left: 2px; background: var(--accent); color: #fff; border-radius: 8px; font-size: 10px; padding: 0 5px; line-height: 14px; }
.fm-addr-wrap { flex: 1; min-width: 160px; }
.fm-addr-input { width: 100%; font-family: var(--font-mono); }
.fm-crumbs { flex: 1; min-width: 0; display: flex; align-items: center; gap: 2px; max-width: 680px; overflow: hidden; flex-wrap: nowrap; white-space: nowrap; font-size: 13px; cursor: default; }
.fm-crumb { border: none; background: transparent; color: var(--text-muted); padding: 2px 4px; border-radius: 5px; cursor: pointer; font-size: 12.5px; }
.fm-crumb:hover { background: var(--surface-3); color: var(--text); }
.fm-crumb-sep { color: var(--text-faint); margin: 0 1px; }

/* 工具条 */
.fm-strip { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.fm-search-opts { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); }
.fm-search-count { font-size: 12px; color: var(--text-muted); margin-left: auto; }
.fm-lbl { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.fm-lbl .input { font-size: 12px; padding: 4px 7px; }
.fm-num { width: 62px; }
.fm-inp-sm { width: 96px; }
.fm-target { width: 200px; }

/* 选择操作条 */
.fm-selbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 14px; border: 1px solid var(--accent); border-radius: 10px; background: var(--accent-soft); }
.fm-sel-info { font-weight: 700; color: var(--accent-hover); }
.fm-sel-sep { width: 1px; height: 16px; background: var(--border-strong); }

/* 参数卡 */
.fm-params { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 4px 14px 10px; }
.fm-params summary { cursor: pointer; font-size: 12px; color: var(--text-muted); user-select: none; padding: 6px 0; }
.fm-params summary:hover { color: var(--text); }
.fm-params-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }

/* 状态条 */
.fm-alert { padding: 8px 12px; border-radius: 8px; background: var(--danger-soft); color: var(--danger); font-size: 13px; }
.fm-processing { display: flex; align-items: center; gap: 8px; padding: 8px 12px; color: var(--text-muted); font-size: 13px; }
.fm-hash { margin-top: 2px; font-size: 12px; }
.fm-preview { }
.fm-preview-body { max-height: 400px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
.fm-warn-text { color: var(--warning); }

/* 表格 */
.fm-table-card { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
.fm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fm-table thead th { padding: 8px 10px; color: var(--text-faint); text-align: left; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface-2); z-index: 2; font-weight: 600; }
.fm-th-sort { cursor: pointer; }
.fm-th-sort:hover { color: var(--text); }
.fm-col-check { width: 32px; }
.fm-col-size { width: 100px; text-align: right; }
.fm-col-type { width: 72px; }
.fm-col-time { width: 150px; }
.fm-col-ops { width: 172px; }
.fm-row { border-bottom: 1px solid var(--border); transition: background var(--transition); }
.fm-row:last-child { border-bottom: none; }
.fm-row:hover { background: var(--surface-2); }
.fm-row.sel { background: var(--accent-soft); box-shadow: inset 3px 0 0 var(--accent); }
.fm-row td { padding: 6px; }
.fm-col-name { padding: 6px 10px !important; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-ico { margin-right: 6px; }
.fm-link { color: var(--accent); font-size: 11px; margin-left: 4px; }
.fm-op { padding: 2px 7px; font-size: 12px; opacity: 0.85; }
.fm-col-ops { white-space: nowrap; }
.fm-more { padding: 10px; text-align: center; }
.fm-empty { padding: 34px; text-align: center; color: var(--text-faint); display: flex; align-items: center; justify-content: center; gap: 8px; }

/* 弹窗 */
.fm-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(2px); }
.fm-dialog { width: 440px; max-width: 92vw; max-height: 82vh; display: flex; flex-direction: column; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
.fm-dialog-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; }
.fm-dialog-body { padding: 14px 16px; overflow: auto; }
.fm-dialog-crumb { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px solid var(--border); font-size: 13px; }
.fm-dialog-list { overflow: auto; padding: 6px; flex: 1; }
.fm-dir-item { display: block; width: 100%; text-align: left; padding: 7px 12px; border-radius: 7px; font-size: 13px; color: var(--text); background: transparent; border: none; cursor: pointer; }
.fm-dir-item:hover { background: var(--surface-3); }
.fm-dialog-foot { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); }
.fm-confirm-msg { white-space: pre-wrap; word-break: break-all; }

/* 编辑器 */
.fm-edit-mask { z-index: 1100; }
.fm-edit-dialog { width: min(940px, 94vw); height: 78vh; }
.fm-edit-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--border); }
.fm-edit-title { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 44%; }
.fm-edit-wrap { flex: 1; display: flex; overflow: hidden; min-height: 0; background: var(--surface); }
.fm-edit-gutter { width: 52px; overflow: hidden; text-align: right; padding: 10px 8px 10px 0; color: var(--text-faint); font-size: 12px; line-height: 1.55; background: var(--surface-2); user-select: none; flex-shrink: 0; }
.fm-edit-ln { height: 18.6px; }
.fm-edit-area { flex: 1; min-width: 0; resize: none; border: none; outline: none; background: var(--surface); color: var(--text); font-family: var(--font-mono); font-size: 12.5px; line-height: 1.55; padding: 10px 12px; white-space: pre; overflow: auto; }

/* 上传卡片 */
.fm-upcard { position: fixed; left: 16px; bottom: 16px; z-index: 1250; width: 320px; max-width: 82vw; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: var(--shadow); padding: 10px 12px; font-size: 12px; }
.fm-upcard-head { display: flex; justify-content: space-between; align-items: center; font-weight: 700; margin-bottom: 6px; }
.fm-upitem { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; }
.fm-upname { width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-upbar { flex: 1; height: 8px; background: var(--surface-3); border-radius: 4px; overflow: hidden; }
.fm-upfill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.15s; }
.fm-upfill.done { background: var(--success); }
.fm-upfill.error { background: var(--danger); }
.fm-uppct { width: 46px; text-align: right; color: var(--text-muted); }

/* 任务面板 */
.fm-tasks { position: fixed; right: 16px; bottom: 16px; z-index: 1300; width: 360px; max-width: 92vw; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
.fm-tasks-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 700; }
.fm-tasks-body { max-height: 46vh; overflow: auto; padding: 4px 12px; }
.fm-task { padding: 10px 0; border-bottom: 1px solid var(--border); }
.fm-task:last-child { border-bottom: none; }
.fm-task-line { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.fm-task-op { font-weight: 700; }
.fm-task-state { font-size: 12px; }
.fm-task-state.done { color: var(--success); }
.fm-task-state.error { color: var(--danger); }
.fm-task-state.cancelled { color: var(--text-faint); }
.fm-taskbar { height: 6px; background: var(--surface-3); border-radius: 3px; overflow: hidden; margin: 6px 0 4px; }
.fm-taskfill { height: 100%; background: var(--accent); transition: width 0.3s; }
.fm-taskfoot { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.fm-task-err { color: var(--danger); font-size: 12px; margin-top: 4px; }

/* 右键菜单 */
.fm-ctx { position: fixed; z-index: 1500; min-width: 168px; background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 10px; padding: 4px; box-shadow: var(--shadow); font-size: 13px; }
.fm-ctx-title { padding: 5px 10px; color: var(--text-faint); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
.fm-ctx-item { display: block; width: 100%; text-align: left; padding: 6px 10px; border: none; background: transparent; color: var(--text); border-radius: 6px; cursor: pointer; font-size: 12px; }
.fm-ctx-item:hover { background: var(--surface-3); }
.fm-ctx-item.danger:hover { background: var(--danger-soft); color: var(--danger); }
.fm-ctx-sep { height: 1px; background: var(--border); margin: 4px 6px; }

/* toast */
.fm-toast { position: fixed; top: 16px; right: 16px; z-index: 2000; padding: 10px 16px; border-radius: 10px; font-size: 13px; background: var(--surface-3); border: 1px solid var(--border-strong); border-left: 3px solid var(--success); color: var(--text); box-shadow: var(--shadow); }
.fm-toast.err { border-left-color: var(--danger); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }

/* 响应式 */
@media (max-width: 960px) {
  .fm-side { display: none; }
  .fm-crumbs { max-width: 240px; }
  .fm-col-ops { width: auto; }
  .fm-col-time { display: none; }
}
</style>
