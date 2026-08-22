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

const displayPath = computed(() => cwd.value || '/')
const selectedList = computed(() => items.value.filter((i) => selected.value.has(i.path)))
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
  <div>
    <h1>文件管理</h1>
    <div class="subtitle">浏览服务器文件系统, 上传下载、在线编辑、压缩解压与异步任务</div>

    <div class="fm-layout" :class="{ drop: dragOver }"
         @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="onDrop">
      <aside v-if="sidebarOpen" class="fm-sidebar">
        <div class="fm-sidebar-head">
          <span>快捷导航</span>
          <button class="btn btn-sm btn-ghost" style="padding:0 4px;font-size:11px;" @click="sidebarOpen = false">收起</button>
        </div>

        <div class="fm-sidebar-section">
          <div class="fm-sidebar-label">
            <span>收藏目录</span>
            <button class="btn btn-sm btn-ghost" style="padding:0 4px;font-size:11px;" @click="addFav">＋当前</button>
          </div>
          <button v-for="p in favs" :key="'f' + p" class="fm-nav-btn"
                  :class="{ active: cwd === p }" @click="go(p)">
            <span class="fm-nav-text">{{ p }}</span>
            <span class="fm-nav-x" title="移除收藏" @click.stop="removeFav(p)">×</span>
          </button>
        </div>

        <div v-if="mountedDisks().length" class="fm-sidebar-section">
          <div class="fm-sidebar-label">磁盘挂载</div>
          <button v-for="m in mountedDisks()" :key="'m' + m.path" class="fm-nav-btn"
                  :class="{ active: cwd === m.path }" @click="go(m.path)">
            <span class="fm-nav-text">{{ m.path }}</span>
          </button>
        </div>
      </aside>

      <div class="fm-main">
        <div class="section">
          <div class="btn-row">
            <button v-if="!sidebarOpen" class="btn btn-sm" @click="sidebarOpen = true">侧边栏</button>
            <button class="btn btn-sm" @click="go('/')">根目录</button>
            <button class="btn btn-sm" @click="load(cwd)">刷新</button>
            <button class="btn btn-sm btn-primary" @click="fileInput && fileInput.click()">上传</button>
            <input ref="fileInput" type="file" multiple style="display:none;" @change="onPickFiles" />
            <select v-model="conflict" class="input" style="width:auto;">
              <option value="rename">重名自动改名</option>
              <option value="overwrite">重名覆盖</option>
            </select>
            <input v-model="newName" class="input" style="width:150px;" placeholder="新建文件夹名"
                   @keydown.enter="doMkdir" />
            <button class="btn btn-sm" :disabled="!!action" @click="doMkdir">新建</button>
            <span style="flex:1"></span>
            <button class="btn btn-sm" :class="{ active: showDirs }" @click="toggleDirs">目录大小</button>
            <button class="btn btn-sm" :class="{ active: tasksOpen }" @click="tasksOpen = !tasksOpen">
              任务<template v-if="runningOps"> ({{ runningOps }})</template>
            </button>
            <span v-if="selectedList.length" class="status-line">{{ selectedList.length }} 项已选</span>
          </div>

          <div class="btn-row" v-if="showAddr">
            <input v-model="addrVal" class="input fm-addr-input" style="flex:1;font-family:var(--font-mono);"
                   placeholder="输入绝对路径后回车跳转" @keydown.enter="goAddr" />
            <button class="btn btn-sm btn-primary" @click="goAddr">跳转</button>
            <button class="btn btn-sm" @click="showAddr = false">取消</button>
          </div>

          <div class="btn-row">
            <input v-model="searchQ" class="input fm-search-input" style="flex:1;min-width:150px;"
                   placeholder="在当前目录及子目录搜索文件名…" @keydown.enter="doSearch()" />
            <select v-model="searchKind" class="input" style="width:auto;">
              <option value="">全部类型</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="audio">音频</option>
              <option value="archive">压缩包</option>
              <option value="text">文本</option>
              <option value="dir">目录</option>
              <option value="file">其他</option>
            </select>
            <input v-model="searchMinMB" class="input" style="width:88px;" placeholder="≥M" />
            <input v-model="searchMaxMB" class="input" style="width:88px;" placeholder="≤M" />
            <input v-model="searchDays" class="input" style="width:88px;" placeholder="≤N天" />
            <button class="btn btn-sm btn-primary" @click="doSearch(true)">搜索</button>
            <button v-if="searching" class="btn btn-sm" @click="exitSearch">返回目录</button>
            <button class="btn btn-sm" title="Ctrl+L" @click="toggleAddr">地址栏</button>
          </div>

          <div v-if="error" class="error" style="margin-top:10px;">{{ error }}</div>
          <div v-if="action" class="loading" style="margin-top:10px;"><div class="spinner"></div> {{ action === 'hash' ? '计算中...' : '处理中...' }}</div>

          <div class="btn-row">
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="selectedList.length === 1 ? openRename(selectedList[0]) : null">重命名</button>
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="startMoveCopy('move')">移动</button>
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="startMoveCopy('copy')">复制</button>
            <button class="btn btn-sm btn-danger" :disabled="!selectedList.length || !!action" @click="askDelete(selectedList.map(i => i.name), selectedList.map(i => i.path))">删除</button>
            <button class="btn btn-sm" :disabled="selectedList.length !== 1 || !!action" @click="doHash">哈希</button>
            <button class="btn btn-sm" :disabled="selectedList.length !== 1 || !!action" @click="doUnzip">解压</button>
            <select v-model="archiveFmt" class="input" style="width:auto;">
              <option value="zip">ZIP</option>
              <option value="7z">7z</option>
            </select>
            <input v-model="archiveName" class="input" style="width:110px;" placeholder="包名" />
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="startArchive">打包</button>
          </div>

          <div class="btn-row">
            <input v-model="targetDir" class="input" style="flex:1;min-width:150px;" placeholder="移动/复制目标目录（绝对路径）" />
            <button class="btn btn-sm" @click="openPicker">浏览…</button>
            <input v-model="unzipPwd" class="input" style="width:140px;" type="password" placeholder="解压密码（可选）" />
            <select v-model="hashAlgo" class="input" style="width:auto;">
              <option value="md5">MD5</option>
              <option value="sha1">SHA1</option>
              <option value="sha256">SHA256</option>
              <option value="sha512">SHA512</option>
            </select>
            <select v-model="dlMode" class="input" style="width:auto;">
              <option value="direct">目录直传</option>
              <option value="compress">7z 极限压缩</option>
            </select>
          </div>

          <div v-if="hashResult" style="margin-top:10px;font-size:12px;" class="mono-block">
            <b>{{ hashResult.algo.toUpperCase() }}</b> {{ hashResult.hash }}
          </div>
        </div>

        <!-- 上传进度 -->
        <div v-if="uploadState.items.length" class="section">
          <div class="section-title">上传进度
            <span class="status-line" style="margin-left:8px;">{{ uploadState.active ? '上传中…' : '完成' }}</span>
          </div>
          <div v-for="(u, i) in uploadState.items" :key="i" class="fm-up-item">
            <span class="fm-up-name">{{ u.name }}</span>
            <div class="fm-up-bar"><div class="fm-up-fill" :class="u.status" :style="{ width: (u.pct || 0) + '%' }"></div></div>
            <span class="fm-up-pct">{{ u.status === 'error' ? '失败' : (u.status === 'done' ? '完成' : (u.pct || 0) + '%') }}</span>
          </div>
        </div>

        <!-- 文本查看 -->
        <div v-if="textPreview" class="section">
          <div class="section-title">文本预览
            <button class="btn btn-sm btn-ghost" style="float:right;" @click="textPreview = null">关闭</button>
          </div>
          <pre class="mono-block" style="max-height:400px;overflow:auto;font-size:12px;white-space:pre-wrap;word-break:break-all;">{{ textPreview.text }}</pre>
          <div v-if="textPreview.truncated" class="status-line" style="margin-top:6px;">已截断（仅显示前 512KB）, 如需完整内容请使用「编辑」</div>
        </div>

        <!-- 面包屑 / 搜索横幅 -->
        <div class="section fm-crumb">
          <div v-if="searching" class="crumb-row">
            <span class="status-line">搜索「{{ searchQ || '全部' }}」{{ searchKind ? '· ' + kindName(searchKind) : '' }}：{{ items.length }} 条结果</span>
            <span v-if="searchHasMore" class="status-line" style="color:var(--warning, #d0b27a);">（还有更多, 可加载）</span>
            <button class="btn btn-sm btn-ghost" style="margin-left:auto;" @click="exitSearch">返回目录</button>
          </div>
          <div v-else class="crumb-row">
            <template v-for="(c, i) in crumbs" :key="c.path">
              <span v-if="i > 0" class="crumb-sep">/</span>
              <button class="btn btn-ghost btn-sm" style="padding:0 4px;" @click="go(c.path)">{{ c.label }}</button>
            </template>
            <span v-if="loading" class="spinner" style="margin-left:10px;"></span>
          </div>
        </div>

        <!-- 文件列表 -->
        <div class="section fm-table-wrap">
          <div v-if="!loading && !items.length" class="empty" style="padding:30px;">{{ searching ? '无搜索结果' : '空目录' }}</div>
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
                <td class="fm-col-name" @click="openItem(item)" @dblclick="item.kind === 'text' && showPreview(item)"
                    :title="item.link_target ? ('链接 → ' + item.link_target) : item.path">
                  <span class="fm-ico">{{ kindIcon(item.kind) }}</span>
                  <span :class="{ 'text-faint': item.hidden }">{{ item.name }}</span>
                  <span v-if="item.is_link" style="color:var(--accent);font-size:11px;margin-left:4px;">→链接</span>
                </td>
                <td class="fm-col-size">{{ fmtSize(item) }}</td>
                <td class="fm-col-type">{{ kindName(item.kind) }}</td>
                <td class="fm-col-time">{{ fmtTime(item.mtime) }}</td>
                <td class="fm-col-ops">
                  <button class="btn btn-sm btn-ghost" @click.stop="downloadItem(item, dlMode)">下载</button>
                  <button v-if="item.kind === 'text'" class="btn btn-sm btn-ghost" @click.stop="showPreview(item)">查看</button>
                  <button v-if="item.kind === 'text'" class="btn btn-sm btn-ghost" @click.stop="openEditor(item)">编辑</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="hasMore" ref="sentinel" style="padding:10px;text-align:center;">
            <button class="btn btn-sm" @click="showMore">加载更多（当前显示 {{ paged.length }} / {{ sortedAll.length }}）</button>
          </div>
          <div v-if="searching && searchHasMore" style="padding:10px;text-align:center;">
            <button class="btn btn-sm" :disabled="loading" @click="searchMore">加载更多搜索结果</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 目录选择器 -->
    <div v-if="showPicker" class="fm-modal-mask" @click.self="showPicker = false">
      <div class="fm-modal">
        <div class="fm-modal-head">
          <span>选择目标目录</span>
          <button class="btn btn-sm btn-ghost" @click="showPicker = false">取消</button>
        </div>
        <div class="fm-modal-crumb">
          <template v-for="(c, i) in pickerCrumbs" :key="c.path">
            <span v-if="i > 0" class="crumb-sep">/</span>
            <button class="btn btn-ghost btn-sm" style="padding:0 4px;" @click="pickerGo(c.path)">{{ c.label }}</button>
          </template>
        </div>
        <div class="fm-modal-list">
          <div v-if="pickerLoading" class="loading"><div class="spinner"></div> 加载中...</div>
          <div v-else-if="!pickerItems.length" class="empty" style="padding:20px;">无子目录</div>
          <button v-for="d in pickerItems" :key="d.path" class="fm-dir-item" @click="pickerEnter(d)">
            <span>📁</span> {{ d.name }}
          </button>
        </div>
        <div class="fm-modal-foot">
          <span class="status-line" style="font-family:var(--font-mono);">{{ pickerCwd }}</span>
          <span style="flex:1"></span>
          <button class="btn btn-sm" @click="showPicker = false">取消</button>
          <button class="btn btn-sm btn-primary" @click="usePickerDir">使用此目录</button>
        </div>
      </div>
    </div>

    <!-- 重命名 -->
    <div v-if="renameState.show" class="fm-modal-mask" @click.self="closeRename">
      <div class="fm-modal">
        <div class="fm-modal-head">
          <span>重命名</span>
          <button class="btn btn-sm btn-ghost" @click="closeRename">取消</button>
        </div>
        <div class="fm-modal-body">
          <input v-model="renameState.value" class="input" style="width:100%;font-family:var(--font-mono);"
                 @keydown.enter="submitRename" @keydown.esc="closeRename" />
        </div>
        <div class="fm-modal-foot">
          <span class="status-line" style="font-family:var(--font-mono);">{{ renameState.target && renameState.target.path }}</span>
          <span style="flex:1"></span>
          <button class="btn btn-sm" @click="closeRename">取消</button>
          <button class="btn btn-sm btn-primary" :disabled="!!action" @click="submitRename">确定</button>
        </div>
      </div>
    </div>

    <!-- 通用确认 -->
    <div v-if="confirmState.show" class="fm-modal-mask" @click.self="confirmState = { show:false,title:'',msg:'',okText:'确定',danger:false,onOk:null }">
      <div class="fm-modal">
        <div class="fm-modal-head"><span>{{ confirmState.title }}</span></div>
        <div class="fm-modal-body" style="white-space:pre-wrap;word-break:break-all;">{{ confirmState.msg }}</div>
        <div class="fm-modal-foot">
          <span style="flex:1"></span>
          <button class="btn btn-sm" @click="confirmState = { show:false,title:'',msg:'',okText:'确定',danger:false,onOk:null }">取消</button>
          <button class="btn btn-sm" :class="confirmState.danger ? 'btn-danger' : 'btn-primary'" @click="confirmOk">{{ confirmState.okText }}</button>
        </div>
      </div>
    </div>

    <!-- 编辑器 -->
    <div v-if="editorOpen" class="fm-modal-mask editor-mask" @click.self="closeEditor">
      <div class="fm-modal fm-editor-modal">
        <div class="fm-modal-head">
          <span class="fm-edit-title">编辑 — {{ editorItem && editorItem.path }}</span>
          <span class="status-line">{{ editorSize }} B · {{ editorEncoding }}</span>
          <button class="btn btn-sm btn-ghost" @click="closeEditor">关闭</button>
        </div>
        <div class="fm-editor-toolbar">
          <select v-model="editorEncoding" class="input" style="width:auto;">
            <option value="utf-8">UTF-8</option>
            <option value="gb18030">GB18030</option>
            <option value="gbk">GBK</option>
            <option value="ascii">ASCII</option>
            <option value="latin-1">latin-1</option>
          </select>
          <span class="status-line" style="margin-left:10px;">Ctrl+S 保存</span>
          <span v-if="editorMsg" class="status-line" style="margin-left:10px;color:var(--warning, #d0b27a);">{{ editorMsg }}</span>
          <span style="flex:1"></span>
          <span v-if="editorDirty" class="status-line" style="color:var(--warning, #d0b27a);">未保存</span>
          <button class="btn btn-sm btn-primary" :disabled="editorSaving" @click="saveEditor">{{ editorSaving ? '保存中…' : '保存' }}</button>
        </div>
        <div class="fm-editor-wrap">
          <div class="fm-editor-gutter" ref="gutterEl">
            <div v-for="n in editorLineCount" :key="n" class="fm-editor-ln">{{ n }}</div>
          </div>
          <textarea ref="editorEl" v-model="editorText" class="fm-editor-area" spellcheck="false"
                    @scroll="syncEditorScroll" @input="editorDirty = true"
                    @keydown.ctrl.s.prevent="saveEditor" @keydown.meta.s.prevent="saveEditor"></textarea>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="ctx.show" class="fm-ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
      <div class="fm-ctx-item mono">{{ ctx.item && ctx.item.name }}</div>
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

    <!-- 任务面板 -->
    <div v-if="tasksOpen" class="fm-tasks">
      <div class="fm-tasks-head">
        <span>任务 ({{ opsTasks.length }})</span>
        <button class="btn btn-sm btn-ghost" style="padding:0 6px;font-size:11px;" @click="tasksOpen = false">收起</button>
      </div>
      <div class="fm-tasks-body">
        <div v-if="!opsTasks.length" class="empty" style="padding:14px;">暂无任务</div>
        <div v-for="t in opsTasks" :key="t.id" class="fm-task">
          <div class="fm-task-line">
            <span class="fm-task-op">{{ OP_LABEL[t.op] || t.op }}</span>
            <span class="status-line">#{{ t.id }}</span>
            <span style="flex:1"></span>
            <span :class="'fm-task-state ' + t.status">{{ OP_STATE[t.status] || t.status }}</span>
          </div>
          <div class="fm-task-bar">
            <div class="fm-task-fill" :style="{ width: (t.total ? Math.round((t.done / t.total) * 100) : 0) + '%' }"></div>
          </div>
          <div class="fm-task-foot">
            <span class="status-line">{{ t.done }}/{{ t.total }}<template v-if="t.failed && t.failed.length"> · {{ t.failed.length }} 项失败</template></span>
            <span style="flex:1"></span>
            <button v-if="t.status === 'running'" class="btn btn-sm btn-ghost" @click="cancelTask(t)">取消</button>
            <button v-else-if="t.op === 'archive' && t.status === 'done'" class="btn btn-sm" @click="downloadArchived(t)">下载包</button>
            <button v-if="t.status !== 'running'" class="btn btn-sm btn-ghost" @click="removeTask(t)">删除</button>
          </div>
          <div v-if="t.error" class="error" style="font-size:12px;">{{ t.error }}</div>
          <div v-if="t.failed && t.failed.length" class="error" style="font-size:12px;">{{ t.failed.join('; ') }}</div>
        </div>
      </div>
    </div>

    <!-- toast -->
    <transition name="toast">
      <div v-if="toastMsg" class="fm-toast" :class="toastKind">{{ toastMsg }}</div>
    </transition>
  </div>
