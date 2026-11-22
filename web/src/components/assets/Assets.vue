<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const items = ref([])
const loading = ref(false)
const err = ref('')
const plugin = ref('')
const kind = ref('')
const q = ref('')
const total = ref(0)
const hasMore = ref(false)
const pageSize = 300
const preview = ref(null)
const previewText = ref('')
const previewBusy = ref(false)
const previewErr = ref('')

const zoom = ref(1)
const rotate = ref(0)
const pan = ref({ x: 0, y: 0 })
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, px: 0, py: 0 })
const archiveQuery = ref('')

const archive = ref({ open: false, entries: [], selected: null, url: '', text: '', busy: false, err: '' })
const imageItems = computed(() => items.value.filter((x) => x.kind === 'image'))
const imageIndex = computed(() => preview.value ? imageItems.value.findIndex((x) => x.plugin === preview.value.plugin && x.path === preview.value.path) : -1)
const archiveFiltered = computed(() => {
  const q = archiveQuery.value.trim().toLowerCase()
  if (!q) return archive.value.entries
  return archive.value.entries.filter((e) => e.name.toLowerCase().includes(q))
})

const shown = computed(() => items.value)

async function load() {
  loading.value = true; err.value = ''
  try {
    const d = await api.assets({ plugin: plugin.value, kind: kind.value, q: q.value, offset: 0, limit: pageSize })
    items.value = (d && d.items) || []
    total.value = (d && d.total) || 0
    hasMore.value = !!(d && d.has_more)
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}

async function loadMore() {
  if (!hasMore.value || loading.value) return
  loading.value = true
  try {
    const d = await api.assets({ plugin: plugin.value, kind: kind.value, q: q.value, offset: items.value.length, limit: pageSize })
    items.value = items.value.concat((d && d.items) || [])
    total.value = (d && d.total) || total.value
    hasMore.value = !!(d && d.has_more)
  } catch (e) { err.value = e.message || String(e) }
  finally { loading.value = false }
}

function resetImage() {
  zoom.value = 1
  rotate.value = 0
  pan.value = { x: 0, y: 0 }
}
function onWheel(e) {
  if (!preview.value || preview.value.kind !== 'image') return
  const z = zoom.value * (e.deltaY < 0 ? 1.15 : 0.87)
  zoom.value = Math.max(0.4, Math.min(8, z))
}
function startDrag(e) {
  if (!preview.value || preview.value.kind !== 'image') return
  dragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, px: pan.value.x, py: pan.value.y }
}
function moveDrag(e) {
  if (!dragging.value) return
  pan.value = { x: dragStart.value.px + e.clientX - dragStart.value.x, y: dragStart.value.py + e.clientY - dragStart.value.y }
}
function endDrag() { dragging.value = false }

async function open(it) {
  preview.value = it
  previewText.value = ''
  previewErr.value = ''
  archiveQuery.value = ''
  archive.value = { open: false, entries: [], selected: null, url: '', text: '', busy: false, err: '' }
  resetImage()
  if (it.kind === 'text') await loadText(it)
  if (it.kind === 'doc') await loadDoc(it)
  if (it.kind === 'archive') await loadArchive(it)
}

function prevImage() {
  if (imageIndex.value > 0) open(imageItems.value[imageIndex.value - 1])
}
function nextImage() {
  if (imageIndex.value >= 0 && imageIndex.value < imageItems.value.length - 1) open(imageItems.value[imageIndex.value + 1])
}
function onKey(e) {
  if (!preview.value) return
  if (e.key === 'Escape') { preview.value = null; return }
  if (preview.value.kind !== 'image') return
  if (e.key === 'ArrowLeft') { e.preventDefault(); prevImage() }
  if (e.key === 'ArrowRight') { e.preventDefault(); nextImage() }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom.value = Math.min(8, zoom.value * 1.2) }
  if (e.key === '-') { e.preventDefault(); zoom.value = Math.max(0.4, zoom.value / 1.2) }
  if (e.key === '0') { e.preventDefault(); resetImage() }
}

async function loadDoc(it) {
  previewBusy.value = true
  try {
    const r = await fetch(api.assetDocUrl(it.plugin, it.path))
    if (!r.ok) throw new Error('HTTP ' + r.status)
    previewText.value = await r.text()
  } catch (e) { previewErr.value = e.message || String(e) }
  finally { previewBusy.value = false }
}

async function loadText(it) {
  previewBusy.value = true
  try {
    const r = await fetch(it.url)
    if (!r.ok) throw new Error('HTTP ' + r.status)
    previewText.value = await r.text()
  } catch (e) { previewErr.value = e.message || String(e) }
  finally { previewBusy.value = false }
}

