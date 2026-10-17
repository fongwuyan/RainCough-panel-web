<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'
import FmPreview from './FmPreview.vue'
import {
  useFileManager, fmtSize, fmtTime, kindLabel, iconOf,
} from './useFileManager'

const fm = useFileManager()
const {
  cwd, sorted, loading, error, selection, selectedItems, selectedBytes,
  sortKey, sortDir, view, search, ops, uploads, toast, favorites,
} = fm

const previewItem = ref(null)
const query = ref('')
const dragOver = ref(false)
const fileInput = ref(null)
const picker = reactive({ open: false, path: '/', dirs: [], busy: false, for: 'copy' })

// 通用对话框
const dlg = reactive({ open: false, type: '', title: '', value: '', item: null, err: '', busy: false, extra: '' })

const ctx = reactive({ open: false, x: 0, y: 0, item: null })

const QUICK = ['/', '/home', '/tmp', '/var/log', '/opt', '/etc']
const disks = ref([])

const crumbs = computed(() => {
  const parts = cwd.value.split('/').filter(Boolean)
  const out = [{ name: '/', path: '/' }]
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    out.push({ name: p, path: acc })
  }
  return out
})

const displayList = computed(() => (search.on ? search.results : sorted.value))

onMounted(async () => {
  await fm.load('/')
  fm.pollOps()
  try {
    const d = await api.disks()
    disks.value = d.disks || []
  } catch (e) { /* 忽略 */ }
  window.addEventListener('keydown', onKey)
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onDocClick)
})

function onDocClick() {
  if (ctx.open) ctx.open = false
}

// ---- 导航 ----

function go(p) {
  previewItem.value = null
  query.value = ''
  fm.go(p)
}

function openItem(it) {
  if (it.is_dir) go(it.path)
  else previewItem.value = it
}

function onRowClick(it, e) {
  fm.toggleSel(it, e)
}

function onRowDbl(it) {
  openItem(it)
}

// ---- 右键菜单 ----

function openCtx(e, it) {
  e.preventDefault()
  if (it && !selection.value.has(it.path)) {
    selection.value = new Set([it.path])
  }
  ctx.open = true
  ctx.x = e.clientX
  ctx.y = e.clientY
  ctx.item = it || null
}

function ctxAct(action) {
  const it = ctx.item
  ctx.open = false
  if (action === 'open' && it) return openItem(it)
  if (action === 'download' && it) return fm.download(it.path)
  if (action === 'rename' && it) return askRename(it)
  if (action === 'delete') return askDelete()
  if (action === 'copy') return askMoveCopy('copy')
  if (action === 'move') return askMoveCopy('move')
  if (action === 'archive') return askArchive()
  if (action === 'hash' && it) return askHash(it)
  if (action === 'unzip' && it) return askUnzip(it)
  if (action === 'mkdir') return askMkdir()
}

// ---- 对话框 ----

function askMkdir() {
  Object.assign(dlg, { open: true, type: 'mkdir', title: '新建文件夹', value: '', item: null, err: '' })
}

function askRename(it) {
  Object.assign(dlg, { open: true, type: 'rename', title: '重命名', value: it.name, item: it, err: '' })
}

function askDelete() {
  if (!selectedItems.value.length) return
  Object.assign(dlg, { open: true, type: 'delete', title: '确认删除', value: '', item: null, err: '' })
}

function askMoveCopy(op) {
  if (!selectedItems.value.length) return
  picker.for = op
  picker.open = true
  picker.path = cwd.value
  loadPicker()
}

async function loadPicker() {
  picker.busy = true
  try {
    const d = await api.fmList(picker.path)
    picker.path = d.path
    picker.dirs = (d.items || []).filter((i) => i.is_dir)
  } catch (e) {
    fm.flash(e.message || String(e))
  } finally {
    picker.busy = false
  }
}

function pickerGo(p) {
  picker.path = p
  loadPicker()
}

function pickerUp() {
  const p = picker.path.replace(/\/+$/, '')
  pickerGo(p.slice(0, p.lastIndexOf('/')) || '/')
}

async function confirmPicker() {
  const paths = selectedItems.value.map((i) => i.path)
  picker.open = false
  try {
    await fm.moveCopy(picker.for, paths, picker.path)
    await fm.load()
  } catch (e) {
    fm.flash(e.message || String(e))
  }
}

