<script setup>
import { ref } from 'vue'
import LsFetch from './LsFetch.vue'
import LsHistory from './LsHistory.vue'
import LsSettings from './LsSettings.vue'

const tab = ref('fetch')
const tabs = [
  { key: 'fetch', label: '获取涩图' },
  { key: 'history', label: '历史' },
  { key: 'settings', label: '设置' },
]
</script>

<template>
  <div>
    <h1>来张涩图</h1>
    <div class="subtitle">Lolicon API - 随机 Pixiv 涩图</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <LsFetch v-if="tab === 'fetch'" />
    <LsHistory v-else-if="tab === 'history'" />
    <LsSettings v-else />
  </div>
</template>
