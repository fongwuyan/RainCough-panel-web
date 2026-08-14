<script setup>
import { ref } from 'vue'
import JmSearch from './JmSearch.vue'
import JmLibrary from './JmLibrary.vue'
import JmBatch from './JmBatch.vue'
import JmReader from './JmReader.vue'
import JmAlbumPopup from './JmAlbumPopup.vue'
import { useJmcomic } from '../../stores/jmcomic'

const jm = useJmcomic()
const tab = ref('search')
const tabs = [
  { key: 'search', label: '搜索' },
  { key: 'batch', label: '批量下载' },
  { key: 'library', label: '本子库' },
  { key: 'reader', label: '阅读器' },
]

function switchTab(t) {
  tab.value = t
  if (t === 'library') jm.refreshLibrary()
}

function openReader() { tab.value = 'reader' }
</script>

<template>
  <div>
    <h1>JMComic 禁漫天堂</h1>
    <div class="subtitle">搜索和阅读禁漫漫画</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="switchTab(t.key)"
      >{{ t.label }}</button>
    </div>

    <JmSearch v-if="tab === 'search'" @read="openReader" />
    <JmBatch v-else-if="tab === 'batch'" />
    <JmLibrary v-else-if="tab === 'library'" @read="openReader" />
    <JmReader v-else />

    <JmAlbumPopup @read="openReader" />
  </div>
</template>
