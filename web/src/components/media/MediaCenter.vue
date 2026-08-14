<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api'
import { usePreview } from '../../stores/preview'

const preview = usePreview()

const roots = ref([])
const activeRoot = ref('')
const kind = ref('')
const items = ref([])
const page = ref(0)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const counts = ref({})
const showRootsEditor = ref(false)
const editRoots = ref([])
const tagFilter = ref('')
const tagging = ref(false)
const tagInfo = ref('')
const showDedup = ref(false)
const dedupGroups = ref([])
const dedupScanned = ref(0)
const dedupLoading = ref(false)
const deleting = ref({})

function fmtSize(b) {
  b = b || 0
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

const hasMore = computed(() => items.value.length < total.value)

async function loadRoots() {
  try {
    const d = await api.mediaRoots()
    roots.value = d.roots || []
    if (!activeRoot.value && roots.value.length) activeRoot.value = roots.value[0].name
  } catch (e) { error.value = e.message }
}

async function loadStats() {
  try {
    const d = await api.mediaStats()
    counts.value = d.counts || {}
  } catch (e) {}
}

async function load(reset = true) {
  if (!activeRoot.value) return
  loading.value = true
  error.value = ''
  try {
    const d = await api.mediaList(activeRoot.value, kind.value, reset ? 0 : page.value, tagFilter.value)
    total.value = d.total
    items.value = reset ? (d.items || []) : [...items.value, ...(d.items || [])]
    page.value = d.page + 1
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function doTagBatch() {
  const paths = items.value.filter((i) => i.kind === 'image').map((i) => i.path)
  if (!paths.length) return
  tagging.value = true
  tagInfo.value = ''
  error.value = ''
  try {
    const d = await api.mediaTag(paths)
    const done = d.results.filter((r) => !r.error).length
    const failed = d.results.length - done
    tagInfo.value = `打标完成：成功 ${done}，失败 ${failed}（单张约 1-3s，请稍候）`
    await load(true)
  } catch (e) {
    error.value = e.message
  } finally {
    tagging.value = false
  }
}

function doTagSearch() {
  load(true)
}

async function doDedup() {
  if (!activeRoot.value) return
  dedupLoading.value = true
  error.value = ''
  showDedup.value = true
  dedupGroups.value = []
  try {
    const d = await api.mediaDedup(activeRoot.value)
    dedupGroups.value = d.groups || []
    dedupScanned.value = d.scanned || 0
  } catch (e) {
    error.value = e.message
  } finally {
    dedupLoading.value = false
  }
}

async function deleteDup(path) {
  if (!window.confirm(`确定删除？\n${path}`)) return
  deleting.value[path] = true
  try {
    await api.fmDelete([path])
    dedupGroups.value = dedupGroups.value.map((g) => g.filter((p) => p !== path)).filter((g) => g.length > 1)
  } catch (e) {
    error.value = e.message
  } finally {
    delete deleting.value[path]
  }
}

function switchRoot(name) {
  if (name === activeRoot.value) return
  activeRoot.value = name
  load(true)
}

function switchKind(k) {
  if (k === kind.value) return
  kind.value = k
  load(true)
}

function openView(item) {
  if (item.kind !== 'image') {
    window.open(api.mediaFile(item.path), '_blank')
    return
  }
  const list = items.value.filter((i) => i.kind === 'image').map((i) => api.mediaFile(i.path))
  const idx = list.indexOf(api.mediaFile(item.path))
  preview.open(list, idx < 0 ? 0 : idx)
}

function openRootsEditor() {
  editRoots.value = roots.value.map((r) => ({ name: r.name, label: r.label, path: r.path }))
  showRootsEditor.value = true
}

function addRoot() {
  editRoots.value.push({ name: '', label: '', path: '' })
}

function removeRoot(i) {
  editRoots.value.splice(i, 1)
}

async function saveRoots() {
  try {
    await api.mediaSaveRoots(editRoots.value)
    showRootsEditor.value = false
    await loadRoots()
    await loadStats()
    if (activeRoot.value) await load(true)
  } catch (e) {
    error.value = e.message
  }
}

onMounted(async () => {
  await loadRoots()
  await loadStats()
  await load(true)
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>媒体中心</h1>
      <div class="subtitle">聚合浏览服务器图片与视频</div>
      <div class="media-toolbar">
        <div class="root-tabs">
          <button
            v-for="r in roots"
            :key="r.name"
            class="tab"
            :class="{ active: activeRoot === r.name }"
            @click="switchRoot(r.name)"
          >
            {{ r.label }}
            <span v-if="counts[r.name]" class="root-count">
              {{ counts[r.name].image }}图/{{ counts[r.name].video }}视频
            </span>
          </button>
        </div>
        <div class="media-actions">
          <button class="btn btn-sm" :class="{ 'btn-primary': kind === '' }" @click="switchKind('')">全部</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': kind === 'image' }" @click="switchKind('image')">图片</button>
          <button class="btn btn-sm" :class="{ 'btn-primary': kind === 'video' }" @click="switchKind('video')">视频</button>
          <input v-model="tagFilter" class="input" style="width:140px;" placeholder="标签筛选（逗号分隔）"
                 @keydown.enter="doTagSearch" />
          <button class="btn btn-sm" @click="doTagSearch">筛选</button>
          <button class="btn btn-sm" :disabled="tagging || !items.filter(i => i.kind === 'image').length" @click="doTagBatch">
            {{ tagging ? '打标中…' : '打标当前' }}
          </button>
          <button class="btn btn-sm" :disabled="dedupLoading" @click="doDedup">相似检测</button>
          <button class="btn btn-sm btn-ghost" style="margin-left:8px;" @click="openRootsEditor">编辑根目录</button>
        </div>
      </div>
      <div v-if="tagInfo" class="tag-info">{{ tagInfo }}</div>
    </div>

    <div class="page-body">
      <div v-if="error" class="error" style="margin-bottom:10px;">{{ error }}</div>
      <div v-if="loading && !items.length" class="status-line" style="padding:20px;">加载中...</div>
      <div v-else-if="!items.length && !loading" class="empty" style="padding:40px;">暂无媒体</div>

      <div v-if="items.length" class="media-grid">
        <div v-for="item in items" :key="item.path" class="media-card" @click="openView(item)">
          <div class="media-thumb">
            <template v-if="item.kind === 'image'">
              <img :src="api.mediaThumb(item.path)" loading="lazy" :alt="item.name" />
            </template>
            <template v-else>
              <div class="video-thumb" :style="{ backgroundImage: `url(${api.mediaThumb(item.path)})` }">
                <span class="video-badge">▶</span>
              </div>
            </template>
          </div>
          <div class="media-info">
            <div class="media-name" :title="item.name">{{ item.name }}</div>
            <div class="media-meta">
              <span>{{ fmtSize(item.size) }}</span>
              <span>{{ fmtTime(item.mtime) }}</span>
            </div>
            <div v-if="item.tags && (item.tags.general || []).length" class="tag-chips">
              <span class="chip">{{ item.tags.general.slice(0, 5).join('、') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasMore" style="text-align:center;padding:14px;">
        <button class="btn btn-sm" :disabled="loading" @click="load(false)">
          {{ loading ? '加载中…' : `加载更多（${items.length} / ${total}）` }}
        </button>
      </div>
    </div>

    <div v-if="showRootsEditor" class="modal-mask" @click.self="showRootsEditor = false">
      <div class="modal">
        <div class="modal-title">编辑媒体根目录</div>
        <div style="max-height:50vh;overflow:auto;">
          <div v-for="(r, i) in editRoots" :key="i" class="root-row">
            <input v-model="r.label" class="input" style="width:110px;" placeholder="显示名" />
            <input v-model="r.path" class="input" style="flex:1;" placeholder="绝对路径，如 /opt/touchgal/plugins/aigen/output" />
            <button class="btn btn-sm btn-danger" @click="removeRoot(i)">删除</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:space-between;">
          <button class="btn btn-sm" @click="addRoot">+ 添加根目录</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-ghost" @click="showRootsEditor = false">取消</button>
            <button class="btn btn-sm btn-primary" @click="saveRoots">保存</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showDedup" class="modal-mask" @click.self="showDedup = false">
      <div class="modal">
        <div class="modal-title">
          相似图片检测
          <button class="btn btn-sm btn-ghost" style="float:right;" @click="showDedup = false">关闭</button>
        </div>
        <div v-if="dedupLoading" class="status-line" style="padding:16px;">扫描中…（需数分钟）</div>
        <div v-else-if="!dedupGroups.length" class="empty" style="padding:20px;">未发现相似组（扫描 {{ dedupScanned }} 张）</div>
        <div v-else class="dedup-list">
          <div class="dedup-note">发现 {{ dedupGroups.length }} 组疑似重复（共扫描 {{ dedupScanned }} 张）</div>
          <div v-for="(g, gi) in dedupGroups" :key="gi" class="dedup-group">
            <div class="dedup-title">组 {{ gi + 1 }}（{{ g.length }} 张）</div>
            <div v-for="p in g" :key="p" class="dedup-row">
              <span class="dedup-path" :title="p">{{ p }}</span>
              <button class="btn btn-sm btn-danger" :disabled="deleting[p]" @click="deleteDup(p)">删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-toolbar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.root-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.tab {
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}
.tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.root-count { opacity: 0.75; margin-left: 4px; font-size: 11px; }
.media-actions { display: flex; align-items: center; gap: 6px; }
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.media-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-2);
  cursor: pointer;
  transition: border-color 0.15s;
}
.media-card:hover { border-color: var(--accent); }
.media-thumb {
  height: 160px;
  background: #0a0d10;
}
.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.video-thumb {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  position: relative;
}
.video-badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
}
.media-info { padding: 8px 10px; }
.media-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.media-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 4px;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  padding: 16px;
  width: 560px;
  max-width: 92vw;
}
.modal-title { font-weight: 700; margin-bottom: 12px; }
.root-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.tag-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.tag-chips { margin-top: 6px; }
.chip {
  display: inline-block;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
}
.dedup-list { max-height: 55vh; overflow: auto; }
.dedup-note { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.dedup-group {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: var(--surface-2);
}
.dedup-title { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
.dedup-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.dedup-path {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>