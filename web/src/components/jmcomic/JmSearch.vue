<script setup>
import { computed } from 'vue'
import { api } from '../../api'
import { useJmcomic } from '../../stores/jmcomic'

const {
  downloads,
  libraryCache,
  searchMode,
  searchKeyword,
  searchPage,
  searchPageCount,
  searchItems,
  searchLoading,
  searchError,
  doSearch,
  refreshLibrary,
  openPopup,
  openAlbumInReader,
  startDownload,
} = useJmcomic()
const emit = defineEmits(['read'])

const MODES = [
  { key: 'keyword', label: '关键词' },
  { key: 'author', label: '作者' },
  { key: 'tag', label: '标签' },
  { key: 'work', label: '作品名' },
  { key: 'id', label: 'ID' },
]

const placeholder = computed(() => searchMode.value === 'tag' ? '多标签用逗号分隔，如：黑丝,制服' : '搜索...')

function badgeText(item) {
  const d = downloads.value[item.id]
  if (d && d.status === 'completed') return '已缓存'
  if (d && d.status === 'downloading') {
    return d.total > 0 ? `已下载 ${d.downloaded}/${d.total} 张` : '下载中'
  }
  return libraryCache.value[item.id] ? '已缓存' : '下载'
}

async function onSearch(pg) {
  const opened = await doSearch(pg)
  if (opened) emit('read')
}

function onBadge(item) {
  const d = downloads.value[item.id]
  const cached = (d && d.status === 'completed') || !!libraryCache.value[item.id]
  if (cached) {
    openAlbumInReader(item.id).catch(() => {})
  } else {
    startDownload(item.id)
    openAlbumInReader(item.id).catch(() => {})
  }
  emit('read')
}
</script>

<template>
  <div>
    <div class="search-bar">
      <select v-model="searchMode" class="select">
        <option v-for="m in MODES" :key="m.key" :value="m.key">{{ m.label }}</option>
      </select>
      <input
        v-model="searchKeyword"
        class="input"
        type="text"
        :placeholder="placeholder"
        @keydown.enter="onSearch(1)"
      />
      <button class="btn btn-primary" :disabled="searchLoading" @click="onSearch(1)">{{ searchLoading ? '搜索中...' : '搜索' }}</button>
    </div>

    <div v-if="searchLoading" class="loading"><div class="spinner"></div>搜索中...</div>
    <div v-else-if="searchError && !searchItems.length" class="error">{{ searchError }}</div>

    <template v-if="searchItems.length">
      <div class="card-grid">
        <div
          v-for="item in searchItems"
          :key="item.id"
          class="card"
          @click="openPopup(item.id)"
        >
          <div class="card-cover">
            <img
              :src="api.jmCover(item.id)"
              loading="lazy"
              @error="$event.target.style.display='none'"
            />
            <span class="badge" @click.stop="onBadge(item)">{{ badgeText(item) }}</span>
          </div>
          <div class="card-body">
            <div class="card-title" :title="item.name">{{ item.name }}</div>
            <div class="card-meta">{{ item.author || '未知作者' }}</div>
            <div v-if="item.tags && item.tags.length" class="card-tags">
              <span v-for="t in item.tags.slice(0, 3)" :key="t" class="tag-chip tag-chip-sm">{{ t }}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:center;align-items:center;margin-top:16px;">
        <button v-if="searchPage > 1" class="btn btn-ghost btn-sm" @click="onSearch(searchPage - 1)">上一页</button>
        <span class="status-line">第 {{ searchPage }}/{{ searchPageCount }} 页</span>
        <button v-if="searchPage < searchPageCount" class="btn btn-ghost btn-sm" @click="onSearch(searchPage + 1)">下一页</button>
      </div>
    </template>

    <div v-else-if="!searchLoading && !searchError" class="empty">输入关键词开始搜索</div>
  </div>
</template>