function askArchive() {
  if (!selectedItems.value.length) return
  const base = selectedItems.value.length === 1 ? selectedItems.value[0].name : 'archive'
  Object.assign(dlg, { open: true, type: 'archive', title: '压缩', value: base + '.zip', item: null, err: '', extra: 'zip' })
}

function askHash(it) {
  Object.assign(dlg, { open: true, type: 'hash', title: '校验值', value: '', item: it, err: '', extra: '' })
  dlg.busy = true
  fm.hash(it.path, 'md5')
    .then((r) => (dlg.extra = r.md5 || ''))
    .catch((e) => (dlg.err = e.message || String(e)))
    .finally(() => (dlg.busy = false))
}

function askUnzip(it) {
  Object.assign(dlg, { open: true, type: 'unzip', title: '解压到当前目录', value: '', item: it, err: '' })
}

async function confirmDlg() {
  dlg.err = ''
  dlg.busy = true
  try {
    if (dlg.type === 'mkdir') {
      await fm.mkdir(dlg.value.trim())
    } else if (dlg.type === 'rename') {
      await fm.rename(dlg.item, dlg.value.trim())
    } else if (dlg.type === 'delete') {
      await fm.remove(selectedItems.value.map((i) => i.path))
    } else if (dlg.type === 'archive') {
      await fm.archive(selectedItems.value.map((i) => i.path), cwd.value, dlg.value.trim(), dlg.extra || 'zip')
    } else if (dlg.type === 'unzip') {
      await fm.unzip(dlg.item.path, cwd.value, dlg.value)
    }
    if (dlg.type !== 'delete' && dlg.type !== 'archive') await fm.load()
    dlg.open = false
  } catch (e) {
    dlg.err = e.message || String(e)
  } finally {
    dlg.busy = false
  }
}

// ---- 上传 ----

function pickFiles() {
  fileInput.value && fileInput.value.click()
}

function onFiles(e) {
  fm.upload(e.target.files)
  e.target.value = ''
}

function onDrop(e) {
  dragOver.value = false
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    fm.upload(e.dataTransfer.files)
  }
}

// ---- 搜索 ----

let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fm.doSearch(query.value), 350)
}

function clearSearch() {
  query.value = ''
  fm.exitSearch()
}

// ---- 键盘 ----

function isTyping(e) {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

function onKey(e) {
  if (e.key === 'Escape') {
    if (ctx.open) return (ctx.open = false)
    if (previewItem.value) return (previewItem.value = null)
    if (dlg.open) return (dlg.open = false)
    if (picker.open) return (picker.open = false)
    if (search.on) return clearSearch()
    return
  }
  if (isTyping(e) || dlg.open || picker.open) return
  const list = displayList.value
  const first = selectedItems.value[0] || list[0]
  if (e.key === 'Enter' && first) { e.preventDefault(); openItem(first) }
  else if (e.key === 'Backspace') { e.preventDefault(); fm.up() }
  else if (e.key === 'Delete' && selection.value.size) { e.preventDefault(); askDelete() }
  else if (e.key === 'F2' && selectedItems.value.length === 1) { e.preventDefault(); askRename(selectedItems.value[0]) }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); fm.selectAll() }
}

function sortCls(k) {
  if (sortKey.value !== k) return ''
  return sortDir.value > 0 ? 'asc' : 'desc'
}
</script>

