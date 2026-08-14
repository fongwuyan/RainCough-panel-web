<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'
import { useJmcomic } from '../../stores/jmcomic'

const jm = useJmcomic()
const emit = defineEmits(['read'])

const PAGE_SIZE = 45

const items = ref([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageCount = ref(1)
const total = ref(0)

// 只缓存已打开页及其下一页
const pageCache = ref({})
let loadGen = 0

async function enrichTags(list, gen) {
  const pending = list.filter((a) => !a.tags || !a.tags.length)
  const CONC = 8
  for (let k = 0; k < pending.length && gen === loadGen; k += CONC) {
    const batch = pending.slice(k, k + CONC)
    await Promise.all(
      batch.map((a) =>
        api.jmMeta(a.aid)
          .then((m) => {
            if (gen !== loadGen) return
            a.tags = m.tags || []
          })
          .catch(() => {}),
      ),
    )
  }
}

function pruneCache(current) {
  const keep = new Set([current, current + 1])
  const next = {}
  for (const k in pageCache.value) {
    if (keep.has(Number(k))) next[k] = pageCache.value[k]
  }
  pageCache.value = next
}

async function fetchPage(p) {
  const data = await api.jmLibrary(p, PAGE_SIZE)
  pageCount.value = data.page_count || 1
  total.value = data.total || 0
  pageCache.value = { ...pageCache.value, [p]: (data.items || []).slice() }
  return pageCache.value[p]
}

async function load(p) {
  const target = p || 1
  loading.value = true
  error.value = ''
  loadGen++
  const gen = loadGen
  try {
    let list = pageCache.value[target]
    if (!list) {
      list = await fetchPage(target)
      page.value = target
    } else {
      page.value = target
    }
    items.value = list
    // 预取下一页（只缓存当前页与下一页）
    if (!pageCache.value[target + 1]) {
      fetchPage(target + 1).catch(() => {})
    }
    pruneCache(target)
    enrichTags(items.value, gen)
  } catch (e) {
    if (gen === loadGen) error.value = e.message
  } finally {
    if (gen === loadGen) loading.value = false
  }
}

function goPage(p) {
  if (p < 1 || p > pageCount.value) return
  load(p)
}

function open(aid) {
  jm.openAlbumInReader(aid).catch(() => {})
  emit('read')
}

async function del(aid) {
  if (!window.confirm(`确定删除本子 #${aid} 吗？`)) return
  await jm.deleteLibrary(aid)
  pageCache.value = {}
  load(page.value)
}

function pageText(album) {
  if (!album) return ''
  return album.total > 0 ? `${album.cached}/${album.total} 页` : `${album.cached} 页`
}
function pct(album) {
  return album.total > 0 ? Math.round((album.cached / album.total) * 100) : 0
}
function zipText(album) {
  return album.zip_size ? `(${(album.zip_size / 1024 / 1024).toFixed(1)}MB)` : ''
}

onMounted(() => load(1))
</script>

<template>
  <div>
    <div v-if="loading" class="loading"><div class="spinner"></div>加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!items.length" class="empty">还没有缓存过本子，搜索并查看漫画后会自动加入</div>

    <template v-else>
      <h3 style="margin-bottom:14px;">本子库 ({{ total }})</h3>
      <div class="card-grid">
        <div
          v-for="album in items"
          :key="album.aid"
          class="card"
          @click="open(album.aid)"
        >
          <div class="card-cover">
            <img
              :src="api.jmCover(album.aid)"
              loading="lazy"
              @error="$event.target.style.display='none'"
            />
            <span class="badge" style="cursor:default;">{{ pageText(album) }}</span>
            <a
              v-if="album.zip_size"
              class="badge"
              style="right:6px;left:auto;text-decoration:none;"
              :href="api.jmZip(album.aid)"
              download
              @click.stop
            >ZIP</a>
            <span
              class="badge badge-err"
              style="top:auto;bottom:6px;right:6px;left:auto;"
              @click.stop="del(album.aid)"
            >删除</span>
            <div v-if="pct(album) < 100" class="progress" style="position:absolute;left:0;right:0;bottom:0;">
              <div :style="{ width: pct(album) + '%' }"></div>
            </div>
          </div>
          <div class="card-body">
            <div class="card-title" :title="album.name || album.aid">{{ album.name || album.aid }}</div>
            <div class="card-meta">{{ album.author || '未知作者' }} {{ zipText(album) }}</div>
            <div v-if="album.tags && album.tags.length" class="card-tags">
              <span v-for="t in album.tags.slice(0, 3)" :key="t" class="tag-chip tag-chip-sm">{{ t }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pageCount > 1" style="display:flex;gap:8px;justify-content:center;align-items:center;margin-top:16px;">
        <button v-if="page > 1" class="btn btn-ghost btn-sm" @click="goPage(page - 1)">上一页</button>
        <span class="status-line">第 {{ page }}/{{ pageCount }} 页</span>
        <button v-if="page < pageCount" class="btn btn-ghost btn-sm" @click="goPage(page + 1)">下一页</button>
      </div>
    </template>
  </div>
</template>