async function loadArchive(it) {
  archive.value.busy = true
  archive.value.open = true
  archive.value.err = ''
  try {
    const d = await api.assetArchive(it.plugin, it.path)
    archive.value.entries = (d && d.entries) || []
    const first = archive.value.entries.find((x) => !x.is_dir && x.kind !== 'file')
    if (first) await selectEntry(first)
  } catch (e) { archive.value.err = e.message || String(e) }
  finally { archive.value.busy = false }
}

async function selectEntry(entry) {
  if (!preview.value || entry.is_dir) return
  archive.value.selected = entry
  archive.value.url = ''
  archive.value.text = ''
  const url = api.assetArchiveEntryUrl(preview.value.plugin, preview.value.path, entry.name)
  if (entry.kind === 'image' || entry.kind === 'video' || entry.kind === 'audio' || entry.kind === 'pdf') {
    archive.value.url = url
  } else if (entry.kind === 'text') {
    archive.value.text = '加载中…'
    try {
      const r = await fetch(url)
      archive.value.text = r.ok ? await r.text() : ('读取失败 HTTP ' + r.status)
    } catch (e) { archive.value.text = '读取失败: ' + (e.message || e) }
  }
}

async function del(it) {
  if (!confirm('删除资产「' + it.name + '」？此操作不可恢复。')) return
  try { await api.assetDelete(it.plugin, it.path); await load() }
  catch (e) { err.value = e.message || String(e) }
}

async function rename(it) {
  const name = prompt('重命名资产', it.name)
  if (!name || name === it.name) return
  try { await api.assetRename(it.plugin, it.path, name); await load() }
  catch (e) { err.value = e.message || String(e) }
}

