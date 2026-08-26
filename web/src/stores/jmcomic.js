import { ref } from 'vue'
import { api } from '../api'

const libraryCache = ref({})
const downloads = ref({})
const albumCache = ref({})
const chapterCache = ref({})
const reader = ref(null)
const readerAlbum = ref(null)
const popupAid = ref(null)
const batch = ref(null)
const pollers = new Map()

const searchMode = ref('keyword')
const searchKeyword = ref('')
const searchPage = ref(1)
const searchPageCount = ref(1)
const searchItems = ref([])
const searchLoading = ref(false)
const searchError = ref('')
let searchGen = 0

async function enrichMeta(list, gen) {
  const pending = list.filter((i) => !i.author && (!i.tags || !i.tags.length))
  const CONC = 8
  for (let k = 0; k < pending.length && gen === searchGen; k += CONC) {
    const batch = pending.slice(k, k + CONC)
    await Promise.all(
      batch.map((it) =>
        api.jmMeta(it.id)
          .then((m) => {
            if (gen !== searchGen) return
            it.author = m.author || ''
            it.tags = m.tags || []
          })
          .catch(() => {}),
      ),
    )
  }
}

async function refreshLibrary() {
  try {
    const data = await api.jmLibrary(1, 100000)
    const map = {}
    ;(data.items || []).forEach((i) => { map[i.aid] = true })
    libraryCache.value = map
  } catch (e) {}
}

function pollOnce(aid) {
  return api.jmDownload(aid)
    .then((st) => {
      downloads.value = { ...downloads.value, [aid]: st }
      if (st.status === 'completed') {
        stopPolling(aid)
        refreshLibrary()
      }
      return st
    })
    .catch(() => null)
}

function stopPolling(aid) {
  const t = pollers.get(aid)
  if (t) { clearInterval(t); pollers.delete(aid) }
}

function ensurePolling(aid) {
  if (pollers.has(aid)) return
  pollers.set(aid, setInterval(() => pollOnce(aid), 2000))
}

const BATCH_KEY = '__batch__'

async function pollBatch() {
  try {
    const st = await api.jmBatchStatus()
    batch.value = st
    if (!st.running) stopBatchPolling()
    return st
  } catch (e) {
    return null
  }
}

function stopBatchPolling() {
  const t = pollers.get(BATCH_KEY)
  if (t) { clearInterval(t); pollers.delete(BATCH_KEY) }
}

function ensureBatchPolling() {
  if (pollers.has(BATCH_KEY)) return
  pollers.set(BATCH_KEY, setInterval(pollBatch, 2000))
}

export function useJmcomic() {
  function startDownload(aid) {
    downloads.value = { ...downloads.value, [aid]: { status: 'downloading', downloaded: 0, total: 0 } }
    ensurePolling(aid)
    api.jmStartDownload(aid).catch(() => {})
    pollOnce(aid)
  }

  async function startBatch(mode, keyword) {
    try { await api.jmBatchStart(mode, keyword) } catch (e) { throw e }
    await pollBatch()
    ensureBatchPolling()
  }

  async function stopBatch() {
    try { await api.jmBatchStop() } catch (e) {}
    await pollBatch()
  }

  async function loadAlbum(aid) {
    if (!albumCache.value[aid]) {
      const data = await api.jmAlbum(aid)
      albumCache.value = { ...albumCache.value, [aid]: data }
    }
    return albumCache.value[aid]
  }

  async function openAlbumInReader(aid) {
    readerAlbum.value = null
    const album = await loadAlbum(aid)
    readerAlbum.value = album
    reader.value = { aid, cid: null, name: '', files: [], page: 0, fitMode: 'width', loading: false, error: '' }
  }

  async function doSearch(pg) {
    const kw = searchKeyword.value.trim()
    if (!kw) return false

    if (searchMode.value === 'id') {
      if (!/^\d+$/.test(kw)) {
        searchError.value = 'ID 必须是数字'
        return false
      }
      searchError.value = ''
      openAlbumInReader(kw).catch((e) => { searchError.value = e.message })
      return true
    }

    const p = pg || 1
    searchPage.value = p
    searchLoading.value = true
    searchError.value = ''
    searchGen++
    try {
      const data = await api.jmSearch(kw, p, searchMode.value)
      searchItems.value = (data.items || []).map((i) => ({ author: '', tags: [], ...i }))
      searchPageCount.value = data.page_count || 1
      if (!searchItems.value.length) searchError.value = '没有找到结果'
      refreshLibrary()
      enrichMeta(searchItems.value, searchGen)
    } catch (e) {
      searchError.value = e.message
      searchItems.value = []
    } finally {
      searchLoading.value = false
    }
    return false
  }

  async function openChapter(cid, name) {
    if (!reader.value) return
    const aid = reader.value.aid
    reader.value.cid = cid
    reader.value.name = name
    reader.value.page = 0
    reader.value.error = ''
    reader.value.loading = true
    try {
      if (!chapterCache.value[cid]) {
        const data = await api.jmChapter(aid, cid)
        chapterCache.value = { ...chapterCache.value, [cid]: data }
      }
      reader.value.files = chapterCache.value[cid].page_arr || []
    } catch (e) {
      reader.value.error = e.message
      reader.value.files = []
    } finally {
      reader.value.loading = false
    }
  }

  function setPage(i) {
    const r = reader.value
    if (!r || r.files.length === 0) return
    if (i < 0 || i >= r.files.length) return
    r.page = i
  }
  function nextPage() { setPage(reader.value ? reader.value.page + 1 : 0) }
  function prevPage() { setPage(reader.value ? reader.value.page - 1 : 0) }
  function toggleFit() {
    if (reader.value) {
      reader.value.fitMode = reader.value.fitMode === 'width' ? 'height' : 'width'
    }
  }

  async function deleteLibrary(aid) {
    await api.jmDeleteLibrary(aid)
    await refreshLibrary()
  }

  return {
    libraryCache,
    downloads,
    batch,
    reader,
    readerAlbum,
    popupAid,
    searchMode,
    searchKeyword,
    searchPage,
    searchPageCount,
    searchItems,
    searchLoading,
    searchError,
    doSearch,
    refreshLibrary,
    startDownload,
    getDownload: pollOnce,
    ensurePolling,
    startBatch,
    stopBatch,
    getBatch: pollBatch,
    stopBatchPolling,
    loadAlbum,
    openAlbumInReader,
    openChapter,
    setPage,
    nextPage,
    prevPage,
    toggleFit,
    deleteLibrary,
    openPopup: (aid) => { popupAid.value = aid },
    closePopup: () => { popupAid.value = null },
  }
}
