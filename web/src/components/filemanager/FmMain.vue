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
const searchSize = ref('')
const searchTruncated = ref(false)

const FAV_KEY = 'fm_favs'
const favs = ref([])
const showPicker = ref(false)
const pickerCwd = ref('/')
const pickerItems = ref([])
const pickerLoading = ref(false)
const toastMsg = ref('')
const toastKind = ref('ok')
const sentinel = ref(null)

const displayPath = computed(() => cwd.value || '/')
const selectedList = computed(() => items.value.filter((i) => selected.value.has(i.path)))
const isRoot = computed(() => !cwd.value || cwd.value === '/')

let toastTimer = null
let observer = null

function kindName(k) {
  return { dir: '目录', image: '图片', video: '视频', audio: '音频', archive: '压缩包', text: '文本', file: '文件' }[k] || k
}

function fmtSize(item) {
  if (item.is_dir) return '-'
  const b = item.size
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

function resetSelection() {
  selected.value = new Set()
  hashResult.value = null
  textPreview.value = null
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

async function doSearch() {
  if (!searchQ.value && !searchKind.value && !searchSize.value) return
  searching.value = true
  loading.value = true
  error.value = ''
  resetSelection()
  try {
    const d = await api.fmSearch({
      path: cwd.value || '/',
      q: searchQ.value,
      kind: searchKind.value,
      min_size: searchSize.value ? String(parseFloat(searchSize.value) * 1024 * 1024) : '',
    })
    items.value = d.results || []
    searchTruncated.value = !!d.truncated
  } catch (e) {
    error.value = e.message
    items.value = []
  } finally {
    loading.value = false
  }
}

function exitSearch() {
  searching.value = false
  searchTruncated.value = false
  load(cwd.value)
}

async function showPreview(item) {
  try {
    const data = await api.fmPreview(item.path)
    textPreview.value = data
  } catch (e) {
    error.value = e.message
  }
}

function onPickFiles() {
  const input = fileInput.value
  if (!input || !input.files.length) return
  upload(input.files)
  input.value = ''
}

async function upload(files) {
  action.value = 'upload'
  error.value = ''
  try {
    const res = await api.fmUpload(cwd.value, files)
    if (res.errors && res.errors.length) error.value = res.errors.join('; ')
    showToast(`已上传 ${files.length} 个文件`)
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function doMkdir() {
  if (!newName.value) return
  action.value = 'mkdir'
  try {
    const p = cwd.value.replace(/\/$/, '') + '/' + newName.value
    await api.fmMkdir(p)
    showToast(`已创建 ${newName.value}`)
    newName.value = ''
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function doRename() {
  if (selectedList.value.length !== 1) { error.value = '请选择一个文件'; return }
  const item = selectedList.value[0]
  const name = window.prompt('新名称：', item.name)
  if (!name) return
  action.value = 'rename'
  try {
    await api.fmRename(item.path, name)
    showToast('已重命名')
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function renamePath(item) {
  const name = window.prompt('新名称：', item.name)
  if (!name) return
  action.value = 'rename'
  try {
    await api.fmRename(item.path, name)
    showToast('已重命名')
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function doMoveCopy(op) {
  if (!selectedList.value.length) { error.value = '请先选择文件'; return }
  if (!targetDir.value) { error.value = '请输入目标目录'; return }
  action.value = op
  try {
    const paths = selectedList.value.map((i) => i.path)
    await (op === 'move' ? api.fmMove(paths, targetDir.value) : api.fmCopy(paths, targetDir.value))
    showToast(op === 'move' ? '已移动' : '已复制')
    targetDir.value = ''
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function doDelete() {
  if (!selectedList.value.length) { error.value = '请先选择文件'; return }
  const names = selectedList.value.map((i) => i.name)
  if (!window.confirm(`确定删除以下 ${names.length} 项？\n\n${names.slice(0, 10).join('\n')}${names.length > 10 ? '\n...' : ''}`)) return
  action.value = 'delete'
  try {
    const res = await api.fmDelete(selectedList.value.map((i) => i.path))
    if (res.failed && res.failed.length) error.value = res.failed.join('; ')
    showToast(`已删除 ${names.length} 项`)
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function deletePath(item) {
  if (!window.confirm(`确定删除「${item.name}」？`)) return
  action.value = 'delete'
  try {
    const res = await api.fmDelete([item.path])
    if (res.failed && res.failed.length) error.value = res.failed.join('; ')
    showToast('已删除')
    load(cwd.value)
  } catch (e) { error.value = e.message }
  finally { action.value = '' }
}

async function doHash() {
  if (selectedList.value.length !== 1) { error.value = '请选择一个文件'; return }
  const item = selectedList.value[0]
  hashItem(item)
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
  const item = selectedList.value[0]
  unzipItem(item)
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

function doArchive() {
  if (!selectedList.value.length) { error.value = '请先选择文件'; return }
  const paths = selectedList.value.map((i) => i.path)
  const href = api.fmArchive(paths, archiveFmt.value, archiveName.value || 'archive')
  window.open(href, '_blank')
}

function downloadItem(item, mode) {
  window.open(api.fmDownload(item.path, mode), '_blank')
}

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

/* favorites */
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

/* directory picker */
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

/* keyboard */
function isTypingTarget(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}
function onKeydown(e) {
  if (e.key.startsWith('Arrow') || e.key === 'Escape') {
    if (preview.show.value) {
      if (e.key === 'ArrowRight') { preview.next(); e.preventDefault() }
      else if (e.key === 'ArrowLeft') { preview.prev(); e.preventDefault() }
      else if (e.key === 'Escape') { preview.close() }
    }
    return
  }
  if (isTypingTarget(e.target)) return
  if (e.key === 'Delete') {
    e.preventDefault()
    if (selectedList.value.length) doDelete()
  } else if (e.key === 'F2') {
    e.preventDefault()
    if (selectedList.value.length === 1) doRename()
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
}

onMounted(() => {
  load('/')
  loadDisks()
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
    <div class="subtitle">浏览服务器文件系统，上传下载、增删改、预览与压缩解压</div>

    <div class="fm-layout">
      <!-- left sidebar -->
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

      <!-- right content -->
      <div class="fm-main">
        <!-- toolbar -->
        <div class="section">
          <div class="btn-row">
            <button v-if="!sidebarOpen" class="btn btn-sm" @click="sidebarOpen = true">侧边栏</button>
            <button class="btn btn-sm" @click="go('/')">根目录</button>
            <button class="btn btn-sm" @click="load(cwd)">刷新</button>
            <button class="btn btn-sm btn-primary" @click="fileInput && fileInput.click()">上传</button>
            <input ref="fileInput" type="file" multiple style="display:none;" @change="onPickFiles" />
            <input v-model="newName" class="input" style="width:180px;" placeholder="新建文件夹名"
                   @keydown.enter="doMkdir" />
            <button class="btn btn-sm" :disabled="!!action" @click="doMkdir">新建</button>
            <span v-if="selectedList.length" class="status-line">{{ selectedList.length }} 项已选</span>
          </div>

          <div class="btn-row">
            <input v-model="searchQ" class="input fm-search-input" style="flex:1;min-width:160px;"
                   placeholder="在当前目录及子目录搜索文件名…" @keydown.enter="doSearch" />
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
            <input v-model="searchSize" class="input" style="width:110px;" placeholder="最小(MB)" />
            <button class="btn btn-sm btn-primary" @click="doSearch">搜索</button>
            <button v-if="searching" class="btn btn-sm" @click="exitSearch">返回目录</button>
          </div>

          <div v-if="error" class="error" style="margin-top:10px;">{{ error }}</div>
          <div v-if="action" class="loading" style="margin-top:10px;"><div class="spinner"></div> {{ action === 'hash' ? '计算中...' : '处理中...' }}</div>

          <div class="btn-row">
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="doRename">重命名</button>
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="doMoveCopy('move')">移动</button>
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="doMoveCopy('copy')">复制</button>
            <button class="btn btn-sm btn-danger" :disabled="!selectedList.length || !!action" @click="doDelete">删除</button>
            <button class="btn btn-sm" :disabled="selectedList.length !== 1 || !!action" @click="doHash">哈希</button>
            <button class="btn btn-sm" :disabled="selectedList.length !== 1 || !!action" @click="doUnzip">解压</button>
            <select v-model="archiveFmt" class="input" style="width:auto;">
              <option value="zip">ZIP</option>
              <option value="7z">7z</option>
            </select>
            <button class="btn btn-sm" :disabled="!selectedList.length || !!action" @click="doArchive">打包下载</button>
          </div>

          <div class="btn-row">
            <input v-model="targetDir" class="input" style="flex:1;min-width:160px;" placeholder="移动/复制目标目录（绝对路径）" />
            <button class="btn btn-sm" @click="openPicker">浏览…</button>
            <input v-model="unzipPwd" class="input" style="width:150px;" type="password" placeholder="解压密码（可选）" />
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

        <!-- text preview -->
        <div v-if="textPreview" class="section">
          <div class="section-title">文本预览
            <button class="btn btn-sm btn-ghost" style="float:right;" @click="textPreview = null">关闭</button>
          </div>
          <pre class="mono-block" style="max-height:400px;overflow:auto;font-size:12px;white-space:pre-wrap;word-break:break-all;">{{ textPreview.text }}</pre>
          <div v-if="textPreview.truncated" class="status-line" style="margin-top:6px;">已截断（仅显示前 512KB）</div>
        </div>

        <!-- breadcrumb / search banner -->
        <div class="section fm-crumb">
          <div v-if="searching" class="crumb-row">
            <span class="status-line">搜索「{{ searchQ || '全部' }}」{{ searchKind ? '· ' + kindName(searchKind) : '' }}：{{ items.length }} 条结果</span>
            <span v-if="searchTruncated" class="status-line" style="color:var(--warning, #d0b27a);">（已达上限，请细化条件）</span>
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

        <!-- file list -->
        <div class="section fm-table-wrap">
          <div v-if="!loading && !items.length" class="empty" style="padding:30px;">{{ searching ? '无搜索结果' : '空目录' }}</div>
          <table v-else class="fm-table">
            <thead>
              <tr>
                <th class="fm-col-check"><input type="checkbox" :checked="allChecked()" @change="toggleAll" /></th>
                <th class="fm-th-sort" @click="setSort('name')">名称</th>
                <th class="fm-col-size fm-th-sort" @click="setSort('size')">大小</th>
                <th class="fm-col-type">类型</th>
                <th class="fm-col-time fm-th-sort" @click="setSort('mtime')">修改时间</th>
                <th class="fm-col-ops">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paged" :key="item.path" class="fm-row"
                  :class="{ sel: selected.has(item.path) }">
                <td class="fm-col-check" @click.stop>
                  <input type="checkbox" :checked="selected.has(item.path)" @change="toggleSel(item)" />
                </td>
                <td class="fm-col-name" @click="openItem(item)" @dblclick="item.kind === 'text' && showPreview(item)">
                  <span :class="{ 'text-faint': item.hidden }">{{ item.name }}</span>
                  <span v-if="item.is_link" style="color:var(--accent);font-size:11px;margin-left:4px;">→链接</span>
                </td>
                <td class="fm-col-size">{{ fmtSize(item) }}</td>
                <td class="fm-col-type">{{ kindName(item.kind) }}</td>
                <td class="fm-col-time">{{ fmtTime(item.mtime) }}</td>
                <td class="fm-col-ops">
                  <button class="btn btn-sm btn-ghost" @click.stop="downloadItem(item, dlMode)">下载</button>
                  <button v-if="item.kind === 'text'" class="btn btn-sm btn-ghost" @click.stop="showPreview(item)">查看</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="hasMore" ref="sentinel" style="padding:10px;text-align:center;">
            <button class="btn btn-sm" @click="showMore">加载更多（当前显示 {{ paged.length }} / {{ sortedAll.length }}）</button>
          </div>
        </div>
      </div>
    </div>

    <!-- directory picker modal -->
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

    <!-- context menu (由全局统一右键菜单接管) -->

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
.fm-sidebar-section {
  padding: 6px 0;
}
.fm-sidebar-section + .fm-sidebar-section {
  border-top: 1px solid var(--border);
}
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
.fm-nav-x {
  color: var(--text-faint);
  font-size: 13px;
  padding: 0 2px;
  line-height: 1;
}
.fm-nav-x:hover { color: #ff6a63; }
.fm-main {
  flex: 1;
  min-width: 0;
}
.btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.btn-row + .btn-row {
  margin-top: 10px;
}
.crumb-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 13px;
  font-family: var(--font-mono);
}
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
.fm-col-size { width: 90px; text-align: right; }
.fm-col-type { width: 70px; }
.fm-col-time { width: 150px; }
.fm-col-ops { width: 150px; }
.fm-row { border-bottom: 1px solid var(--border); }
.fm-row:hover { background: var(--surface-2); }
.fm-row.sel { background: var(--surface-3); }
.fm-row td { padding: 6px 6px; }
.fm-row td.fm-col-name { padding: 6px 10px; cursor: pointer; }
.fm-col-size { font-family: var(--font-mono); text-align: right; }
.fm-col-time { color: var(--text-faint); font-family: var(--font-mono); font-size: 12px; }
.fm-col-type { color: var(--text-muted); }

/* modal */
.fm-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.fm-modal {
  width: 440px;
  max-width: 92vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.fm-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  font-weight: 700;
}
.fm-modal-crumb {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 10px 14px;
  font-family: var(--font-mono);
  font-size: 13px;
  border-bottom: 1px solid var(--border);
}
.fm-modal-list {
  overflow: auto;
  padding: 6px;
  flex: 1;
}
.fm-dir-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  background: transparent;
  border: none;
  cursor: pointer;
}
.fm-dir-item:hover { background: var(--surface-3); }
.fm-modal-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}

/* toast */
.fm-toast {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1200;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-left: 3px solid #7bd88f;
  color: var(--text);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
}
.fm-toast.err { border-left-color: #ff6a63; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>