function fmtSize(n) {
  n = Number(n) || 0
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + ' GB'
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}
function fmtTime(ts) { return ts ? new Date(ts * 1000).toLocaleString() : '—' }
onMounted(() => { load(); window.addEventListener('keydown', onKey) })
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="page assets-page">
    <div class="assets-head">
      <div><h1>资产</h1><p class="sub">插件 cache/output/work 产物；支持图片缩放、压缩包内预览、文档/视频/PDF 查看</p></div>
      <button class="btn" :disabled="loading" @click="load">{{ loading ? '扫描中…' : '刷新' }}</button>
    </div>
    <div v-if="err" class="error">{{ err }}</div>
    <div class="assets-filters">
      <input v-model="plugin" class="input" placeholder="插件名" @keyup.enter="load" />
      <select v-model="kind" class="input" @change="load">
        <option value="">全部类型</option>
        <option value="image">图片</option>
        <option value="video">视频</option>
        <option value="audio">音频</option>
        <option value="pdf">PDF</option>
        <option value="doc">文档</option>
        <option value="archive">压缩包</option>
        <option value="model">模型</option>
        <option value="text">文本/文档</option>
        <option value="file">其他</option>
      </select>
      <input v-model="q" class="input" placeholder="文件名/路径" @keyup.enter="load" />
      <button class="btn" @click="load">筛选</button>
      <span class="faint" style="font-size:11px;">共 {{ total || items.length }} 项</span>
    </div>

    <div v-if="!items.length && !loading" class="hint">没有资产</div>
    <div class="assets-grid">
      <div v-for="(it, i) in shown" :key="i" class="asset-card">
        <div class="asset-preview" @click="open(it)">
          <img v-if="it.kind === 'image'" :src="it.url" loading="lazy" />
          <span v-else class="asset-kind">{{ it.kind }}</span>
        </div>
        <div class="asset-name" :title="it.name">{{ it.name }}</div>
        <div class="asset-meta">{{ it.plugin }} · {{ fmtSize(it.size) }}</div>
        <div class="asset-actions">
          <button class="btn btn-sm" @click="open(it)">查看</button>
          <a class="btn btn-sm" :href="it.url" download>下载</a>
          <button class="btn btn-sm" @click="rename(it)">重命名</button>
          <button class="btn btn-sm btn-danger" @click="del(it)">删除</button>
        </div>
      </div>
    </div>
    <div v-if="hasMore" class="assets-more">
      <button class="btn" :disabled="loading" @click="loadMore">加载更多（{{ items.length }} / {{ total }}）</button>
    </div>

    <div v-if="preview" class="asset-mask" @click.self="preview = null">
      <div class="asset-modal" :class="{ 'is-archive': archive.open }">
        <div class="asset-modal-head">
          <div class="asset-title"><b>{{ preview.name }}</b><span class="faint">{{ preview.plugin }} · {{ fmtSize(preview.size) }} · {{ fmtTime(preview.mtime) }}</span></div>
          <div class="asset-head-actions">
            <a class="btn btn-sm" :href="preview.url" download>下载</a>
            <button class="btn btn-sm btn-ghost" @click="preview = null">×</button>
          </div>
        </div>
        <div class="asset-modal-body" :class="{ 'img-body': preview.kind === 'image' }">
          <template v-if="preview.kind === 'image'">
            <div class="asset-img-stage"
              @wheel.prevent="onWheel"
              @mousedown.prevent="startDrag"
              @mousemove="moveDrag"
              @mouseup="endDrag"
              @mouseleave="endDrag"
              @dblclick="resetImage">
              <img :src="preview.url" class="asset-full-img" :style="{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ') rotate(' + rotate + 'deg)' }" draggable="false" />
            </div>
          </template>
          <video v-else-if="preview.kind === 'video'" :src="preview.url" controls class="asset-media"></video>
          <audio v-else-if="preview.kind === 'audio'" :src="preview.url" controls class="asset-audio"></audio>
          <iframe v-else-if="preview.kind === 'pdf'" :src="preview.url" class="asset-pdf"></iframe>
          <pre v-else-if="preview.kind === 'text'" class="asset-text">{{ previewBusy ? '加载中…' : (previewErr || previewText) }}</pre>
          <pre v-else-if="preview.kind === 'doc'" class="asset-text">{{ previewBusy ? '解析文档…' : (previewErr || previewText) }}</pre>
          <div v-else-if="preview.kind === 'archive'" class="archive-view">
            <div v-if="archive.busy" class="hint" style="padding:16px;">读取压缩包…</div>
            <div v-else-if="archive.err" class="error" style="padding:16px;">{{ archive.err }}</div>
            <div v-else class="archive-layout">
              <aside class="archive-list">
                <div class="archive-search"><input v-model="archiveQuery" class="input" placeholder="搜索压缩包内文件…" /></div>
                <div v-for="e in archiveFiltered" :key="e.name" class="archive-item" :class="{ active: archive.selected && archive.selected.name === e.name, dir: e.is_dir }" @click="selectEntry(e)">
                  <span class="archive-name" :title="e.name">{{ e.name }}</span>
                  <span class="archive-size">{{ e.is_dir ? '' : fmtSize(e.size) }}</span>
                </div>
                <div v-if="!archiveFiltered.length" class="hint" style="padding:12px;">{{ archive.entries.length ? '没有匹配文件' : '空压缩包' }}</div>
              </aside>
              <section class="archive-preview">
                <div v-if="!archive.selected" class="hint">选择左侧文件预览</div>
                <img v-else-if="archive.selected.kind === 'image' && archive.url" :src="archive.url" class="archive-img" />
                <video v-else-if="archive.selected.kind === 'video' && archive.url" :src="archive.url" controls class="asset-media"></video>
                <audio v-else-if="archive.selected.kind === 'audio' && archive.url" :src="archive.url" controls class="asset-audio"></audio>
                <iframe v-else-if="archive.selected.kind === 'pdf' && archive.url" :src="archive.url" class="asset-pdf"></iframe>
                <pre v-else-if="archive.selected.kind === 'text'" class="asset-text archive-text">{{ archive.text }}</pre>
                <div v-else class="hint">该文件无法内嵌预览，请下载。</div>
              </section>
            </div>
          </div>
          <div v-else class="asset-other">该类型不支持内嵌预览，可下载或用原程序打开。</div>
        </div>
        <div class="asset-modal-foot">
          <template v-if="preview.kind === 'image'">
            <button class="btn btn-sm" :disabled="imageIndex <= 0" @click="prevImage">‹</button>
            <button class="btn btn-sm" :disabled="imageIndex < 0 || imageIndex >= imageItems.length - 1" @click="nextImage">›</button>
            <span class="faint" style="font-size:11px;">{{ imageIndex + 1 }} / {{ imageItems.length }}</span>
            <span style="width:1px;height:14px;background:var(--border);"></span>
            <button class="btn btn-sm" @click="zoom = Math.max(0.4, zoom / 1.2)">−</button>
            <span class="mono zoom-label">{{ Math.round(zoom * 100) }}%</span>
            <button class="btn btn-sm" @click="zoom = Math.min(8, zoom * 1.2)">＋</button>
            <button class="btn btn-sm" @click="rotate = (rotate + 90) % 360">旋转</button>
            <button class="btn btn-sm" @click="zoom = 1; pan = { x: 0, y: 0 }">适应</button>
            <button class="btn btn-sm" @click="resetImage">重置</button>
          </template>
          <span v-if="archive.open" class="faint" style="font-size:11px;">{{ archive.entries.length }} 个条目</span>
          <span class="np-grow"></span>
          <a class="btn btn-sm" :href="preview.url" download>下载原文件</a>
          <button class="btn btn-sm" @click="preview = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assets-page { padding: 18px 22px 28px; }