</template>

<style scoped>
.fm-layout {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-height: 200px;
}
.fm-layout.drop {
  outline: 2px dashed var(--accent);
  outline-offset: 4px;
  border-radius: 10px;
}
.fm-sidebar {
  width: 210px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
}
.fm-sidebar-head {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-faint);
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.fm-sidebar-section { padding: 6px 0; }
.fm-sidebar-section + .fm-sidebar-section { border-top: 1px solid var(--border); }
.fm-sidebar-label {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--text-faint);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.fm-nav-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  border-radius: 0;
  font-family: var(--font-mono);
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
}
.fm-nav-btn:hover { background: var(--surface-3); }
.fm-nav-btn.active { background: var(--surface-3); }
.fm-nav-x { color: var(--text-faint); font-size: 13px; padding: 0 2px; line-height: 1; }
.fm-nav-x:hover { color: #ff6a63; }
.fm-main { flex: 1; min-width: 0; }
.btn-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.btn-row + .btn-row { margin-top: 10px; }
.crumb-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 13px; font-family: var(--font-mono); }
.crumb-sep { color: var(--text-faint); }
.fm-crumb { padding: 10px 14px; }

.fm-table-wrap { padding: 0; }
.fm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fm-table thead th {
  padding: 8px 10px;
  color: var(--text-faint);
  text-align: left;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--surface-2);
  z-index: 1;
}
.fm-th-sort { cursor: pointer; }
.fm-th-sort:hover { color: var(--text); }
.fm-col-check { width: 30px; }
.fm-col-size { width: 100px; text-align: right; }
.fm-col-type { width: 70px; }
.fm-col-time { width: 150px; }
.fm-col-ops { width: 170px; }
.fm-row { border-bottom: 1px solid var(--border); }
.fm-row:hover { background: var(--surface-2); }
.fm-row.sel { background: var(--surface-3); }
.fm-row td { padding: 6px 6px; }
.fm-row td.fm-col-name { padding: 6px 10px; cursor: pointer; }
.fm-col-size { font-family: var(--font-mono); text-align: right; }
.fm-col-time { color: var(--text-faint); font-family: var(--font-mono); font-size: 12px; }
.fm-col-type { color: var(--text-muted); }
.fm-ico { margin-right: 5px; }

