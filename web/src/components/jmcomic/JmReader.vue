<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { api } from '../../api'
import { useJmcomic } from '../../stores/jmcomic'
import { usePreview } from '../../stores/preview'

const jm = useJmcomic()
const preview = usePreview()

const r = computed(() => jm.reader.value)
const album = computed(() => jm.readerAlbum.value)
const albumAid = computed(() => (album.value ? String(album.value.id || album.value.aid || '') : ''))
const dl = computed(() => (albumAid.value ? jm.downloads.value[albumAid.value] : null))
const isCached = computed(() => {
  if (!albumAid.value) return false
  if (dl.value && dl.value.status === 'completed') return true
  return !!jm.libraryCache.value[albumAid.value]
})

const imgLoading = ref(false)
const imgError = ref(false)
const retryNonce = ref(0)
const imgWrap = ref(null)
const isFullscreen = ref(false)
let touchX = 0

const pageSrc = computed(() => {
  const cur = r.value
  if (!cur || !cur.cid || !cur.files.length) return ''
  return api.jmImage(cur.aid, cur.cid, cur.files[cur.page])
})

watch(pageSrc, () => {
  if (!pageSrc.value) return
  imgLoading.value = true
  imgError.value = false
})

function onImgLoad() { imgLoading.value = false; imgError.value = false }
function onImgError() { imgLoading.value = false; imgError.value = true }
function retry() { retryNonce.value++; imgLoading.value = true; imgError.value = false }

watch(
  () => [r.value && r.value.page, r.value && r.value.cid],
  () => {
    const cur = r.value
    if (!cur || !cur.files.length) return
    for (const off of [-2, -1, 1, 2]) {
      const i = cur.page + off
      if (i >= 0 && i < cur.files.length) {
        new Image().src = api.jmImage(cur.aid, cur.cid, cur.files[i])
      }
    }
  }
)

function startDownload() {
  if (albumAid.value) {
    jm.startDownload(albumAid.value)
    jm.ensurePolling(albumAid.value)
  }
}

function onImgClick(e) {
  if (e.target.closest('.reader-nav')) return
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  if (x < rect.width * 0.4) jm.prevPage()
  else if (x > rect.width * 0.6) jm.nextPage()
}

function onTouchStart(e) { touchX = e.changedTouches[0].clientX }
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchX
  if (Math.abs(dx) > 60) {
    if (dx > 0) jm.prevPage()
    else jm.nextPage()
  }
}

function toggleFullscreen() {
  if (!imgWrap.value) return
  if (document.fullscreenElement) document.exitFullscreen()
  else imgWrap.value.requestFullscreen()
}

function onFsChange() { isFullscreen.value = !!document.fullscreenElement }

function onKey(e) {
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
  if (!r.value || !r.value.cid) return
  if (preview.show.value) return
  if (e.key === 'ArrowLeft') { e.preventDefault(); jm.prevPage() }
  if (e.key === 'ArrowRight') { e.preventDefault(); jm.nextPage() }
  if (e.key === 'f' || e.key === 'F') toggleFullscreen()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('fullscreenchange', onFsChange)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('fullscreenchange', onFsChange)
})
</script>

<template>
  <div>
    <div v-if="!r" class="empty">从搜索或本子库选择一个漫画开始阅读</div>

    <template v-else>
      <template v-if="album">
        <div class="section">
          <h2 style="margin-bottom:8px;">{{ album.name }}</h2>
          <div class="status-line" style="margin-bottom:8px;">
            <template v-if="album.author">作者: {{ album.author }}</template>
            <template v-if="album.likes"> | 喜欢: {{ album.likes }}</template>
            <template v-if="album.views"> | 浏览: {{ album.views }}</template>
          </div>
          <div v-if="album.tags && album.tags.length" style="margin-bottom:8px;">
            <span v-for="t in album.tags" :key="t" class="tag-chip tag-chip-sm">{{ t }}</span>
          </div>
          <p v-if="album.description" class="mono-block" style="margin-bottom:12px;">{{ album.description }}</p>
          <button
            class="btn btn-primary"
            :disabled="isCached || (dl && dl.status === 'downloading')"
            @click="startDownload"
          >
            {{
              isCached
                ? '已完成'
                : dl && dl.status === 'downloading'
                  ? (dl.total > 0 ? `已下载 ${dl.downloaded}/${dl.total} 张` : '下载中')
                  : '下载本子'
            }}
          </button>
        </div>

        <div class="section">
          <div class="section-title">章节列表 ({{ album.chapters.length }})</div>
          <div
            v-for="ch in album.chapters"
            :key="ch.cid"
            class="result-item"
            :style="{ borderLeftColor: r.cid === ch.cid ? 'var(--accent)' : 'var(--border)' }"
            @click="jm.openChapter(ch.cid, ch.name)"
          >
            <div class="name">{{ ch.name }}</div>
          </div>
        </div>
      </template>

      <template v-if="r.cid">
        <div class="section" style="padding:0;background:#000;border-color:#000;">
          <div class="reader-top">
            <span class="status-line">{{ r.name }}</span>
          </div>
          <div class="reader-view">
            <div
              ref="imgWrap"
              class="reader-image-wrap"
              :class="{ 'fit-height': r.fitMode === 'height' }"
              @click="onImgClick"
              @touchstart.passive="onTouchStart"
              @touchend.passive="onTouchEnd"
            >
              <img
                v-if="!imgError && pageSrc"
                :key="r.page + '-' + retryNonce"
                :src="pageSrc"
                draggable="false"
                @load="onImgLoad"
                @error="onImgError"
              />
              <div v-if="imgLoading" class="reader-overlay">
                <div class="spinner"></div>
                <span>加载中...</span>
              </div>
              <div v-else-if="imgError" class="reader-overlay" style="cursor:pointer;" @click="retry">
                <span>加载失败，点击重试</span>
              </div>
              <span class="reader-page-num">{{ r.page + 1 }}</span>
            </div>
          </div>
          <div class="reader-nav" v-show="!isFullscreen">
            <button
              v-show="r.page > 0"
              class="btn btn-ghost btn-sm"
              @click="jm.prevPage"
            >上一页</button>
            <span class="status-line">{{ r.page + 1 }} / {{ r.files.length }}</span>
            <button
              v-show="r.page < r.files.length - 1"
              class="btn btn-ghost btn-sm"
              @click="jm.nextPage"
            >下一页</button>
            <button class="btn btn-ghost btn-sm" @click="toggleFullscreen">全屏</button>
            <button class="btn btn-ghost btn-sm" @click="jm.toggleFit">
              {{ r.fitMode === 'width' ? '适应高度' : '适应宽度' }}
            </button>
          </div>
        </div>
      </template>

      <div v-if="r && !r.cid" class="empty">选择上方章节开始阅读</div>
    </template>
  </div>
</template>

<style scoped>
.reader-top {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.reader-view {
  height: calc(100vh - 320px);
  min-height: 300px;
  background: #000;
}
.reader-image-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}
.reader-image-wrap img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  animation: reader-fade 180ms ease;
}
.reader-image-wrap.fit-height img {
  height: 100%;
  width: auto;
  max-width: none;
}
@keyframes reader-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.reader-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}
.reader-page-num {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 2px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text);
  background: rgba(13, 17, 23, 0.85);
  border: 1px solid var(--border-strong);
}
.reader-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  background: var(--surface);
  border-top: 1px solid var(--border);
}
</style>