.assets-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.assets-head h1 { margin: 0; font-size: 22px; }
.assets-head .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 12px; }
.assets-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
.assets-filters .input { width: 170px; }
.assets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.asset-card { border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); overflow: hidden; min-width: 0; }
.asset-preview { display: flex; width: 100%; height: 125px; align-items: center; justify-content: center; background: var(--bg2); overflow: hidden; cursor: zoom-in; }
.asset-preview img { max-width: 100%; max-height: 125px; object-fit: contain; }
.asset-kind { color: var(--text-muted); font-size: 12px; text-transform: uppercase; }
.asset-name { padding: 6px 7px 0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-meta { padding: 2px 7px 5px; font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-actions { display: flex; gap: 3px; flex-wrap: wrap; padding: 0 6px 7px; }
.asset-actions .btn { padding: 2px 6px; }
.assets-more { display: flex; justify-content: center; padding: 12px; }
.asset-mask { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.42); display: flex; align-items: center; justify-content: center; padding: 18px; }
.asset-modal { width: min(1100px, 96vw); max-height: 92vh; display: flex; flex-direction: column; background: var(--bg-raised, var(--surface)); border: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.28); }
:root[data-scheme="light"] .asset-modal { background: #fff; }
:root[data-scheme="dark"] .asset-modal { background: #1d2430; }
:root[data-theme="yuluo"] .asset-modal { background: rgba(22,25,30,.97); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
.asset-modal.is-archive { width: min(1250px, 97vw); }
.asset-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border); }
.asset-title { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 13px; }
.asset-title .faint { font-size: 11px; }
.asset-head-actions { display: flex; gap: 6px; align-items: center; }
.asset-modal-body { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: transparent; }
.asset-modal-body.img-body { overflow: hidden; }
.asset-img-stage { width: 100%; height: 72vh; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: grab; }
.asset-img-stage:active { cursor: grabbing; }
.asset-full-img { max-width: 100%; max-height: 100%; object-fit: contain; user-select: none; will-change: transform; }
.asset-media { max-width: 100%; max-height: 76vh; padding: 8px; }
.asset-audio { width: min(520px, 90%); padding: 20px; }
.asset-pdf { width: 100%; height: 76vh; border: 0; background: #fff; }
.asset-text { margin: 0; padding: 14px; width: 100%; height: 72vh; overflow: auto; color: var(--text); font-size: 12px; line-height: 1.65; white-space: pre-wrap; }
.asset-other { color: var(--text-muted); font-size: 13px; padding: 40px; text-align: center; }
.archive-view { width: 100%; height: 72vh; align-self: stretch; }
.archive-layout { display: grid; grid-template-columns: minmax(260px, 340px) 1fr; height: 100%; min-height: 0; }
.archive-list { border-right: 1px solid var(--border); overflow: auto; background: var(--surface-2); }
.archive-search { position: sticky; top: 0; z-index: 1; padding: 6px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.archive-search .input { width: 100%; height: 26px; font-size: 11px; }
.archive-item { display: flex; justify-content: space-between; gap: 8px; padding: 5px 9px; font-size: 11px; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid var(--border); }
.archive-item:hover { background: var(--surface-3); }
.archive-item.active { background: var(--accent-soft); color: var(--text); }
.archive-item.dir { color: var(--text-faint); cursor: default; }
.archive-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.archive-size { color: var(--text-faint); flex: 0 0 auto; }
.archive-preview { overflow: auto; display: flex; align-items: center; justify-content: center; min-width: 0; }
.archive-img { max-width: 100%; max-height: 70vh; object-fit: contain; }
.archive-text { height: 70vh; }
.asset-modal-foot { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-top: 1px solid var(--border); font-size: 11px; }
.zoom-label { width: 44px; text-align: center; color: var(--text-muted); }
.np-grow { flex: 1; }
@media (max-width: 760px) {
  .assets-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .archive-layout { grid-template-columns: 1fr; grid-template-rows: 35% 65%; }
  .archive-list { border-right: 0; border-bottom: 1px solid var(--border); }
  .archive-view { height: 66vh; }
}
</style>