/* 上传进度 */
.fm-up-item { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; }
.fm-up-name { width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-up-bar { flex: 1; height: 8px; background: var(--surface-3); border-radius: 4px; overflow: hidden; }
.fm-up-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width .15s; }
.fm-up-fill.done { background: #7bd88f; }
.fm-up-fill.error { background: #ff6a63; }
.fm-up-pct { width: 48px; text-align: right; color: var(--text-muted); font-family: var(--font-mono); }

/* 编辑器 */
.editor-mask { z-index: 1100; }
.fm-editor-modal { width: min(920px, 94vw); height: 76vh; }
.fm-editor-toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 14px; border-bottom: 1px solid var(--border); }
.fm-edit-title { font-family: var(--font-mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 46%; }
.fm-editor-wrap { flex: 1; display: flex; overflow: hidden; min-height: 0; }
.fm-editor-gutter {
  width: 52px; overflow: hidden; text-align: right; padding: 10px 8px 10px 0;
  color: var(--text-faint); font-family: var(--font-mono); font-size: 12px; line-height: 1.55;
  background: var(--surface-3); user-select: none; flex-shrink: 0;
}
.fm-editor-ln { height: 18.6px; }
.fm-editor-area {
  flex: 1; min-width: 0; resize: none; border: none; outline: none;
  background: var(--surface-2); color: var(--text);
  font-family: var(--font-mono); font-size: 12.5px; line-height: 1.55;
  padding: 10px 12px; white-space: pre; overflow: auto;
}

/* 通用 modal */
.fm-modal-mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.fm-modal {
  width: 440px; max-width: 92vw; max-height: 82vh;
  display: flex; flex-direction: column;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
}
.fm-modal-head {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 10px 14px; border-bottom: 1px solid var(--border); font-weight: 700;
}
.fm-modal-body { padding: 14px; overflow: auto; }
.fm-modal-crumb { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 10px 14px; font-family: var(--font-mono); font-size: 13px; border-bottom: 1px solid var(--border); }
.fm-modal-list { overflow: auto; padding: 6px; flex: 1; }
.fm-dir-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 7px 10px; border-radius: 6px; font-size: 13px; color: var(--text); background: transparent; border: none; cursor: pointer; }
.fm-dir-item:hover { background: var(--surface-3); }
.fm-modal-foot { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); }

