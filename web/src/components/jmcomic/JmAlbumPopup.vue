<script setup>
import { ref, computed, watch } from 'vue'
import { useJmcomic } from '../../stores/jmcomic'

const jm = useJmcomic()
const emit = defineEmits(['read'])

const aid = computed(() => jm.popupAid.value)
const album = ref(null)
const loading = ref(false)
const error = ref('')

const dl = computed(() => (aid.value ? jm.downloads.value[aid.value] : null))
const isCached = computed(() => {
  if (!aid.value) return false
  if (dl.value && dl.value.status === 'completed') return true
  return !!jm.libraryCache.value[aid.value]
})

async function load() {
  if (!aid.value) return
  album.value = null
  error.value = ''
  loading.value = true
  try {
    album.value = await jm.loadAlbum(aid.value)
    if (dl.value) jm.ensurePolling(aid.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function download() {
  if (aid.value) jm.startDownload(aid.value)
}

function read() {
  const id = aid.value
  if (!id) return
  jm.openAlbumInReader(id).catch(() => {})
  jm.closePopup()
  emit('read')
}

watch(aid, load)
</script>

<template>
  <transition name="fade">
    <div v-if="aid" class="overlay" @click.self="jm.closePopup()">
      <div class="modal" style="max-width:440px;">
        <div class="modal-header">
          <h2>#{{ aid }}</h2>
          <button class="btn btn-ghost btn-sm" @click="jm.closePopup()">关闭</button>
        </div>
        <div class="modal-body">
          <div v-if="loading" class="loading"><div class="spinner"></div>加载中...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <template v-else-if="album">
            <div style="font-size:14px;font-weight:700;line-height:1.5;">
              {{ album.name }}<span v-if="album.author" class="status-line"> · {{ album.author }}</span>
            </div>
            <div v-if="album.tags && album.tags.length" style="margin-top:8px;">
              <span v-for="t in album.tags" :key="t" class="tag-chip tag-chip-sm">{{ t }}</span>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;">
              <button
                class="btn btn-primary"
                :disabled="isCached || (dl && dl.status === 'downloading')"
                @click="download"
              >
                {{
                  isCached
                    ? '已完成'
                    : dl && dl.status === 'downloading'
                      ? (dl.total > 0 ? `已下载 ${dl.downloaded}/${dl.total} 张` : '下载中')
                      : '下载本子'
                }}
              </button>
              <button class="btn btn-ghost" @click="read">阅读</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>