<template>
  <div class="page fm-page">
    <!-- 工具栏 -->
    <div class="fm-toolbar">
      <div class="fm-nav">
        <button class="btn btn-sm btn-ghost" title="后退" @click="fm.back()">←</button>
        <button class="btn btn-sm btn-ghost" title="前进" @click="fm.forward()">→</button>
        <button class="btn btn-sm btn-ghost" title="上一级 (Backspace)" @click="fm.up()">↑</button>
        <button class="btn btn-sm btn-ghost" title="刷新" @click="fm.load()">⟳</button>
      </div>

      <div class="fm-crumbs">
        <template v-for="(c, i) in crumbs" :key="c.path">
          <span v-if="i" class="fm-sep">/</span>
          <button class="fm-crumb" :class="{ last: i === crumbs.length - 1 }" @click="go(c.path)">{{ c.name }}</button>
        </template>
      </div>

      <div class="fm-search">
        <input
          v-model="query"
          class="input"
          placeholder="搜索当前目录…"
          @input="onSearchInput"
          @keydown.esc="clearSearch"
        />
        <button v-if="search.on" class="btn btn-sm btn-ghost" @click="clearSearch">×</button>
      </div>

      <div class="fm-tools">
        <button class="btn btn-sm" title="收藏当前目录" @click="fm.addFav()">☆</button>
        <button class="btn btn-sm" :class="{ 'btn-primary': view === 'grid' }" @click="view = view === 'list' ? 'grid' : 'list'">
          {{ view === 'list' ? '▤' : '▦' }}
        </button>
        <button class="btn btn-sm" @click="askMkdir">新建</button>
        <button class="btn btn-sm btn-primary" @click="pickFiles">上传</button>
        <input ref="fileInput" type="file" multiple hidden @change="onFiles" />
      </div>
    </div>

    <div class="fm-body">
      <!-- 侧栏 -->
      <aside class="fm-side">
        <div class="fm-side-group">
          <div class="fm-side-title">收藏</div>
          <div v-if="!favorites.length" class="fm-side-empty">点工具栏 ☆ 收藏目录</div>
          <div v-for="f in favorites" :key="f" class="fm-side-item" :class="{ active: cwd === f }" @click="go(f)">
            <span class="fm-side-name" :title="f">{{ f }}</span>
            <button class="fm-side-x" @click.stop="fm.removeFav(f)">×</button>
          </div>
        </div>

        <div class="fm-side-group">
          <div class="fm-side-title">常用</div>
          <div v-for="p in QUICK" :key="p" class="fm-side-item" :class="{ active: cwd === p }" @click="go(p)">
            <span class="fm-side-name">{{ p }}</span>
          </div>
        </div>

        <div class="fm-side-group">
          <div class="fm-side-title">磁盘</div>
          <div v-for="d in disks" :key="d.name" class="fm-side-item" @click="go('/')">
            <span class="fm-side-name">{{ d.name }}</span>
            <span class="fm-side-meta">{{ fmtSize(d.size) }}</span>
          </div>
        </div>
      </aside>

      <!-- 主列表 -->
      <section
        class="fm-main"
        :class="{ dropping: dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <div v-if="error" class="error fm-err">{{ error }}</div>
        <div v-else-if="loading" class="hint fm-empty">加载中…</div>
        <div v-else-if="!displayList.length" class="hint fm-empty">
          {{ search.on ? '没有匹配的文件' : '空目录' }}
        </div>

        <table v-else-if="view === 'list'" class="fm-table">
          <thead>
            <tr>
              <th class="c-chk">
                <input
                  type="checkbox"
                  :checked="selection.size === sorted.length && sorted.length > 0"
                  @change="selection.size === sorted.length ? fm.clearSel() : fm.selectAll()"
                />
              </th>
              <th class="c-name" :class="sortCls('name')" @click="fm.setSort('name')">名称</th>
              <th class="c-size" :class="sortCls('size')" @click="fm.setSort('size')">大小</th>
              <th class="c-time" :class="sortCls('mtime')" @click="fm.setSort('mtime')">修改时间</th>
              <th class="c-kind">类型</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="it in sorted"
              :key="it.path"
              :class="{ sel: selection.has(it.path) }"
              @click="onRowClick(it, $event)"
              @dblclick="onRowDbl(it)"
              @contextmenu="openCtx($event, it)"
            >
              <td class="c-chk" @click.stop>
                <input type="checkbox" :checked="selection.has(it.path)" @change="fm.toggleSel(it, $event)" />
              </td>
              <td class="c-name">
                <span class="fm-ico" :class="'k-' + (it.kind || 'file')">{{ iconOf(it) }}</span>
                <span class="fm-name" :title="it.path">{{ it.name }}</span>
                <span v-if="it.is_link" class="fm-link" title="符号链接">↗</span>
              </td>
              <td class="c-size mono">{{ it.is_dir ? '—' : fmtSize(it.size) }}</td>
              <td class="c-time mono">{{ fmtTime(it.mtime) }}</td>
              <td class="c-kind">{{ kindLabel(it) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-else class="fm-grid">
          <div
            v-for="it in sorted"
            :key="it.path"
            class="fm-card"
            :class="{ sel: selection.has(it.path) }"
            @click="onRowClick(it, $event)"
            @dblclick="onRowDbl(it)"
            @contextmenu="openCtx($event, it)"
          >
            <div class="fm-card-ico" :class="'k-' + (it.kind || 'file')">{{ iconOf(it) }}</div>
            <div class="fm-card-name" :title="it.name">{{ it.name }}</div>
            <div class="fm-card-meta">{{ it.is_dir ? '目录' : fmtSize(it.size) }}</div>
          </div>
        </div>

        <div v-if="dragOver" class="fm-drop-hint">松手上传到 {{ cwd }}</div>
      </section>
    </div>

    <!-- 状态栏 -->
    <div class="fm-status">
      <span>{{ displayList.length }} 项</span>
      <span v-if="selection.size">· 已选 {{ selection.size }} 项 ({{ fmtSize(selectedBytes) }})</span>
      <span v-if="search.on" class="fm-search-tip">· 搜索「{{ search.q }}」</span>
      <div v-if="selection.size" class="fm-batch">
        <button class="btn btn-sm" @click="askMoveCopy('copy')">复制</button>
        <button class="btn btn-sm" @click="askMoveCopy('move')">移动</button>
        <button class="btn btn-sm" @click="askArchive">压缩</button>
        <button class="btn btn-sm" @click="selection.size === 1 && fm.download(selectedItems[0].path)">下载</button>
        <button class="btn btn-sm btn-danger" @click="askDelete">删除</button>
        <button class="btn btn-sm btn-ghost" @click="fm.clearSel()">取消选择</button>
      </div>
      <span class="fm-cwd mono">{{ cwd }}</span>
    </div>

    <!-- 上传进度 -->
    <div v-if="uploads.length" class="fm-upcard">
      <div class="fm-upcard-head">上传中 ({{ uploads.length }})</div>
      <div v-for="(u, i) in uploads" :key="i" class="fm-upitem">
        <span class="fm-upname">{{ u.name }}</span>
        <div class="progress fm-upprogress"><div :style="{ width: u.pct + '%' }"></div></div>
        <span class="mono fm-uppct">{{ u.state === 'error' ? '失败' : u.pct + '%' }}</span>
      </div>
    </div>

    <!-- 后台任务 -->
    <div v-if="ops.length" class="fm-opscard">
      <div class="fm-upcard-head">任务</div>
      <div v-for="t in ops" :key="t.id" class="fm-opitem">
        <span class="fm-opname">{{ t.op }} · {{ (t.paths || []).length || 1 }} 项</span>
        <div class="progress fm-upprogress"><div :style="{ width: (t.progress || 0) + '%' }"></div></div>
        <span class="mono fm-uppct">{{ t.status }}</span>
        <button v-if="t.status === 'running'" class="btn btn-sm btn-ghost" @click="fm.cancelOp(t.id)">取消</button>
        <button v-else class="btn btn-sm btn-ghost" @click="fm.removeOp(t.id)">×</button>
      </div>
    </div>

    <!-- 预览抽屉 -->
    <FmPreview :item="previewItem" @close="previewItem = null" @saved="fm.flash('已保存')" />

    <!-- 右键菜单 -->
    <div v-if="ctx.open" class="fm-ctx" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
      <template v-if="ctx.item">
        <button @click="ctxAct('open')">{{ ctx.item.is_dir ? '打开' : '预览' }}</button>
        <button v-if="!ctx.item.is_dir" @click="ctxAct('download')">下载</button>
        <button v-if="!ctx.item.is_dir" @click="ctxAct('hash')">校验值</button>
        <button v-if="!ctx.item.is_dir && /\.(zip|tar|gz|tgz|bz2|jar)$/i.test(ctx.item.name)" @click="ctxAct('unzip')">解压</button>
        <button @click="ctxAct('rename')">重命名</button>
        <button @click="ctxAct('copy')">复制到…</button>
        <button @click="ctxAct('move')">移动到…</button>
        <button @click="ctxAct('archive')">压缩</button>
        <button class="danger" @click="ctxAct('delete')">删除</button>
      </template>
      <template v-else>
        <button @click="ctxAct('mkdir')">新建文件夹</button>
        <button @click="pickFiles">上传文件</button>
      </template>
    </div>

    <!-- 通用对话框 -->
    <div v-if="dlg.open" class="overlay" @click.self="dlg.open = false">
      <div class="modal fm-modal">
        <div class="modal-header">
          <span>{{ dlg.title }}</span>
          <button class="btn btn-sm btn-ghost" @click="dlg.open = false">×</button>
        </div>
        <div class="modal-body">
          <div v-if="dlg.err" class="error">{{ dlg.err }}</div>

          <template v-if="dlg.type === 'delete'">
            <p>将删除 {{ selectedItems.length }} 项，此操作不可撤销。</p>
            <div class="fm-del-list mono">
              <div v-for="i in selectedItems.slice(0, 8)" :key="i.path">{{ i.path }}</div>
              <div v-if="selectedItems.length > 8" class="faint">…还有 {{ selectedItems.length - 8 }} 项</div>
            </div>
          </template>

          <template v-else-if="dlg.type === 'hash'">
            <div class="fm-hash mono">{{ dlg.busy ? '计算中…' : dlg.extra || '—' }}</div>
          </template>

          <template v-else-if="dlg.type === 'unzip'">
            <p>解压 <b>{{ dlg.item && dlg.item.name }}</b> 到 {{ cwd }}</p>
            <input v-model="dlg.value" class="input" placeholder="密码(无则留空)" />
          </template>

          <template v-else-if="dlg.type === 'archive'">
            <div class="form-row">
              <label class="form-label">文件名</label>
              <input v-model="dlg.value" class="input" />
            </div>
          </template>

          <template v-else>
            <input
              v-model="dlg.value"
              class="input"
              :placeholder="dlg.type === 'mkdir' ? '文件夹名' : '新名称'"
              @keydown.enter="confirmDlg"
            />
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="dlg.open = false">取消</button>
          <button
            v-if="dlg.type !== 'hash'"
            class="btn"
            :class="dlg.type === 'delete' ? 'btn-danger' : 'btn-primary'"
            :disabled="dlg.busy"
            @click="confirmDlg"
          >
            {{ dlg.busy ? '处理中…' : '确定' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 目录选择器 -->
    <div v-if="picker.open" class="overlay" @click.self="picker.open = false">
      <div class="modal fm-modal fm-picker">
        <div class="modal-header">
          <span>{{ picker.for === 'copy' ? '复制到' : '移动到' }}</span>
          <button class="btn btn-sm btn-ghost" @click="picker.open = false">×</button>
        </div>
        <div class="modal-body">
          <div class="fm-picker-bar">
            <button class="btn btn-sm btn-ghost" @click="pickerUp">↑</button>
            <input v-model="picker.path" class="input mono" @keydown.enter="loadPicker" />
          </div>
          <div class="fm-picker-list">
            <div v-if="picker.busy" class="hint">加载中…</div>
            <div v-for="d in picker.dirs" :key="d.path" class="fm-picker-item" @dblclick="pickerGo(d.path)">
              <span @click="pickerGo(d.path)">▣ {{ d.name }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <span class="faint mono grow">{{ picker.path }}</span>
          <button class="btn btn-ghost" @click="picker.open = false">取消</button>
          <button class="btn btn-primary" @click="confirmPicker">确定</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fm-toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
/* 占满 content-inner 的可视区: 减去上下 padding(22 + 44) */
.fm-page { display: flex; flex-direction: column; height: calc(100vh - 66px); padding: 0; }
.fm-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.fm-nav { display: flex; gap: 2px; }
.fm-crumbs {
  display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0;
  overflow: hidden; white-space: nowrap;
}
.fm-crumb {
  border: 0; background: transparent; color: var(--text-muted);
  font-size: 12px; font-family: var(--font-mono); cursor: pointer; padding: 2px 4px;
}
.fm-crumb:hover { color: var(--accent); background: var(--accent-soft); }
.fm-crumb.last { color: var(--text); font-weight: 600; }
.fm-sep { color: var(--text-faint); font-size: 11px; }
.fm-search { display: flex; align-items: center; gap: 4px; width: 220px; }
.fm-search .input { height: 26px; font-size: 12px; }
.fm-tools { display: flex; gap: 4px; }

.fm-body { flex: 1; display: flex; min-height: 0; }
.fm-side {
  width: 180px; border-right: 1px solid var(--border);
  background: var(--bg-raised); overflow: auto; padding: 8px 0; flex-shrink: 0;
}
.fm-side-group { margin-bottom: 14px; }
.fm-side-title {
  font-size: 10px; letter-spacing: 1.2px; color: var(--text-faint);
  padding: 4px 12px; font-family: var(--font-mono);
}
.fm-side-empty { font-size: 11px; color: var(--text-faint); padding: 2px 12px; }
.fm-side-item {
  display: flex; align-items: center; gap: 6px; padding: 5px 12px;
  font-size: 12px; color: var(--text-muted); cursor: pointer;
  border-left: 2px solid transparent;
}
.fm-side-item:hover { background: var(--surface-2); color: var(--text); }
.fm-side-item.active { border-left-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.fm-side-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); }
.fm-side-meta { font-size: 10px; color: var(--text-faint); }
.fm-side-x { border: 0; background: transparent; color: var(--text-faint); cursor: pointer; }

.fm-main { flex: 1; overflow: auto; position: relative; background: var(--surface); }
.fm-main.dropping { outline: 2px dashed var(--accent); outline-offset: -6px; }
.fm-err, .fm-empty { padding: 24px; }
.fm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.fm-table th {
  position: sticky; top: 0; z-index: 1;
  text-align: left; font-weight: 500; color: var(--text-faint);
  background: var(--surface-2); border-bottom: 1px solid var(--border);
  padding: 7px 10px; font-size: 11px; cursor: pointer; user-select: none;
}
.fm-table th.asc::after { content: ' ↑'; }
.fm-table th.desc::after { content: ' ↓'; }
.fm-table td { padding: 5px 10px; border-bottom: 1px solid var(--border); color: var(--text-muted); }
.fm-table tbody tr { cursor: default; }
.fm-table tbody tr:hover { background: var(--surface-2); }
.fm-table tbody tr.sel { background: var(--accent-soft); }
.fm-table tbody tr.sel td { color: var(--text); }
.c-chk { width: 34px; }
.c-size { width: 90px; text-align: right; }
.c-time { width: 140px; }
.c-kind { width: 90px; }
.fm-ico { display: inline-block; width: 16px; color: var(--text-faint); }
.fm-ico.k-image { color: #2f855a; }
.fm-ico.k-video { color: #b7791f; }
.fm-ico.k-audio { color: #805ad5; }
.fm-ico.k-archive { color: #c05621; }
.fm-ico.k-text, .fm-ico.k-code { color: #2b6cb0; }
.fm-name { color: var(--text); }
.fm-link { color: var(--accent); margin-left: 4px; font-size: 10px; }

.fm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; padding: 12px; }
.fm-card {
  border: 1px solid var(--border); background: var(--bg-raised);
  padding: 10px 8px; text-align: center; cursor: default;
}
.fm-card:hover { border-color: var(--border-strong); }
.fm-card.sel { border-color: var(--accent); background: var(--accent-soft); }
.fm-card-ico { font-size: 22px; color: var(--text-faint); line-height: 1.4; }
.fm-card-name {
  font-size: 11px; color: var(--text); margin-top: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fm-card-meta { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.fm-drop-hint {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(109, 92, 255, 0.08); color: var(--accent); font-size: 13px; pointer-events: none;
}

.fm-status {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 12px; border-top: 1px solid var(--border);
  background: var(--surface-2); font-size: 11px; color: var(--text-muted);
}
.fm-batch { display: flex; gap: 4px; }
.fm-cwd { margin-left: auto; color: var(--text-faint); max-width: 40%; overflow: hidden; text-overflow: ellipsis; }

.fm-upcard, .fm-opscard {
  position: fixed; right: 16px; bottom: 44px; width: 320px; z-index: 50;
  background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-sm);
}
.fm-opscard { bottom: 220px; }
.fm-upcard-head { padding: 6px 10px; font-size: 11px; color: var(--text-faint); border-bottom: 1px solid var(--border); }
.fm-upitem, .fm-opitem { display: flex; align-items: center; gap: 8px; padding: 5px 10px; font-size: 11px; }
.fm-upname, .fm-opname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-upprogress { width: 90px; height: 4px; }
.fm-uppct { width: 48px; text-align: right; color: var(--text-faint); }

.fm-ctx {
  position: fixed; z-index: 70; min-width: 132px;
  background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow);
  padding: 4px;
}
.fm-ctx button {
  display: block; width: 100%; text-align: left; border: 0; background: transparent;
  color: var(--text-muted); font-size: 12px; padding: 6px 10px; cursor: pointer;
}
.fm-ctx button:hover { background: var(--surface-2); color: var(--text); }
.fm-ctx button.danger { color: var(--danger); }

.fm-modal { width: 420px; max-width: 92vw; }
.fm-del-list { max-height: 160px; overflow: auto; font-size: 11px; color: var(--text-muted); }
.fm-hash { font-size: 12px; word-break: break-all; color: var(--text); }
.fm-picker { width: 520px; }
.fm-picker-bar { display: flex; gap: 6px; margin-bottom: 8px; }
.fm-picker-list { height: 260px; overflow: auto; border: 1px solid var(--border); }
.fm-picker-item { padding: 5px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer; }
.fm-picker-item:hover { background: var(--surface-2); color: var(--text); }

.fm-toast {
  position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%);
  background: var(--text); color: var(--bg); padding: 8px 16px; font-size: 12px; z-index: 90;
}
</style>