/* 右键菜单 */
.fm-ctx {
  position: fixed; z-index: 1500; min-width: 160px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
  padding: 4px; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35); font-size: 13px;
}
.fm-ctx-item {
  display: block; width: 100%; text-align: left; padding: 6px 10px;
  border: none; background: transparent; color: var(--text); border-radius: 6px; cursor: pointer;
  font-family: var(--font-mono); font-size: 12px;
}
.fm-ctx-item:hover { background: var(--surface-3); }
.fm-ctx-item.danger:hover { background: rgba(255, 106, 99, 0.15); color: #ff6a63; }
.fm-ctx-sep { height: 1px; background: var(--border); margin: 4px 6px; }

/* 任务面板 */
.fm-tasks {
  position: fixed; right: 16px; bottom: 16px; z-index: 1300; width: 360px; max-width: 92vw;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.4); overflow: hidden;
}
.fm-tasks-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 700; }
.fm-tasks-body { max-height: 46vh; overflow: auto; padding: 6px 10px; }
.fm-task { padding: 8px 0; border-bottom: 1px solid var(--border); }
.fm-task:last-child { border-bottom: none; }
.fm-task-line { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.fm-task-op { font-weight: 700; }
.fm-task-state { font-size: 12px; }
.fm-task-state.done { color: #7bd88f; }
.fm-task-state.error { color: #ff6a63; }
.fm-task-state.cancelled { color: var(--text-faint); }
.fm-task-bar { height: 6px; background: var(--surface-3); border-radius: 3px; overflow: hidden; margin: 6px 0 4px; }
.fm-task-fill { height: 100%; background: var(--accent); transition: width .3s; }
.fm-task-foot { display: flex; align-items: center; gap: 8px; font-size: 12px; }

/* toast */
.fm-toast {
  position: fixed; top: 16px; right: 16px; z-index: 1200;
  padding: 10px 16px; border-radius: 8px; font-size: 13px;
  background: var(--surface-3); border: 1px solid var(--border); border-left: 3px solid #7bd88f;
  color: var(--text); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
}
.fm-toast.err { border-left-color: #ff6a63; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
