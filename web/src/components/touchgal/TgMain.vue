<script setup>
import { ref } from 'vue'
import TgSearch from './TgSearch.vue'
import TgRecognize from './TgRecognize.vue'
import TgSettings from './TgSettings.vue'

const tab = ref('search')
const tabs = [
  { key: 'search', label: '搜索游戏' },
  { key: 'recognize', label: '图片识别' },
  { key: 'settings', label: '设置' },
]
</script>

<template>
  <div>
    <h1>TouchGal 游戏查找</h1>
    <div class="subtitle">Galgame 资源搜索、下载与图片识别</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <TgSearch v-if="tab === 'search'" />
    <TgRecognize v-else-if="tab === 'recognize'" />
    <TgSettings v-else />
  </div>
</template>
